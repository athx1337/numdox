// ============================================
// Phone Normalizer & Variant Generator
// ============================================

import { parsePhoneNumberFromString, PhoneNumber } from 'libphonenumber-js'
import { NormalizedPhoneVariants } from './types'

export class PhoneVariantNormalizer {
  static normalize(rawInput: string, defaultCountry = 'IN'): NormalizedPhoneVariants {
    const raw = rawInput.trim()
    const digitsOnly = raw.replace(/[^\d]/g, '')
    const defaultRegion = (defaultCountry || 'IN').toUpperCase() as any

    let parsed: PhoneNumber | undefined

    try {
      if (raw.startsWith('+')) {
        parsed = parsePhoneNumberFromString(raw)
      } else {
        parsed = parsePhoneNumberFromString(raw, defaultRegion)
      }
    } catch {
      // Fallback
    }

    if (!parsed) {
      // Fallback manual normalization
      const isIndia = digitsOnly.length === 10 || digitsOnly.startsWith('91')
      const national = digitsOnly.length === 10 ? digitsOnly : digitsOnly.slice(-10)
      const e164 = `+91${national}`
      const nationalSpaced = `${national.slice(0, 5)} ${national.slice(5)}`
      const nationalHyphenated = `${national.slice(0, 5)}-${national.slice(5)}`
      const international = `+91 ${nationalSpaced}`
      const hyphenated = `+91-${nationalHyphenated}`
      const withLeadingZero = `0${national}`

      const searchVariants = Array.from(
        new Set([
          `"${e164}"`,
          `"${national}"`,
          `"${international}"`,
          `"${hyphenated}"`,
          `"${withLeadingZero}"`,
          e164,
          national,
          international,
          hyphenated,
        ])
      )

      return {
        raw,
        e164,
        digitsOnly,
        national,
        international,
        hyphenated,
        nationalSpaced,
        nationalHyphenated,
        withLeadingZero,
        searchVariants,
        isIndia,
        countryCode: isIndia ? 'IN' : 'UNKNOWN',
        countryCallingCode: '+91',
      }
    }

    const countryCode = parsed.country || defaultRegion
    const countryCallingCode = parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : '+91'
    const isIndia = countryCode === 'IN' || parsed.countryCallingCode === '91'

    const e164 = parsed.format('E.164')
    const national = parsed.nationalNumber
    const international = parsed.format('INTERNATIONAL')
    const nationalSpaced = parsed.format('NATIONAL')

    // Create hyphenated variations
    const hyphenated = international.replace(/\s+/g, '-')
    const nationalHyphenated = nationalSpaced.replace(/\s+/g, '-')
    const withLeadingZero = isIndia ? `0${national}` : undefined

    const variantsSet = new Set<string>()

    // Priority exact search quotes
    variantsSet.add(`"${e164}"`)
    variantsSet.add(`"${national}"`)
    variantsSet.add(`"${international}"`)
    if (withLeadingZero) {
      variantsSet.add(`"${withLeadingZero}"`)
    }
    variantsSet.add(`"${hyphenated}"`)

    // Standard unquoted variants
    variantsSet.add(e164)
    variantsSet.add(national)
    variantsSet.add(international)
    variantsSet.add(nationalSpaced)
    variantsSet.add(hyphenated)
    variantsSet.add(nationalHyphenated)
    if (withLeadingZero) {
      variantsSet.add(withLeadingZero)
    }

    return {
      raw,
      e164,
      digitsOnly: digitsOnly || national,
      national,
      international,
      hyphenated,
      nationalSpaced,
      nationalHyphenated,
      withLeadingZero,
      searchVariants: Array.from(variantsSet),
      isIndia,
      countryCode,
      countryCallingCode,
    }
  }
}
