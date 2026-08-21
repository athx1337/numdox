// ============================================
// Phone Lookup History API
// GET /api/v1/phone/history
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, withAuth, AuthResult } from '@/lib/auth'
import { PhoneOrchestrator } from '@/services'
import { PaginatedResponseSchema, LookupHistoryItemSchema } from '@/types/phone'
import { randomBytes } from 'crypto'

const PaginatedHistorySchema = PaginatedResponseSchema(LookupHistoryItemSchema)

async function handler(req: NextRequest, auth: AuthResult): Promise<NextResponse> {
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
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)

    const result = await PhoneOrchestrator.getHistory(auth.userId, page, pageSize)

    return NextResponse.json(
      {
        success: true,
        data: result,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('History API error:', error)
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

export const GET = withAuth(handler)