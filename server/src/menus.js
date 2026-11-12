import { pool } from './db.js'
import { HttpError } from './http.js'

const MENU_SQL = `
  SELECT
    m.id,
    m.name,
    m.description,
    m.price,
    m.image,
    m.stock,
    o.id AS option_id,
    o.name AS option_name,
    o.price AS option_price
  FROM menus m
  LEFT JOIN options o ON o.menu_id = m.id
`

function groupMenus(rows) {
  const menus = []
  const index = new Map()
  for (const row of rows) {
    let menu = index.get(row.id)
    if (!menu) {
      menu = {
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        image: row.image,
        stock: row.stock,
        options: [],
      }
      index.set(row.id, menu)
      menus.push(menu)
    }
    if (row.option_id != null) {
      menu.options.push({
        id: row.option_id,
        name: row.option_name,
        price: row.option_price,
      })
    }
  }
  return menus
}

export async function listMenus() {
  const result = await pool.query(`${MENU_SQL} ORDER BY m.id, o.id`)
  return groupMenus(result.rows)
}

export async function getMenu(id) {
  const result = await pool.query(`${MENU_SQL} WHERE m.id = $1 ORDER BY o.id`, [id])
  const menus = groupMenus(result.rows)
  if (menus.length === 0) {
    throw new HttpError(404, '없는 메뉴입니다.')
  }
  return menus[0]
}

export async function changeStock(id, body) {
  const delta = body?.delta
  if (delta !== 1 && delta !== -1) {
    throw new HttpError(400, '재고는 1개씩만 바꿀 수 있습니다.')
  }
  const updated = await pool.query(
    `UPDATE menus
     SET stock = stock + $2
     WHERE id = $1 AND stock + $2 >= 0
     RETURNING id`,
    [id, delta],
  )
  if (updated.rowCount === 0) {
    const existing = await pool.query('SELECT id FROM menus WHERE id = $1', [id])
    if (existing.rowCount === 0) {
      throw new HttpError(404, '없는 메뉴입니다.')
    }
    throw new HttpError(400, '재고는 0개보다 작아질 수 없습니다.')
  }
  return getMenu(id)
}
