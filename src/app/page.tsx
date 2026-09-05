'use client'

import { useMemo, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Fingerprint,
  Globe2,
  Hash,
  Menu,
  Network,
  Phone,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  X,
  AlertCircle,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { UI } from '@/lib/constants'

const modules = [
  { id: 'identity', apiKey: 'validation', label: 'Identity graph', detail: 'Names, aliases, format validity', icon: Fingerprint },
  { id: 'carrier', apiKey: 'carrier', label: 'Carrier & line', detail: 'Type, circle, routing network', icon: Smartphone },
  { id: 'location', apiKey: 'location', label: 'Geo footprint', detail: 'Region and time zone', icon: Globe2 },
  { id: 'social', apiKey: 'social', label: 'Social surfaces', detail: 'UPI & public account matches', icon: Network },
  { id: 'breach', apiKey: 'breach', label: 'Breach signals', detail: 'Exposure indicators', icon: ShieldCheck },
  { id: 'reputation', apiKey: 'reputation', label: 'Risk reputation', detail: 'Spam and fraud score', icon: Activity },
]

const scans = [
  { label: 'Quick scan', modules: ['carrier', 'reputation'] },
  { label: 'Full OSINT', modules: modules.map((module) => module.id) },
  { label: 'Social + breach', modules: ['identity', 'social', 'breach'] },
]

function HomeContent() {
  const router = useRouter()
  const [number, setNumber] = useState('')
  const [countryCode, setCountryCode] = useState('IN')
  const [activeScan, setActiveScan] = useState('Full OSINT')
  const [selected, setSelected] = useState(modules.map((module) => module.id))
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  const selectedLabel = useMemo(() => `${selected.length} / ${modules.length} modules armed`, [selected.length])

  async function runScan(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError('')
    const cleanedPhone = number.replace(/[^\d+]/g, '')
    if (!cleanedPhone || cleanedPhone.length < 5) {
      setError('Please enter a valid phone number')
      return
    }
    if (selected.length === 0) {
      setError('Please select at least one module')
      return
    }

    setIsScanning(true)

    // Map UI module IDs to backend API module keys
    const apiModules = selected.map((s) => {
      const found = modules.find((m) => m.id === s)
      return found ? found.apiKey : s
    })
    // Ensure validation and identity are always included
    if (!apiModules.includes('validation')) {
      apiModules.unshift('validation')
    }
    if (!apiModules.includes('identity')) {
      apiModules.push('identity')
    }

    try {
      const response = await fetch('/api/v1/phone/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanedPhone,
          countryCode: countryCode,
          modules: apiModules,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error?.message || 'Lookup failed')
      }

      router.push(`/results/${data.data.jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during lookup')
      setIsScanning(false)
    }
  }

  function chooseScan(scan: (typeof scans)[number]) {
    setActiveScan(scan.label)
    setSelected(scan.modules)
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-5 md:px-10">
        <a href="#top" className="flex items-center gap-3" aria-label="numdox home">
          <img
            src="/logo.png"
            alt="numdox logo"
            className="size-9 border-2 border-foreground bg-primary shadow-[3px_3px_0_var(--foreground)] object-contain"
          />
          <span className="font-mono text-lg font-black tracking-[-0.08em]">
            numdox<span className="text-primary">.</span>
          </span>
        </a>
        <nav className="hidden items-center gap-8 font-mono text-xs uppercase tracking-[0.16em] md:flex">
          <a href="#workspace" className="hover:text-primary transition-colors">Workspace</a>
          <a href="#signals" className="hover:text-primary transition-colors">Signal index</a>
          <a href="#docs" className="hover:text-primary transition-colors">Docs</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden border border-border bg-card px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] md:inline-flex">
            Beta / 01.0
          </span>
          <button
            className="grid size-10 place-items-center border-2 border-foreground bg-primary text-primary-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="mx-5 flex flex-col gap-4 border-2 border-foreground bg-card p-5 font-mono text-xs uppercase tracking-[0.16em] md:hidden">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <span className="text-muted-foreground">THEME MODE</span>
            <ThemeToggle />
          </div>
          <a href="#workspace" onClick={() => setMobileOpen(false)}>Workspace</a>
          <a href="#signals" onClick={() => setMobileOpen(false)}>Signal index</a>
          <a href="#docs" onClick={() => setMobileOpen(false)}>Docs</a>
        </nav>
      )}

      {/* Hero Section */}
      <section id="top" className="mx-auto grid max-w-[1480px] gap-12 px-5 pb-16 pt-12 md:px-10 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-20">
        <div>
          <div className="mb-7 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="size-2 bg-primary" /> open-source intelligence / phone layer
          </div>
          <h1 className="max-w-4xl font-mono text-[clamp(3.75rem,10vw,9.5rem)] font-black leading-[0.82] tracking-[-0.11em] text-balance">
            know<br />
            the<br />
            <em className="rgb-flow font-serif font-medium italic tracking-[-0.08em] pr-2">
              number.
            </em>
          </h1>
          <p className="mt-9 max-w-xl text-lg leading-7 text-muted-foreground md:text-xl">
            A sharp, privacy-first phone intelligence workspace for turning one number into a map of public signals.
          </p>
        </div>

        <div className="border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-7">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">what numdox sees</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-[-0.06em]">one input. six surfaces.</p>
            </div>
            <Sparkles className="size-7 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
            {['carrier', 'geo', 'social', 'breach', 'risk', 'identity'].map((item, index) => (
              <div key={item} className="bg-background p-4 font-mono text-xs uppercase tracking-[0.12em]">
                <span className="mb-5 block text-muted-foreground">0{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace Banner */}
      <section id="workspace" className="border-y-2 border-foreground bg-foreground px-5 py-5 text-background md:px-10">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.17em]">
          <span>workspace / lookup console</span>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="size-2 animate-pulse bg-primary" /> all systems nominal
          </span>
        </div>
      </section>

      {/* Workspace Section */}
      <section className="mx-auto max-w-[1480px] px-5 py-12 md:px-10 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          {/* Target Input */}
          <div className="flex flex-col gap-7">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">01 / target</p>
              <h2 className="mt-3 font-mono text-3xl font-black tracking-[-0.08em] md:text-4xl">
                start with a<br />phone number.
              </h2>
            </div>

            <form onSubmit={runScan} className="border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-7">
              <label htmlFor="phone" className="mb-3 block font-mono text-xs font-bold uppercase tracking-[0.15em]">
                E.164 target
              </label>
              <div className="flex border-2 border-foreground bg-background focus-within:ring-2 focus-within:ring-primary">
                <div className="relative flex items-center border-r-2 border-foreground bg-muted/40">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-full bg-transparent px-3 font-mono text-sm font-bold uppercase outline-none cursor-pointer"
                    aria-label="Select country code"
                  >
                    {UI.supportedCountries.map((c) => (
                      <option key={c.code} value={c.code} className="bg-background text-foreground">
                        {c.code} ({c.dialCode})
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  id="phone"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="e.g. 98100 12345 or +91 98100 12345"
                  className="min-w-0 flex-1 bg-transparent px-4 py-4 font-mono text-lg outline-none placeholder:text-muted-foreground"
                />
              </div>

              {error && (
                <p className="mt-3 text-xs font-mono text-destructive flex items-center gap-1">
                  <AlertCircle className="size-4" /> {error}
                </p>
              )}

              {/* Demo Targets */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Try demo:</span>
                <button
                  type="button"
                  onClick={() => {
                    setNumber('+91 84536 07248')
                    setCountryCode('IN')
                  }}
                  className="font-mono text-xs font-bold text-primary underline underline-offset-4 hover:opacity-80"
                >
                  Target (+91 84536 07248)
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setNumber('+91 98100 12345')
                    setCountryCode('IN')
                  }}
                  className="font-mono text-xs text-primary underline underline-offset-4 hover:opacity-80"
                >
                  Airtel Delhi (+91 98100 12345)
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setNumber('+91 63800 12345')
                    setCountryCode('IN')
                  }}
                  className="font-mono text-xs text-primary underline underline-offset-4 hover:opacity-80"
                >
                  Jio TN (+91 63800 12345)
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setNumber('+1 415 555 2671')
                    setCountryCode('US')
                  }}
                  className="font-mono text-xs text-primary underline underline-offset-4 hover:opacity-80"
                >
                  US Demo (+1 415 555 2671)
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 gap-px border border-border bg-border text-center font-mono text-xs uppercase tracking-[0.12em]">
              <div className="bg-card p-4">
                <span className="block text-xl font-bold">0.4s</span>
                <span className="text-muted-foreground">avg. scan</span>
              </div>
              <div className="bg-card p-4">
                <span className="block text-xl font-bold">99.2%</span>
                <span className="text-muted-foreground">uptime</span>
              </div>
            </div>
          </div>

          {/* Module Selector */}
          <div id="signals" className="border-2 border-foreground bg-card p-5 shadow-[8px_8px_0_var(--foreground)] md:p-8">
            <div className="mb-7 flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">02 / signal index</p>
                <h2 className="mt-2 font-mono text-2xl font-black tracking-[-0.07em]">arm your modules</h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{selectedLabel}</span>
            </div>

            <div className="mb-7 flex flex-wrap gap-2">
              {scans.map((scan) => (
                <button
                  key={scan.label}
                  type="button"
                  onClick={() => chooseScan(scan)}
                  className={`border-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] transition-all font-bold ${
                    activeScan === scan.label
                      ? 'border-foreground bg-foreground text-background shadow-[3px_3px_0_var(--foreground)]'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  {scan.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon
                const isSelected = selected.includes(module.id)
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        isSelected ? current.filter((item) => item !== module.id) : [...current, module.id]
                      )
                    }
                    className={`group flex min-h-28 flex-col justify-between border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-foreground bg-card text-foreground shadow-[4px_4px_0_var(--foreground)] ring-1 ring-foreground/20'
                        : 'border-border bg-card/60 text-muted-foreground opacity-70 hover:opacity-100 hover:border-foreground'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start justify-between">
                      <Icon className={`size-5 transition-colors ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`} />
                      <span
                        className={`grid size-5 place-items-center border-2 ${
                          isSelected ? 'border-foreground bg-foreground text-background font-bold' : 'border-border bg-background'
                        }`}
                      >
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                      </span>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold text-foreground">{module.label}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{module.detail}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => runScan()}
                disabled={isScanning || !number.trim() || selected.length === 0}
                className="flex w-full items-center justify-center gap-3 border-2 border-foreground bg-primary px-5 py-4 font-mono text-sm font-bold uppercase tracking-[0.1em] text-primary-foreground shadow-[5px_5px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none transition-transform"
              >
                <Search className="size-5" />
                {isScanning ? 'mapping signals...' : 'run lookup'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Docs / Cards */}
      <section id="docs" className="mx-auto grid max-w-[1480px] gap-4 px-5 pb-16 md:grid-cols-3 md:px-10">
        <div className="border-2 border-foreground bg-primary p-6 text-primary-foreground md:col-span-2 shadow-[6px_6px_0_var(--foreground)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">latest lookup / verified engine</p>
          <div className="mt-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-3xl font-bold tracking-[-0.08em]">+91 98100 12345</p>
              <p className="mt-2 text-sm opacity-90">Bharti Airtel · Delhi NCR · Mobile · 0 reports clean</p>
            </div>
            <ArrowUpRight className="size-8" />
          </div>
        </div>
        <div className="border-2 border-foreground bg-card p-6 shadow-[6px_6px_0_var(--foreground)]">
          <Clock3 className="size-6 text-primary" />
          <p className="mt-12 font-mono text-sm font-bold">private by default.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            No tracking. No account required. Public & operator intelligence only.
          </p>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1480px] flex-col gap-4 border-t border-border px-5 py-7 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-10">
        <span>numdox / intelligence, without the noise</span>
        <span>built for analysts · v0.1.0 beta</span>
      </footer>
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  )
}