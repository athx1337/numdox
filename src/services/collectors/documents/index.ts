// ============================================
// Public Documents OSINT Collector
// Searches indexed public documents (PDF, CSV, TXT, XML)
// ============================================

import { Collector, CollectorStatus, EvidenceItem, NormalizedPhoneVariants } from '../types'

const IGNORE_TERMS = new Set([
  'contact', 'phone', 'mobile', 'telecom', 'support', 'terms', 'privacy',
  'document', 'download', 'pdf', 'csv', 'index', 'table', 'sheet', 'page',
  'official', 'national', 'government', 'portal', 'department', 'ministry',
])

export class DocumentCollector implements Collector {
  name = 'Public Documents'
  type = 'documents' as const

  async collect(
    phone: NormalizedPhoneVariants,
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = []
    const seenNames = new Set<string>()

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: 0,
      message: 'Searching indexed public documents (PDF, CSV, TXT, XML)...',
    })

    // Search queries targeting document extensions
    const filetypes = ['pdf', 'csv', 'txt']
    const searchQueries = filetypes.map((ft) => `filetype:${ft} "${phone.national}"`)

    const discoveredDocs: Array<{ url: string; title: string; snippet: string; filetype: string }> = []

    for (const q of searchQueries) {
      try {
        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: `q=${encodeURIComponent(q)}`,
          signal: AbortSignal.timeout(4500),
        })

        if (!res.ok) continue
        const html = await res.text()

        const bodyMatches = Array.from(html.matchAll(/<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/g))
        for (const block of bodyMatches.slice(0, 3)) {
          const content = block[1]
          const hrefMatch =
            content.match(/<a[^>]+class="result__snippet[^>]*href="([^"]+)"/) ||
            content.match(/<a[^>]+class="result__url[^>]*href="([^"]+)"/)
          const titleMatch = content.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)
          const snippetMatch = content.match(/<a[^>]+class="result__snippet[^>]*>([\s\S]*?)<\/a>/)

          if (!hrefMatch) continue

          let docUrl = hrefMatch[1]
          if (docUrl.includes('uddg=')) {
            const uddg = docUrl.match(/uddg=([^&]+)/)
            if (uddg) docUrl = decodeURIComponent(uddg[1])
          }

          if (!docUrl.startsWith('http')) continue

          const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Public Indexed Document'
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

          const ft = docUrl.endsWith('.pdf') ? 'PDF' : docUrl.endsWith('.csv') ? 'CSV' : 'Document'
          discoveredDocs.push({ url: docUrl, title, snippet, filetype: ft })
        }
      } catch {
        // Continue to next filetype query
      }
    }

    // Process discovered document snippets and metadata
    for (const doc of discoveredDocs) {
      const fullContext = `${doc.title} — ${doc.snippet}`

      // Match explicit "Name: ... Phone:" or proper nouns in proximity
      const namePattern = /\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15})?)\b/g
      const matches = Array.from(fullContext.matchAll(namePattern))

      for (const m of matches) {
        const candidate = m[1].trim()
        const words = candidate.split(/\s+/)
        if (words.some((w) => IGNORE_TERMS.has(w.toLowerCase()))) continue
        if (words.length < 2 || words.length > 3) continue

        if (!seenNames.has(candidate.toLowerCase())) {
          seenNames.add(candidate.toLowerCase())
          evidenceItems.push({
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'person',
            value: candidate,
            source: `Public ${doc.filetype} (${this.safeHostname(doc.url)})`,
            sourceType: 'documents',
            sourceUrl: doc.url,
            matchedPhone: phone.national,
            evidence: `Found in ${doc.filetype} document: "${doc.title}" | Context: ${doc.snippet.slice(0, 140)}`,
            matchType: 'proximity',
            confidence: 0.75,
            confidenceLevel: 'medium',
            timestamp: new Date().toISOString(),
            metadata: {
              documentTitle: doc.title,
              documentType: doc.filetype,
            },
          })
        }
      }
    }

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'completed',
      resultsCount: evidenceItems.length,
      message: `Completed document scan. Extracted ${evidenceItems.length} records.`,
    })

    return evidenceItems
  }

  private safeHostname(urlStr: string): string {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '')
    } catch {
      return 'document-host'
    }
  }
}
