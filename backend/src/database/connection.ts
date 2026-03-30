import knex, { type Knex } from 'knex'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL
  : `postgres://${encodeURIComponent(requireEnv('POSTGRES_USER'))}:${encodeURIComponent(requireEnv('POSTGRES_PASSWORD'))}@${requireEnv('POSTGRES_HOST')}:${requireEnv('POSTGRES_PORT')}/${requireEnv('POSTGRES_DB')}`

export const db: Knex = knex({
  client: 'pg',
  connection: connectionString,
  pool: {
    min: 2,
    max: 10,
  },
})

