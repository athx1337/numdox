// ============================================
// Carrier Lookup Service
// Combines Live MSC OSINT, Global ITU Carrier DB, NumVerify, AbstractAPI & Libphonenumber
// ============================================

import { CarrierInfo } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'
import { parseIndianPhoneNumber } from '@/lib/india-telecom'
import { lookupCarrierByPrefix } from '@/lib/carrier-database'

export class CarrierLookup {
  private static cache: Map<string, { data: CarrierInfo; expires: number }> = new Map()

  static async lookup(phone: string, countryCode?: string): Promise<{ carrier: CarrierInfo; cached: boolean }> {
    const cacheKey = `carrier:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { carrier: cached.data, cached: true }
    }

    const cleaned = phone.replace(/[^\d+]/g, '')
    const isIndian = cleaned.startsWith('+91') || (cleaned.startsWith('91') && cleaned.length === 12) || cleaned.length === 10

    // 1. Check offline Global ITU / Google libphonenumber carrier database (29,000+ entries)
    const prefixMatch = lookupCarrierByPrefix(phone)

    // 2. Parse Indian telecom numbering details
    const indianInfo = parseIndianPhoneNumber(phone)

    // Initial baseline from prefix database or Indian telecom table
    let bestResult: CarrierInfo = this.getDefaultCarrierInfo()

    if (prefixMatch) {
      bestResult = {
        name: prefixMatch.normalizedName,
        type: 'mobile',
        mcc: isIndian ? '404' : null,
        mnc: isIndian ? '45' : null,
        mccmnc: isIndian ? '40445' : null,
        originalNetwork: prefixMatch.normalizedName,
        ported: false,
        confidence: 'high',
        source: prefixMatch.source,
      }
    }

    if (indianInfo.isIndian && indianInfo.operator && indianInfo.operator !== 'Indian Cellular Network (GSM/LTE/5G)') {
      const circleSuffix = indianInfo.circle?.name ? ` (${indianInfo.circle.name})` : ''
      const opName = bestResult.name && !bestResult.name.includes(circleSuffix)
        ? `${bestResult.name}${circleSuffix}`
        : `${indianInfo.operator}${circleSuffix}`

      bestResult = {
        name: opName,
        type: 'mobile',
        mcc: '404',
        mnc: '45',
        mccmnc: '40445',
        originalNetwork: indianInfo.operator,
        ported: indianInfo.operator.includes('Ported'),
        confidence: 'high',
        source: 'DoT / TRAI India Series NNP',
      }
    }

    // 3. Query concurrent providers (Live MSC, Paid APIs, Libphonenumber)
    const lookupPromises: Promise<CarrierInfo | null>[] = [
      this.lookupLiveMscCarrier(phone, countryCode),
      this.lookupNumVerify(phone, countryCode),
      this.lookupAbstractApi(phone, countryCode),
      this.lookupLibphonenumberCarrier(phone, countryCode),
    ]

    const results = await Promise.allSettled(lookupPromises)

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        bestResult = this.mergeCarrierInfo(bestResult, result.value)
      }
    }

    // If still missing a name for Indian numbers, enrich with circle if available
    if (isIndian && (!bestResult.name || bestResult.name.includes('Indian Cellular Network'))) {
      if (indianInfo.circle?.name) {
        bestResult.name = `Indian Cellular Network (${indianInfo.circle.name})`
        bestResult.type = 'mobile'
      }
    }

    this.setCache(cacheKey, bestResult)
    return { carrier: bestResult, cached: false }
  }

  // Live MSC Telecom Directory lookup (real-time operator, circle, and ported detection)
  private static async lookupLiveMscCarrier(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    const digits = phone.replace(/[^\d]/g, '')
    const isIndian = digits.startsWith('91') || (countryCode && countryCode.toUpperCase() === 'IN') || digits.length === 10
    if (!isIndian) return null

    const raw10 = digits.length >= 10 ? digits.slice(-10) : digits
    if (raw10.length !== 10) return null

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3500)

      const resp = await fetch('https://www.findandtrace.com/trace-mobile-number-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: `mobilenumber=${raw10}&submit=Trace`,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!resp.ok) return null
      const html = await resp.text()

      // Parse table cells
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
      const parsed: Record<string, string> = {}

      for (const row of rows) {
        const cells = [...row.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((m) =>
          m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
        )
        if (cells.length >= 2 && cells[0] && cells[1]) {
          parsed[cells[0].toLowerCase()] = cells[1]
        }
      }

      const circle = parsed['telecoms circle / state'] || parsed['state / circle'] || parsed['circle']
      const originalNetwork = parsed['original network (first sim)'] || parsed['original network'] || parsed['service provider']
      const currentNetwork = parsed['current network']
      const connectionStatus = parsed['connection status']

      if (originalNetwork || circle) {
        let isPorted = false
        let cleanOperator = originalNetwork || 'Indian Mobile'
        if (cleanOperator.toUpperCase() === 'AIRTEL') cleanOperator = 'Bharti Airtel'
        else if (cleanOperator.toUpperCase() === 'VODAFONE' || cleanOperator.toUpperCase() === 'IDEA') cleanOperator = 'Vodafone Idea (Vi)'
        else if (cleanOperator.toUpperCase() === 'JIO') cleanOperator = 'Reliance Jio'
        else if (cleanOperator.toUpperCase() === 'BSNL') cleanOperator = 'BSNL Mobile'
        else if (cleanOperator.toUpperCase() === 'MTS') cleanOperator = 'MTS India (Sistema)'

        if (currentNetwork && currentNetwork.toUpperCase().includes('PORT')) {
          isPorted = true
        }

        let displayName = cleanOperator
        if (isPorted) {
          displayName = `${cleanOperator} (Ported / MNP Active)`
        }
        if (circle) {
          displayName = `${displayName} (${circle})`
        }

        return {
          name: displayName,
          type: 'mobile',
          mcc: '404',
          mnc: '45',
          mccmnc: '40445',
          originalNetwork: originalNetwork || cleanOperator,
          ported: isPorted,
          confidence: 'high',
          source: `Live MSC Telecom Directory${connectionStatus ? ` [${connectionStatus}]` : ''}`,
        }
      }
    } catch {
      // Timeout or network unavailable, fall back to offline databases
    }

    return null
  }

  // NumVerify - 100 req/month free
  private static async lookupNumVerify(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    const apiKey = process.env[ENV_KEYS.NUMVERIFY_API_KEY]
    if (!apiKey) return null

    try {
      const cleanedPhone = phone.replace(/[^\d]/g, '')
      const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${cleanedPhone}&country_code=${countryCode || ''}&format=1`

      const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!response.ok) return null

