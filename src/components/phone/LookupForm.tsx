'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from './PhoneInput'
import { ModuleSelector, ModulePresets } from './ModuleSelector'
import { ModuleKey, MODULES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Search, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface LookupFormProps {
  initialPhone?: string
  initialCountry?: string
  initialModules?: ModuleKey[]
  onSubmit?: (phone: string, countryCode: string, modules: ModuleKey[]) => void
}

export function LookupForm({
  initialPhone = '',
  initialCountry = 'IN',
  initialModules = ['validation', 'carrier', 'location', 'social', 'breach', 'spam', 'reputation'],
  onSubmit,
}: LookupFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [phone, setPhone] = React.useState(initialPhone)
  const [countryCode, setCountryCode] = React.useState(initialCountry)
  const [modules, setModules] = React.useState<ModuleKey[]>(initialModules)
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  // If we have a jobId in URL, redirect to results
  const jobId = searchParams.get('jobId')
  React.useEffect(() => {
    if (jobId) {
      router.push(`/results/${jobId}`)
    }
  }, [jobId, router])

  if (jobId) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate phone
    const cleanedPhone = phone.replace(/[^\d+]/g, '')
    if (!cleanedPhone) {
      setError('Please enter a phone number')
      return
    }

    if (cleanedPhone.length < 7) {
      setError('Phone number too short')
      return
    }

    if (modules.length === 0) {
      setError('Please select at least one module')
      return
    }

    setIsLoading(true)

    try {
      if (onSubmit) {
        onSubmit(cleanedPhone, countryCode, modules)
      } else {
        // Default: call API
        const response = await fetch('/api/v1/phone/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanedPhone, countryCode, modules }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error?.message || 'Lookup failed')
        }

        // Redirect to results page
        router.push(`/results/${data.data.jobId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Phone Input */}
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-lg font-medium">
          Phone Number
        </Label>
        <PhoneInput
          value={phone}
          onChange={setPhone}
          onCountryChange={setCountryCode}
          countryCode={countryCode}
          disabled={isLoading}
          error={error}
          placeholder="e.g. 98100 12345 or +91 98765 43210"
        />
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>

      {/* Module Selection */}
      <div className="space-y-2">
        <Label className="text-lg font-medium">
          OSINT Modules
        </Label>
        <ModulePresets selectedModules={modules} onChange={setModules} disabled={isLoading} />
        <ModuleSelector
          selectedModules={modules}
          onChange={setModules}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {modules.length} of {Object.keys(MODULES).length} modules selected
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="xl"
        className="w-full"
        loading={isLoading}
        variant="phonetrace"
      >
        <Search className="h-5 w-5 mr-2" />
        {isLoading ? 'Looking up...' : 'Start Lookup'}
      </Button>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
        <span>Try Indian Demo:</span>
        <button
          type="button"
          onClick={() => {
            setPhone('+919810012345')
            setCountryCode('IN')
            setModules(['validation', 'carrier', 'location', 'social', 'breach', 'spam', 'reputation'])
          }}
          className="text-primary hover:underline font-mono text-xs px-2 py-1 rounded bg-muted/60"
          disabled={isLoading}
        >
          Airtel Delhi (+91 98100 12345)
        </button>
        <button
          type="button"
          onClick={() => {
            setPhone('+916380012345')
            setCountryCode('IN')
            setModules(['validation', 'carrier', 'location', 'social', 'breach', 'spam', 'reputation'])
          }}
          className="text-primary hover:underline font-mono text-xs px-2 py-1 rounded bg-muted/60"
          disabled={isLoading}
        >
          Jio Tamil Nadu (+91 63800 12345)
        </button>
      </div>
    </form>
  )
}

// Compact version for results page
export function CompactLookupForm({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [phone, setPhone] = React.useState('')
  const [error, setError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanedPhone = phone.replace(/[^\d+]/g, '')
    if (!cleanedPhone || cleanedPhone.length < 7) {
      setError('Enter a valid phone number')
      return
    }

    setIsLoading(true)
    try {
      onSubmit(cleanedPhone)
    } catch {
      setError('Failed to start lookup')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number..."
          disabled={isLoading}
          className="pr-10"
        />
        {error && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">⚠</span>
        )}
      </div>
      <Button type="submit" size="icon" loading={isLoading} variant="phonetrace">
        <Search className="h-5 w-5" />
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </form>
  )
}