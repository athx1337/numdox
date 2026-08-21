import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/phonetrace'

// For serverless environments (Vercel, Cloudflare), use a singleton pattern
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

const conn = globalForDb.conn ?? postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Disable prepared statements for serverless
})

const db = globalForDb.db ?? drizzle(conn, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
  globalForDb.db = db
}

export { db, conn }
export * from './schema'