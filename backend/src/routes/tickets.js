const express = require('express')
const db      = require('../db')
const { audit, logger } = require('../logger')
const { authenticate, requireRuolo } = require('../middleware/authenticate')

const router = express.Router()
router.use(authenticate)

// ─── Costruisce la WHERE clause dai query params ─────────────
function buildWhere(query, allowedFields) {
  const conditions = []
  const values     = []
  let   idx        = 1

  for (const [field, raw] of Object.entries(query)) {
    if (!allowedFields.includes(field)) continue
    if (!raw) continue

    if (raw.startsWith('eq.')) {
      conditions.push(`t.${field} = $${idx++}`)
      values.push(raw.slice(3))
    } else if (raw.startsWith('neq.')) {
      conditions.push(`t.${field} != $${idx++}`)
      values.push(raw.slice(4))
    } else if (raw.startsWith('in.')) {
      const items = raw.slice(3).split(',').filter(Boolean)
      if (items.length) {
        conditions.push(`t.${field} = ANY($${idx++}::text[])`)
        values.push(items)
      }
    } else if (raw.startsWith('gte.')) {
      conditions.push(`t.${field} >= $${idx++}`)
      values.push(raw.slice(4))
    } else if (raw.startsWith('lte.')) {
      conditions.push(`t.${field} <= $${idx++}`)
      values.push(raw.slice(4))
    }
  }

  return { conditions, values }
}

function buildOrder(orderParam) {
  if (!orderParam) return 'ORDER BY t.created_at DESC'
  const parts = orderParam.split('.')
  const field = parts[0]
  const dir   = parts[1] === 'desc' ? 'DESC' : 'ASC'
  const nulls = parts[2] === 'nullslast' ? 'NULLS LAST' : 'NULLS FIRST'

  const allowed = ['created_at', 'data_apertura', 'data_intervento_richiesta',
                   'priorita', 'stato', 'nome_cliente']
  if (!allowed.includes(field)) return 'ORDER BY t.created_at DESC'
  return `ORDER BY t.${field} ${dir} ${nulls}`
}

const ALLOWED_FILTERS = [
  'stato', 'priorita', 'categoria', 'tipo_problema',
  'manutentore_id', 'segnalatore_id', 'data_apertura',
]

// Join comune per includere nomi segnalatore/manutentore
const TICKET_SELECT = `
  t.*,
  json_build_object('id', sp.id, 'nome', sp.nome, 'cognome', sp.cognome) AS segnalatore,
  CASE WHEN mp.id IS NOT NULL
    THEN json_build_object('id', mp.id, 'nome', mp.nome, 'cognome', mp.cognome)
    ELSE NULL
  END AS manutentore
`
const TICKET_JOINS = `
  FROM tickets t
  LEFT JOIN profiles sp ON sp.id = t.segnalatore_id
  LEFT JOIN profiles mp ON mp.id = t.manutentore_id
`

// ─── GET /api/tickets ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const ruolo = req.user.ruolo
    const { conditions, values } = buildWhere(req.query, ALLOWED_FILTERS)
    const order = buildOrder(req.query.order)

    // I manutentori vedono solo i propri ticket
    if (ruolo === 'manutentore' || ruolo === 'segnalatore_manutentore') {
      const idx = values.length + 1
      conditions.push(`t.manutentore_id = $${idx}`)
      values.push(req.user.id)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await db.query(
      `SELECT ${TICKET_SELECT} ${TICKET_JOINS} ${where} ${order}`,
      values
    )
    res.json(rows)
  } catch (err) {
    logger.error('GET /tickets error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── GET /api/tickets/:id ────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ${TICKET_SELECT} ${TICKET_JOINS} WHERE t.id = $1`,
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Ticket non trovato' })

    const ticket = rows[0]
    const ruolo  = req.user.ruolo

    // Manutentori vedono solo i propri
    if ((ruolo === 'manutentore' || ruolo === 'segnalatore_manutentore')
        && ticket.manutentore_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non consentito' })
    }

    res.json(ticket)
  } catch (err) {
    logger.error('GET /tickets/:id error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /api/tickets ───────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    codice_cliente, nome_cliente, matricola_serbatoio,
    tipo_problema, note_apertura, priorita, categoria,
    provincia, telefono,
  } = req.body || {}

  if (!nome_cliente || !priorita || !tipo_problema) {
    return res.status(400).json({ error: 'Campi obbligatori mancanti' })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO tickets
         (codice_cliente, nome_cliente, matricola_serbatoio, tipo_problema, note_apertura,
          priorita, categoria, provincia, telefono, segnalatore_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [codice_cliente || null, nome_cliente, matricola_serbatoio || null,
       tipo_problema, note_apertura || null, priorita,
       categoria || null, provincia || null, telefono || null, req.user.id]
    )

    await audit(req.user.id, 'TICKET_CREATED', 'tickets', rows[0].id, {}, req)
    res.status(201).json(rows[0])
  } catch (err) {
    logger.error('POST /tickets error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── PATCH /api/tickets/:id ──────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    // Verifica esistenza e permessi
    const check = await db.query('SELECT manutentore_id, stato FROM tickets WHERE id = $1', [req.params.id])
    if (!check.rows[0]) return res.status(404).json({ error: 'Ticket non trovato' })

    const ticket = check.rows[0]
    const ruolo  = req.user.ruolo

    // I manutentori possono aggiornare solo i propri ticket
    if ((ruolo === 'manutentore' || ruolo === 'segnalatore_manutentore')
        && ticket.manutentore_id !== req.user.id) {
      return res.status(403).json({ error: 'Accesso non consentito' })
    }

    // Campi aggiornabili per ruolo
    const COORD_FIELDS = [
      'codice_cliente', 'nome_cliente', 'matricola_serbatoio', 'tipo_problema',
      'priorita', 'categoria', 'provincia', 'telefono', 'note_apertura',
      'note_intervento', 'materiale_utilizzato', 'manutentore_id',
      'data_intervento_richiesta', 'stato',
    ]
    const MAN_FIELDS = [
      'codice_cliente', 'nome_cliente', 'telefono', 'provincia',
      'matricola_serbatoio', 'note_intervento', 'materiale_utilizzato',
      'stato', 'data_intervento',
    ]

    const allowed = ruolo === 'coordinatore' ? COORD_FIELDS : MAN_FIELDS
    const updates = []
    const values  = []
    let   idx     = 1

    for (const field of allowed) {
      if (field in req.body) {
        updates.push(`${field} = $${idx++}`)
        values.push(req.body[field] ?? null)
      }
    }

    if (!updates.length) return res.status(400).json({ error: 'Nessun campo da aggiornare' })

    values.push(req.params.id)
    const { rows } = await db.query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )

    await audit(req.user.id, 'TICKET_UPDATED', 'tickets', req.params.id,
      { fields: Object.keys(req.body) }, req)
    res.json(rows[0])
  } catch (err) {
    logger.error('PATCH /tickets/:id error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
