// ============================================
// Reputation Checker Service
// IP/Network reputation using existing API keys (AbuseIPDB, OTX, GreyNoise)
// ============================================

import { ReputationInfo } from '@/types/phone'
import { CACHE_TTL, ENV_KEYS } from '@/lib/constants'

interface AbuseIPDBResponse {
  data: {
    ipAddress: string
    isPublic: boolean
    ipVersion: number
    isWhitelisted: boolean
    abuseConfidenceScore: number
    countryCode: string
    countryName: string
    usageType: string
    isp: string
    domain: string
    hostnames: string[]
    totalReports: number
    numDistinctUsers: number
    lastReportedAt: string
    reports: any[]
  }
}

interface OTXResponse {
  pulse_count: number
  malware_families: string[]
  tags: string[]
}

interface GreyNoiseResponse {
  noise: boolean
  riot: boolean
  classification: string
  name: string
  link: string
  last_seen: string
  message: string
}

interface ShodanInternetDBResponse {
  ip: string
  hostnames: string[]
  ports: number[]
  tags: string[]
  vulns: string[]
  cpes: string[]
}

interface ReputationCheckResult {
  source: ReputationInfo['sources'][0]
  score: number
  categories: string[]
  asn?: string | null
  isp?: string | null
  isVpn?: boolean
  isProxy?: boolean
  isTor?: boolean
  isHosting?: boolean
  lastSeen?: string | null
}

export class ReputationChecker {
  private static cache: Map<string, { data: ReputationInfo; expires: number }> = new Map()

  static async check(phone: string, countryCode?: string): Promise<{ reputation: ReputationInfo; cached: boolean }> {
    const cacheKey = `reputation:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { reputation: cached.data, cached: true }
    }

    // For phone reputation, we need to resolve associated IPs
    // This is a limitation - phone numbers don't directly map to IPs
    // We can check the carrier's ASN/IP ranges, or use the phone to find associated IPs

    // For now, we'll use the country's general reputation as a proxy
    // In production, integrate with PhoneInfoga which can find IPs associated with numbers

    const reputation = await this.getCountryReputation(countryCode || 'US')
    this.setCache(cacheKey, reputation)
    return { reputation, cached: false }
  }

  // Get reputation for a country's IP space (proxy for phone)
  private static async getCountryReputation(countryCode: string): Promise<ReputationInfo> {
    // Since we can't directly map phone -> IP, we'll check the user's IP
    // or use carrier ASN reputation
    // This is a placeholder for the full implementation

    const sources: ReputationInfo['sources'] = []

    // Check AbuseIPDB for country-level stats (if we have an IP)
    // Check OTX for country-level pulses
    // Check GreyNoise for country-level noise

    return {
      score: 0,
      level: 'clean',
      categories: [],
      sources,
      asn: null,
      isp: null,
      isVpn: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      lastSeen: null,
    }
  }

  // Check an IP address directly (for when we have IP from phone infra)
  static async checkIP(ip: string): Promise<ReputationInfo> {
    const cacheKey = `reputation:ip:${ip}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return cached.data
    }

    const results = await Promise.allSettled([
      this.checkAbuseIPDB(ip),
      this.checkOTX(ip),
      this.checkGreyNoise(ip),
      this.checkShodanInternetDB(ip),
    ])

