// ============================================
// Phone Lookup API - Get Job Status/Result
// GET /api/v1/phone/lookup/[jobId]
// GET /api/v1/phone/lookup/[jobId]/stream (SSE)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { PhoneOrchestrator } from '@/services'
import { authenticateRequest } from '@/lib/auth'
import { randomBytes } from 'crypto'

// ============================================
// GET /api/v1/phone/lookup/[jobId] - Polling
// ============================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params
  const requestId = randomBytes(16).toString('hex')

  try {
    // Authenticate (optional for public results, required for private)
    const auth = await authenticateRequest(req)

    // Get job status and result from orchestrator
    const progress = PhoneOrchestrator.getJobStatus(jobId)
    const result = await PhoneOrchestrator.getJobResult(jobId)

    if (result) {
      return NextResponse.json(
        {
          success: true,
          data: {
            ...result,
            progress: progress?.progress,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '0.1.0',
          },
        },
        { status: 200 }
      )
    }

    if (progress) {
      // Job is currently in progress
      return NextResponse.json(
        {
          success: true,
          data: {
            jobId: progress.jobId,
            status: progress.status,
            progress: progress.progress,
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version: '0.1.0',
          },
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Lookup job not found',
        },
      },
      { status: 404 }
    )
  } catch (error) {
    console.error('Job status API error:', error)
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
// GET /api/v1/phone/lookup/[jobId]/stream - SSE
// ============================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}