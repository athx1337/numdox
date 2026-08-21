import { describe, it, expect, beforeEach } from 'vitest'
import { PhoneValidator } from '@/services/phone-validator'

describe('PhoneValidator', () => {
  beforeEach(() => {
    PhoneValidator.clearCache()
  })

  it('validates a valid US phone number correctly', async () => {
    const result = await PhoneValidator.validate('+14155552671')
    expect(result.validation.valid).toBe(true)
    expect(result.validation.countryCode).toBe('+1')
    expect(result.validation.countryName).toBe('United States')
    expect(result.validation.format).toBe('E164')
    expect(result.cached).toBe(false)
  })

  it('caches validation results for repeat queries', async () => {
    const first = await PhoneValidator.validate('+14155552671')
    expect(first.cached).toBe(false)

    const second = await PhoneValidator.validate('+14155552671')
    expect(second.cached).toBe(true)
    expect(second.validation.valid).toBe(true)
  })

  it('handles invalid numbers gracefully', async () => {
    const result = await PhoneValidator.validate('not-a-number')
    expect(result.validation.valid).toBe(false)
    expect(result.validation.possible).toBe(false)
  })

  it('validates numbers with explicit country code', async () => {
    const result = await PhoneValidator.validate('02071838750', 'GB')
    expect(result.validation.valid).toBe(true)
    expect(result.validation.countryCode).toBe('+44')
    expect(result.validation.countryName).toBe('United Kingdom')
  })
})
