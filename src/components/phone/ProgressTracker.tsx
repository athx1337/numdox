'use client'

import * as React from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  CheckCircle2,
} from 'lucide-react'
export interface ModuleProgressItem {
  name: string
  label?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  startedAt?: string
  completedAt?: string
  error?: string
}

interface ProgressTrackerProps {
  jobId: string
  modules: ModuleProgressItem[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  currentModule?: string
}

export function ProgressTracker({
  jobId,
  modules,
  status,
  currentModule,
}: ProgressTrackerProps) {
  const completedCount = modules.filter((m) => m.status === 'completed').length
  const failedCount = modules.filter((m) => m.status === 'failed').length
  const totalCount = modules.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const statusIcons = {
    pending: <Clock className="h-4 w-4 text-muted-foreground" />,
    processing: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <Clock className="h-4 w-4 text-muted-foreground" />,
  }

  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    processing: 'bg-primary text-primary-foreground',
    completed: 'bg-green-500 text-white',
    failed: 'bg-red-500 text-white',
    skipped: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Overall Progress</span>
            <Badge variant="outline" className="text-xs">
              {completedCount}/{totalCount} completed
            </Badge>
            {status === 'processing' && currentModule && (
              <Badge variant="secondary" className="text-xs">
                Processing: {currentModule}
              </Badge>
            )}
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            {progressPercent}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-3" />
      </div>

      {/* Module List */}
      <div className="space-y-2">
        {modules.map((module) => {
          const isCurrent = module.name === currentModule && status === 'processing'
          const icon = statusIcons[module.status]

          return (
            <div
              key={module.name}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrent ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'
              )}
            >
              <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', statusColors[module.status])}>
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{module.label}</span>
                  <Badge variant="outline" className="text-xs capitalize">{module.status}</Badge>
                </div>
                {module.startedAt && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      Started: {new Date(module.startedAt).toLocaleTimeString()}
                      {module.completedAt && (
                        <>
                          {' • '}
                          Completed: {new Date(module.completedAt).toLocaleTimeString()}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {module.error && (
                <div className="text-xs text-red-500 max-w-xs truncate" title={module.error}>
                  {module.error}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
        <span>Job ID: <code className="font-mono">{jobId.slice(0, 8)}...</code></span>
        <Badge variant={status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : 'secondary'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>
    </div>
  )
}

// Simplified version for results page header
export function CompactProgressTracker({
  modules,
  status,
}: {
  modules: ModuleProgressItem[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
}) {
  const completedCount = modules.filter((m) => m.status === 'completed').length
  const totalCount = modules.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <Progress value={progressPercent} className="h-2 w-48" />
      <span className="text-sm font-medium">
        {completedCount}/{totalCount}
      </span>
      <Badge variant={status === 'completed' ? 'success' : status === 'failed' ? 'destructive' : 'secondary'}>
        {status}
      </Badge>
    </div>
  )
}