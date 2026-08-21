// ============================================
// Identity & Name Discovery Service
// Real OSINT entity & name resolution engine with RapidAPI Waterfall Pool
// ============================================

import { parseIndianPhoneNumber } from '@/lib/india-telecom'

export interface DiscoveredName {
  name: string
  source: string
  confidence: 'high' | 'medium' | 'low'
  type: 'person' | 'business' | 'handle' | 'carrier_label'
  details?: string
}

export interface IdentityProfile {
  primaryName: string | null
  aliases: string[]
  namesDiscovered: DiscoveredName[]
  sources: string[]
  upiHandles: Array<{ vpa: string; app: string; verificationUrl: string }>
  truecallerSearchUrl: string
  whatsappDirectUrl: string
  googleSearchUrl: string
}

const IGNORE_TERMS = new Set([
  'contact', 'phone', 'number', 'mobile', 'whatsapp', 'call', 'sms', 'india', 'delhi',
  'mumbai', 'telecom', 'airtel', 'jio', 'vodafone', 'bsnl', 'support', 'help', 'customer',
  'service', 'privacy', 'policy', 'terms', 'about', 'home', 'search', 'results', 'login',
  'sign', 'register', 'download', 'free', 'online', 'view', 'details', 'page', 'website',
  'united', 'states', 'carrier', 'network', 'status', 'verification', 'code', 'portal'
])