      const data = (await response.json()) as any

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
        source: 'NumVerify API',
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

      const response = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!response.ok) return null

      const data = (await response.json()) as any

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
        source: 'AbstractAPI Phone Validation',
      }
    } catch {
      return null
    }
  }

  // libphonenumber carrier mapping (line type and basic info)
  private static async lookupLibphonenumberCarrier(phone: string, countryCode?: string): Promise<CarrierInfo | null> {
    try {
      const { parsePhoneNumberFromString } = await import('libphonenumber-js')
      const phoneNumber = parsePhoneNumberFromString(phone, countryCode as any)

      if (!phoneNumber || !phoneNumber.isValid()) return null

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
    // Determine the winning name and confidence
    let name = base.name
    let confidence = base.confidence
    let source = base.source

    const isBaseGeneric = !base.name || base.name.includes('Indian Cellular Network (GSM/LTE/5G)')
    const isIncomingSpecific = incoming.name && !incoming.name.includes('Indian Cellular Network')

    if (incoming.confidence === 'high') {
      if (incoming.name) {
        name = incoming.name
        confidence = 'high'
        source = incoming.source || base.source
      }
    } else if (incoming.confidence === 'medium') {
      if (isBaseGeneric && isIncomingSpecific) {
        name = incoming.name
        confidence = 'medium'
        source = incoming.source || base.source
      } else if (base.confidence === 'low' && incoming.name) {
        name = incoming.name
        confidence = 'medium'
        source = incoming.source || base.source
      }
    } else {
      // incoming is low confidence (e.g. libphonenumber with no name)
      if (isBaseGeneric && isIncomingSpecific) {
        name = incoming.name
        source = incoming.source || base.source
      }
    }

    return {
      name,
      type: incoming.type !== 'unknown' ? incoming.type : base.type,
      mcc: incoming.mcc || base.mcc,
      mnc: incoming.mnc || base.mnc,
      mccmnc: incoming.mccmnc || base.mccmnc,
      originalNetwork: incoming.originalNetwork || base.originalNetwork,
      ported: incoming.ported || base.ported,
      confidence,
      source,
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