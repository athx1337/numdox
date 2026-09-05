// ============================================
// NUMDOX Identity Intelligence Engine
// Coordinates modular collectors, pivots, and correlation
// ============================================

import { PhoneVariantNormalizer } from '../collectors/normalizer'
import { WebCollector } from '../collectors/web'
import { GitHubCollector } from '../collectors/github'
import { DocumentCollector } from '../collectors/documents'
import { DirectoryCollector } from '../collectors/directories'
import { ProfileCollector } from '../collectors/profiles'
import { IdentityCorrelator, CorrelationResult } from './correlator'
import { CollectorStatus, EvidenceItem } from '../collectors/types'

export interface IdentityEngineResult extends CorrelationResult {
  collectorStatuses: CollectorStatus[]
  phoneVariants: string[]
  upiHandles: Array<{ vpa: string; app: string; verificationUrl: string }>
  truecallerUrl: string
  whatsappUrl: string
  googleUrl: string
}

export class IdentityIntelligenceEngine {
  private webCollector = new WebCollector()
  private githubCollector = new GitHubCollector()
  private documentCollector = new DocumentCollector()
  private directoryCollector = new DirectoryCollector()
  private profileCollector = new ProfileCollector()

  async execute(
    rawPhone: string,
    defaultCountry = 'IN',
    onCollectorUpdate?: (status: CollectorStatus) => void
  ): Promise<IdentityEngineResult> {
    const normalized = PhoneVariantNormalizer.normalize(rawPhone, defaultCountry)
    const allEvidence: EvidenceItem[] = []
    const statuses: Map<string, CollectorStatus> = new Map()

    const updateStatus = (status: CollectorStatus) => {
      statuses.set(status.type, status)
      onCollectorUpdate?.(status)
    }

    // Initialize all collector statuses as scanning/pending
    updateStatus({ name: 'Public Web Search', type: 'web', status: 'scanning', resultsCount: 0 })
    updateStatus({ name: 'GitHub Public OSINT', type: 'github', status: 'scanning', resultsCount: 0 })
    updateStatus({ name: 'Public Documents', type: 'documents', status: 'scanning', resultsCount: 0 })
    updateStatus({ name: 'Caller ID Directories', type: 'directories', status: 'scanning', resultsCount: 0 })

    // Run primary collectors in parallel with allSettled (complete fault tolerance)
    const results = await Promise.allSettled([
      this.webCollector.collect(normalized, updateStatus),
      this.githubCollector.collect(normalized, updateStatus),
      this.documentCollector.collect(normalized, updateStatus),
      this.directoryCollector.collect(normalized, updateStatus),
    ])

    for (const res of results) {
      if (res.status === 'fulfilled') {
        allEvidence.push(...res.value)
      }
    }

    // Run limited secondary pivots if any username/email entities were found
    if (allEvidence.some((e) => e.type === 'username' || e.type === 'email')) {
      try {
        const pivotItems = await this.profileCollector.pivot(normalized, allEvidence, updateStatus)
        allEvidence.push(...pivotItems)
      } catch {
        // Pivoting error does not interrupt scan
      }
    }

    // Correlate and rank findings
    const correlation = IdentityCorrelator.correlate(allEvidence, normalized.e164)

    // Generate UPI VPA handles (for Indian numbers)
    const raw10 = normalized.national
    const upiHandles = [
      { vpa: `${raw10}@ybl`, app: 'PhonePe (Yes Bank)', verificationUrl: `upi://pay?pa=${raw10}@ybl&pn=Target` },
      { vpa: `${raw10}@paytm`, app: 'Paytm Payments Bank', verificationUrl: `upi://pay?pa=${raw10}@paytm&pn=Target` },
      { vpa: `${raw10}@okaxis`, app: 'Google Pay (Axis)', verificationUrl: `upi://pay?pa=${raw10}@okaxis&pn=Target` },
      { vpa: `${raw10}@upi`, app: 'BHIM NPCI Official', verificationUrl: `upi://pay?pa=${raw10}@upi&pn=Target` },
    ]

    const truecallerUrl = normalized.isIndia
      ? `https://www.truecaller.com/search/in/+91${raw10}`
      : `https://www.truecaller.com/search/global/${encodeURIComponent(normalized.e164)}`

    const whatsappUrl = `https://wa.me/${normalized.digitsOnly}`
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${normalized.e164}" OR "${normalized.national}"`)}`

    return {
      ...correlation,
      collectorStatuses: Array.from(statuses.values()),
      phoneVariants: normalized.searchVariants,
      upiHandles,
      truecallerUrl,
      whatsappUrl,
      googleUrl,
    }
  }
}
