// ============================================
// Breach Checker Service
// HaveIBeenPwned API integration
// ============================================

import { BreachInfo } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'

interface HIBPBreach {
  Name: string
  Title: string
  Domain: string
  BreachDate: string
  AddedDate: string
  ModifiedDate: string
  PwnCount: number
  Description: string
  LogoPath: string
  DataClasses: string[]
  IsVerified: boolean
  IsFabricated: boolean
  IsSensitive: boolean
  IsRetired: boolean
  IsSpamList: boolean
  IsMalware: boolean
  IsSubscriptionFree: boolean
}

export class BreachChecker {
  private static cache: Map<string, { data: BreachInfo[]; expires: number }> = new Map()

  static async checkBreaches(phone: string): Promise<{ breaches: BreachInfo[]; cached: boolean }> {
    const cacheKey = `breach:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { breaches: cached.data, cached: true }
    }

    const breaches = await this.queryHIBP(phone)
    this.setCache(cacheKey, breaches)
    return { breaches, cached: false }
  }

  private static async queryHIBP(phone: string): Promise<BreachInfo[]> {
    const apiKey = process.env[ENV_KEYS.HIBP_API_KEY]
    const headers: Record<string, string> = {
      'User-Agent': 'phonetrace-osint',
      'Accept': 'application/json',
    }

    if (apiKey) {
      headers['hibp-api-key'] = apiKey
    }

    try {
      // HIBP doesn't directly support phone number lookups in free tier
      // We'd need to query by email or domain
      // For now, we'll check if the phone appears in any breach data classes
      // This is a limitation - HIBP primarily indexes emails

      // Alternative: Use PhoneInfoga or other phone-specific breach databases
      // For now, return empty with note
      return this.getMockBreachData(phone)
    } catch (error) {
      console.error('HIBP API error:', error)
      return []
    }
  }

  // In production, integrate with:
  // - PhoneInfoga (https://phoneinfoga.crvs.io/)
  // - DeHashed API
  // - BreachDirectory API
  // - Custom scraping of breach data that includes phone numbers
  private static getMockBreachData(phone: string): BreachInfo[] {
    // This would be replaced with real breach API integration
    // For demo purposes, return empty array
    // Real implementation would query breach databases for phone numbers
    return []
  }

  private static setCache(key: string, data: BreachInfo[]): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.breach * 1000,
    })
  }

  static clearCache(): void {
    this.cache.clear()
  }
}

// Helper to check if phone is in breach data classes
export function isPhoneInBreachDataClasses(dataClasses: string[]): boolean {
  const phoneClasses = [
    'phone numbers',
    'phone',
    'mobile phones',
    'telephone numbers',
    'contact information',
    'personal information',
  ]
  return dataClasses.some((dc) =>
    phoneClasses.some((pc) => dc.toLowerCase().includes(pc.toLowerCase()))
  )
}