import pg from 'pg'

const { Pool } = pg

const config = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
}

function databaseName() {
  const name = process.env.PGDATABASE
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name ?? '')) {
    throw new Error(`PGDATABASE 값이 올바르지 않습니다: ${name}`)
  }
  return name
}

export async function ensureDatabase() {
  const name = databaseName()
  const admin = new Pool({ ...config, database: 'postgres' })
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${name}`)
    }
  } finally {
    await admin.end()
  }
}

export const pool = new Pool({
  ...config,
  database: process.env.PGDATABASE,
})
