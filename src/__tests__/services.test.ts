import { describe, it, expect } from 'vitest'
import { LocationLookup } from '@/services/location-lookup'
import { ReputationChecker } from '@/services/reputation-checker'
import { PhoneLookupRequestSchema, PhoneValidationSchema } from '@/types/phone'

import { CarrierLookup } from '@/services/carrier-lookup'

describe('CarrierLookup', () => {
  it('accurately resolves mobile carrier for known test number', async () => {
    const { carrier } = await CarrierLookup.lookup('+918453607248', 'IN')
    expect(carrier.name).toBeDefined()
    expect(carrier.name?.toLowerCase()).toContain('mts')
    expect(carrier.confidence).toBe('high')
    expect(carrier.ported).toBe(true)
  })

  it('accurately resolves Bharti Airtel series', async () => {
    const { carrier } = await CarrierLookup.lookup('+919810012345', 'IN')
    expect(carrier.name).toBeDefined()
    expect(carrier.name?.toLowerCase()).toContain('airtel')
  })

  it('accurately resolves Reliance Jio series', async () => {
    const { carrier } = await CarrierLookup.lookup('+917000012345', 'IN')
    expect(carrier.name).toBeDefined()
    expect(carrier.name?.toLowerCase()).toContain('jio')
  })
})

describe('LocationLookup', () => {
  it('extracts location metadata from phone number', async () => {
    const { location } = await LocationLookup.lookup('+14155552671', 'US')
    expect(location.country).toBe('US')
    expect(location.countryName).toBe('United States')
    expect(location.timezone).toBeDefined()
  })
})

describe('ReputationChecker', () => {
  it('returns clean baseline country reputation without errors', async () => {
    const { reputation } = await ReputationChecker.check('+14155552671', 'US')
    expect(reputation.level).toBe('clean')
    expect(reputation.score).toBe(0)
    expect(Array.isArray(reputation.categories)).toBe(true)
  })
})

describe('Phone Types & Zod Schemas', () => {
  it('validates a valid lookup request', () => {
    const parsed = PhoneLookupRequestSchema.safeParse({
      phone: '+14155552671',
      countryCode: 'US',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.async).toBe(true)
      expect(parsed.data.modules.length).toBe(8)
    }
  })

  it('rejects an empty phone number', () => {
    const parsed = PhoneLookupRequestSchema.safeParse({
      phone: '',
    })
    expect(parsed.success).toBe(false)
  })
})
