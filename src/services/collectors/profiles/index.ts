// ============================================
// Profile & Pivoting OSINT Collector
// Secondary pivoting (depth <= 2) for discovered identifiers
// ============================================

import { CollectorStatus, EvidenceItem, NormalizedPhoneVariants } from '../types'

export class ProfileCollector {
  name = 'Public Profiles & Pivots'
  type = 'profiles' as const

  async pivot(
    phone: NormalizedPhoneVariants,
    existingEvidences: EvidenceItem[],
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]> {
    const pivotEvidences: EvidenceItem[] = []
    const seenUrls = new Set<string>()

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: 0,
      message: 'Running secondary OSINT pivots on discovered candidate entities...',
    })

    // Extract unique discovered usernames and emails
    const usernames = Array.from(
      new Set(
        existingEvidences
          .filter((e) => e.type === 'username')
          .map((e) => e.value.replace(/^@/, ''))
          .filter((u) => u.length >= 3 && u.length <= 25)
      )
    ).slice(0, 2)

    const emails = Array.from(
      new Set(
        existingEvidences
          .filter((e) => e.type === 'email')
          .map((e) => e.value)
      )
    ).slice(0, 2)

    // 1. Pivot on discovered usernames (e.g. check public platforms)
    for (const username of usernames) {
      const platforms = [
        { name: 'GitHub Profile', url: `https://github.com/${username}` },
        { name: 'Gravatar Profile', url: `https://gravatar.com/${username}` },
      ]

      for (const p of platforms) {
        try {
          const res = await fetch(p.url, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(2500),
          })

          if (res.ok && !seenUrls.has(p.url)) {
            seenUrls.add(p.url)
            pivotEvidences.push({
              id: `pivot-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'username',
              value: `@${username}`,
              source: `Secondary Pivot (${p.name})`,
              sourceType: 'profiles',
              sourceUrl: p.url,
              matchedPhone: phone.national,
              evidence: `Pivoted from discovered handle @${username} → Active ${p.name} verified`,
              matchType: 'profile',
              confidence: 0.8,
              confidenceLevel: 'high',
              timestamp: new Date().toISOString(),
              metadata: {
                pivotDepth: 2,
                pivotParent: username,
              },
            })
          }
        } catch {
          // Continue
        }
      }
    }

    // 2. Pivot on discovered emails (Gravatar MD5 lookup)
    for (const email of emails) {
      try {
        const cleanEmail = email.trim().toLowerCase()
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanEmail))
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        const gravatarUrl = `https://gravatar.com/${hashHex}`
        const res = await fetch(gravatarUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(2500),
        })

        if (res.ok && !seenUrls.has(gravatarUrl)) {
          seenUrls.add(gravatarUrl)
          pivotEvidences.push({
            id: `pivot-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'email',
            value: email,
            source: 'Secondary Pivot (Gravatar)',
            sourceType: 'profiles',
            sourceUrl: gravatarUrl,
            matchedPhone: phone.national,
            evidence: `Pivoted from discovered email ${email} → Active Gravatar profile verified`,
            matchType: 'profile',
            confidence: 0.85,
            confidenceLevel: 'high',
            timestamp: new Date().toISOString(),
            metadata: {
              pivotDepth: 2,
              pivotParent: email,
            },
          })
        }
      } catch {
        // Continue
      }
    }

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'completed',
      resultsCount: pivotEvidences.length,
      message: `Completed secondary pivots. Found ${pivotEvidences.length} verified profile links.`,
    })

    return pivotEvidences
  }
}
