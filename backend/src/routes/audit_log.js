const express = require('express')
const db      = require('../db')
const { logger } = require('../logger')
const { authenticate, requireRuolo } = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)
router.use(requireRuolo('amministratore'))

// ─── GET /api/audit-log?data_da=YYYY-MM-DD&data_a=YYYY-MM-DD ──
router.get('/', async (req, res) => {
  try {
    const conditions = []
    const values     = []
    let   idx        = 1

    if (req.query.data_da) {
      conditions.push(`al.created_at >= $${idx++}::date`)
      values.push(req.query.data_da)
    }
    if (req.query.data_a) {
      conditions.push(`al.created_at < $${idx++}::date + interval '1 day'`)
      values.push(req.query.data_a)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await db.query(
      `SELECT al.id, al.action, al.resource, al.resource_id, al.details,
              al.ip_address, al.created_at,
              p.nome, p.cognome, p.email
       FROM audit_log al
       LEFT JOIN profiles p ON p.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT 5000`,
      values
    )
    res.json(rows)
  } catch (err) {
    logger.error('GET /audit-log error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
