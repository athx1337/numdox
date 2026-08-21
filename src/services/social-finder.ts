// ============================================
// Social Media Finder Service
// OSINT search across social platforms
// ============================================

import { SocialMediaAccount } from '@/types/phone'
import { CACHE_TTL } from '@/lib/constants'
import { parseIndianPhoneNumber } from '@/lib/india-telecom'

interface SocialPlatform {
  name: string
  urlPattern: (phone: string) => string
  searchUrl: (phone: string) => string
}

// Known platforms with phone-based search & Indian ecosystem
const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    name: 'Truecaller (Caller ID)',
    urlPattern: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const num = clean.startsWith('91') ? clean.slice(2) : clean
      return `https://www.truecaller.com/search/in/+91${num}`
    },
    searchUrl: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const num = clean.startsWith('91') ? clean.slice(2) : clean
      return `https://www.truecaller.com/search/in/+91${num}`
    },
  },
  {
    name: 'WhatsApp Direct Chat',
    urlPattern: (phone) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`,
    searchUrl: (phone) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`,
  },
  {
    name: 'Telegram',
    urlPattern: (phone) => `https://t.me/+${phone.replace(/[^\d]/g, '')}`,
    searchUrl: (phone) => `https://t.me/+${phone.replace(/[^\d]/g, '')}`,
  },
  {
    name: 'UPI / PhonePe (@ybl)',
    urlPattern: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const raw10 = clean.slice(-10)
      return `upi://pay?pa=${raw10}@ybl&pn=VerifiedUser`
    },
    searchUrl: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const raw10 = clean.slice(-10)
      return `https://www.phonepe.com/`
    },
  },
  {
    name: 'UPI / Paytm (@paytm)',
    urlPattern: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const raw10 = clean.slice(-10)
      return `upi://pay?pa=${raw10}@paytm&pn=VerifiedUser`
    },
    searchUrl: (phone) => `https://paytm.com/`,
  },
  {
    name: 'UPI / Google Pay (@okaxis)',
    urlPattern: (phone) => {
      const clean = phone.replace(/[^\d]/g, '')
      const raw10 = clean.slice(-10)
      return `upi://pay?pa=${raw10}@okaxis&pn=VerifiedUser`
    },
    searchUrl: (phone) => `https://pay.google.com/`,
  },
  {
    name: 'DoT Sanchar Saathi (Fraud Check)',
    urlPattern: () => 'https://sancharsaathi.gov.in/sfc/',
    searchUrl: () => 'https://sancharsaathi.gov.in/sfc/',
  },
  {
    name: 'National Cybercrime Portal',
    urlPattern: () => 'https://cybercrime.gov.in/',
    searchUrl: () => 'https://cybercrime.gov.in/',
  },
  {
    name: 'Facebook',
    urlPattern: (phone) => `https://www.facebook.com/search/top/?q=${encodeURIComponent(phone)}`,
    searchUrl: (phone) => `https://www.facebook.com/search/top/?q=${encodeURIComponent(phone)}`,
  },
  {
    name: 'Instagram',
    urlPattern: (phone) => `https://www.instagram.com/explore/tags/${encodeURIComponent(phone.replace(/[^\d]/g, ''))}/`,
    searchUrl: (phone) => `https://www.instagram.com/explore/tags/${encodeURIComponent(phone.replace(/[^\d]/g, ''))}/`,
  },
  {
    name: 'LinkedIn',
    urlPattern: (phone) => `https://www.linkedin.com/search/results/index/?keywords=${encodeURIComponent(phone)}`,
    searchUrl: (phone) => `https://www.linkedin.com/search/results/index/?keywords=${encodeURIComponent(phone)}`,
  },
  {
    name: 'Twitter/X',
    urlPattern: (phone) => `https://twitter.com/search?q=${encodeURIComponent(phone)}`,
    searchUrl: (phone) => `https://twitter.com/search?q=${encodeURIComponent(phone)}`,
  },
  {
    name: 'Signal',
    urlPattern: (phone) => `#signal-${phone.replace(/[^\d]/g, '')}`,
    searchUrl: (phone) => `#signal-${phone.replace(/[^\d]/g, '')}`,
  },
]

export class SocialFinder {
  private static cache: Map<string, { data: SocialMediaAccount[]; expires: number }> = new Map()

  static async findAccounts(phone: string): Promise<{ accounts: SocialMediaAccount[]; cached: boolean }> {
    const cacheKey = `social:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { accounts: cached.data, cached: true }
    }

    const indianInfo = parseIndianPhoneNumber(phone)

    const accounts: SocialMediaAccount[] = SOCIAL_PLATFORMS.map((platform) => ({
      platform: platform.name,
      username: null,
      url: platform.urlPattern(phone),
      displayName: null,
      verified: false,
      confidence: indianInfo.isIndian && platform.name.includes('UPI') ? 'medium' as const : 'low' as const,
      foundAt: new Date().toISOString(),
      metadata: {
        searchUrl: platform.searchUrl(phone),
        method: 'direct_link',
      },
    }))

    // Optionally use social-analyzer API if available
    // This would be a more thorough check
    // Skipped for now due to rate limits/privacy concerns

    this.setCache(cacheKey, accounts)
    return { accounts, cached: false }
  }

  static clearCache(): void {
    this.cache.clear()
  }

  private static setCache(key: string, data: SocialMediaAccount[]): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.social * 1000,
    })
  }
}