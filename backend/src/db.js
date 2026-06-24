const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
})

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message)
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}
