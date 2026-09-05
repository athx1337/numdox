// ============================================
// NUMDOX Identity Correlator & Ranking Engine
// Clusters, scores, and correlates multi-source public evidence
// ============================================

import {
  EvidenceItem,
  IdentityCandidate,
  ConfidenceLevel,
  DiscoveredEntities,
  RelationshipItem,
} from '../collectors/types'

const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'er', 'shri', 'smt', 'md', 'ca'])

export interface CorrelationResult {
  primaryCandidate: IdentityCandidate | null
  rankedCandidates: IdentityCandidate[]
  allEvidence: EvidenceItem[]
  entities: DiscoveredEntities
  relationships: RelationshipItem[]
  statusMessage: string
  isResolved: boolean
}

export class IdentityCorrelator {
  static correlate(allEvidence: EvidenceItem[], targetPhone: string): CorrelationResult {
    // 1. Separate evidence items by entity type
    const personEvidence = allEvidence.filter((e) => e.type === 'person')
    const usernameEvidence = allEvidence.filter((e) => e.type === 'username')
    const emailEvidence = allEvidence.filter((e) => e.type === 'email')
    const orgEvidence = allEvidence.filter((e) => e.type === 'organization')

    const usernames = Array.from(new Set(usernameEvidence.map((e) => e.value)))
    const emails = Array.from(new Set(emailEvidence.map((e) => e.value)))
    const orgs = Array.from(new Set(orgEvidence.map((e) => e.value)))
    const urls = Array.from(new Set(allEvidence.map((e) => e.sourceUrl).filter(Boolean) as string[]))

    // 2. Cluster person names
    const clusters: Map<string, { canonicalName: string; items: EvidenceItem[]; sources: Set<string> }> = new Map()

    for (const item of personEvidence) {
      const rawName = item.value.trim()
      const normalizedKey = this.normalizeNameKey(rawName)
      if (!normalizedKey) continue

      let matchedClusterKey: string | null = null

      // Check if matches an existing cluster (exact or abbreviation)
      for (const existingKey of clusters.keys()) {
        if (this.areNamesRelated(normalizedKey, existingKey)) {
          matchedClusterKey = existingKey
          break
        }
      }

      const clusterKey = matchedClusterKey || normalizedKey
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          canonicalName: rawName,
          items: [],
          sources: new Set<string>(),
        })
      }

      const cluster = clusters.get(clusterKey)!
      cluster.items.push(item)
      cluster.sources.add(item.source)

      // Keep the most complete / longest specific name as canonical display
      if (rawName.length > cluster.canonicalName.length && !rawName.startsWith('@')) {
        cluster.canonicalName = rawName
      }
    }

    // 3. Score and rank clusters
    const rankedCandidates: IdentityCandidate[] = []

    for (const [, cluster] of clusters.entries()) {
      const items = cluster.items
      const sourcesCount = cluster.sources.size

      let score = 0.0
      const matchTypes = new Set(items.map((i) => i.matchType))
      const isStructured = matchTypes.has('structured')
      const isExact = matchTypes.has('exact')
      const isProximity = matchTypes.has('proximity')

      // Base weight from strongest match
      const maxEvidenceConfidence = Math.max(...items.map((i) => i.confidence || 0), 0)

      if (isStructured) score += 0.55
      else if (isExact) score += 0.48
      else if (matchTypes.has('profile')) score += 0.38
      else if (isProximity) score += 0.28

      // Factor in individual item confidence from collector
      score += maxEvidenceConfidence * 0.25

      // Independent sources bonus
      if (sourcesCount >= 3) score += 0.35
      else if (sourcesCount === 2) score += 0.20
      else if (sourcesCount === 1 && items.length > 1) score += 0.10

      // Cross-collector agreement bonus (e.g. web + directory or web + github)
      const collectorTypes = new Set(items.map((i) => i.sourceType))
      if (collectorTypes.size >= 2) {
        score += 0.25
      }

      // Corroboration with discovered usernames or emails
      const canonicalLower = cluster.canonicalName.toLowerCase().replace(/[^a-z]/g, '')
      const emailMatch = emails.some((em) => {
        const localPart = em.split('@')[0].toLowerCase().replace(/[^a-z]/g, '')
        return localPart.includes(canonicalLower) || canonicalLower.includes(localPart)
      })
      const usernameMatch = usernames.some((un) => {
        const cleanUn = un.replace(/^@/, '').toLowerCase().replace(/[^a-z]/g, '')
        return cleanUn.includes(canonicalLower) || canonicalLower.includes(cleanUn)
      })

      if (emailMatch || usernameMatch) {
        score += 0.15
      }

      // Cap score at 0.98
      const finalScore = Math.min(0.98, Math.max(0.1, score))

      let confidence: ConfidenceLevel = 'low'
      if (finalScore >= 0.70 || (sourcesCount >= 2 && finalScore >= 0.55)) {
        confidence = 'high'
      } else if (finalScore >= 0.40) {
        confidence = 'medium'
      }

      rankedCandidates.push({
        name: cluster.canonicalName,
        confidence,
        confidenceScore: Math.round(finalScore * 100) / 100,
        supportingSourcesCount: sourcesCount,
        sources: Array.from(cluster.sources),
        matchTypes: Array.from(matchTypes),
        evidenceItems: items,
        isProximity,
        isStructured,
      })
    }

    // Sort by confidence score descending, then supporting sources count
    rankedCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore || b.supportingSourcesCount - a.supportingSourcesCount)

    const primaryCandidate = rankedCandidates.length > 0 ? rankedCandidates[0] : null
    const isResolved = primaryCandidate !== null && primaryCandidate.confidenceScore >= 0.40

    // Build relationships
    const relationships: RelationshipItem[] = []
    if (primaryCandidate) {
      relationships.push({
        source: targetPhone,
        target: primaryCandidate.name,
        relation: 'associated_name_candidate',
        confidence: primaryCandidate.confidenceScore,
      })

      for (const un of usernames) {
        relationships.push({
          source: primaryCandidate.name,
          target: un,
          relation: 'associated_username',
          confidence: 0.75,
        })
      }

      for (const em of emails) {
        relationships.push({
          source: primaryCandidate.name,
          target: em,
          relation: 'associated_email',
          confidence: 0.8,
        })
      }
    }

    const statusMessage = isResolved
      ? `Discovered ${rankedCandidates.length} candidate entity mentions across ${allEvidence.length} public records.`
      : 'NO RELIABLE NAME FOUND'

    return {
      primaryCandidate,
      rankedCandidates,
      allEvidence,
      entities: {
        names: rankedCandidates.map((c) => c.name),
        usernames,
        emails,
        organizations: orgs,
        urls,
      },
      relationships,
      statusMessage,
      isResolved,
    }
  }

  private static normalizeNameKey(name: string): string {
    const words = name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !TITLES.has(w))

    return words.join(' ')
  }

  private static areNamesRelated(keyA: string, keyB: string): boolean {
    if (keyA === keyB) return true

    const wordsA = keyA.split(/\s+/)
    const wordsB = keyB.split(/\s+/)

    // Last name matches and first letter of first name matches (e.g. John Smith vs J Smith)
    if (wordsA.length >= 2 && wordsB.length >= 2) {
      const lastA = wordsA[wordsA.length - 1]
      const lastB = wordsB[wordsB.length - 1]
      if (lastA === lastB && wordsA[0][0] === wordsB[0][0]) {
        return true
      }
    }

    return false
  }
}
