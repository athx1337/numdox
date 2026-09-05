// ============================================
// Public Web OSINT Collector
// Real public-data search & proximity entity extraction
// ============================================

import { Collector, CollectorStatus, EvidenceItem, NormalizedPhoneVariants } from '../types'

const IGNORE_TERMS = new Set([
  'contact', 'contacts', 'phone', 'number', 'mobile', 'whatsapp', 'call', 'sms', 'india', 'delhi',
  'mumbai', 'bengaluru', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'telecom', 'airtel', 'jio',
  'vodafone', 'bsnl', 'support', 'help', 'customer', 'care', 'service', 'services', 'privacy',
  'policy', 'terms', 'condition', 'conditions', 'about', 'home', 'search', 'results', 'login',
  'signin', 'signup', 'register', 'download', 'free', 'online', 'view', 'details', 'page', 'website',
  'united', 'states', 'carrier', 'network', 'status', 'verification', 'code', 'portal', 'official',
  'directory', 'business', 'company', 'address', 'email', 'info', 'inquiry', 'sales', 'department',
  'branch', 'office', 'head', 'manager', 'executive', 'team', 'feedback', 'review', 'reviews',
  'google', 'yahoo', 'bing', 'duckduckgo', 'facebook', 'twitter', 'instagram', 'linkedin', 'youtube'
])

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

export class WebCollector implements Collector {
  name = 'Public Web Search'
  type = 'web' as const

