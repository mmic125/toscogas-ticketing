const jwt = require('jsonwebtoken')
const fs  = require('fs')
const db  = require('../db')

let _publicKey = null

function getPublicKey() {
  if (!_publicKey) {
    _publicKey = fs.readFileSync('/run/secrets/jwt_public_key', 'utf8')
  }
  return _publicKey
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] })

    // Verifica che l'utente esista ancora e sia attivo
    const { rows } = await db.query(
      `SELECT p.id, p.ruolo, p.attivo, u.locked_until
       FROM profiles p
       JOIN users u ON u.id = p.id
       WHERE p.id = $1`,
      [payload.sub]
    )

    const utente = rows[0]
    if (!utente || !utente.attivo) {
      return res.status(401).json({ error: 'Utente non autorizzato' })
    }
    if (utente.locked_until && new Date(utente.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporaneamente bloccato' })
    }

    req.user = {
      id:    payload.sub,
      email: payload.email,
      ruolo: utente.ruolo,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido o scaduto' })
  }
}

function requireRuolo(...ruoli) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non autenticato' })
    if (!ruoli.includes(req.user.ruolo)) {
      return res.status(403).json({ error: 'Accesso non consentito per questo ruolo' })
    }
    next()
  }
}

module.exports = { authenticate, requireRuolo }
