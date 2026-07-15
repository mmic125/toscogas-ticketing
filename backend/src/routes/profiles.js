const express = require('express')
const argon2  = require('@node-rs/argon2')
const db      = require('../db')
const { audit, logger } = require('../logger')
const { authenticate, requireRuolo } = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)

const ARGON2_OPTIONS = { memoryCost: 65536, timeCost: 3, parallelism: 4 }

// ─── GET /api/profiles ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let conditions = []
    let values     = []
    let idx        = 1

    if (req.query.ruolo) {
      const raw = req.query.ruolo
      if (raw.startsWith('in.')) {
        const items = raw.slice(3).split(',').filter(Boolean)
        conditions.push(`ruolo = ANY($${idx++}::ruolo_utente[])`)
        values.push(items)
      } else if (raw.startsWith('eq.')) {
        conditions.push(`ruolo = $${idx++}`)
        values.push(raw.slice(3))
      }
    }
    if (req.query.attivo) {
      const val = req.query.attivo === 'eq.true' || req.query.attivo === 'true'
      conditions.push(`attivo = $${idx++}`)
      values.push(val)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const order = req.query.order === 'cognome.asc'
      ? 'ORDER BY cognome ASC, nome ASC'
      : 'ORDER BY cognome ASC, nome ASC'

    const { rows } = await db.query(
      `SELECT p.id, p.email, p.nome, p.cognome, p.ruolo, p.attivo, p.created_at, u.totp_enabled
       FROM profiles p JOIN users u ON u.id = p.id ${where} ${order}`,
      values
    )
    res.json(rows)
  } catch (err) {
    logger.error('GET /profiles error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── GET /api/profiles/:id ───────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email, nome, cognome, ruolo, attivo, created_at FROM profiles WHERE id = $1',
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Profilo non trovato' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── PATCH /api/profiles/:id — solo coordinatore ─────────────
router.patch('/:id', requireRuolo('coordinatore'), async (req, res) => {
  const allowed = ['nome', 'cognome', 'ruolo', 'attivo']
  const updates = []
  const values  = []
  let   idx     = 1

  for (const field of allowed) {
    if (field in req.body) {
      updates.push(`${field} = $${idx++}`)
      values.push(req.body[field] ?? null)
    }
  }

  if (!updates.length) return res.status(400).json({ error: 'Nessun campo' })

  try {
    values.push(req.params.id)
    const { rows } = await db.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )
    await audit(req.user.id, 'PROFILE_UPDATED', 'profiles', req.params.id,
      { fields: Object.keys(req.body) }, req)
    res.json(rows[0])
  } catch (err) {
    logger.error('PATCH /profiles/:id error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /api/admin/users — crea nuovo utente (coordinatore) ─
router.post('/admin/create', requireRuolo('coordinatore'), async (req, res) => {
  const { email, nome, cognome, ruolo } = req.body || {}
  const VALID_RUOLI = ['coordinatore', 'segnalatore', 'manutentore', 'segnalatore_manutentore']

  if (!email || !nome || !cognome || !ruolo) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' })
  }
  if (!VALID_RUOLI.includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido' })
  }

  const TEMP_PASSWORD = 'Temporanea1!'

  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'Email già registrata' })
    }

    const hash = await argon2.hash(TEMP_PASSWORD, ARGON2_OPTIONS)

    const client = await require('../db').pool.connect()
    try {
      await client.query('BEGIN')

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, must_change_pwd) VALUES ($1, $2, true) RETURNING id`,
        [email.toLowerCase(), hash]
      )
      const userId = userRes.rows[0].id

      await client.query(
        `INSERT INTO profiles (id, email, nome, cognome, ruolo) VALUES ($1, $2, $3, $4, $5)`,
        [userId, email.toLowerCase(), nome.trim(), cognome.trim(), ruolo]
      )

      await client.query('COMMIT')
      await audit(req.user.id, 'USER_CREATED', 'users', userId,
        { email, ruolo }, req)

      res.status(201).json({
        id: userId,
        message: `Utente creato. Password temporanea: ${TEMP_PASSWORD}`,
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error('POST /admin/users error', { err: err.message })
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email già registrata' })
    }
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /api/profiles/admin/reset-password — reset password (coordinatore) ─
router.post('/admin/reset-password', requireRuolo('coordinatore'), async (req, res) => {
  const { user_id } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id mancante' })

  const TEMP_PASSWORD = 'Temporanea1!'

  try {
    const existing = await db.query('SELECT id FROM users WHERE id = $1', [user_id])
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Utente non trovato' })
    }

    const hash = await argon2.hash(TEMP_PASSWORD, ARGON2_OPTIONS)

    await db.query(
      `UPDATE users
       SET password_hash = $1, must_change_pwd = true, failed_attempts = 0, locked_until = NULL
       WHERE id = $2`,
      [hash, user_id]
    )

    await audit(req.user.id, 'PASSWORD_RESET_BY_ADMIN', 'users', user_id, {}, req)

    res.json({ message: `Password reimpostata. Password temporanea: ${TEMP_PASSWORD}` })
  } catch (err) {
    logger.error('POST /admin/reset-password error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
