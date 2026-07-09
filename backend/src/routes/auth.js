const express   = require('express')
const argon2    = require('@node-rs/argon2')
const jwt       = require('jsonwebtoken')
const crypto    = require('crypto')
const fs        = require('fs')
const nodemailer = require('nodemailer')
const db        = require('../db')
const { audit, logger } = require('../logger')
const { authenticate }  = require('../middleware/authenticate')
const { authenticator } = require('otplib')
const QRCode            = require('qrcode')

const router = express.Router()

// ─── Chiavi RSA ─────────────────────────────────────────────
let _privateKey = null
let _publicKey  = null

function getPrivateKey() {
  if (!_privateKey) _privateKey = fs.readFileSync('/run/secrets/jwt_private_key', 'utf8')
  return _privateKey
}
function getPublicKey() {
  if (!_publicKey) _publicKey = fs.readFileSync('/run/secrets/jwt_public_key', 'utf8')
  return _publicKey
}

// ─── Generazione token ───────────────────────────────────────
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, ruolo: user.ruolo },
    getPrivateKey(),
    { algorithm: 'RS256', expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m', issuer: 'toscogas-ticketing' }
  )
}

async function createRefreshToken(userId, req) {
  const raw  = crypto.randomBytes(48).toString('base64url')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const exp  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress
  const ua = req.headers['user-agent']

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, exp, ip, ua]
  )
  return raw
}

// ─── Argon2id config (NIS2/NIST SP 800-63B) ─────────────────
const ARGON2_OPTIONS = {
  memoryCost: 65536,  // 64 MiB
  timeCost:   3,
  parallelism: 4,
}

