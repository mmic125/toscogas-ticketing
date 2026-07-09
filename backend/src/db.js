const { Pool, types } = require('pg')

// Le colonne DATE (OID 1082) vanno restituite come stringa 'YYYY-MM-DD',
// non come oggetto Date: altrimenti JSON.stringify le serializza con
// .toISOString() aggiungendo un orario fittizio (T00:00:00.000Z).
types.setTypeParser(1082, val => val)

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
