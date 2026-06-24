const express     = require('express')
const helmet      = require('helmet')
const cors        = require('cors')
const rateLimit   = require('express-rate-limit')
const { logger }  = require('./logger')

const authRouter        = require('./routes/auth')
const ticketsRouter     = require('./routes/tickets')
const profilesRouter    = require('./routes/profiles')
const ticketFotoRouter  = require('./routes/ticket_foto')
const storageRouter     = require('./routes/storage')

const app  = express()
const PORT = process.env.PORT || 3000

// ── Sicurezza header (NIS2) ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,  // gestito da Nginx
  hsts: false,                   // gestito da Nginx
}))

app.set('trust proxy', 1)  // Nginx proxy

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Rate limiting globale ─────────────────────────────────────
app.use(rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Troppe richieste, riprova tra un minuto' },
}))

// ── Parse JSON ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))

// ── Logging richieste ────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    ua: req.headers['user-agent'],
  })
  next()
})

// ── Routes ───────────────────────────────────────────────────
app.use('/auth',              authRouter)
app.use('/api/tickets',       ticketsRouter)
app.use('/api/profiles',      profilesRouter)
app.use('/api/ticket-foto',   ticketFotoRouter)
app.use('/api/storage',       storageRouter)

// Route admin per creazione utenti (mountata su profiles ma con prefisso separato)
app.use('/api/admin',         profilesRouter)

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint non trovato' }))

// ── Error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack })
  res.status(500).json({ error: 'Errore interno del server' })
})

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Backend in ascolto su porta ${PORT}`)
})
