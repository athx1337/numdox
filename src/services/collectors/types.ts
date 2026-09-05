// ============================================
// NUMDOX Modular Collector Architecture - Types
// ============================================

export type EntityType = 'person' | 'username' | 'email' | 'organization' | 'domain' | 'url' | 'location'
export type MatchType = 'exact' | 'proximity' | 'structured' | 'profile' | 'inferred'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type CollectorType = 'web' | 'github' | 'documents' | 'directories' | 'profiles'
export type CollectorExecutionStatus = 'pending' | 'scanning' | 'completed' | 'unavailable' | 'failed'

export interface EvidenceItem {
  id: string
  type: EntityType
  value: string
  source: string              // Human-readable source, e.g. "Public Web (indiamart.com)", "GitHub Profile"
  sourceType: CollectorType
  sourceUrl?: string          // Must be clickable external URL when available
  matchedPhone: string        // The exact phone variant that matched
  evidence: string            // Contextual text snippet or surrounding content
  matchType: MatchType
  confidence: number          // Numerical confidence between 0.0 and 1.0
  confidenceLevel: ConfidenceLevel
  timestamp: string
  metadata?: Record<string, any>
}

export interface CollectorStatus {
  name: string
  type: CollectorType
  status: CollectorExecutionStatus
  resultsCount: number
  message?: string
  error?: string
}

export interface NormalizedPhoneVariants {
  raw: string
  e164: string                      // "+919876543210"
  digitsOnly: string                // "919876543210"
  national: string                  // "9876543210"
  international: string             // "+91 98765 43210"
  hyphenated: string                // "+91-98765-43210"
  nationalSpaced: string            // "98765 43210"
  nationalHyphenated: string        // "98765-43210"
  withLeadingZero?: string          // "09876543210"
  searchVariants: string[]          // Exact quoted and unquoted permutations
  isIndia: boolean
  countryCode: string               // "IN", "US", etc.
  countryCallingCode: string        // "+91", "+1", etc.
}

export interface Collector {
  name: string
  type: CollectorType
  collect(
    phone: NormalizedPhoneVariants,
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]>
}

export interface IdentityCandidate {
  name: string
  confidence: ConfidenceLevel
  confidenceScore: number
  supportingSourcesCount: number
  sources: string[]
  matchTypes: MatchType[]
  evidenceItems: EvidenceItem[]
  isProximity: boolean
  isStructured: boolean
}

export interface DiscoveredEntities {
  names: string[]
  usernames: string[]
  emails: string[]
  organizations: string[]
  urls: string[]
}

export interface RelationshipItem {
  source: string
  target: string
  relation: string            // e.g. "associated_with_phone", "extracted_from", "owns_username"
  confidence: number
}
