// ============================================
// Phone Validation Service
// Uses libphonenumber-js (Google's library)
// ============================================

import { parsePhoneNumberFromString, PhoneNumber } from 'libphonenumber-js'
import { PhoneValidation } from '@/types/phone'
import { CACHE_TTL } from '@/lib/constants'

interface ValidationResult {
  validation: PhoneValidation
  cached: boolean
}

export class PhoneValidator {
  private static cache: Map<string, { data: PhoneValidation; expires: number }> = new Map()

  static async validate(phone: string, countryCode?: string): Promise<ValidationResult> {
    const cacheKey = `validation:${countryCode || 'auto'}:${phone}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expires > Date.now()) {
      return { validation: cached.data, cached: true }
    }

    try {
      const phoneNumber: PhoneNumber | undefined = parsePhoneNumberFromString(phone, countryCode as any)

      if (!phoneNumber) {
        const invalidResult: PhoneValidation = {
          valid: false,
          possible: false,
        }
        this.setCache(cacheKey, invalidResult)
        return { validation: invalidResult, cached: false }
      }

      const isValid = phoneNumber.isValid()
      const isPossible = phoneNumber.isPossible()
      const type = phoneNumber.getType()
      const country = phoneNumber.country
      const countryCallingCode = phoneNumber.countryCallingCode
      const nationalNumber = phoneNumber.nationalNumber

      const result: PhoneValidation = {
        valid: isValid,
        possible: isPossible,
        format: 'E164',
        type: type || 'UNKNOWN',
        countryCode: countryCallingCode ? `+${countryCallingCode}` : undefined,
        countryName: country ? this.getCountryName(country) : undefined,
        nationalNumber,
        internationalFormat: phoneNumber.format('INTERNATIONAL'),
        nationalFormat: phoneNumber.format('NATIONAL'),
        e164Format: phoneNumber.format('E.164'),
        rfc3966Format: phoneNumber.format('RFC3966'),
        regionCode: country,
        leadingDigits: this.getLeadingDigits(nationalNumber, country),
      }

      this.setCache(cacheKey, result)
      return { validation: result, cached: false }
    } catch (error) {
      console.error('Phone validation error:', error)
      const errorResult: PhoneValidation = {
        valid: false,
        possible: false,
      }
      return { validation: errorResult, cached: false }
    }
  }

  private static setCache(key: string, data: PhoneValidation): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + CACHE_TTL.validation * 1000,
    })
  }

  private static getCountryName(countryCode: string): string {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
      GB: 'United Kingdom',
      AU: 'Australia',
      DE: 'Germany',
      FR: 'France',
      IN: 'India',
      BR: 'Brazil',
      MX: 'Mexico',
      ES: 'Spain',
      IT: 'Italy',
      JP: 'Japan',
      KR: 'South Korea',
      CN: 'China',
      RU: 'Russia',
    }
    return countryNames[countryCode] || countryCode
  }

  private static getLeadingDigits(nationalNumber: string, countryCode?: string): string {
    if (!countryCode) return nationalNumber.slice(0, 3)

    // Common leading digits by country
    const leadingDigits: Record<string, string> = {
      US: '2-9',
      CA: '2-9',
      GB: '1-9',
      AU: '2-4',
      DE: '1-9',
      FR: '1-9',
      IN: '6-9',
      BR: '1-9',
      MX: '1-9',
    }
    return leadingDigits[countryCode] || nationalNumber.slice(0, 3)
  }

  static clearCache(): void {
    this.cache.clear()
  }
}