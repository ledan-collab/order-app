import { pool } from './db.js'
import { HttpError } from './http.js'

const NEXT_STATUS = {
  '주문 접수': '제조 중',
  '제조 중': '완료',
}

const ORDER_SQL = `
  SELECT
    o.id,
    o.ordered_at,
    o.status,
    o.total,
    i.id AS item_id,
    i.menu_id,
    i.menu_name,
    i.quantity,
    i.line_price,
    i.option_names
  FROM orders o
  LEFT JOIN order_items i ON i.order_id = o.id
`

function groupOrders(rows) {
  const orders = []
  const index = new Map()
  for (const row of rows) {
    let order = index.get(row.id)
    if (!order) {
      order = {
        id: row.id,
        orderedAt: new Date(row.ordered_at).toISOString(),
        status: row.status,
        total: row.total,
        items: [],
      }
      index.set(row.id, order)
      orders.push(order)
    }
    if (row.item_id != null) {
      order.items.push({
        menuId: row.menu_id,
        menuName: row.menu_name,
        quantity: row.quantity,
        optionNames: row.option_names ?? [],
        linePrice: row.line_price,
      })
    }
  }
  return orders
}

export function parseItems(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, '주문 항목이 없습니다.')
  }
  return body.items.map((item) => {
    const menuId = item?.menuId
    const quantity = item?.quantity
    const optionIds = item?.optionIds ?? []
    if (!Number.isInteger(menuId) || menuId <= 0) {
      throw new HttpError(400, '메뉴 정보가 올바르지 않습니다.')
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new HttpError(400, '수량은 1 이상이어야 합니다.')
    }
    if (!Array.isArray(optionIds) || optionIds.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new HttpError(400, '옵션 정보가 올바르지 않습니다.')
    }
    if (new Set(optionIds).size !== optionIds.length) {
      throw new HttpError(400, '같은 옵션을 중복해서 선택할 수 없습니다.')
    }
    return { menuId, quantity, optionIds }
  })
}

export async function listOrders() {
  const result = await pool.query(
    `${ORDER_SQL} ORDER BY o.ordered_at DESC, o.id DESC, i.id ASC`,
  )
  return groupOrders(result.rows)
}

export async function getOrder(id) {
  const result = await pool.query(`${ORDER_SQL} WHERE o.id = $1 ORDER BY i.id`, [id])
  const orders = groupOrders(result.rows)
  if (orders.length === 0) {
    throw new HttpError(404, '없는 주문입니다.')
  }
  return orders[0]
}

export async function createOrder(body) {
  const items = parseItems(body)
  const client = await pool.connect()
  let orderId
  try {
    await client.query('BEGIN')
    const menuIds = [...new Set(items.map((item) => item.menuId))]
    const menuResult = await client.query(
      'SELECT id, name, price, stock FROM menus WHERE id = ANY($1::int[]) FOR UPDATE',
      [menuIds],
    )
    const menus = new Map(menuResult.rows.map((row) => [row.id, row]))
    for (const item of items) {
      if (!menus.has(item.menuId)) {
        throw new HttpError(404, '없는 메뉴입니다.')
      }
    }

    const optionIds = [...new Set(items.flatMap((item) => item.optionIds))]
    const options = new Map()
    if (optionIds.length > 0) {
      const optionResult = await client.query(
        'SELECT id, menu_id, name, price FROM options WHERE id = ANY($1::int[])',
        [optionIds],
      )
      for (const row of optionResult.rows) {
        options.set(row.id, row)
      }
    }

    const needed = new Map()
    const lines = []
    for (const item of items) {
      const menu = menus.get(item.menuId)
      const chosen = []
      for (const optionId of item.optionIds) {
        const option = options.get(optionId)
        if (!option || option.menu_id !== item.menuId) {
          throw new HttpError(400, '옵션이 그 메뉴에 연결되어 있지 않습니다.')
        }
        chosen.push(option)
      }
      const unitPrice = menu.price + chosen.reduce((sum, option) => sum + option.price, 0)
      lines.push({
        menu,
        quantity: item.quantity,
        optionNames: chosen.map((option) => option.name),
        optionPrices: chosen.map((option) => option.price),
        linePrice: unitPrice * item.quantity,
      })
      needed.set(item.menuId, (needed.get(item.menuId) ?? 0) + item.quantity)
    }

    for (const [menuId, quantity] of needed) {
      if (menus.get(menuId).stock < quantity) {
        throw new HttpError(409, '재고가 부족합니다.')
      }
    }

    const total = lines.reduce((sum, line) => sum + line.linePrice, 0)
    const orderResult = await client.query(
      'INSERT INTO orders (total) VALUES ($1) RETURNING id',
      [total],
    )
    orderId = orderResult.rows[0].id
    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items
           (order_id, menu_id, menu_name, quantity, line_price, option_names, option_prices)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7::integer[])`,
        [
          orderId,
          line.menu.id,
          line.menu.name,
          line.quantity,
          line.linePrice,
          line.optionNames,
          line.optionPrices,
        ],
      )
    }
    for (const [menuId, quantity] of needed) {
      const updated = await client.query(
        `UPDATE menus
         SET stock = stock - $2
         WHERE id = $1 AND stock >= $2
         RETURNING id`,
        [menuId, quantity],
      )
      if (updated.rowCount === 0) {
        throw new HttpError(409, '재고가 부족합니다.')
      }
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return getOrder(orderId)
}

export async function advanceOrder(id) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [id])
    if (current.rowCount === 0) {
      throw new HttpError(404, '없는 주문입니다.')
    }
    const next = NEXT_STATUS[current.rows[0].status]
    if (!next) {
      throw new HttpError(409, '더 이상 상태를 바꿀 수 없습니다.')
    }
    await client.query('UPDATE orders SET status = $2 WHERE id = $1', [id, next])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return getOrder(id)
}
