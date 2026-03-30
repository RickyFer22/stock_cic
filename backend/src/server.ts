import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { logger } from './utils/logger'
import { apiRouter } from './routes/api.routes'
import { errorMiddleware } from './middleware/error.middleware'

const app = express()
const PORT = Number(process.env.PORT || 4000)

app.set('trust proxy', 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        ip: req.remoteAddress,
        ua: req.headers['user-agent']?.slice(0, 120),
      }
    },
  },
}))

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use('/api', apiRouter)
app.use(errorMiddleware)

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'Backend listo')
})

export default app

