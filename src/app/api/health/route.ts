// ============================================
// Health Check API
// GET /api/health
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now()
  let dbHealthy = false
  let dbLatency = 0

  try {
    const dbStart = Date.now()
    await db.execute(sql`SELECT 1`)
    dbLatency = Date.now() - dbStart
    dbHealthy = true
  } catch (error) {
    console.error('Health check DB error:', error)
  }

  const totalLatency = Date.now() - startTime

  return NextResponse.json(
    {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      checks: {
        database: {
          healthy: dbHealthy,
          latencyMs: dbLatency,
        },
      },
      latencyMs: totalLatency,
    },
    {
      status: dbHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}