// ============================================
// Phone Lookup API - Start Async Lookup
// POST /api/v1/phone/lookup
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { PhoneLookupRequestSchema, ApiResponseSchema, JobStatusSchema } from '@/types/phone'
import { PhoneOrchestrator } from '@/services'
import { authenticateRequest } from '@/lib/auth'
import { RATE_LIMITS } from '@/lib/constants'
import { db } from '@/db'
import { phoneLookups, rateLimits } from '@/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// ============================================
// Rate Limiting
// ============================================

async function checkRateLimit(
  identifier: string,
  identifierType: 'ip' | 'api_key',
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + windowMs)

  try {
    const windowStart = new Date(now.getTime() - windowMs)

    // Clean old entries
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowEnd, now))

    // Get current count
    const [existing] = await db
      .select()
      .from(rateLimits)
      .where(
        and(
          eq(rateLimits.identifier, identifier),
          eq(rateLimits.identifierType, identifierType),
          eq(rateLimits.endpoint, '/api/v1/phone/lookup'),
          gte(rateLimits.windowStart, windowStart),
          lt(rateLimits.windowEnd, windowEnd)
        )
      )
      .limit(1)

    if (existing && existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowEnd.getTime(),
      }
    }

    // Increment or create
    if (existing) {
      await db
        .update(rateLimits)
        .set({ count: existing.count + 1 })
        .where(eq(rateLimits.id, existing.id))
    } else {
      await db.insert(rateLimits).values({
        identifier,
        identifierType,
        endpoint: '/api/v1/phone/lookup',
        count: 1,
        windowStart,
        windowEnd,
      })
    }

    return {
      allowed: true,
      remaining: limit - (existing?.count || 0) - 1,
      resetAt: windowEnd.getTime(),
    }
  } catch {
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: windowEnd.getTime(),
    }
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

// ============================================
// POST /api/v1/phone/lookup
// ============================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomBytes(16).toString('hex')

  try {
    // Authenticate
    const auth = await authenticateRequest(req)
    const ip = getClientIp(req)

    // Determine rate limit
    let rateLimit: { requests: number; window: string }
    if (auth.isApiRequest && auth.rateLimit) {
      rateLimit = { requests: auth.rateLimit, window: '1h' }
    } else if (auth.authenticated) {
      rateLimit = RATE_LIMITS.authenticated
    } else {
      rateLimit = RATE_LIMITS.anonymous
    }

    const windowMs = rateLimit.window === '1h' ? 60 * 60 * 1000 : 60 * 1000
    const identifier = auth.isApiRequest ? `api_key:${auth.apiKeyId}` : `ip:${ip}`

    const rateLimitResult = await checkRateLimit(
      identifier,
      auth.isApiRequest ? 'api_key' : 'ip',
      rateLimit.requests,
      windowMs
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.requests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetAt / 1000).toString(),
          },
        }
      )
    }

    // Parse and validate request
    const body = await req.json()
    const parseResult = PhoneLookupRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const request = parseResult.data

    // Execute lookup (await completion so serverless lambda containers do not freeze background work)
    const { jobId: localJobId, result } = await PhoneOrchestrator.startLookup(
      request,
      auth.userId,
      auth.apiKeyId,
      ip,
      req.headers.get('user-agent') || undefined,
      true
    )

    // Get final or initial status for response
    const progress = PhoneOrchestrator.getJobStatus(localJobId)

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: localJobId,
          status: result ? result.status : 'pending',
          result: result || undefined,
          progress: progress?.progress,
          pollUrl: `/api/v1/phone/lookup/${localJobId}`,
          streamUrl: `/api/v1/phone/lookup/${localJobId}/stream`,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': rateLimit.requests.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetAt / 1000).toString(),
        },
      }
    )
  } catch (error) {
    console.error('Lookup API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS for CORS
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}