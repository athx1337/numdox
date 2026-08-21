// ============================================
// Authentication & Session Management
// ============================================

import { getIronSession, SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { users, apiKeys } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ENV_KEYS } from '@/lib/constants'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// ============================================
// Session Configuration
// ============================================

export interface SessionData {
  userId?: string
  email?: string
  role?: string
  isAuthenticated?: boolean
}

const sessionOptions: SessionOptions = {
  password: process.env[ENV_KEYS.SESSION_PASSWORD] || 'fallback_dev_password_change_me_32chars_min',
  cookieName: process.env[ENV_KEYS.SESSION_COOKIE_NAME] || 'phonetrace_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

// ============================================
// Password Hashing
// ============================================

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || randomBytes(16).toString('hex')
  const hash = scryptSync(password, useSalt, 64).toString('hex')
  return { hash, salt: useSalt }
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidateHash = scryptSync(password, salt, 64)
  const storedHash = Buffer.from(hash, 'hex')
  return timingSafeEqual(candidateHash, storedHash)
}

// ============================================
// Session Helpers
// ============================================

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session
}

export async function createSession(userId: string, email: string, role: string) {
  const session = await getSession()
  session.userId = userId
  session.email = email
  session.role = role
  session.isAuthenticated = true
  await session.save()
  return session
}

export async function destroySession() {
  const session = await getSession()
  session.destroy()
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session.isAuthenticated || !session.userId) {
    return null
  }
  return {
    id: session.userId,
    email: session.email,
    role: session.role,
  }
}

// ============================================
// API Key Authentication
// ============================================

export async function authenticateApiKey(apiKey: string): Promise<{
  valid: boolean
  keyId?: string
  userId?: string
  permissions?: string[]
  rateLimit?: number
} | null> {
  if (!apiKey || !apiKey.startsWith('pt_')) {
    return null
  }

  const prefix = apiKey.slice(0, 12)
  const keyHash = hashApiKey(apiKey)

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix))
    .limit(1)

  if (!key || !key.isActive) {
    return null
  }

  if (key.expiresAt && key.expiresAt < new Date()) {
    return null
  }

  // Verify hash
  if (!timingSafeEqual(Buffer.from(key.keyHash), Buffer.from(keyHash))) {
    return null
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))

  return {
    valid: true,
    keyId: key.id,
    userId: key.userId,
    permissions: key.permissions,
    rateLimit: key.rateLimit,
  }
}

export function hashApiKey(apiKey: string): string {
  return scryptSync(apiKey, 'phonetrace_api_salt', 64).toString('hex')
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(32).toString('hex')
  const key = `pt_${randomPart}`
  const prefix = key.slice(0, 12)
  const hash = hashApiKey(key)
  return { key, prefix, hash }
}

// ============================================
// Authorization Middleware
// ============================================

export interface AuthResult {
  authenticated: boolean
  userId?: string
  apiKeyId?: string
  permissions?: string[]
  rateLimit?: number
  isApiRequest: boolean
}

export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')

  // Try API key first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7)
    const result = await authenticateApiKey(apiKey)
    if (result?.valid) {
      return {
        authenticated: true,
        userId: result.userId,
        apiKeyId: result.keyId,
        permissions: result.permissions,
        rateLimit: result.rateLimit,
        isApiRequest: true,
      }
    }
  }

  // Try session
  const user = await getCurrentUser()
  if (user) {
    return {
      authenticated: true,
      userId: user.id,
      isApiRequest: false,
    }
  }

  return { authenticated: false, isApiRequest: false }
}

// ============================================
// Middleware for API Routes
// ============================================

export function withAuth(
  handler: (req: NextRequest, auth: AuthResult) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await authenticateRequest(req)
    if (!auth.authenticated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      )
    }
    return handler(req, auth)
  }
}

// ============================================
// Validation Schemas
// ============================================

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).default([]),
  rateLimit: z.number().min(1).max(10000).default(100),
  expiresAt: z.string().datetime().optional(),
})

export const PasswordResetSchema = z.object({
  email: z.string().email(),
})