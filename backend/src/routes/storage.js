const express = require('express')
const multer  = require('multer')
const { Client } = require('minio')
const { logger } = require('../logger')
const { authenticate } = require('../middleware/authenticate')

const router = express.Router()

// ─── MinIO client ────────────────────────────────────────────
const minio = new Client({
  endPoint:  process.env.MINIO_ENDPOINT || 'minio',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
})

const BUCKET = process.env.MINIO_BUCKET || 'ticket-foto'
const MAX_SIZE_BYTES = 20 * 1024 * 1024  // 20 MB
const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

// Assicura che il bucket esista all'avvio
async function ensureBucket() {
  try {
    const exists = await minio.bucketExists(BUCKET)
    if (!exists) {
      await minio.makeBucket(BUCKET, 'eu-west-1')
      logger.info(`MinIO bucket "${BUCKET}" creato`)
    }
  } catch (err) {
    logger.error('MinIO bucket init error', { err: err.message })
  }
}
ensureBucket()

// ─── Multer (memoria — poi si passa a MinIO) ─────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Tipo file non consentito: ${file.mimetype}`))
    }
  },
})

// ─── POST /api/storage/upload ────────────────────────────────
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File mancante' })

  const path = req.body.path
  if (!path) return res.status(400).json({ error: 'Path mancante' })

  // Sanitizza il path: evita directory traversal
  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '')
  if (!safePath) return res.status(400).json({ error: 'Path non valido' })

  try {
    await minio.putObject(BUCKET, safePath, req.file.buffer, req.file.size, {
      'Content-Type': req.file.mimetype,
    })
    res.json({ path: safePath })
  } catch (err) {
    logger.error('Upload to MinIO error', { err: err.message })
    res.status(500).json({ error: 'Errore upload' })
  }
})

// ─── GET /api/storage/:bucket/*path ─────────────────────────
// Serve i file da MinIO (con autenticazione)
router.get('/:bucket/*', authenticate, async (req, res) => {
  const bucket = req.params.bucket
  const path   = req.params[0]

  if (!path) return res.status(400).json({ error: 'Path mancante' })

  try {
    const stat = await minio.statObject(bucket, path)
    res.setHeader('Content-Type', stat.metaData?.['content-type'] || 'application/octet-stream')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const stream = await minio.getObject(bucket, path)
    stream.pipe(res)
  } catch (err) {
    if (err.code === 'NoSuchKey') return res.status(404).json({ error: 'File non trovato' })
    logger.error('GET storage error', { err: err.message })
    res.status(500).json({ error: 'Errore interno' })
  }
})

module.exports = router
