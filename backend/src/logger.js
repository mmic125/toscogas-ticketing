const winston = require('winston')
const db = require('./db')

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: '/var/log/app/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,  // 10MB
      maxFiles: 12,                // 12 mesi di log per NIS2
    }),
    new winston.transports.File({
      filename: '/var/log/app/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 12,
    }),
  ],
})

// Audit log NIS2: persiste nel DB
async function audit(userId, action, resource, resourceId, details, req) {
  const ip = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req?.socket?.remoteAddress
  const ua = req?.headers?.['user-agent']

  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, resource, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, action, resource || null, resourceId || null,
       details ? JSON.stringify(details) : null, ip || null, ua || null]
    )
  } catch (err) {
    logger.error('Failed to write audit log', { err: err.message, action, userId })
  }
}

module.exports = { logger, audit }
