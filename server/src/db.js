import pg from 'pg'

const { Pool } = pg

function hostName() {
  return (process.env.PGHOST ?? '').replace(/^@/, '')
}

function poolConfig(database) {
  const host = hostName()
  const config = {
    host,
    port: Number(process.env.PGPORT),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database,
    connectionTimeoutMillis: 15000,
  }
  if (host.endsWith('.render.com')) {
    config.ssl = { rejectUnauthorized: false }
  }
  return config
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
  const probe = new Pool(poolConfig(name))
  try {
    await probe.query('SELECT 1')
    return
  } catch (error) {
    if (error.code !== '3D000') {
      throw error
    }
  } finally {
    await probe.end()
  }

  const admin = new Pool(poolConfig('postgres'))
  try {
    await admin.query(`CREATE DATABASE ${name}`)
  } finally {
    await admin.end()
  }
}

export const pool = new Pool(poolConfig(process.env.PGDATABASE))
