import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from '@/lib/auth'
import { formatPhoneNumber, maskPhoneNumber, getCountryFlag } from '@/lib/utils'
import { getCountryFlag as getFlagFromConstants } from '@/lib/constants'

describe('Auth Utilities', () => {
  it('hashes and verifies passwords securely', () => {
    const password = 'StrongPassword123!'
    const { hash, salt } = hashPassword(password)
    expect(hash).toBeDefined()
    expect(salt).toBeDefined()

    expect(verifyPassword(password, hash, salt)).toBe(true)
    expect(verifyPassword('WrongPassword', hash, salt)).toBe(false)
  })

  it('generates well-formed API keys', () => {
    const { key, prefix, hash } = generateApiKey()
    expect(key.startsWith('pt_')).toBe(true)
    expect(prefix).toBe(key.slice(0, 12))
    expect(hash).toBe(hashApiKey(key))
  })
})

describe('Phone Utilities', () => {
  it('formats phone numbers by stripping whitespace and invalid characters', () => {
    expect(formatPhoneNumber('+1 (415) 555-2671')).toBe('+14155552671')
  })

  it('masks phone numbers correctly', () => {
    expect(maskPhoneNumber('+14155552671')).toBe('+*******2671')
    expect(maskPhoneNumber('123')).toBe('123')
  })

  it('generates emoji flags from country codes', () => {
    expect(getCountryFlag('US')).toBe('🇺🇸')
    expect(getFlagFromConstants('GB')).toBe('🇬🇧')
    expect(getFlagFromConstants('IN')).toBe('🇮🇳')
  })
})