// ─── POST /auth/login ────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password obbligatorie' })
  }

  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.failed_attempts, u.locked_until, u.must_change_pwd, u.totp_enabled,
        p.nome, p.cognome, p.ruolo, p.attivo
       FROM users u
       JOIN profiles p ON p.id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    )

    const utente = rows[0]

    // Risposta generica per evitare user enumeration
    if (!utente || !utente.attivo) {
      await audit(null, 'LOGIN_FAILED', 'users', null, { email, reason: 'not_found' }, req)
      return res.status(401).json({ error: 'Credenziali non valide' })
    }

    // Verifica blocco account (NIS2: protezione brute force)
    if (utente.locked_until && new Date(utente.locked_until) > new Date()) {
      const unlockTime = new Date(utente.locked_until).toISOString()
      await audit(utente.id, 'LOGIN_BLOCKED', 'users', utente.id, { ip }, req)
      return res.status(403).json({ error: `Account bloccato fino a ${unlockTime}` })
    }

    const valid = await argon2.verify(utente.password_hash, password, ARGON2_OPTIONS)

    if (!valid) {
      const attempts = utente.failed_attempts + 1
      const lockUntil = attempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000)  // blocco 15 min dopo 5 tentativi
        : null

      await db.query(
        `UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lockUntil, utente.id]
      )
      await audit(utente.id, 'LOGIN_FAILED', 'users', utente.id, { attempts, ip }, req)
      return res.status(401).json({ error: 'Credenziali non valide' })
    }

    // Login riuscito: reset tentativi falliti
    await db.query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [utente.id]
    )

    // Se MFA attiva: non rilasciare i token, chiedi il codice TOTP
    if (utente.totp_enabled) {
      const tempToken = jwt.sign(
        { sub: utente.id, scope: 'totp_pending' },
        getPrivateKey(),
        { algorithm: 'RS256', expiresIn: '5m', issuer: 'toscogas-ticketing' }
      )
      return res.json({ totp_required: true, temp_token: tempToken })
    }

    const user = { id: utente.id, email: utente.email, ruolo: utente.ruolo }
    const accessToken  = signAccessToken(user)

    const user = { id: utente.id, email: utente.email, ruolo: utente.ruolo }
    const accessToken  = signAccessToken(user)
    const refreshToken = await createRefreshToken(utente.id, req)

    await audit(utente.id, 'LOGIN_SUCCESS', 'users', utente.id, { ip }, req)

    res.json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      token_type:    'Bearer',
      expires_in:    15 * 60,
      user: {
        id:              utente.id,
        email:           utente.email,
        nome:            utente.nome,
        cognome:         utente.cognome,
        ruolo:           utente.ruolo,
        must_change_pwd: utente.must_change_pwd,
      },
    })
  } catch (err) {
    logger.error('Login error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/refresh ──────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refresh_token: raw } = req.body || {}
  if (!raw) return res.status(400).json({ error: 'refresh_token mancante' })

  try {
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    const { rows } = await db.query(
      `SELECT rt.*, p.ruolo, p.attivo, u.email
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN profiles p ON p.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
      [hash]
    )

    const token = rows[0]
    if (!token || !token.attivo) {
      return res.status(401).json({ error: 'Token non valido o scaduto' })
    }

    // Ruota il refresh token (token rotation)
    await db.query('DELETE FROM refresh_tokens WHERE id = $1', [token.id])

    const user = { id: token.user_id, email: token.email, ruolo: token.ruolo }
    const accessToken  = signAccessToken(user)
    const newRefreshToken = await createRefreshToken(token.user_id, req)

    res.json({
      access_token:  accessToken,
      refresh_token: newRefreshToken,
      token_type:    'Bearer',
      expires_in:    15 * 60,
      user: { id: token.user_id, email: token.email, ruolo: token.ruolo },
    })
  } catch (err) {
    logger.error('Refresh error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── GET /auth/me ────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.id, p.email, p.nome, p.cognome, p.ruolo, u.must_change_pwd
       FROM profiles p JOIN users u ON u.id = p.id
       WHERE p.id = $1`,
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Profilo non trovato' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/logout ───────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  const { refresh_token: raw } = req.body || {}
  if (raw) {
    const hash = crypto.createHash('sha256').update(raw).digest('hex')
    await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]).catch(() => {})
  }
  await audit(req.user.id, 'LOGOUT', 'users', req.user.id, {}, req)
  res.json({ message: 'Logout effettuato' })
})

// ─── POST /auth/change-password ──────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { new_password } = req.body || {}
  if (!new_password) {
    return res.status(400).json({ error: 'Parametri mancanti' })
  }
  if (new_password.length < 12) {
    return res.status(400).json({ error: 'La password deve essere di almeno 12 caratteri' })
  }

  try {
    const hash = await argon2.hash(new_password, ARGON2_OPTIONS)
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_pwd = false WHERE id = $2`,
      [hash, req.user.id]
    )

    await audit(req.user.id, 'PASSWORD_CHANGED', 'users', req.user.id, {}, req)
    res.json({ message: 'Password aggiornata' })
  } catch (err) {
    logger.error('Change password error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/reset-password ───────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email } = req.body || {}
  // Risposta sempre positiva per non rivelare se l'email esiste
  if (!email) return res.json({ message: 'Email inviata se presente' })

  try {
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (!rows[0]) return res.json({ message: 'Email inviata se presente' })

    const token     = crypto.randomBytes(32).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const exp       = new Date(Date.now() + 60 * 60 * 1000)  // 1 ora

    // Salva token come refresh speciale per reset
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [rows[0].id, tokenHash, exp]
    )

    const link = `${process.env.APP_URL}/reset-password?token=${token}`

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
      await transporter.sendMail({
        from:    process.env.SMTP_FROM,
        to:      email,
        subject: 'Reset password — Toscogas Ticketing',
        text:    `Clicca qui per reimpostare la password: ${link}\n\nIl link scade tra 1 ora.`,
      })
    } else {
      logger.warn('SMTP non configurato, link reset:', { link })
    }

    res.json({ message: 'Email inviata se presente' })
  } catch (err) {
    logger.error('Reset password error', { err: err.message })
    res.json({ message: 'Email inviata se presente' })
  }
})
// ─── POST /auth/totp/setup — genera segreto e QR code ─────────
router.post('/totp/setup', authenticate, async (req, res) => {
  try {
    const secret = authenticator.generateSecret()

    await db.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = false WHERE id = $2',
      [secret, req.user.id]
    )

    const otpauth = authenticator.keyuri(
      req.user.email,
      'Toscogas Ticketing',
      secret
    )

    const qrDataUrl = await QRCode.toDataURL(otpauth)

    await audit(req.user.id, 'TOTP_SETUP_STARTED', 'users', req.user.id, {}, req)

    res.json({ qr: qrDataUrl, secret })
  } catch (err) {
    logger.error('totp/setup error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/totp/verify-setup — conferma attivazione ──────
router.post('/totp/verify-setup', authenticate, async (req, res) => {
  const { code } = req.body || {}
  if (!code) return res.status(400).json({ error: 'Codice mancante' })

  try {
    const { rows } = await db.query(
      'SELECT totp_secret FROM users WHERE id = $1',
      [req.user.id]
    )
    if (!rows[0]?.totp_secret) {
      return res.status(400).json({ error: 'Setup TOTP non avviato' })
    }

    const valid = authenticator.verify({ token: code, secret: rows[0].totp_secret })
    if (!valid) {
      return res.status(401).json({ error: 'Codice non valido' })
    }

    await db.query(
      'UPDATE users SET totp_enabled = true WHERE id = $1',
      [req.user.id]
    )

    await audit(req.user.id, 'TOTP_ENABLED', 'users', req.user.id, {}, req)
    res.json({ message: 'MFA attivata con successo' })
  } catch (err) {
    logger.error('totp/verify-setup error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/totp/verify — verifica codice al login ────────
router.post('/totp/verify', async (req, res) => {
  const { temp_token, code } = req.body || {}
  if (!temp_token || !code) {
    return res.status(400).json({ error: 'Parametri mancanti' })
  }

  try {
    let payload
    try {
      payload = jwt.verify(temp_token, getPublicKey(), { algorithms: ['RS256'] })
    } catch {
      return res.status(401).json({ error: 'Sessione scaduta, ripeti il login' })
    }

    if (payload.scope !== 'totp_pending') {
      return res.status(401).json({ error: 'Token non valido' })
    }

    const { rows } = await db.query(
      `SELECT u.id, u.email, u.totp_secret, u.must_change_pwd,
              p.nome, p.cognome, p.ruolo
       FROM users u JOIN profiles p ON p.id = u.id
       WHERE u.id = $1`,
      [payload.sub]
    )
    const utente = rows[0]
    if (!utente) return res.status(401).json({ error: 'Utente non trovato' })

    const valid = authenticator.verify({ token: code, secret: utente.totp_secret })
    if (!valid) {
      await audit(utente.id, 'TOTP_FAILED', 'users', utente.id, {}, req)
      return res.status(401).json({ error: 'Codice non valido' })
    }

    const user = { id: utente.id, email: utente.email, ruolo: utente.ruolo }
    const accessToken  = signAccessToken(user)
    const refreshToken = await createRefreshToken(utente.id, req)

    await audit(utente.id, 'LOGIN_SUCCESS_TOTP', 'users', utente.id, {}, req)

    res.json({
      access_token:  accessToken,
      refresh_token: refreshToken,
      user: {
        id:      utente.id,
        email:   utente.email,
        nome:    utente.nome,
        cognome: utente.cognome,
        ruolo:   utente.ruolo,
        must_change_pwd: utente.must_change_pwd,
        totp_enabled: true,
      },
    })
  } catch (err) {
    logger.error('totp/verify error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

// ─── POST /auth/totp/disable — il coordinatore disattiva MFA ──
router.post('/totp/disable', authenticate, async (req, res) => {
  if (req.user.ruolo !== 'coordinatore') {
    return res.status(403).json({ error: 'Solo il coordinatore può disattivare la MFA' })
  }
  const { user_id } = req.body || {}
  if (!user_id) return res.status(400).json({ error: 'user_id mancante' })

  try {
    await db.query(
      'UPDATE users SET totp_secret = NULL, totp_enabled = false WHERE id = $1',
      [user_id]
    )
    await audit(req.user.id, 'TOTP_DISABLED_BY_ADMIN', 'users', user_id, {}, req)
    res.json({ message: 'MFA disattivata' })
  } catch (err) {
    logger.error('totp/disable error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})


module.exports = router
