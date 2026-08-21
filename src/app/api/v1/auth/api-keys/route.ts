// ============================================
// API Key Management
// GET /api/v1/auth/api-keys - List keys
// POST /api/v1/auth/api-keys - Create key
// DELETE /api/v1/auth/api-keys/[id] - Revoke key
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { apiKeys } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { withAuth, generateApiKey, AuthResult, ApiKeyCreateSchema } from '@/lib/auth'
import { randomBytes } from 'crypto'

// ============================================
// GET /api/v1/auth/api-keys
// ============================================

export const GET = withAuth(async (req: NextRequest, auth: AuthResult): Promise<NextResponse> => {
  if (!auth.userId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        },
      },
      { status: 401 }
    )
  }

  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        rateLimit: apiKeys.rateLimit,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, auth.userId))
      .orderBy(desc(apiKeys.createdAt))

    return NextResponse.json({
      success: true,
      data: keys,
    })
  } catch (error) {
    console.error('List API keys error:', error)
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
})

// ============================================
// POST /api/v1/auth/api-keys
// ============================================

async function createKeyHandler(
  req: NextRequest,
  auth: AuthResult
): Promise<NextResponse> {
  const requestId = randomBytes(16).toString('hex')

  if (!auth.userId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User ID required',
        },
      },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const parseResult = ApiKeyCreateSchema.safeParse(body)

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

    const { name, permissions, rateLimit, expiresAt } = parseResult.data
    const { key, prefix, hash } = generateApiKey()

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        userId: auth.userId,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning()

    // Return the full key ONLY ONCE
    return NextResponse.json(
      {
        success: true,
        data: {
          id: newKey.id,
          name: newKey.name,
          key, // Only returned once!
          prefix: newKey.keyPrefix,
          permissions: newKey.permissions,
          rateLimit: newKey.rateLimit,
          expiresAt: newKey.expiresAt,
          createdAt: newKey.createdAt,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create API key error:', error)
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

export const POST = withAuth(createKeyHandler)