const express = require('express')
const db      = require('../db')
const { logger } = require('../logger')
const { authenticate } = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)

// ─── GET /api/ticket-foto ────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let where  = ''
    let values = []

    if (req.query.ticket_id) {
      const raw = req.query.ticket_id
      const id  = raw.startsWith('eq.') ? raw.slice(3) : raw
      where  = 'WHERE ticket_id = $1'
      values = [id]
    }

    const order = req.query.order === 'ordine.asc' ? 'ORDER BY ordine ASC' : 'ORDER BY ordine ASC'

    const { rows } = await db.query(
      `SELECT * FROM ticket_foto ${where} ${order}`,
      values
    )
    res.json(rows)
  } catch (err) {
    logger.error('GET /ticket-foto error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /api/ticket-foto ───────────────────────────────────
router.post('/', async (req, res) => {
  const { ticket_id, storage_path, ordine } = req.body || {}
  if (!ticket_id || !storage_path) {
    return res.status(400).json({ error: 'ticket_id e storage_path obbligatori' })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO ticket_foto (ticket_id, storage_path, ordine) VALUES ($1, $2, $3) RETURNING *`,
      [ticket_id, storage_path, ordine ?? 0]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    logger.error('POST /ticket-foto error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
