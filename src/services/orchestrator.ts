// ============================================
// Orchestrator Service
// Coordinates all OSINT modules for a phone lookup
// ============================================

import { db } from '@/db'
import { phoneLookups } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  PhoneValidator,
  CarrierLookup,
  LocationLookup,
  SocialFinder,
  BreachChecker,
  SpamScorer,
  ReputationChecker,
  IdentityFinderService,
} from '@/services'
import {
  PhoneLookupResult,
  PhoneLookupRequest,
  ModuleStatus,
  MODULE_DEFINITIONS,
} from '@/types/phone'
import { CACHE_TTL } from '@/lib/constants'

// Simple UUID generator for edge runtime
function generateId(): string {
  return crypto.randomUUID()
}

export interface LookupProgress {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: {
    current: number
    total: number
    currentModule: string
    modules: Array<{
      name: string
      status: 'pending' | 'processing' | 'completed' | 'failed'
      startedAt?: string
      completedAt?: string
    }>
  }
}

declare global {
  var __phonetrace_jobProgress: Map<string, LookupProgress> | undefined
  var __phonetrace_jobResults: Map<string, PhoneLookupResult> | undefined
}

const globalJobProgress = globalThis.__phonetrace_jobProgress ?? new Map<string, LookupProgress>()
const globalJobResults = globalThis.__phonetrace_jobResults ?? new Map<string, PhoneLookupResult>()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__phonetrace_jobProgress = globalJobProgress
  globalThis.__phonetrace_jobResults = globalJobResults
}

export class PhoneOrchestrator {
  private static jobProgress: Map<string, LookupProgress> = globalJobProgress
  private static jobResults: Map<string, PhoneLookupResult> = globalJobResults

  static async startLookup(
    request: PhoneLookupRequest,
    userId?: string,
    apiKeyId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const jobId = generateId()
    const maskedPhone = this.maskPhone(request.phone)

    // Create database record if available
    try {
      await db.insert(phoneLookups).values({
        jobId,
        userId,
        apiKeyId,
        phone: request.phone,
        maskedPhone,
        countryCode: request.countryCode,
        modules: request.modules,
        status: 'pending',
        startedAt: new Date(),
        ipAddress,
        userAgent,
      })
    } catch (err) {
      console.warn('Database insert skipped (offline or unconfigured):', err instanceof Error ? err.message : err)
    }

    // Initialize progress tracking
    const modules = request.modules.map((name) => {
      const def = MODULE_DEFINITIONS.find((m) => m.name === name)
      return {
        name,
        status: 'pending' as const,
        startedAt: undefined,
        completedAt: undefined,
      }
    })

    this.jobProgress.set(jobId, {
      jobId,
      status: 'pending',
      progress: {
        current: 0,
        total: modules.length,
        currentModule: modules[0]?.name || '',
        modules,
      },
    })

    // Start async processing
    this.processLookup(jobId, request).catch((error) => {
      console.error(`Lookup ${jobId} failed:`, error)
      const message = error instanceof Error ? error.message : String(error)
      this.updateJobStatus(jobId, 'failed', message)
    })

    return jobId
  }

  private static async processLookup(jobId: string, request: PhoneLookupRequest): Promise<void> {
    this.updateJobStatus(jobId, 'processing')

    try {
      const results: Partial<PhoneLookupResult> = {
        jobId,
        phone: request.phone,
        status: 'processing',
        startedAt: new Date().toISOString(),
      }

      const modules = request.modules
      const totalModules = modules.length
      let completedModules = 0

      for (const moduleName of modules) {
        this.updateModuleStatus(jobId, moduleName, 'processing')
        const startedAt = new Date().toISOString()

        try {
          switch (moduleName) {
            case 'validation': {
              const { validation } = await PhoneValidator.validate(request.phone, request.countryCode)
              results.validation = validation
              break
            }
            case 'carrier': {
              const { carrier } = await CarrierLookup.lookup(request.phone, request.countryCode)
              results.carrier = carrier
              break
            }
            case 'location': {
              const { location } = await LocationLookup.lookup(request.phone, request.countryCode)
              results.location = location
              break
            }
            case 'social': {
              const { accounts } = await SocialFinder.findAccounts(request.phone)
              results.social = accounts
              break
            }
            case 'breach': {
              const { breaches } = await BreachChecker.checkBreaches(request.phone)
              results.breaches = breaches
              break
            }
            case 'spam': {
              const { spam } = await SpamScorer.score(request.phone, request.countryCode)
              results.spam = spam
              break
            }
            case 'reputation': {
              const { reputation } = await ReputationChecker.check(request.phone, request.countryCode)
              results.reputation = reputation
              break
            }
            case 'identity': {
              const idProfile = await IdentityFinderService.resolveIdentity(request.phone)
              results.identity = {
                primaryName: idProfile.primaryName,
                aliases: idProfile.aliases,
                namesDiscovered: idProfile.namesDiscovered,
                confidence: idProfile.primaryName ? 'high' : 'low',
                source: idProfile.sources.join(', '),
                upiHandles: idProfile.upiHandles,
                truecallerUrl: idProfile.truecallerSearchUrl,
              }
              break
            }
          }

          this.updateModuleStatus(jobId, moduleName, 'completed', startedAt)
        } catch (error) {
          console.error(`Module ${moduleName} failed for job ${jobId}:`, error)
          const message = error instanceof Error ? error.message : String(error)
          this.updateModuleStatus(jobId, moduleName, 'failed', startedAt, message)
        }

        completedModules++
        this.updateProgress(jobId, completedModules, totalModules, moduleName)
      }

      // Finalize
      const finalResult: PhoneLookupResult = {
        ...results,
        status: 'completed',
        completedAt: new Date().toISOString(),
        cached: false,
      } as PhoneLookupResult

      // Store in in-memory map
      this.jobResults.set(jobId, finalResult)

      // Update database if available
      try {
        await db
          .update(phoneLookups)
          .set({
            status: 'completed',
            validation: finalResult.validation,
            carrier: finalResult.carrier,
            location: finalResult.location,
            social: finalResult.social,
            breaches: finalResult.breaches,
            spam: finalResult.spam,
            reputation: finalResult.reputation,
            completedAt: new Date(),
          })
          .where(eq(phoneLookups.jobId, jobId))
      } catch (err) {
        console.warn('Database update skipped:', err instanceof Error ? err.message : err)
      }

      this.updateJobStatus(jobId, 'completed', undefined, finalResult)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const failedResult: PhoneLookupResult = {
        jobId,
        phone: request.phone,
        status: 'failed',
        error: errorMessage,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        validation: null,
        carrier: null,
        location: null,
        social: [],
        breaches: [],
        spam: null,
        reputation: null,
        cached: false,
      }
      this.jobResults.set(jobId, failedResult)

      try {
        await db
          .update(phoneLookups)
          .set({
            status: 'failed',
            error: errorMessage,
            completedAt: new Date(),
          })
          .where(eq(phoneLookups.jobId, jobId))
      } catch (err) {
        console.warn('Database update skipped:', err instanceof Error ? err.message : err)
      }

      this.updateJobStatus(jobId, 'failed', errorMessage)
    }
  }

