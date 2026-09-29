const express = require('express')
const db      = require('../db')
const { audit, logger } = require('../logger')
const { authenticate, requireRuolo } = require('../middleware/authenticate')
const { getPasswordPolicy } = require('../passwordPolicy')

const router = express.Router()
router.use(authenticate)

const EDITABLE_FIELDS = [
  'min_length', 'require_uppercase', 'min_uppercase',
  'require_special', 'min_special', 'require_digit', 'min_digit',
  'avoid_ambiguous_common', 'validity_days',
]

// ─── GET /api/password-policy — leggibile da chiunque sia loggato ─
// (serve al form di cambio password per mostrare i requisiti correnti)
router.get('/', async (req, res) => {
  try {
    const policy = await getPasswordPolicy()
    res.json(policy)
  } catch (err) {
    logger.error('GET /password-policy error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── PUT /api/password-policy — solo amministratore ──────────
router.put('/', requireRuolo('amministratore'), async (req, res) => {
  const updates = []
  const values  = []
  let   idx     = 1

  for (const field of EDITABLE_FIELDS) {
    if (field in req.body) {
      updates.push(`${field} = $${idx++}`)
      values.push(req.body[field] ?? null)
    }
  }

  if (!updates.length) return res.status(400).json({ error: 'Nessun campo da aggiornare' })
  updates.push('updated_at = NOW()')

  try {
    const { rows } = await db.query(
      `UPDATE password_policy SET ${updates.join(', ')} WHERE id = 1 RETURNING *`,
      values
    )
    await audit(req.user.id, 'PASSWORD_POLICY_UPDATED', 'password_policy', null,
      { fields: Object.keys(req.body) }, req)
    res.json(rows[0])
  } catch (err) {
    logger.error('PUT /password-policy error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
