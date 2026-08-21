// ============================================
// Spam Scorer Service
// Aggregates spam reputation from multiple sources
// ============================================

import { SpamScore } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'

interface SpamSourceResult {
  source: string
  score: number // 0-100
  reports: number
  categories: string[]
  lastReported: string | null
}

export class SpamScorer {
  private static cache: Map<string, { data: SpamScore; expires: number }> = new Map()

  static async score(phone: string, countryCode?: string): Promise<{ spam: SpamScore; cached: boolean }> {
    const cacheKey = `spam:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { spam: cached.data, cached: true }
    }

    // Query multiple spam sources
    const sourceResults = await Promise.allSettled([
      this.checkTruecaller(phone),
      this.checkShouldIAnswer(phone),
      this.checkSyncMe(phone),
      this.checkNumVerifySpam(phone),
    ])

    // Aggregate results
    const validResults: SpamSourceResult[] = []
    for (const result of sourceResults) {
      if (result.status === 'fulfilled' && result.value) {
        validResults.push(result.value)
      }
    }

    const aggregated = this.aggregateSpamScore(validResults)
    this.setCache(cacheKey, aggregated)
    return { spam: aggregated, cached: false }
  }

  // Truecaller - limited public API, mostly scraping
  private static async checkTruecaller(phone: string): Promise<SpamSourceResult | null> {
    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      // Truecaller has a public search but limited API
      // This would need scraping or their business API
      return null
    } catch {
      return null
    }
  }

  // ShouldIAnswer - community spam database
  private static async checkShouldIAnswer(phone: string): Promise<SpamSourceResult | null> {
    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      // ShouldIAnswer has a public API
      // https://www.shouldianswer.com/api/
      const response = await fetch(
        `https://www.shouldianswer.com/api/v1/number/${cleanedPhone}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!response.ok) return null

      const data = await response.json() as any
      if (!data || data.error) return null

      return {
        source: 'shouldianswer',
        score: Math.min(data.spamScore * 10 || 0, 100),
        reports: data.reports || 0,
        categories: data.categories || [],
        lastReported: data.lastReport || null,
      }
    } catch {
      return null
    }
  }

  // Sync.me - caller ID database
  private static async checkSyncMe(phone: string): Promise<SpamSourceResult | null> {
    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      // Sync.me API (limited)
      return null
    } catch {
      return null
    }
  }

  // NumVerify spam info
  private static async checkNumVerifySpam(phone: string): Promise<SpamSourceResult | null> {
    const apiKey = process.env[ENV_KEYS.NUMVERIFY_API_KEY]
    if (!apiKey) return null

    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${cleanedPhone}&format=1`

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null

      const data = await response.json() as any
      if (!data.valid) return null

      return {
        source: 'numverify',
        score: data.spam_score ? Math.min(data.spam_score * 10, 100) : 0,
        reports: 0,
        categories: data.spam_type ? [data.spam_type] : [],
        lastReported: null,
      }
    } catch {
      return null
    }
  }

  private static aggregateSpamScore(results: SpamSourceResult[]): SpamScore {
    if (results.length === 0) {
      return this.getDefaultSpamScore()
    }

    // Weighted average: more recent and more reports = higher weight
    let totalWeight = 0
    let weightedScore = 0
    let totalReports = 0
    const allCategories = new Set<string>()
    let latestReport: string | null = null

    for (const result of results) {
      const weight = Math.max(1, Math.log10(result.reports + 1)) * 10
      weightedScore += result.score * weight
      totalWeight += weight
      totalReports += result.reports
      result.categories.forEach((c) => allCategories.add(c))

      if (result.lastReported) {
        const reportDate = new Date(result.lastReported)
        if (!latestReport || reportDate > new Date(latestReport)) {
          latestReport = result.lastReported
        }
      }
    }

    const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
    const level = this.getSpamLevel(finalScore)

    return {
      score: finalScore,
      level,
      reports: totalReports,
      categories: Array.from(allCategories),
      lastReported: latestReport,
      sources: results.map((r) => r.source),
      details: {
        sourceCount: results.length,
        sources: results,
      },
    }
  }

  private static getSpamLevel(score: number): SpamScore['level'] {
    if (score >= 80) return 'critical'
    if (score >= 60) return 'high'
    if (score >= 40) return 'medium'
    if (score >= 20) return 'low'
    return 'clean'
  }

  private static getDefaultSpamScore(): SpamScore {
    return {
      score: 0,
      level: 'clean',
      reports: 0,
      categories: [],
      lastReported: null,
      sources: [],
    }
  }

  private static setCache(key: string, data: SpamScore): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.spam * 1000,
    })
  }

  static clearCache(): void {
    this.cache.clear()
  }
}