  static getJobStatus(jobId: string): LookupProgress | null {
    return this.jobProgress.get(jobId) || null
  }

  static async getJobResult(jobId: string): Promise<PhoneLookupResult | null> {
    // Check in-memory first
    if (this.jobResults.has(jobId)) {
      return this.jobResults.get(jobId)!
    }

    try {
      // Fetch from database
      const [lookup] = await db
        .select()
        .from(phoneLookups)
        .where(eq(phoneLookups.jobId, jobId))
        .limit(1)

      if (!lookup) return null

      return {
        jobId: lookup.jobId,
        phone: lookup.phone,
        status: lookup.status as PhoneLookupResult['status'],
        validation: lookup.validation as PhoneLookupResult['validation'],
        carrier: lookup.carrier as PhoneLookupResult['carrier'],
        location: lookup.location as PhoneLookupResult['location'],
        social: lookup.social as PhoneLookupResult['social'],
        breaches: lookup.breaches as PhoneLookupResult['breaches'],
        spam: lookup.spam as PhoneLookupResult['spam'],
        reputation: lookup.reputation as PhoneLookupResult['reputation'],
        error: lookup.error,
        startedAt: lookup.startedAt.toISOString(),
        completedAt: lookup.completedAt?.toISOString() || null,
        cached: lookup.cached,
      }
    } catch {
      return null
    }
  }

  static async getHistory(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    const [items, [{ count }]] = await Promise.all([
      db
        .select()
        .from(phoneLookups)
        .where(eq(phoneLookups.userId, userId))
        .orderBy(phoneLookups.startedAt)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: phoneLookups.id })
        .from(phoneLookups)
        .where(eq(phoneLookups.userId, userId)),
    ])

    return {
      items: items.map((lookup) => ({
        id: lookup.id,
        phone: lookup.phone,
        maskedPhone: lookup.maskedPhone,
        status: lookup.status,
        modulesRun: lookup.modules,
        createdAt: lookup.startedAt.toISOString(),
        completedAt: lookup.completedAt?.toISOString() || null,
      })),
      total: Number(count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(count) / pageSize),
    }
  }

  private static updateJobStatus(
    jobId: string,
    status: LookupProgress['status'],
    error?: string,
    result?: PhoneLookupResult
  ): void {
    const progress = this.jobProgress.get(jobId)
    if (progress) {
      progress.status = status
      if (error) {
        // Find the current module and mark as failed
        const currentModule = progress.progress.modules.find(
          (m) => m.status === 'processing'
        )
        if (currentModule) {
          currentModule.status = 'failed'
          currentModule.completedAt = new Date().toISOString()
        }
      }
    }
  }

  private static updateModuleStatus(
    jobId: string,
    moduleName: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    startedAt?: string,
    error?: string
  ): void {
    const progress = this.jobProgress.get(jobId)
    if (progress) {
      const moduleItem = progress.progress.modules.find((m) => m.name === moduleName)
      if (moduleItem) {
        moduleItem.status = status
        if (startedAt) moduleItem.startedAt = startedAt
        if (status === 'completed' || status === 'failed') {
          moduleItem.completedAt = new Date().toISOString()
        }
      }
    }
  }

  private static updateProgress(
    jobId: string,
    current: number,
    total: number,
    currentModule: string
  ): void {
    const progress = this.jobProgress.get(jobId)
    if (progress) {
      progress.progress.current = current
      progress.progress.total = total
      progress.progress.currentModule = currentModule
    }
  }

  private static maskPhone(phone: string): string {
    const cleaned = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
    if (cleaned.length <= 4) return cleaned
    return cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4)
  }

  static clearJob(jobId: string): void {
    this.jobProgress.delete(jobId)
  }
}