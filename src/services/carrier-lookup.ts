// ============================================
// Carrier Lookup Service
// Combines multiple free sources + optional paid APIs
// ============================================

import { CarrierInfo } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'
import { parseIndianPhoneNumber } from '@/lib/india-telecom'

interface CarrierApiResponse {
  carrier?: string
  type?: string
  mcc?: string
  mnc?: string
  error?: string
}

export class CarrierLookup {
  private static cache: Map<string, { data: CarrierInfo; expires: number }> = new Map()

  static async lookup(phone: string, countryCode?: string): Promise<{ carrier: CarrierInfo; cached: boolean }> {
    const cacheKey = `carrier:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { carrier: cached.data, cached: true }
    }

    // Check Indian telecom numbering database first for India (+91)
    const indianInfo = parseIndianPhoneNumber(phone)

    // Try multiple sources in order of preference
    const results = await Promise.allSettled([
      this.lookupFreeCarrierApi(phone, countryCode),
      this.lookupNumVerify(phone, countryCode),
      this.lookupAbstractApi(phone, countryCode),
      this.lookupLibphonenumberCarrier(phone, countryCode),
    ])

    // Merge results, preferring paid API results
    let bestResult: CarrierInfo = this.getDefaultCarrierInfo()

    if (indianInfo.isIndian && indianInfo.operator) {
      bestResult = {
        name: indianInfo.circle?.name ? `${indianInfo.operator} (${indianInfo.circle.name})` : indianInfo.operator,
        type: 'mobile',
        mcc: '404',
        mnc: '45',
        mccmnc: '40445',
        originalNetwork: indianInfo.operator,
        ported: false,
        confidence: 'high',
        source: 'DoT / TRAI India Series NNP',
      }
    }

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        bestResult = this.mergeCarrierInfo(bestResult, result.value)
        // If we got high confidence from a paid API, use it
        if (bestResult.confidence === 'high' && !indianInfo.isIndian) break
      }
    }

    this.setCache(cacheKey, bestResult)
    return { carrier: bestResult, cached: false }
  }

  // FreeCarrierAPI - free tier available
  private static async lookupFreeCarrierApi(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    try {
      const cleanedPhone = phone.replace(/[^\d+]/g, '')
      const url = `https://api.freecarrierapi.com/v1/${cleanedPhone}`

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) return null

      const data = await response.json() as CarrierApiResponse

      if (data.error || !data.carrier) return null

      return {
        name: data.carrier,
        type: this.mapCarrierType(data.type),
        mcc: data.mcc || null,
        mnc: data.mnc || null,
        mccmnc: data.mcc && data.mnc ? `${data.mcc}${data.mnc}` : null,
        originalNetwork: null,
        ported: false,
        confidence: 'medium',
        source: 'freecarrierapi',
      }
    } catch {
      return null
    }
  }

  // NumVerify - 100 req/month free
  private static async lookupNumVerify(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    const apiKey = process.env[ENV_KEYS.NUMVERIFY_API_KEY]
    if (!apiKey) return null

    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${cleanedPhone}&country_code=${countryCode || ''}&format=1`

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null

      const data = await response.json() as any

      if (!data.valid || !data.carrier) return null

      return {
        name: data.carrier,
        type: this.mapCarrierType(data.line_type),
        mcc: null,
        mnc: null,
        mccmnc: null,
        originalNetwork: null,
        ported: false,
        confidence: 'high',
        source: 'numverify',
      }
    } catch {
      return null
    }
  }

  // AbstractAPI - 250 req/month free
  private static async lookupAbstractApi(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    const apiKey = process.env[ENV_KEYS.ABSTRACT_API_KEY]
    if (!apiKey) return null

    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      const url = `https://phonevalidation.abstractapi.com/v1/?api_key=${apiKey}&phone=${cleanedPhone}`

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null

      const data = await response.json() as any

      if (!data.carrier) return null

      return {
        name: data.carrier,
        type: this.mapCarrierType(data.type),
        mcc: data.mcc || null,
        mnc: data.mnc || null,
        mccmnc: data.mcc && data.mnc ? `${data.mcc}${data.mnc}` : null,
        originalNetwork: null,
        ported: false,
        confidence: 'high',
        source: 'abstractapi',
      }
    } catch {
      return null
    }
  }

  // libphonenumber carrier mapping (basic, offline)
  private static async lookupLibphonenumberCarrier(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    try {
      const { parsePhoneNumberFromString } = await import('libphonenumber-js')
      const phoneNumber = parsePhoneNumberFromString(phone, countryCode as any)

      if (!phoneNumber || !phoneNumber.isValid()) return null

      // libphonenumber doesn't have carrier data, but we can infer type
      const type = phoneNumber.getType()

      return {
        name: null,
        type: this.mapLibphonenumberType(type),
        mcc: null,
        mnc: null,
        mccmnc: null,
        originalNetwork: null,
        ported: false,
        confidence: 'low',
        source: 'libphonenumber',
      }
    } catch {
      return null
    }
  }

  private static mapCarrierType(type?: string): CarrierInfo['type'] {
    if (!type) return 'unknown'
    const t = type.toLowerCase()
    if (t.includes('mobile') || t.includes('cell') || t.includes('wireless')) return 'mobile'
    if (t.includes('landline') || t.includes('fixed') || t.includes('wireline')) return 'landline'
    if (t.includes('voip') || t.includes('voice over ip')) return 'voip'
    if (t.includes('toll') || t.includes('freephone')) return 'toll_free'
    if (t.includes('premium') || t.includes('special')) return 'premium'
    return 'unknown'
  }

  private static mapLibphonenumberType(type?: string): CarrierInfo['type'] {
    if (!type) return 'unknown'
    const t = type.toUpperCase()
    if (t === 'MOBILE') return 'mobile'
    if (t === 'FIXED_LINE') return 'landline'
    if (t === 'VOIP') return 'voip'
    if (t === 'TOLL_FREE') return 'toll_free'
    if (t === 'PREMIUM_RATE') return 'premium'
    return 'unknown'
  }

  private static getDefaultCarrierInfo(): CarrierInfo {
    return {
      name: null,
      type: 'unknown',
      mcc: null,
      mnc: null,
      mccmnc: null,
      originalNetwork: null,
      ported: false,
      confidence: 'low',
      source: 'none',
    }
  }

  private static mergeCarrierInfo(base: CarrierInfo, incoming: CarrierInfo): CarrierInfo {
    // Prefer higher confidence
    if (incoming.confidence === 'high' && base.confidence !== 'high') {
      return incoming
    }
    if (incoming.confidence === 'medium' && base.confidence === 'low') {
      return incoming
    }
    // Merge non-null fields
    return {
      ...base,
      name: incoming.name || base.name,
      type: incoming.type !== 'unknown' ? incoming.type : base.type,
      mcc: incoming.mcc || base.mcc,
      mnc: incoming.mnc || base.mnc,
      mccmnc: incoming.mccmnc || base.mccmnc,
      confidence: incoming.confidence,
      source: incoming.source,
    }
  }

  private static setCache(key: string, data: CarrierInfo): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.carrier * 1000,
    })
  }

  static clearCache(): void {
    this.cache.clear()
  }
}