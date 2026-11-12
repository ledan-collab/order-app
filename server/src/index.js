import 'dotenv/config'
import express from 'express'
import { ensureDatabase, pool } from './db.js'

const app = express()
const port = 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'COZY server is running' })
})

try {
  await ensureDatabase()
  const { rows } = await pool.query('SELECT current_database() AS database')
  console.log(`데이터베이스에 연결했습니다: ${rows[0].database}`)
} catch (error) {
  console.error(`데이터베이스 연결에 실패했습니다: ${error.message}`)
  process.exit(1)
}

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
