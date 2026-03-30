import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { logger } from './utils/logger'
import { apiRouter } from './routes/api.routes'
import { errorMiddleware } from './middleware/error.middleware'

const app  = express()
const PORT = process.env.PORT || 4000

// ── Seguridad y parsing ───────────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info({
    method: req.method,
    path:   req.path,
    ip:     req.ip,
    ua:     req.headers['user-agent']?.slice(0, 80),
  })
  next()
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use('/api', apiRouter)

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorMiddleware)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Servidor escuchando en el puerto ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
})

export default app
