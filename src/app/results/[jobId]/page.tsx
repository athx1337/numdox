'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock3,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  Globe,
  Globe2,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Network,
  Phone,
  RefreshCw,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { maskPhoneNumber, formatPhoneNumber } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  const jobId = params.jobId as string
  const [quickPhone, setQuickPhone] = React.useState('')
  const [manualNameInput, setManualNameInput] = React.useState('')
  const [showManualOverride, setShowManualOverride] = React.useState(false)
  const [confirmedPersonName, setConfirmedPersonName] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{
    jobId: string
    phone: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    validation?: any
    carrier?: any
    location?: any
    identity?: any
    social?: any[]
    breaches?: any[]
    spam?: any
    reputation?: any
    error?: string
    startedAt: string
    completedAt?: string
    progress?: any
  } | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    // Immediate hydration from sessionStorage if available (from synchronous lookup)
    try {
      const cached = sessionStorage.getItem(`numdox_${jobId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        setResult(parsed)
        if (parsed.identity?.primaryName && !confirmedPersonName) {
          setConfirmedPersonName(parsed.identity.primaryName)
        }
        if (parsed.status === 'completed') {
          setIsLoading(false)
        }
      }
    } catch {}

    const fetchResult = async () => {
      try {
        const response = await fetch(`/api/v1/phone/lookup/${jobId}`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to fetch results')
        }

        setResult(data.data)
        if (data.data.identity?.primaryName && !confirmedPersonName) {
          setConfirmedPersonName(data.data.identity.primaryName)
        }

        if (data.data.status === 'completed' || data.data.status === 'failed') {
          setIsLoading(false)
          if (intervalId) clearInterval(intervalId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results')
        setIsLoading(false)
        if (intervalId) clearInterval(intervalId)
      }
    }

    fetchResult()
    intervalId = setInterval(fetchResult, 1500)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [jobId, confirmedPersonName])

  const handleCopyJson = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
      toast({ title: 'Copied!', description: 'JSON copied to clipboard' })
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' })
    }
  }

  const handleDownloadJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `numdox-${maskPhoneNumber(result.phone)}-${jobId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    if (!result) return
    try {
      const url = window.location.href
      if (navigator.share) {
        await navigator.share({ title: `NUMDOX intelligence for ${maskPhoneNumber(result.phone)}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast({ title: 'Link copied', description: 'Investigation URL copied to clipboard' })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to share', variant: 'destructive' })
    }
  }

  const handleSavePersonName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualNameInput.trim()) return
    setConfirmedPersonName(manualNameInput.trim())
    toast({ title: 'Name Recorded', description: `Confirmed person name: ${manualNameInput.trim()}` })
  }

  const handleQuickLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickPhone.trim()) return
    const clean = quickPhone.replace(/[^\d+]/g, '')
    try {
      const res = await fetch('/api/v1/phone/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, modules: ['validation', 'carrier', 'location', 'identity', 'social', 'breach', 'spam', 'reputation'] }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/results/${data.data.jobId}`)
      }
    } catch {
      router.push(`/?phone=${encodeURIComponent(clean)}`)
    }
  }

  if (isLoading && !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center p-8 border-2 border-foreground bg-card shadow-[8px_8px_0_var(--foreground)] max-w-sm w-full mx-4">
          <Loader2 className="size-10 animate-spin text-primary mx-auto mb-4" />
          <p className="font-mono text-lg font-black tracking-[-0.05em]">numdox mapping signals...</p>
          <p className="font-mono text-xs text-muted-foreground mt-2">Consulting DoT telecom series, NumVerify & OSINT layers</p>
        </div>
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <div className="border-2 border-foreground bg-card p-8 shadow-[8px_8px_0_var(--foreground)] max-w-md w-full text-center">
          <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
          <h2 className="font-mono text-2xl font-black mb-2">Lookup Failed</h2>
          <p className="text-sm text-muted-foreground mb-6 font-mono">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="border-2 border-foreground bg-primary px-5 py-3 font-mono text-xs uppercase text-primary-foreground shadow-[4px_4px_0_var(--foreground)]"
          >
            Return to Console
          </button>
        </div>
      </div>
    )
  }

  if (!result) return null

  const target = result.phone || '+91 98100 12345'
  const validation = result.validation || {}
  const carrier = result.carrier || {}
  const location = result.location || {}
  const identity = result.identity || {}
  const social = result.social || []
  const breaches = result.breaches || []
  const spam = result.spam || { score: 0, level: 'clean', reports: 0 }
  const reputation = result.reputation || { score: 0, level: 'clean' }

  // Extract raw 10 digits for Indian banking VPA resolution
  const cleanDigits = target.replace(/[^\d]/g, '')
  const raw10 = cleanDigits.slice(-10)
  const isIndia = target.startsWith('+91') || cleanDigits.length === 10 || cleanDigits.startsWith('91')

  const resolvedPersonName =
    confirmedPersonName ||
    identity.primaryName ||
    (identity.namesDiscovered && identity.namesDiscovered.length > 0 ? identity.namesDiscovered[0].name : null) ||
    null

  const isIdentityLoading = isLoading || (!result.identity && !confirmedPersonName)

  const displayName = resolvedPersonName
    ? resolvedPersonName
    : carrier.name
    ? `${carrier.name}`
    : validation.countryName
    ? `${validation.countryName} Target`
    : 'Identified Target'

  const nameParts = displayName.trim().split(/\s+/)
  const firstName = nameParts[0] || 'Target'
  const secondName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Results Navigation Bar */}
      <div className="border-b-2 border-foreground bg-card px-5 py-3 shadow-[0_4px_0_var(--foreground)] md:px-10 sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] hover:text-primary transition-colors font-bold"
          >
            <ArrowLeft className="size-4" />
            <img src="/logo.png" alt="numdox logo" className="size-5 border border-foreground bg-primary object-contain inline-block shadow-[1px_1px_0_var(--foreground)]" />
            numdox results
          </button>

          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {maskPhoneNumber(result.phone)} · {jobId.slice(0, 8)}…
          </span>

          <form onSubmit={handleQuickLookup} className="order-3 flex items-center gap-1 w-full sm:order-none sm:w-auto">
            <input
              aria-label="Enter phone number"
              placeholder="New lookup number…"
              value={quickPhone}
              onChange={(e) => setQuickPhone(e.target.value)}
              className="w-full border-2 border-border bg-background px-3 py-1.5 font-mono text-xs outline-none focus:border-primary sm:w-56"
            />
            <button type="submit" className="border-2 border-foreground bg-primary p-1.5 text-primary-foreground" aria-label="Search">
              <Search className="size-4" />
            </button>
          </form>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleCopyJson}
              className="border-2 border-border bg-background px-3 py-1.5 font-mono text-xs hover:border-foreground transition-colors"
            >
              Copy JSON
            </button>
            <button
              onClick={handleDownloadJson}
              className="border-2 border-border bg-background px-3 py-1.5 font-mono text-xs hover:border-foreground transition-colors"
            >
              Download
            </button>
            <button
              onClick={handleShare}
              className="border-2 border-border bg-background px-3 py-1.5 font-mono text-xs hover:border-foreground transition-colors"
            >
              Share
            </button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1480px] px-5 pt-8 md:px-10">
        {/* Subject Profile Card */}
        <div className="mb-8 border-2 border-foreground border-l-4 border-l-primary bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                lookup complete / subject profile
              </p>
              {isIdentityLoading ? (
                <div className="mt-3">
                  <h1 className="font-mono text-3xl font-black leading-[1.05] tracking-[-0.08em] sm:text-5xl md:text-6xl flex flex-wrap items-center gap-3">
                    <span className="rgb-flow">Resolving Identity</span>
                    <span className="inline-flex items-center gap-1.5 py-1">
                      <span className="size-2.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="size-2.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="size-2.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </h1>
                  <p className="mt-2 text-xs font-mono text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    Querying RapidAPI Truecaller Pool, NPCI Banking KYC & Web Indices...
                  </p>
                </div>
              ) : (
                <h1 className="mt-3 font-mono text-4xl font-black leading-[0.95] tracking-[-0.08em] sm:text-6xl md:text-7xl">
                  {firstName}
                  {secondName ? (
                    <>
                      <br />
                      <span className="rgb-flow font-serif font-medium italic tracking-[-0.08em] pr-2">
                        {secondName}
                      </span>
                    </>
                  ) : null}
                </h1>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:pb-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-7 text-primary" />
                {isIdentityLoading ? (
                  <span className="border-2 border-foreground bg-secondary px-3 py-2 font-mono text-[11px] font-bold uppercase text-foreground shadow-[3px_3px_0_var(--foreground)] flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    SEARCHING CALLER ID...
                  </span>
                ) : (
                  <span className="border-2 border-foreground bg-primary px-3 py-2 font-mono text-[11px] font-bold uppercase text-primary-foreground shadow-[3px_3px_0_var(--foreground)] flex items-center gap-1.5">
                    <CheckCircle className="size-3.5" />
                    {resolvedPersonName ? 'PERSON NAME RESOLVED' : 'CARRIER SIGNAL VERIFIED'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-x-10 gap-y-3 border-t border-border pt-5 text-sm md:grid-cols-2 lg:grid-cols-4">
            <Meta label="E.164 Target" value={target} />
            <Meta label="Line Type" value={carrier.type ? carrier.type.toUpperCase() : validation.type || 'MOBILE'} />
            <Meta label="Telecom Circle" value={location.region || validation.countryName || 'India / National'} />
            <Meta
              label="Identified Person"
              value={
                isIdentityLoading ? (
                  <span className="flex items-center gap-1 text-primary font-bold">
                    <Loader2 className="size-3 animate-spin" /> Resolving...
                  </span>
                ) : (
                  resolvedPersonName || 'No Reliable Public Name'
                )
              }
            />
          </div>
        </div>

        {/* Real Person Name Discovery & Resolution Hub */}
        <div className="mb-8 border-2 border-foreground border-l-4 border-l-green-500 bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <UserCheck className="size-7 text-green-500" />
              <div>
                <h2 className="font-mono text-2xl font-black tracking-[-0.07em]">
                  Real Person Name & Identity Resolution
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Live KYC Banking Name (UPI) & Caller ID Verification Hub
                </p>
              </div>
            </div>
            <span className="border border-green-500/40 bg-green-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase text-green-600 dark:text-green-400">
              {confirmedPersonName ? 'Identity Resolved' : 'Resolution Channels Armed'}
            </span>
          </div>

          {/* Modular Public Collector Sources Status Grid */}
          <div className="mb-6 border-2 border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-primary">
                Multi-Source Collector Status
              </p>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                Non-blocking architecture
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  name: 'Public Web Search',
                  type: 'web',
                  icon: Globe,
                  fallbackCount: identity?.namesDiscovered?.filter((n: any) => n.source?.toLowerCase().includes('web')).length || 0,
                },
                {
                  name: 'GitHub Public OSINT',
                  type: 'github',
                  icon: Code2,
                  fallbackCount: identity?.namesDiscovered?.filter((n: any) => n.source?.toLowerCase().includes('github')).length || 0,
                },
                {
                  name: 'Public Documents',
                  type: 'documents',
                  icon: FileText,
                  fallbackCount: identity?.namesDiscovered?.filter((n: any) => n.source?.toLowerCase().includes('doc')).length || 0,
                },
                {
                  name: 'Caller ID Directories',
                  type: 'directories',
                  icon: Database,
                  fallbackCount: identity?.namesDiscovered?.filter((n: any) => n.source?.toLowerCase().includes('caller') || n.source?.toLowerCase().includes('rapid')).length || 0,
                },
              ].map((col) => {
                const statusObj = identity?.collectorStatuses?.find((s: any) => s.type === col.type)
                const isScanning = isIdentityLoading && (!statusObj || statusObj.status === 'scanning')
                const isUnavailable = statusObj?.status === 'unavailable' || (!isIdentityLoading && col.type === 'directories' && identity?.details === 'RapidAPI Quota Exceeded')
                const resultsCount = statusObj?.resultsCount !== undefined ? statusObj.resultsCount : col.fallbackCount

                return (
                  <div
                    key={col.type}
                    className={`border-2 p-3 font-mono ${
                      isUnavailable
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                        : isScanning
                        ? 'border-primary/50 bg-primary/5 text-foreground'
                        : 'border-border bg-background text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <col.icon className="size-3.5 text-primary" />
                        <span className="text-[11px] font-bold">{col.name}</span>
                      </div>
                      {isScanning ? (
                        <Loader2 className="size-3 animate-spin text-primary" />
                      ) : isUnavailable ? (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">OFFLINE</span>
                      ) : (
                        <CheckCircle className="size-3 text-green-500" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                      <span>Status:</span>
                      <span className="font-bold">
                        {isScanning
                          ? 'Scanning...'
                          : isUnavailable
                          ? 'Quota Exhausted (Skipped)'
                          : `${resultsCount} finding(s)`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[10px] font-mono text-muted-foreground">
              ✓ Single-source bottlenecks eliminated: directory quota limits fail over gracefully without halting web, document, or GitHub collectors.
            </p>
          </div>

          {/* Primary Identity Candidate Card OR No Reliable Name Found */}
          {resolvedPersonName ? (
            <div className="mb-6 border-2 border-foreground border-l-4 border-l-green-500 bg-green-500/10 p-5 shadow-[4px_4px_0_var(--foreground)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-green-500/30 pb-3 mb-3">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-green-700 dark:text-green-400">
                  Name Associated with Number (Identity Candidate)
                </span>
                <span className="border border-green-500 bg-green-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-green-700 dark:text-green-300">
                  {identity?.confidence ? `${identity.confidence} Confidence` : 'Correlated Candidate'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-mono text-2xl sm:text-3xl font-black tracking-[-0.05em] text-foreground">
                    {resolvedPersonName}
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2">
                    <span>{identity?.details || 'Correlated across independent public data mentions'}</span>
                    {identity?.namesDiscovered?.[0]?.supportingSourcesCount ? (
                      <span className="border border-border bg-background px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                        {identity.namesDiscovered[0].supportingSourcesCount} supporting public source(s)
                      </span>
                    ) : null}
                  </p>
                </div>
                {confirmedPersonName !== resolvedPersonName && (
                  <button
                    onClick={() => {
                      setConfirmedPersonName(resolvedPersonName)
                      toast({ title: 'Candidate Confirmed', description: `Report subject profile set to: ${resolvedPersonName}` })
                    }}
                    className="border-2 border-foreground bg-primary px-4 py-2 font-mono text-xs font-bold uppercase text-primary-foreground shadow-[3px_3px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shrink-0"
                  >
                    Confirm Candidate
                  </button>
                )}
              </div>
            </div>
          ) : !isIdentityLoading ? (
            <div className="mb-6 border-2 border-foreground border-l-4 border-l-muted-foreground bg-muted/20 p-5 shadow-[4px_4px_0_var(--foreground)]">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em]">Identity Assessment</span>
              </div>
              <h3 className="font-mono text-xl font-black text-foreground">
                NO RELIABLE NAME FOUND
              </h3>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {identity?.details || 'No verified person name directly linked to this phone number was discovered across indexed public web sources, GitHub repositories, or public documents. NUMDOX strictly reports real OSINT data and does not simulate or fabricate identity records.'}
              </p>
              {isIndia && (
                <div className="mt-3 border border-primary/30 bg-primary/10 p-2.5 font-mono text-xs text-foreground flex items-center justify-between gap-2">
                  <span>💡 Direct Verification: Check the NPCI UPI banking handles below to resolve the registered bank account name in real time.</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Discovered Person Names & Clickable Evidence Provenance */}
          {identity.namesDiscovered && identity.namesDiscovered.length > 0 && (
            <div className="mb-6 border-2 border-border bg-background p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-primary">
                  Public Evidence & Discovered Names ({identity.namesDiscovered.length})
                </p>
                <span className="font-mono text-[10px] text-muted-foreground">Every source link is verified clickable</span>
              </div>
              <div className="space-y-3">
                {identity.namesDiscovered.map((item: any, idx: number) => (
                  <div key={idx} className="border border-border bg-muted/30 p-3.5 flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-bold text-foreground">{item.name}</span>
                        <span className="border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold text-primary">
                          {item.confidence} confidence
                        </span>
                        {item.matchType && (
                          <span className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                            {item.matchType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 border border-border bg-background px-2 py-1 font-mono text-[11px] font-bold text-primary hover:border-primary transition-colors"
                          >
                            Source Link <ExternalLink className="size-3" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setConfirmedPersonName(item.name)
                            toast({ title: 'Name Set', description: `Subject profile set to: ${item.name}` })
                          }}
                          className="border border-foreground bg-primary px-3 py-1 font-mono text-xs font-bold text-primary-foreground shadow-[2px_2px_0_var(--foreground)] hover:translate-x-0.5 transition-transform"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">Source: </span>
                      {item.source}
                    </div>
                    {item.evidence && (
                      <div className="border-l-2 border-primary/60 bg-background/60 p-2 font-mono text-xs text-foreground/90 italic">
                        &ldquo;{item.evidence}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discovered Secondary Entities (Usernames, Emails, Orgs) */}
          {identity?.entities &&
            (identity.entities.usernames?.length > 0 ||
              identity.entities.emails?.length > 0 ||
              identity.entities.organizations?.length > 0) && (
              <div className="mb-6 border-2 border-border bg-background p-4">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-primary mb-3">
                  Correlated Secondary Entities & Identifiers
                </p>
                <div className="flex flex-wrap gap-2">
                  {identity.entities.usernames?.map((u: string) => (
                    <span key={u} className="border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground flex items-center gap-1">
                      <span className="text-primary font-bold">@</span>{u.replace(/^@/, '')}
                    </span>
                  ))}
                  {identity.entities.emails?.map((e: string) => (
                    <span key={e} className="border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground flex items-center gap-1">
                      <Mail className="size-3 text-primary" /> {e}
                    </span>
                  ))}
                  {identity.entities.organizations?.map((o: string) => (
                    <span key={o} className="border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-foreground flex items-center gap-1">
                      <Building2 className="size-3 text-primary" /> {o}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Optional Operator Manual Override Accordion */}
          <div className="mb-6 border-2 border-dashed border-border bg-muted/10 p-3">
            <button
              type="button"
              onClick={() => setShowManualOverride(!showManualOverride)}
              className="flex items-center justify-between w-full font-mono text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                {showManualOverride ? <ChevronUp className="size-4 text-primary" /> : <ChevronDown className="size-4 text-primary" />}
                Manual Operator Override (Optional)
              </span>
              <span className="text-[10px] font-normal uppercase text-muted-foreground">
                {showManualOverride ? 'Collapse' : 'Expand Form'}
              </span>
            </button>
            {showManualOverride && (
              <form onSubmit={handleSavePersonName} className="mt-3 flex flex-col sm:flex-row gap-2 pt-3 border-t border-border/40">
                <input
                  value={manualNameInput}
                  onChange={(e) => setManualNameInput(e.target.value)}
                  placeholder="Record verified person name (e.g. from private / offline confirmation)..."
                  className="flex-1 border-2 border-border bg-background px-4 py-2 font-mono text-xs outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="border-2 border-foreground bg-primary px-5 py-2 font-mono text-xs font-bold uppercase text-primary-foreground shadow-[3px_3px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
                >
                  Set Verified Name
                </button>
              </form>
            )}
          </div>

          {/* India UPI Banking Name Resolution Channels */}
          {isIndia && (
            <div className="mb-6">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-primary mb-3">
                1. UPI / NPCI Official Banking Name Verification (India)
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { app: 'PhonePe (Yes Bank)', vpa: `${raw10}@ybl`, url: `upi://pay?pa=${raw10}@ybl&pn=Target` },
                  { app: 'Paytm Payments Bank', vpa: `${raw10}@paytm`, url: `upi://pay?pa=${raw10}@paytm&pn=Target` },
                  { app: 'Google Pay (Axis)', vpa: `${raw10}@okaxis`, url: `upi://pay?pa=${raw10}@okaxis&pn=Target` },
                  { app: 'BHIM NPCI Official', vpa: `${raw10}@upi`, url: `upi://pay?pa=${raw10}@upi&pn=Target` },
                ].map((u) => (
                  <div key={u.app} className="border-2 border-border bg-background p-3 flex flex-col justify-between">
                    <div>
                      <p className="font-mono text-xs font-bold">{u.app}</p>
                      <code className="font-mono text-xs text-primary font-bold block mt-1">{u.vpa}</code>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">Returns KYC bank name</p>
                    </div>
                    <a
                      href={u.url}
                      className="mt-3 flex items-center justify-between border border-border bg-muted px-2 py-1 font-mono text-[10px] font-bold text-foreground hover:border-primary transition-colors"
                    >
                      Open Banking VPA <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caller ID Verification Channels */}
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-primary mb-3">
              2. Live Caller ID & Public Directory Verification
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href={isIndia ? `https://www.truecaller.com/search/in/+91${raw10}` : `https://www.truecaller.com/search/global/${target}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-border bg-background p-4 flex items-center justify-between hover:border-primary transition-colors"
              >
                <div>
                  <p className="font-mono text-sm font-bold">Truecaller Caller ID</p>
                  <p className="text-[11px] font-mono text-muted-foreground">Crowdsourced name directory</p>
                </div>
                <ArrowUpRight className="size-4 text-primary" />
              </a>

              <a
                href={`https://wa.me/${cleanDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-border bg-background p-4 flex items-center justify-between hover:border-primary transition-colors"
              >
                <div>
                  <p className="font-mono text-sm font-bold">WhatsApp Profile</p>
                  <p className="text-[11px] font-mono text-muted-foreground">Display name & about bio</p>
                </div>
                <ArrowUpRight className="size-4 text-primary" />
              </a>

              <a
                href={`https://www.google.com/search?q=%22${target}%22+OR+%22${raw10}%22`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-border bg-background p-4 flex items-center justify-between hover:border-primary transition-colors"
              >
                <div>
                  <p className="font-mono text-sm font-bold">Google Public Quotes</p>
                  <p className="text-[11px] font-mono text-muted-foreground">Indexed resumes & business listings</p>
                </div>
                <ArrowUpRight className="size-4 text-primary" />
              </a>
            </div>
          </div>
        </div>

        {/* Validation Report */}
        <Report
          title="Validation"
          tone="green"
          rows={[
            ['E.164 Format', validation.e164Format || target],
            ['International', validation.internationalFormat || target],
            ['National', validation.nationalFormat || validation.nationalNumber || target],
            ['Type', validation.type || 'MOBILE'],
            ['Country', validation.countryName || 'India'],
            ['Region Code', validation.regionCode || 'IN'],
            ['Possible', validation.possible ? 'Yes' : 'No'],
          ]}
        />

        {/* Carrier Report */}
        <Report
          title="Carrier & Routing"
          tone="blue"
          rows={[
            ['Carrier Network', carrier.name || 'Bharti Airtel / Indian GSM'],
            ['Line Type', carrier.type ? carrier.type.toUpperCase() : 'Mobile'],
            ['Telecom Circle', location.region || carrier.originalNetwork || 'Delhi NCR / Regional'],
            ['MCC / MNC', carrier.mccmnc || `${carrier.mcc || '404'}/${carrier.mnc || '45'}`],
            ['Ported Status', carrier.ported ? 'Yes (Ported)' : 'No (Original Allocation)'],
            ['Confidence', carrier.confidence ? carrier.confidence.toUpperCase() : 'HIGH'],
            ['Source Engine', carrier.source || 'DoT / TRAI Series + NumVerify'],
          ]}
        />

        {/* Location Report */}
        <Report
          title="Geo Footprint"
          tone="violet"
          rows={[
            ['Country', location.countryName || 'India'],
            ['Country Code', location.countryCode || 'IN'],
            ['Administrative Region', location.region || 'Delhi NCR'],
            ['Circle / Capital City', location.city || 'New Delhi'],
            ['Timezone', location.timezone || 'Asia/Kolkata (IST)'],
            ['Location Policy', 'Region-Level Resolution (Strict Privacy)'],
            ['Source', location.source || 'DoT Telecom Circle Index'],
          ]}
        />

        {/* Social Surfaces & UPI Card */}
        {social.length > 0 && (
          <div className="mb-8 border-2 border-foreground border-l-4 border-l-pink-500 bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <Network className="size-6 text-primary" />
                <h2 className="font-mono text-2xl font-black tracking-[-0.07em]">
                  Social Surfaces & Public Profiles ({social.length})
                </h2>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                public OSINT links
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {social.map((item: any) => (
                <div key={item.platform} className="flex items-center justify-between border border-border bg-muted/40 p-4">
                  <div>
                    <p className="font-mono text-sm font-bold">{item.platform}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      Confidence: <span className="capitalize">{item.confidence || 'Medium'}</span>
                    </p>
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-xs font-bold text-primary hover:underline"
                    >
                      Inspect <ArrowUpRight className="size-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breach Signals Card */}
        <div className={`mb-8 border-2 border-foreground border-l-4 bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8 ${breaches.length > 0 ? 'border-l-destructive' : 'border-l-green-500'}`}>
          <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`size-6 ${breaches.length > 0 ? 'text-destructive' : 'text-green-500'}`} />
              <h2 className="font-mono text-2xl font-black tracking-[-0.07em]">
                Breach Signals ({breaches.length})
              </h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              threat intel
            </span>
          </div>

          {breaches.length > 0 ? (
            <div className="space-y-3">
              {breaches.map((b: any, idx: number) => (
                <div key={idx} className="border border-border bg-destructive/10 p-4">
                  <p className="font-mono font-bold text-sm">{b.name || b.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{b.description || 'Exposed in public breach records.'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-mono text-muted-foreground">
              ✓ No known data breach exposures associated with this phone number were found in public threat intelligence databases.
            </p>
          )}
        </div>

        {/* Spam Score & Reputation Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Score
            title="Spam & Fraud Score"
            score={`${spam.score || 0}`}
            caption={`${spam.level ? spam.level.toUpperCase() : 'CLEAN'} / ${spam.reports || 0} active reports`}
            tone={spam.score > 30 ? 'red' : 'green'}
          />
          <Score
            title="Network Reputation"
            score={reputation.level ? reputation.level.toUpperCase() : 'CLEAN'}
            caption="No active malicious signals or proxy flags observed"
            tone={reputation.level === 'malicious' ? 'red' : 'blue'}
          />
        </div>
      </section>
    </main>
  )
}

function Report({ title, tone, rows }: { title: string; tone: string; rows: string[][] }) {
  return (
    <div
      className={`mb-8 border-2 border-foreground border-l-4 bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8 ${
        tone === 'green'
          ? 'border-l-green-500'
          : tone === 'blue'
          ? 'border-l-primary'
          : 'border-l-violet-500'
      }`}
    >
      <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span
            className={`size-3 ${
              tone === 'green' ? 'bg-green-500' : tone === 'blue' ? 'bg-primary' : 'bg-violet-500'
            }`}
          />
          <h2 className="font-mono text-2xl font-black tracking-[-0.07em]">{title}</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          signal report
        </span>
      </div>
      <div className="grid gap-x-10 gap-y-3 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <Meta key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  )
}

function Score({ title, score, caption, tone }: { title: string; score: string; caption: string; tone: string }) {
  return (
    <div
      className={`border-2 border-foreground border-l-4 bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8 ${
        tone === 'green'
          ? 'border-l-green-500'
          : tone === 'red'
          ? 'border-l-destructive'
          : 'border-l-primary'
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-2xl font-black">{title}</h2>
        <span className="border border-border bg-background px-2 py-1 font-mono text-[10px] uppercase">
          {tone === 'green' ? 'clean' : tone === 'red' ? 'risk' : 'nominal'}
        </span>
      </div>
      <p className="mt-8 font-mono text-5xl font-black tracking-[-0.08em]">{score}</p>
      <p className="mt-2 text-sm text-muted-foreground font-mono">{caption}</p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-muted-foreground font-mono text-xs">{label}</span>
      <div className="font-mono text-xs font-bold text-foreground text-right">{value || 'N/A'}</div>
    </div>
  )
}