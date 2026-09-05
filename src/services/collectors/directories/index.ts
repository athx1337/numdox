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

    // 1. Direct Truecaller Bearer Auth (if token configured)
    if (this.truecallerToken) {
      try {
        const tcUrl = `https://search5-noneu.truecaller.com/v2/search?q=${encodeURIComponent(phone.e164)}&countryCode=${isIndia ? 'in' : 'us'}&type=4`
        const tcRes = await fetch(tcUrl, {
          headers: {
            Authorization: `Bearer ${this.truecallerToken}`,
            'User-Agent': 'Truecaller/13.35.6 (Android;13)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3500),
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
    } else if (quotaExceeded) {
      onProgress?.({
        name: this.name,
        type: this.type,
        status: 'unavailable',
        resultsCount: 0,
        message: 'RapidAPI pool quota exhausted (skipped; running other public collectors)',
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
