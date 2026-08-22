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

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://numdox.phish-x.workers.dev'
    let jobId = crypto.randomUUID()

    try {
      console.log(`Forwarding lookup request to Cloudflare Worker: ${backendUrl}/api/v1/phone/lookup`)
      const workerRes = await fetch(`${backendUrl}/api/v1/phone/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: request.phone, countryCode: request.countryCode }),
      })

      if (workerRes.ok) {
        const workerData = await workerRes.json()
        if (workerData.success && workerData.data) {
          const result = workerData.data
          jobId = result.jobId || jobId
          result.jobId = jobId

          const modules = request.modules.map((name) => ({
            name,
            status: 'completed' as const,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          }))

          const progress = {
            jobId,
            status: 'completed' as const,
            progress: {
              current: modules.length,
              total: modules.length,
              currentModule: '',
              modules,
            },
          }

          PhoneOrchestrator.setPrecompletedResult(jobId, result, progress)

          try {
            await db.insert(phoneLookups).values({
              jobId,
              userId: auth.userId,
              apiKeyId: auth.apiKeyId,
              phone: request.phone,
              maskedPhone: request.phone.replace(/.(?=.{4})/g, '*'),
              countryCode: request.countryCode,
              modules: request.modules,
              status: 'completed',
              startedAt: new Date(),
              completedAt: new Date(),
              validation: result.validation,
              carrier: result.carrier,
              location: result.location,
              social: result.social,
              breaches: result.breaches,
              spam: result.spam,
              reputation: result.reputation,
              ipAddress: ip,
              userAgent: req.headers.get('user-agent') || undefined,
            })
          } catch (dbErr) {
            console.warn('DB update skipped:', dbErr)
          }

          return NextResponse.json(
            {
              success: true,
              data: {
                jobId,
                status: 'completed',
                pollUrl: `/api/v1/phone/lookup/${jobId}`,
                streamUrl: `/api/v1/phone/lookup/${jobId}/stream`,
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
        }
      }
    } catch (fetchErr) {
      console.error('Failed to query Cloudflare Worker, falling back to local orchestrator:', fetchErr)
    }

    // Start async lookup locally as fallback
    const localJobId = await PhoneOrchestrator.startLookup(
      request,
      auth.userId,
      auth.apiKeyId,
      ip,
      req.headers.get('user-agent') || undefined
    )

    // Get initial status for response
    const progress = PhoneOrchestrator.getJobStatus(localJobId)

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: localJobId,
          status: 'pending',
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