import { pool } from './db.js'

const MENUS = [
  {
    name: '아메리카노(ICE)',
    description: '에스프레소에 찬물을 더해 깔끔하게 마시는 아이스 커피',
    price: 4000,
    image: '/images/americano-ice.jpg',
    stock: 10,
  },
  {
    name: '아메리카노(HOT)',
    description: '뜨거운 물에 에스프레소를 더한 기본 커피',
    price: 4000,
    image: '/images/americano-hot.jpg',
    stock: 10,
  },
  {
    name: '카페라떼',
    description: '에스프레소와 스팀 밀크를 부드럽게 섞은 라떼',
    price: 5000,
    image: '/images/cafe-latte.jpg',
    stock: 10,
  },
]

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      description text NOT NULL,
      price integer NOT NULL CHECK (price >= 0),
      image text NOT NULL,
      stock integer NOT NULL CHECK (stock >= 0)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS options (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      menu_id integer NOT NULL REFERENCES menus (id),
      name text NOT NULL,
      price integer NOT NULL CHECK (price >= 0)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      ordered_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT '주문 접수' CHECK (status IN ('주문 접수', '제조 중', '완료')),
      total integer NOT NULL CHECK (total >= 0)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
      menu_id integer NOT NULL REFERENCES menus (id),
      menu_name text NOT NULL,
      quantity integer NOT NULL CHECK (quantity >= 1),
      line_price integer NOT NULL CHECK (line_price >= 0),
      option_names text[] NOT NULL DEFAULT '{}',
      option_prices integer[] NOT NULL DEFAULT '{}'
    )
  `)

  const count = await pool.query('SELECT COUNT(*)::int AS count FROM menus')
  if (count.rows[0].count > 0) {
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const menu of MENUS) {
      const inserted = await client.query(
        `INSERT INTO menus (name, description, price, image, stock)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [menu.name, menu.description, menu.price, menu.image, menu.stock],
      )
      await client.query(
        `INSERT INTO options (menu_id, name, price)
         VALUES ($1, '샷 추가', 500), ($1, '시럽 추가', 0)`,
        [inserted.rows[0].id],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
