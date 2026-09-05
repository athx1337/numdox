// ============================================
// Identity & Name Discovery Service
// Drives NUMDOX modular collector OSINT intelligence engine
// ============================================

import { IdentityIntelligenceEngine } from './identity/engine'
import {
  CollectorStatus,
  ConfidenceLevel,
  DiscoveredEntities,
  EvidenceItem,
  RelationshipItem,
} from './collectors/types'

export interface DiscoveredName {
  name: string
  source: string
  confidence: ConfidenceLevel
  type?: 'person' | 'business' | 'handle' | 'carrier_label'
  details?: string
  sourceUrl?: string
  evidence?: string
  matchType?: string
  supportingSourcesCount?: number
}

export interface IdentityProfile {
  primaryName: string | null
  aliases: string[]
  namesDiscovered: DiscoveredName[]
  sources: string[]
  confidence: ConfidenceLevel
  details?: string
  statusMessage: string
  isResolved: boolean
  collectorStatuses: CollectorStatus[]
  evidenceItems: EvidenceItem[]
  entities: DiscoveredEntities
  relationships: RelationshipItem[]
  phoneVariants: string[]
  upiHandles: Array<{ vpa: string; app: string; verificationUrl: string }>
  truecallerSearchUrl: string
  whatsappDirectUrl: string
  googleSearchUrl: string
}

export class IdentityFinderService {
  private static engine = new IdentityIntelligenceEngine()

  static async resolveIdentity(
    phone: string,
    onCollectorUpdate?: (status: CollectorStatus) => void
  ): Promise<IdentityProfile> {
    const result = await this.engine.execute(phone, 'IN', onCollectorUpdate)

    const primaryCandidate = result.primaryCandidate
    const primaryName = primaryCandidate ? primaryCandidate.name : null
    const confidence: ConfidenceLevel = primaryCandidate ? primaryCandidate.confidence : 'low'

    // Format discovered names list
    const namesDiscovered: DiscoveredName[] = result.rankedCandidates.map((c) => {
      const topEvidence = c.evidenceItems[0]
      return {
        name: c.name,
        source: c.sources.join(', '),
        confidence: c.confidence,
        type: 'person',
        details: c.isStructured
          ? 'Structured contact entity'
          : c.isProximity
          ? 'Direct phone proximity mention'
          : 'Exact phone match record',
        sourceUrl: topEvidence?.sourceUrl,
        evidence: topEvidence?.evidence,
        matchType: topEvidence?.matchType,
        supportingSourcesCount: c.supportingSourcesCount,
      }
    })

    const aliases = result.rankedCandidates.slice(1).map((c) => c.name)
    const sources = Array.from(new Set(result.allEvidence.map((e) => e.source)))

    let details: string | undefined
    if (primaryName) {
      details = `Identity candidate correlated from ${primaryCandidate?.supportingSourcesCount || 1} public sources`
    } else {
      const dirStatus = result.collectorStatuses.find((s) => s.type === 'directories')
      if (dirStatus?.message) {
        details = `${dirStatus.message} (Scanned public web, GitHub, and document indices; no other public name found)`
      } else {
        details = 'No verified person name directly linked to this number in publicly indexed records'
      }
    }

    return {
      primaryName,
      aliases,
      namesDiscovered,
      sources,
      confidence,
      details,
      statusMessage: result.statusMessage,
      isResolved: result.isResolved,
      collectorStatuses: result.collectorStatuses,
      evidenceItems: result.allEvidence,
      entities: result.entities,
      relationships: result.relationships,
      phoneVariants: result.phoneVariants,
      upiHandles: result.upiHandles,
      truecallerSearchUrl: result.truecallerUrl,
      whatsappDirectUrl: result.whatsappUrl,
      googleSearchUrl: result.googleUrl,
    }
  }
}