  async collect(
    phone: NormalizedPhoneVariants,
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = []
    const seenCandidateNames = new Set<string>()

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: 0,
      message: 'Searching public web indices for exact phone number mentions...',
    })

    // 1. Determine search permutations
    const searchQueries = [
      `"${phone.e164}"`,
      `"${phone.national}"`,
    ]
    if (phone.international && phone.international !== phone.e164) {
      searchQueries.push(`"${phone.international}"`)
    }

    const discoveredUrls: Array<{ url: string; title: string; snippet: string; matchedPhone: string }> = []

    // 2. Query DuckDuckGo Public HTML Search for each query
    for (const query of searchQueries.slice(0, 3)) {
      try {
        const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': ua,
            Accept: 'text/html,application/xhtml+xml',
          },
          body: `q=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) continue

        const html = await res.text()

        // Extract result blocks using regex
        const bodyMatches = Array.from(html.matchAll(/<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/g))

        for (const block of bodyMatches.slice(0, 6)) {
          const content = block[1]

          // Extract link
          const hrefMatch =
            content.match(/<a[^>]+class="result__snippet[^>]*href="([^"]+)"/) ||
            content.match(/<a[^>]+class="result__url[^>]*href="([^"]+)"/)

          const titleMatch = content.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)
          const snippetMatch = content.match(/<a[^>]+class="result__snippet[^>]*>([\s\S]*?)<\/a>/)

          if (!hrefMatch) continue

          let finalUrl = hrefMatch[1]
          if (finalUrl.includes('uddg=')) {
            const uddg = finalUrl.match(/uddg=([^&]+)/)
            if (uddg) {
              finalUrl = decodeURIComponent(uddg[1])
            }
          }

          if (!finalUrl.startsWith('http')) continue

          const titleText = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Public Web Document'
          const snippetText = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

          discoveredUrls.push({
            url: finalUrl,
            title: titleText,
            snippet: snippetText,
            matchedPhone: query.replace(/"/g, ''),
          })
        }
      } catch {
        // Continue to next search variant on timeout or block
        continue
      }
    }

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: discoveredUrls.length,
      message: `Discovered ${discoveredUrls.length} public web mentions. Extracting proximity entities...`,
    })

    // 3. Process Snippets directly first (guaranteed available even if target page blocks scraping)
    for (const item of discoveredUrls) {
      const combinedSnippet = `${item.title} — ${item.snippet}`
      this.extractEntitiesFromText(
        combinedSnippet,
        item.matchedPhone,
        item.url,
        phone,
        evidenceItems,
        seenCandidateNames,
        'proximity'
      )
    }

    // 4. Fetch the top target public pages to extract rich Schema.org, headings, and proximity text
    const pagesToInspect = discoveredUrls.slice(0, 4)
    await Promise.allSettled(
      pagesToInspect.map(async (page) => {
        try {
          const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
          const res = await fetch(page.url, {
            headers: {
              'User-Agent': ua,
              Accept: 'text/html,application/xhtml+xml;q=0.9',
            },
            signal: AbortSignal.timeout(3500),
          })

          if (!res.ok) return
          const contentType = res.headers.get('content-type') || ''
          if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return

          const html = await res.text()

          // 4a. Inspect JSON-LD / Schema.org structured data
          const jsonLdMatches = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
          for (const m of jsonLdMatches) {
            try {
              const data = JSON.parse(m[1].trim())
              this.inspectJsonLd(data, page.url, page.matchedPhone, phone, evidenceItems, seenCandidateNames)
            } catch {
              // Ignore invalid JSON in page
            }
          }

          // 4b. Strip scripts, styles, and tags for clean visible text
          const cleanText = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')

          // 4c. Extract entities around occurrences of phone number variants
          this.extractEntitiesFromText(
            cleanText,
            page.matchedPhone,
            page.url,
            phone,
            evidenceItems,
            seenCandidateNames,
            'exact'
          )
        } catch {
          // Page fetch failed or timed out, snippet was already processed
        }
      })
    )

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'completed',
      resultsCount: evidenceItems.length,
      message: `Completed public web OSINT. Extracted ${evidenceItems.length} evidence records.`,
    })

    return evidenceItems
  }

  private inspectJsonLd(
    data: any,
    url: string,
    matchedPhone: string,
    phone: NormalizedPhoneVariants,
    evidenceItems: EvidenceItem[],
    seenCandidateNames: Set<string>
  ): void {
    if (!data) return

    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      if (typeof item !== 'object' || !item) continue

      const type = item['@type'] || ''
      const name = typeof item.name === 'string' ? item.name.trim() : null
      const telephone = typeof item.telephone === 'string' ? item.telephone : ''

      const phoneMatches =
        telephone.includes(phone.national) ||
        telephone.includes(phone.digitsOnly) ||
        telephone.includes(phone.e164)

      if (name && (phoneMatches || type === 'Person' || type === 'ContactPoint')) {
        const cleanName = this.sanitizeCandidateName(name)
        if (cleanName && !seenCandidateNames.has(cleanName.toLowerCase())) {
          seenCandidateNames.add(cleanName.toLowerCase())
          evidenceItems.push({
            id: `web-schema-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'person',
            value: cleanName,
            source: `Public Web Schema.org (${new URL(url).hostname})`,
            sourceType: 'web',
            sourceUrl: url,
            matchedPhone,
            evidence: `Structured Schema.org ${type} name: "${name}" (Phone: ${telephone || matchedPhone})`,
            matchType: 'structured',
            confidence: 0.88,
            confidenceLevel: 'high',
            timestamp: new Date().toISOString(),
          })
        }
      }

      // If nested @graph exists, recurse
      if (item['@graph']) {
        this.inspectJsonLd(item['@graph'], url, matchedPhone, phone, evidenceItems, seenCandidateNames)
      }
    }
  }

  private extractEntitiesFromText(
    text: string,
    matchedPhone: string,
    sourceUrl: string,
    phone: NormalizedPhoneVariants,
    evidenceItems: EvidenceItem[],
    seenCandidateNames: Set<string>,
    matchType: 'exact' | 'proximity'
  ): void {
    const domain = this.safeHostname(sourceUrl)
    const variantsToCheck = [phone.e164, phone.national, phone.international, phone.digitsOnly]

    for (const variant of variantsToCheck) {
      if (!variant) continue
      let searchIndex = 0

      while (searchIndex < text.length) {
        const foundIndex = text.indexOf(variant, searchIndex)
        if (foundIndex === -1) break

        // Define a ±300 character proximity window around the phone number
        const start = Math.max(0, foundIndex - 300)
        const end = Math.min(text.length, foundIndex + variant.length + 300)
        const windowText = text.slice(start, end)

        // 1. Explicit contact/owner label patterns
        const explicitPatterns = [
          /(?:contact(?:\s+person)?|owner|posted\s+by|name|author|authorized\s+signatory|proprietor)\s*[:\-–]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/gi,
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–|,]\s*(?:contact|phone|mobile|tel|call)/gi,
        ]

        for (const pattern of explicitPatterns) {
          const matches = Array.from(windowText.matchAll(pattern))
          for (const m of matches) {
            const rawCandidate = m[1]
            const cleanCandidate = this.sanitizeCandidateName(rawCandidate)
            if (cleanCandidate && !seenCandidateNames.has(cleanCandidate.toLowerCase())) {
              seenCandidateNames.add(cleanCandidate.toLowerCase())
              evidenceItems.push({
                id: `web-explicit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'person',
                value: cleanCandidate,
                source: `Public Web (${domain})`,
                sourceType: 'web',
                sourceUrl,
                matchedPhone: variant,
                evidence: windowText.trim().slice(0, 160),
                matchType: 'exact',
                confidence: 0.85,
                confidenceLevel: 'high',
                timestamp: new Date().toISOString(),
              })
            }
          }
        }

        // 2. Proximity Proper Nouns (2 to 3 capitalized words)
        const namePattern = /\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15})?)\b/g
        const candidateMatches = Array.from(windowText.matchAll(namePattern))

        for (const cm of candidateMatches) {
          const rawCandidate = cm[1]
          const cleanCandidate = this.sanitizeCandidateName(rawCandidate)
          if (cleanCandidate && !seenCandidateNames.has(cleanCandidate.toLowerCase())) {
            seenCandidateNames.add(cleanCandidate.toLowerCase())
            evidenceItems.push({
              id: `web-prox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'person',
              value: cleanCandidate,
              source: `Public Web (${domain})`,
              sourceType: 'web',
              sourceUrl,
              matchedPhone: variant,
              evidence: windowText.trim().slice(0, 160),
              matchType: 'proximity',
              confidence: 0.65,
              confidenceLevel: 'medium',
              timestamp: new Date().toISOString(),
            })
          }
        }

        // 3. Proximity Emails
        const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g
        const emailMatches = Array.from(windowText.matchAll(emailPattern))
        for (const em of emailMatches) {
          const emailVal = em[1].toLowerCase()
          if (!emailVal.includes('example') && !emailVal.includes('domain') && !emailVal.includes('.png')) {
            evidenceItems.push({
              id: `web-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'email',
              value: emailVal,
              source: `Public Web (${domain})`,
              sourceType: 'web',
              sourceUrl,
              matchedPhone: variant,
              evidence: `Email found co-occurring with phone: ${emailVal}`,
              matchType: 'proximity',
              confidence: 0.8,
              confidenceLevel: 'high',
              timestamp: new Date().toISOString(),
            })
          }
        }

        // 4. Proximity Social Usernames / Handles (@username)
        const handlePattern = /(?:^|\s)@([a-zA-Z0-9_]{3,25})\b/g
        const handleMatches = Array.from(windowText.matchAll(handlePattern))
        for (const hm of handleMatches) {
          const handle = hm[1]
          if (!IGNORE_TERMS.has(handle.toLowerCase())) {
            evidenceItems.push({
              id: `web-handle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'username',
              value: `@${handle}`,
              source: `Public Web (${domain})`,
              sourceType: 'web',
              sourceUrl,
              matchedPhone: variant,
              evidence: `Public profile handle mentioned: @${handle}`,
              matchType: 'proximity',
              confidence: 0.7,
              confidenceLevel: 'medium',
              timestamp: new Date().toISOString(),
            })
          }
        }

        searchIndex = foundIndex + variant.length
      }
    }
  }

  private sanitizeCandidateName(name: string): string | null {
    if (!name) return null
    const cleaned = name.trim().replace(/\s+/g, ' ')
    if (cleaned.length < 4 || cleaned.length > 32) return null

    const words = cleaned.split(/\s+/)
    if (words.length < 2 || words.length > 4) return null

    // Discard if any word is in ignore terms
    for (const w of words) {
      if (IGNORE_TERMS.has(w.toLowerCase())) return null
      if (w.length < 2) return null
    }

    return cleaned
  }

  private safeHostname(urlStr: string): string {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '')
    } catch {
      return 'public-web'
    }
  }
}
