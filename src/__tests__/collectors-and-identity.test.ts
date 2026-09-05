import { describe, it, expect } from 'vitest'
import { PhoneVariantNormalizer } from '../services/collectors/normalizer'
import { IdentityCorrelator } from '../services/identity/correlator'
import { EvidenceItem } from '../services/collectors/types'
import { DirectoryCollector } from '../services/collectors/directories'

describe('PhoneVariantNormalizer', () => {
  it('generates exhaustive search variants for Indian mobile numbers', () => {
    const res = PhoneVariantNormalizer.normalize('+919876543210')
    expect(res.e164).toBe('+919876543210')
    expect(res.national).toBe('9876543210')
    expect(res.isIndia).toBe(true)
    expect(res.countryCode).toBe('IN')

    // Exact search quotes
    expect(res.searchVariants).toContain('"+919876543210"')
    expect(res.searchVariants).toContain('"9876543210"')
    expect(res.searchVariants).toContain('"09876543210"')
    expect(res.searchVariants).toContain('+91 98765 43210')
  })

  it('normalizes unformatted 10-digit input to +91 E.164 with variants', () => {
    const res = PhoneVariantNormalizer.normalize('9810012345', 'IN')
    expect(res.e164).toBe('+919810012345')
    expect(res.national).toBe('9810012345')
    expect(res.searchVariants.length).toBeGreaterThanOrEqual(6)
  })

  it('normalizes US numbers accurately', () => {
    const res = PhoneVariantNormalizer.normalize('+14155552671')
    expect(res.e164).toBe('+14155552671')
    expect(res.countryCode).toBe('US')
    expect(res.countryCallingCode).toBe('+1')
  })
})

describe('IdentityCorrelator', () => {
  it('returns NO RELIABLE NAME FOUND when no public evidence is extracted', () => {
    const result = IdentityCorrelator.correlate([], '+919876543210')
    expect(result.primaryCandidate).toBeNull()
    expect(result.statusMessage).toBe('NO RELIABLE NAME FOUND')
    expect(result.isResolved).toBe(false)
    expect(result.rankedCandidates).toHaveLength(0)
  })

  it('aggregates and clusters related name variations (e.g. John Smith and J. Smith)', () => {
    const evidence: EvidenceItem[] = [
      {
        id: '1',
        type: 'person',
        value: 'John Smith',
        source: 'Public Web (company.com)',
        sourceType: 'web',
        sourceUrl: 'https://company.com/team',
        matchedPhone: '9876543210',
        evidence: 'Contact: John Smith, Phone: 9876543210',
        matchType: 'exact',
        confidence: 0.85,
        confidenceLevel: 'high',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'person',
        value: 'J Smith',
        source: 'Public Document (report.pdf)',
        sourceType: 'documents',
        sourceUrl: 'https://files.org/report.pdf',
        matchedPhone: '9876543210',
        evidence: 'Authorized signatory: J Smith (+91 98765 43210)',
        matchType: 'proximity',
        confidence: 0.75,
        confidenceLevel: 'medium',
        timestamp: new Date().toISOString(),
      },
      {
        id: '3',
        type: 'username',
        value: '@johnsmith',
        source: 'GitHub (@johnsmith)',
        sourceType: 'github',
        sourceUrl: 'https://github.com/johnsmith',
        matchedPhone: '9876543210',
        evidence: 'Developer profile for @johnsmith',
        matchType: 'profile',
        confidence: 0.8,
        confidenceLevel: 'high',
        timestamp: new Date().toISOString(),
      },
    ]

    const result = IdentityCorrelator.correlate(evidence, '+919876543210')
    expect(result.isResolved).toBe(true)
    expect(result.primaryCandidate).not.toBeNull()
    expect(result.primaryCandidate?.name).toBe('John Smith')
    expect(result.primaryCandidate?.confidence).toBe('high')
    expect(result.primaryCandidate?.supportingSourcesCount).toBe(2)
    expect(result.entities.usernames).toContain('@johnsmith')
  })

  it('prioritizes structured Schema.org and exact directory records', () => {
    const evidence: EvidenceItem[] = [
      {
        id: '1',
        type: 'person',
        value: 'Ananya Sharma',
        source: 'Public Web Schema.org (institute.edu)',
        sourceType: 'web',
        sourceUrl: 'https://institute.edu/faculty',
        matchedPhone: '+919876543210',
        evidence: 'Schema.org ContactPoint for Ananya Sharma',
        matchType: 'structured',
        confidence: 0.9,
        confidenceLevel: 'high',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'person',
        value: 'Casual Mention',
        source: 'Public Forum',
        sourceType: 'web',
        sourceUrl: 'https://forum.com/thread',
        matchedPhone: '9876543210',
        evidence: 'Casual Mention nearby',
        matchType: 'proximity',
        confidence: 0.3,
        confidenceLevel: 'low',
        timestamp: new Date().toISOString(),
      },
    ]

    const result = IdentityCorrelator.correlate(evidence, '+919876543210')
    expect(result.primaryCandidate?.name).toBe('Ananya Sharma')
    expect(result.primaryCandidate?.confidence).toBe('high')
  })
})

describe('DirectoryCollector (Non-blocking)', () => {
  it('executes gracefully without throwing on invalid or exhausted API keys', async () => {
    const collector = new DirectoryCollector()
    const variants = PhoneVariantNormalizer.normalize('+919876543210')

    let reportedStatus = ''
    const results = await collector.collect(variants, (status) => {
      reportedStatus = status.status
    })

    // Should return an array without throwing
    expect(Array.isArray(results)).toBe(true)
    expect(['completed', 'unavailable']).toContain(reportedStatus)
  })
})