    const sources: ReputationInfo['sources'] = []
    let maxScore = 0
    const categories = new Set<string>()
    let asn: string | null = null
    let isp: string | null = null
    let isVpn = false
    let isProxy = false
    let isTor = false
    let isHosting = false
    let lastSeen: string | null = null

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        sources.push(result.value.source)
        maxScore = Math.max(maxScore, result.value.score || 0)
        result.value.categories?.forEach((c) => categories.add(c))
        if (result.value.asn) asn = result.value.asn
        if (result.value.isp) isp = result.value.isp
        if (result.value.isVpn) isVpn = true
        if (result.value.isProxy) isProxy = true
        if (result.value.isTor) isTor = true
        if (result.value.isHosting) isHosting = true
        if (result.value.lastSeen && (!lastSeen || result.value.lastSeen > lastSeen)) {
          lastSeen = result.value.lastSeen
        }
      }
    }

    const level = this.getReputationLevel(maxScore)

    const reputation: ReputationInfo = {
      score: maxScore,
      level,
      categories: Array.from(categories),
      sources,
      asn,
      isp,
      isVpn,
      isProxy,
      isTor,
      isHosting,
      lastSeen,
    }

    this.setCache(cacheKey, reputation)
    return reputation
  }

  private static async checkAbuseIPDB(ip: string): Promise<ReputationCheckResult | null> {
    const apiKey = process.env[ENV_KEYS.ABUSEIPDB_API_KEY]
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose=true`,
        {
          headers: {
            'Key': apiKey,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      )

      if (!response.ok) return null

      const data = await response.json() as AbuseIPDBResponse
      const d = data.data

      return {
        source: {
          name: 'AbuseIPDB',
          score: d.abuseConfidenceScore,
          categories: [d.usageType],
          url: `https://www.abuseipdb.com/check/${ip}`,
        },
        score: d.abuseConfidenceScore,
        categories: [d.usageType].filter(Boolean),
        asn: null, // Would need separate ASN lookup
        isp: d.isp,
        isVpn: d.usageType?.toLowerCase().includes('vpn') || false,
        isProxy: d.usageType?.toLowerCase().includes('proxy') || false,
        isTor: d.usageType?.toLowerCase().includes('tor') || false,
        isHosting: d.usageType?.toLowerCase().includes('hosting') || false,
        lastSeen: d.lastReportedAt || null,
      }
    } catch {
      return null
    }
  }

  private static async checkOTX(ip: string): Promise<ReputationCheckResult | null> {
    const apiKey = process.env[ENV_KEYS.OTX_API_KEY]
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`,
        {
          headers: {
            'X-OTX-API-KEY': apiKey,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      )

      if (!response.ok) return null

      const data = await response.json() as OTXResponse

      const categories = [...data.tags, ...data.malware_families].filter(Boolean)
      const score = Math.min(data.pulse_count * 5, 100)

      return {
        source: {
          name: 'AlienVault OTX',
          score,
          categories,
          url: `https://otx.alienvault.com/indicator/ip/${ip}`,
        },
        score,
        categories,
      }
    } catch {
      return null
    }
  }

  private static async checkGreyNoise(ip: string): Promise<ReputationCheckResult | null> {
    const apiKey = process.env[ENV_KEYS.GREYNOISE_API_KEY]
    if (!apiKey) return null

    try {
      const response = await fetch(
        `https://api.greynoise.io/v3/community/${ip}`,
        {
          headers: {
            'key': apiKey,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      )

      if (!response.ok) return null

      const data = await response.json() as GreyNoiseResponse

      let score = 0
      const categories: string[] = []

      if (data.noise) {
        score += 30
        categories.push('internet_scanner')
      }
      if (data.riot) {
        score -= 20 // Benign service
      }
      if (data.classification === 'malicious') {
        score += 50
        categories.push('malicious')
      }

      return {
        source: {
          name: 'GreyNoise',
          score: Math.max(0, Math.min(100, score)),
          categories,
          url: `https://viz.greynoise.io/ip/${ip}`,
        },
        score: Math.max(0, Math.min(100, score)),
        categories,
        isVpn: false,
        isProxy: false,
        isTor: false,
        isHosting: false,
      }
    } catch {
      return null
    }
  }

  private static async checkShodanInternetDB(ip: string): Promise<ReputationCheckResult | null> {
    try {
      const response = await fetch(
        `https://internetdb.shodan.io/${ip}`,
        { signal: AbortSignal.timeout(5000) }
      )

      if (!response.ok) return null

      const data = await response.json() as ShodanInternetDBResponse

      const categories = [...data.tags, ...data.vulns].filter(Boolean)
      const score = categories.length > 0 ? Math.min(categories.length * 10, 100) : 0

      return {
        source: {
          name: 'Shodan InternetDB',
          score,
          categories,
          url: `https://www.shodan.io/host/${ip}`,
        },
        score,
        categories,
        asn: null,
        isp: null,
        isVpn: data.tags.includes('vpn'),
        isProxy: data.tags.includes('proxy'),
        isTor: data.tags.includes('tor'),
        isHosting: data.tags.includes('cloud') || data.tags.includes('hosting'),
      }
    } catch {
      return null
    }
  }

  private static getReputationLevel(score: number): ReputationInfo['level'] {
    if (score >= 70) return 'malicious'
    if (score >= 30) return 'suspicious'
    return 'clean'
  }

  private static setCache(key: string, data: ReputationInfo): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.reputation * 1000,
    })
  }

  static clearCache(): void {
    this.cache.clear()
  }
}