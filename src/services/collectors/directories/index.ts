// ============================================
// Public & Caller ID Directory Collector
// Non-blocking waterfall pool with graceful quota handling
// ============================================

import { Collector, CollectorStatus, EvidenceItem, NormalizedPhoneVariants } from '../types'

export class DirectoryCollector implements Collector {
  name = 'Caller ID Directories'
  type = 'directories' as const

  private rapidKey = process.env.RAPIDAPI_TRUECALLER_KEY || '6fe6de121bmsh0e1c2f906b4a706p14ab45jsn873459c7932b'
  private truecallerToken = process.env.TRUECALLER_AUTH_TOKEN
  private truecallerCookie = process.env.TRUECALLER_COOKIE

  async collect(
    phone: NormalizedPhoneVariants,
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = []
    let quotaExceeded = false

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: 0,
      message: 'Consulting caller ID directory waterfall pool...',
    })

    const raw10 = phone.national
    const digitsOnly = phone.digitsOnly
    const isIndia = phone.isIndia
    const prefix = phone.countryCallingCode.replace('+', '') || '91'

    // Collect cookies from pool or single env variable
    const rawPool = process.env.TRUECALLER_COOKIE_POOL || process.env.TRUECALLER_COOKIES || ''
    const rawSingle = this.truecallerCookie || process.env.TRUECALLER_COOKIE || ''
    const rawToken = this.truecallerToken || process.env.TRUECALLER_AUTH_TOKEN || ''

    const cleanCookie = (c: string) =>
      c.trim().replace(/^["']|["']$/g, '').replace(/^Cookie:?\s*/i, '').trim()

    let cookiePool: string[] = []
    if (rawPool.trim().startsWith('[') && rawPool.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(rawPool.trim())
        if (Array.isArray(parsed)) {
          cookiePool.push(...parsed.map(cleanCookie).filter(Boolean))
        }
      } catch {}
    } else if (rawPool.includes('|||')) {
      cookiePool.push(...rawPool.split('|||').map(cleanCookie).filter(Boolean))
    } else if (rawPool.includes('\n')) {
      cookiePool.push(...rawPool.split('\n').map(cleanCookie).filter(Boolean))
    }

    if (rawSingle) {
      const cleaned = cleanCookie(rawSingle)
      if (cleaned && !cookiePool.includes(cleaned)) {
        cookiePool.push(cleaned)
      }
    }

    if (rawToken && rawToken.includes('tc_user=')) {
      const cleaned = cleanCookie(rawToken)
      if (cleaned && !cookiePool.includes(cleaned)) {
        cookiePool.push(cleaned)
      }
    }

    let authToken = ''
    if (rawToken && !rawToken.includes('tc_user=')) {
      authToken = rawToken.trim()
    }

    let truecallerSessionExhausted = false

    // 1. Truecaller Web Session Pool (Astro/SSR Page Lookup with automatic failover)
    for (let i = 0; i < cookiePool.length; i++) {
      const currentCookie = cookiePool[i]
      try {
        const webUrl = isIndia
          ? `https://www.truecaller.com/search/in/${raw10}`
          : `https://www.truecaller.com/search/global/${encodeURIComponent(phone.e164)}`

        const webRes = await fetch(webUrl, {
          headers: {
            Cookie: currentCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: 'https://www.truecaller.com/',
          },
          signal: AbortSignal.timeout(5000),
        })

        if (webRes.ok) {
          const html = await webRes.text()
          if (/limit exceeded|too many requests/i.test(html)) {
            truecallerSessionExhausted = true
            quotaExceeded = true
            // Try next session in pool if available
            continue
          }

          // Method A: vCard download attribute (e.g. aniket-chandra.vcf)
          const vcfMatch = html.match(/download="([^"]+)\.vcf"/i)
          // Method B: Astro profile bold name div
          const astroBoldMatch = html.match(/<div class="[^"]*font-bold[^"]*"[^>]*>\s*([^<]+?)\s*<\/div>/i)
          // Method C: Title / OpenGraph metadata
          const titleMatch =
            html.match(/<title>([^<]+?)\s*-\s*Who called/i) ||
            html.match(/meta\s+property=["']og:title["']\s+content=["']([^"']+?)\s*-\s*Who called/i) ||
            html.match(/meta\s+name=["']title["']\s+content=["']([^"']+?)\s*-\s*Who called/i) ||
            html.match(/<h1[^>]*>([^<]+)<\/h1>/i)

          let foundName: string | null = null
          if (astroBoldMatch && astroBoldMatch[1].trim().length > 1 && !/limit exceeded|sign in/i.test(astroBoldMatch[1])) {
            foundName = astroBoldMatch[1].trim()
          } else if (vcfMatch && vcfMatch[1].trim().length > 1) {
            foundName = vcfMatch[1].trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          } else if (titleMatch && titleMatch[1].trim().length > 1) {
            foundName = titleMatch[1].trim()
          }

          if (!foundName) {
            // Check JSON in script tags
            const scriptMatches = html.match(/"name":"([^"]+)"/g)
            for (const sm of scriptMatches || []) {
              const n = sm.replace(/"name":"|"/g, '').trim()
              if (n && n.length > 1 && !['Truecaller', 'search', 'India', 'Free Reverse Phone Number Lookup'].includes(n)) {
                foundName = n
                break
              }
            }
          }

          if (
            foundName &&
            foundName.length > 1 &&
            !foundName.toLowerCase().includes('reverse phone') &&
            !foundName.toLowerCase().includes('free reverse') &&
            !foundName.toLowerCase().includes('search limit')
          ) {
            evidenceItems.push({
              id: `tc-web-${Date.now()}`,
              type: 'person',
              value: foundName,
              source: 'Truecaller Web Verification',
              sourceType: 'directories',
              sourceUrl: webUrl,
              matchedPhone: phone.e164,
              evidence: 'Live verified caller directory record from Truecaller authenticated web session',
              matchType: 'exact',
              confidence: 0.96,
              confidenceLevel: 'high',
              timestamp: new Date().toISOString(),
            })
            onProgress?.({
              name: this.name,
              type: this.type,
              status: 'completed',
              resultsCount: 1,
              message: 'Resolved via Truecaller authenticated session.',
            })
            return evidenceItems
          }
        }
      } catch {
        // Fallthrough to next cookie in pool
        continue
      }
    }

    // 2. Direct Truecaller Bearer Auth (if token configured or extracted)
    if (authToken) {
      try {
        const tcUrl = `https://search5-noneu.truecaller.com/v2/search?q=${encodeURIComponent(phone.e164)}&countryCode=${isIndia ? 'in' : 'us'}&type=4`
        const cleanToken = authToken.replace(/^Bearer\s+/i, '').trim()
        const isJwt = cleanToken.startsWith('eyJ')
        const tcRes = await fetch(tcUrl, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'User-Agent': isJwt
              ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
              : 'Truecaller/13.35.6 (Android;13)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        })

        if (tcRes.ok) {
          const tcData = await tcRes.json()
          const item = tcData?.data?.[0]
          if (item?.name && typeof item.name === 'string' && item.name.trim().length > 1) {
            evidenceItems.push({
              id: `tc-direct-${Date.now()}`,
              type: 'person',
              value: item.name.trim(),
              source: 'Truecaller Direct Verification',
              sourceType: 'directories',
              sourceUrl: `https://www.truecaller.com/search/${isIndia ? 'in' : 'global'}/${encodeURIComponent(phone.e164)}`,
              matchedPhone: phone.e164,
              evidence: `Caller directory record (Carrier: ${item.phones?.[0]?.carrier || 'N/A'})`,
              matchType: 'exact',
              confidence: 0.95,
              confidenceLevel: 'high',
              timestamp: new Date().toISOString(),
            })
            onProgress?.({
              name: this.name,
              type: this.type,
              status: 'completed',
              resultsCount: 1,
              message: 'Resolved via Truecaller direct directory verification.',
            })
            return evidenceItems
          }
        }
      } catch {
        // Fallover to RapidAPI pool
      }
    }

    // 2. RapidAPI Multi-Pool Waterfall
    if (this.rapidKey) {
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
              'x-rapidapi-key': this.rapidKey,
              'x-rapidapi-host': ep.host,
              'Content-Type': ep.method === 'POST' ? 'application/x-www-form-urlencoded' : 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(3500),
          }
          if (ep.method === 'POST' && ep.body) {
            fetchOptions.body = ep.body
          }

          const res = await fetch(ep.url, fetchOptions)
          if (res.status === 429) {
            quotaExceeded = true
            continue
          }

          if (res.ok) {
            const data = await res.json()
            const foundName = ep.parse(data)
            if (foundName && typeof foundName === 'string' && foundName.trim().length > 1) {
              const cleanName = foundName.trim()
              evidenceItems.push({
                id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'person',
                value: cleanName,
                source: `${ep.name} (Caller ID)`,
                sourceType: 'directories',
                sourceUrl: `https://www.truecaller.com/search/${isIndia ? 'in' : 'global'}/${encodeURIComponent(phone.e164)}`,
                matchedPhone: phone.e164,
                evidence: 'Live verified caller ID directory entry from national telecom pool',
                matchType: 'exact',
                confidence: 0.92,
                confidenceLevel: 'high',
                timestamp: new Date().toISOString(),
              })
              break // Stop on first successful name in waterfall
            }
          }
        } catch {
          // Non-blocking failover
          continue
        }
      }
    }

    if (evidenceItems.length > 0) {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'completed',
        resultsCount: evidenceItems.length,
        message: 'Resolved candidate from caller ID directory pool.',
      })
    } else if (truecallerSessionExhausted) {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'unavailable',
        resultsCount: 0,
        message: 'Truecaller daily search quota reached on active session(s). Use UPI banking verification or rotate session cookie.',
      })
    } else if (quotaExceeded) {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'unavailable',
        resultsCount: 0,
        message: 'Directory pool quota exhausted (skipped; running other public collectors)',
      })
    } else if (cookiePool.length === 0) {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'unavailable',
        resultsCount: 0,
        message: 'No active Truecaller web session configured (add TRUECALLER_COOKIE in environment variables).',
      })
    } else {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'completed',
        resultsCount: 0,
        message: 'No matching records found in caller ID directory pool.',
      })
    }

    return evidenceItems
  }
}
