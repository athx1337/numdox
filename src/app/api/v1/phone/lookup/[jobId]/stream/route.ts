// ============================================
// Phone Lookup API - SSE Stream
// GET /api/v1/phone/lookup/[jobId]/stream
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { PhoneOrchestrator } from '@/services'
import { PhoneLookupResult } from '@/types/phone'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const { jobId } = await params

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const sendError = (error: string) => {
        sendEvent({ error, timestamp: new Date().toISOString() })
      }

      // Send initial connection event
      sendEvent({ type: 'connected', jobId, timestamp: new Date().toISOString() })

      // Check for existing progress
      let progress = PhoneOrchestrator.getJobStatus(jobId)

      if (progress) {
        sendEvent({
          type: 'progress',
          status: progress.status,
          progress: progress.progress,
          timestamp: new Date().toISOString(),
        })
      }

      // Poll for updates
      let intervalId: NodeJS.Timeout | null = null
      let lastProgressUpdate = 0

      const poll = async () => {
        progress = PhoneOrchestrator.getJobStatus(jobId)

        if (!progress) {
          // Check database for completed result
          const result = await PhoneOrchestrator.getJobResult(jobId)
          if (result) {
            sendEvent({
              type: 'result',
              data: result,
              timestamp: new Date().toISOString(),
            })
            if (intervalId) clearInterval(intervalId)
            controller.close()
            return
          }
          // Job doesn't exist
          sendError('Job not found')
          if (intervalId) clearInterval(intervalId)
          controller.close()
          return
        }

        // Send progress updates (throttled to avoid spam)
        const now = Date.now()
        if (progress.status === 'processing' && now - lastProgressUpdate > 500) {
          sendEvent({
            type: 'progress',
            status: progress.status,
            progress: progress.progress,
            timestamp: new Date().toISOString(),
          })
          lastProgressUpdate = now
        }

        if (progress.status === 'completed') {
          const result = await PhoneOrchestrator.getJobResult(jobId)
          sendEvent({
            type: 'result',
            data: result,
            timestamp: new Date().toISOString(),
          })
          if (intervalId) clearInterval(intervalId)
          controller.close()
        } else if (progress.status === 'failed') {
          sendError('Job failed')
          if (intervalId) clearInterval(intervalId)
          controller.close()
        }
      }

      // Initial poll
      await poll()

      // Set up interval
      intervalId = setInterval(poll, 1000)

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId)
        controller.close()
      })
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}