export class IdentityFinderService {
  static async resolveIdentity(phone: string): Promise<IdentityProfile> {
    const clean = phone.replace(/[^\d+]/g, '')
    const digitsOnly = clean.replace(/[^\d]/g, '')
    const raw10 = digitsOnly.slice(-10)
    const isIndia = clean.startsWith('+91') || (clean.startsWith('91') && clean.length === 12) || digitsOnly.length === 10
    const prefix = clean.startsWith('+') ? clean.slice(1, -10) || '91' : '91'

    const names: DiscoveredName[] = []
    const aliases: string[] = []
    const sources: string[] = []

    // 1. RapidAPI Truecaller Waterfall Pool
    const rapidKey = process.env.RAPIDAPI_TRUECALLER_KEY || '6fe6de121bmsh0e1c2f906b4a706p14ab45jsn873459c7932b'
    if (rapidKey) {
      const endpoints = [
        {
          name: 'ViewCaller RapidAPI',
          url: `https://viewcaller.p.rapidapi.com/api/v1/search?code=${prefix}&number=${raw10}`,
          host: 'viewcaller.p.rapidapi.com',
          method: 'GET',
          parse: (data: any) => data?.data?.[0]?.name,
        },
        {
          name: 'Truecaller-Data2 RapidAPI',
          url: `https://truecaller-data2.p.rapidapi.com/search/${digitsOnly}`,
          host: 'truecaller-data2.p.rapidapi.com',
          method: 'GET',
          parse: (data: any) => data?.data?.basicInfo?.name,
        },
        {
          name: 'Truecaller4 RapidAPI',
          url: `https://truecaller4.p.rapidapi.com/api/v1/getDetails?phone=${digitsOnly}&countryCode=${isIndia ? 'IN' : 'US'}`,
          host: 'truecaller4.p.rapidapi.com',
          method: 'GET',
          parse: (data: any) => data?.data?.[0]?.name,
        },
        {
          name: 'Truecaller-API11 RapidAPI',
          url: 'https://truecaller-api11.p.rapidapi.com/v2.php',
          host: 'truecaller-api11.p.rapidapi.com',
          method: 'POST',
          body: `phone=${encodeURIComponent(raw10)}&countryCode=${isIndia ? 'in' : 'us'}`,
          parse: (data: any) => data?.truecaller_lookup?.name || data?.truecaller_lookup?.caller_name,
        },
      ]

      for (const ep of endpoints) {
        try {
          const fetchOptions: RequestInit = {
            method: ep.method,
            headers: {
              'x-rapidapi-key': rapidKey,
              'x-rapidapi-host': ep.host,
              'Content-Type': ep.method === 'POST' ? 'application/x-www-form-urlencoded' : 'application/json',
            },
            signal: AbortSignal.timeout(4500),
          }
          if (ep.method === 'POST' && ep.body) {
            fetchOptions.body = ep.body
          }

          const res = await fetch(ep.url, fetchOptions)
          if (res.ok) {
            const data = await res.json()
            const foundName = ep.parse(data)
            if (foundName && typeof foundName === 'string' && foundName.trim().length > 1) {
              const cleanName = foundName.trim()
              names.push({
                name: cleanName,
                source: `${ep.name} (Live Caller ID)`,
                confidence: 'high',
                type: 'person',
                details: 'Live verified caller directory record',
              })
              sources.push('RapidAPI Live Caller ID')
              break // Stop on first successful name in waterfall
            }
          }
        } catch {
          // Fallover to next provider in pool
          continue
        }
      }
    }

    // 2. Direct Truecaller Bearer Auth (if token configured)
    const truecallerToken = process.env.TRUECALLER_AUTH_TOKEN
    if (truecallerToken && names.length === 0) {
      try {
        const tcUrl = `https://search5-noneu.truecaller.com/v2/search?q=${encodeURIComponent(clean)}&countryCode=${isIndia ? 'in' : 'us'}&type=4`
        const tcRes = await fetch(tcUrl, {
          headers: {
            Authorization: `Bearer ${truecallerToken}`,
            'User-Agent': 'Truecaller/13.35.6 (Android;13)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        })

        if (tcRes.ok) {
          const tcData = await tcRes.json()
          const item = tcData?.data?.[0]
          if (item?.name) {
            names.push({
              name: item.name.trim(),
              source: 'Truecaller Direct Bearer Auth',
              confidence: 'high',
              type: 'person',
            })
            sources.push('Truecaller Direct')
          }
        }
      } catch {
        // Fallback
      }
    }

    // 3. Real Public Web OSINT Name Extraction via DuckDuckGo Public Index
    try {
      const query = `"${clean}" OR "${raw10}"`
      const ddgUrl = 'https://html.duckduckgo.com/html/'
      const ddgRes = await fetch(ddgUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: `q=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(4500),
      })

      if (ddgRes.ok) {
        const html = await ddgRes.text()
        sources.push('Public Search Indices')

        const snippetMatches = Array.from(html.matchAll(/<a[^>]+class="result__snippet[^>]*>(.*?)<\/a>/gs))
        const titleMatches = Array.from(html.matchAll(/<h2[^>]*>\s*<a[^>]*>(.*?)<\/a>/gs))

        const allText = [...snippetMatches, ...titleMatches]
          .map((m) => m[1].replace(/<[^>]+>/g, ''))
          .join(' ')

        const nameMatches = allText.matchAll(/\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15})?)\b/g)

        for (const match of nameMatches) {
          const candidate = match[1].trim()
          const words = candidate.toLowerCase().split(/\s+/)
          if (words.some((w) => IGNORE_TERMS.has(w))) continue
          if (candidate.length < 5 || candidate.length > 28) continue

          if (!names.some((n) => n.name.toLowerCase() === candidate.toLowerCase())) {
            names.push({
              name: candidate,
              source: 'Public Web Search Hit',
              confidence: 'medium',
              type: 'person',
              details: 'Extracted from publicly indexed search context',
            })
          }
        }
      }
    } catch {
      // Fallback
    }

    // 4. Generate UPI VPA Endpoints for NPCI Name Resolution (India)
    const upiHandles = [
      { vpa: `${raw10}@ybl`, app: 'PhonePe (Yes Bank)', verificationUrl: `upi://pay?pa=${raw10}@ybl&pn=Target` },
      { vpa: `${raw10}@ibl`, app: 'PhonePe (ICICI Bank)', verificationUrl: `upi://pay?pa=${raw10}@ibl&pn=Target` },
      { vpa: `${raw10}@paytm`, app: 'Paytm Payments Bank', verificationUrl: `upi://pay?pa=${raw10}@paytm&pn=Target` },
      { vpa: `${raw10}@okaxis`, app: 'Google Pay (Axis Bank)', verificationUrl: `upi://pay?pa=${raw10}@okaxis&pn=Target` },
      { vpa: `${raw10}@okhdfcbank`, app: 'Google Pay (HDFC Bank)', verificationUrl: `upi://pay?pa=${raw10}@okhdfcbank&pn=Target` },
      { vpa: `${raw10}@okicici`, app: 'Google Pay (ICICI Bank)', verificationUrl: `upi://pay?pa=${raw10}@okicici&pn=Target` },
      { vpa: `${raw10}@upi`, app: 'BHIM NPCI', verificationUrl: `upi://pay?pa=${raw10}@upi&pn=Target` },
    ]

    const truecallerUrl = isIndia
      ? `https://www.truecaller.com/search/in/+91${raw10}`
      : `https://www.truecaller.com/search/global/${encodeURIComponent(clean)}`

    const whatsappUrl = `https://wa.me/${digitsOnly}`
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${clean}" OR "${raw10}"`)}`

    // Extract aliases
    for (let i = 1; i < names.length; i++) {
      aliases.push(names[i].name)
    }

    return {
      primaryName: names.length > 0 ? names[0].name : null,
      aliases: Array.from(new Set(aliases)),
      namesDiscovered: names,
      sources: Array.from(new Set(sources)),
      upiHandles,
      truecallerSearchUrl: truecallerUrl,
      whatsappDirectUrl: whatsappUrl,
      googleSearchUrl: googleUrl,
    }
  }
}
