// ============================================
// Location Lookup Service
// Geographic location from phone number
// ============================================

import { LocationInfo } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'
import { parseIndianPhoneNumber } from '@/lib/india-telecom'

interface GeoApiResponse {
  country?: string
  countryCode?: string
  region?: string
  regionName?: string
  city?: string
  lat?: number
  lon?: number
  timezone?: string
  isp?: string
  org?: string
  as?: string
  query?: string
}

export class LocationLookup {
  private static cache: Map<string, { data: LocationInfo; expires: number }> = new Map()

  static async lookup(phone: string, countryCode?: string): Promise<{ location: LocationInfo; cached: boolean }> {
    const cacheKey = `location:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { location: cached.data, cached: true }
    }

    // Check Indian telecom numbering database for India (+91)
    const indianInfo = parseIndianPhoneNumber(phone)

    // For phone numbers, we can only get location from the country/area code
    // We'll use libphonenumber for basic location, then try geocoding APIs
    const results = await Promise.allSettled([
      this.lookupLibphonenumberLocation(phone, countryCode),
      this.lookupOpenCage(phone, countryCode),
      this.lookupIpApi(phone, countryCode),
    ])

    let bestResult: LocationInfo = this.getDefaultLocationInfo()

    if (indianInfo.isIndian && indianInfo.circle) {
      bestResult = {
        country: 'IN',
        countryCode: 'IN',
        countryName: 'India',
        region: indianInfo.circle.name,
        regionCode: indianInfo.circle.code,
        city: indianInfo.circle.capital,
        latitude: indianInfo.circle.latitude,
        longitude: indianInfo.circle.longitude,
        timezone: 'Asia/Kolkata (IST)',
        isp: null,
        org: 'Department of Telecommunications (DoT) LSA',
        asn: null,
        accuracy: 'region',
        source: 'DoT Telecom Circle',
      }
    }

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        bestResult = this.mergeLocationInfo(bestResult, result.value)
        if (bestResult.accuracy === 'exact' || bestResult.accuracy === 'city') break
      }
    }

    this.setCache(cacheKey, bestResult)
    return { location: bestResult, cached: false }
  }

  // libphonenumber - basic geographic info from number
  private static async lookupLibphonenumberLocation(phone: string, countryCode?: string): Promise<LocationInfo | null> {
    try {
      const { parsePhoneNumberFromString } = await import('libphonenumber-js')
      const phoneNumber = parsePhoneNumberFromString(phone, countryCode as any)

      if (!phoneNumber || !phoneNumber.isValid()) return null

      const country = phoneNumber.country
      if (!country) return null

      const regionCode = country

      return {
        country: country,
        countryCode: country,
        countryName: this.getCountryName(country),
        region: regionCode || null,
        regionCode: regionCode || null,
        city: null,
        latitude: null,
        longitude: null,
        timezone: this.getTimezoneForCountry(country),
        isp: null,
        org: null,
        asn: null,
        accuracy: 'country',
        source: 'libphonenumber',
      }
    } catch {
      return null
    }
  }

  // OpenCage Geocoding - 2,500 req/day free
  private static async lookupOpenCage(phone: string, countryCode?: string): Promise<LocationInfo | null> {
    const apiKey = process.env[ENV_KEYS.OPENCAGE_API_KEY]
    if (!apiKey) return null

    try {
      const { parsePhoneNumberFromString } = await import('libphonenumber-js')
      const phoneNumber = parsePhoneNumberFromString(phone, countryCode as any)
      if (!phoneNumber || !phoneNumber.country) return null

      // Geocode the country/region
      const query = phoneNumber.country
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1&no_annotations=1`

      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return null

      const data = await response.json() as any
      if (!data.results || data.results.length === 0) return null

      const result = data.results[0]
      const components = result.components

      return {
        country: components.country_code?.toUpperCase() || phoneNumber.country,
        countryCode: components.country_code?.toUpperCase() || phoneNumber.country,
        countryName: components.country,
        region: components.state || components.region || null,
        regionCode: components.state_code || null,
        city: components.city || components.town || components.village || null,
        latitude: result.geometry?.lat || null,
        longitude: result.geometry?.lng || null,
        timezone: result.annotations?.timezone?.name || null,
        isp: null,
        org: null,
        asn: null,
        accuracy: result.confidence >= 9 ? 'exact' : result.confidence >= 7 ? 'city' : 'region',
        source: 'opencage',
      }
    } catch {
      return null
    }
  }

  // ip-api.com - free, no key required (but for IPs, not phones)
  // We'll use this if we can resolve an IP from the phone (limited use case)
  private static async lookupIpApi(phone: string, countryCode?: string): Promise<LocationInfo | null> {
    // This would require an IP address, not directly applicable to phone numbers
    // Kept for future use if we integrate with IP-based lookups
    return null
  }

  private static getCountryName(countryCode: string): string {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
      GB: 'United Kingdom',
      AU: 'Australia',
      DE: 'Germany',
      FR: 'France',
      IN: 'India',
      BR: 'Brazil',
      MX: 'Mexico',
      ES: 'Spain',
      IT: 'Italy',
      JP: 'Japan',
      KR: 'South Korea',
      CN: 'China',
      RU: 'Russia',
    }
    return countryNames[countryCode] || countryCode
  }

  private static getTimezoneForCountry(countryCode: string): string {
    const timezones: Record<string, string> = {
      US: 'America/New_York', // Default, actual varies by region
      CA: 'America/Toronto',
      GB: 'Europe/London',
      AU: 'Australia/Sydney',
      DE: 'Europe/Berlin',
      FR: 'Europe/Paris',
      IN: 'Asia/Kolkata',
      BR: 'America/Sao_Paulo',
      MX: 'America/Mexico_City',
      ES: 'Europe/Madrid',
      IT: 'Europe/Rome',
      JP: 'Asia/Tokyo',
      KR: 'Asia/Seoul',
      CN: 'Asia/Shanghai',
      RU: 'Europe/Moscow',
    }
    return timezones[countryCode] || 'UTC'
  }

  private static getDefaultLocationInfo(): LocationInfo {
    return {
      country: null,
      countryCode: null,
      countryName: null,
      region: null,
      regionCode: null,
      city: null,
      latitude: null,
      longitude: null,
      timezone: null,
      isp: null,
      org: null,
      asn: null,
      accuracy: 'country',
      source: 'none',
    }
  }

  private static mergeLocationInfo(base: LocationInfo, incoming: LocationInfo): LocationInfo {
    // Prefer higher accuracy
    const accuracyOrder = { exact: 4, city: 3, region: 2, country: 1 }
    const baseScore = accuracyOrder[base.accuracy]
    const incomingScore = accuracyOrder[incoming.accuracy]

    if (incomingScore > baseScore) {
      return incoming
    }

    // Merge non-null fields
    return {
      ...base,
      country: incoming.country || base.country,
      countryCode: incoming.countryCode || base.countryCode,
      countryName: incoming.countryName || base.countryName,
      region: incoming.region || base.region,
      regionCode: incoming.regionCode || base.regionCode,
      city: incoming.city || base.city,
      latitude: incoming.latitude ?? base.latitude,
      longitude: incoming.longitude ?? base.longitude,
      timezone: incoming.timezone || base.timezone,
      isp: incoming.isp || base.isp,
      org: incoming.org || base.org,
      asn: incoming.asn || base.asn,
      accuracy: incoming.accuracy,
      source: incoming.source,
    }
  }

  private static setCache(key: string, data: LocationInfo): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.location * 1000,
    })
  }

  static clearCache(): void {
    this.cache.clear()
  }
}