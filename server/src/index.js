import 'dotenv/config'
import express from 'express'
import { ensureDatabase, pool } from './db.js'
import { HttpError } from './http.js'
import { api } from './routes.js'
import { ensureSchema } from './schema.js'

const app = express()
const port = 3000

app.use(express.json())
app.get('/', (req, res) => {
  res.json({ message: 'COZY server is running' })
})
app.use('/api', api)
app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error)
    return
  }
  const status = error instanceof HttpError ? error.status : 500
  const message = error instanceof HttpError ? error.message : '서버 오류가 발생했습니다.'
  if (status === 500) {
    console.error(error)
  }
  res.status(status).json({ message })
})

try {
  await ensureDatabase()
  await ensureSchema()
  const { rows } = await pool.query('SELECT current_database() AS database')
  console.log(`데이터베이스에 연결했습니다: ${rows[0].database}`)
} catch (error) {
  console.error(`데이터베이스 연결에 실패했습니다: ${error.message}`)
  process.exit(1)
}

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
