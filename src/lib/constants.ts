// ============================================
// App Constants
// ============================================

export const APP_NAME = 'phonetrace'
export const APP_DESCRIPTION = 'Phone Number OSINT & Intelligence Platform'
export const APP_VERSION = '0.1.0'

// ============================================
// API Configuration
// ============================================

export const API_VERSION = 'v1'
export const API_PREFIX = `/api/${API_VERSION}`

export const RATE_LIMITS = {
  anonymous: { requests: 10, window: '1h' }, // 10 requests/hour for anonymous
  authenticated: { requests: 100, window: '1h' }, // 100 requests/hour for authenticated
  apiKey: { requests: 1000, window: '1h' }, // 1000 requests/hour for API keys
} as const

// ============================================
// Cache TTL (in seconds)
// ============================================

export const CACHE_TTL = {
  validation: 86400 * 30, // 30 days - validation rarely changes
  carrier: 86400 * 7, // 7 days
  location: 86400 * 7, // 7 days
  social: 86400 * 1, // 1 day
  breach: 86400 * 1, // 1 day
  spam: 86400 * 1, // 1 day
  reputation: 86400 * 1, // 1 day
} as const

// ============================================
// Module Definitions (matching types)
// ============================================

export const MODULES = {
  validation: { label: 'Validation', icon: 'check-circle', description: 'Phone number format & validity' },
  carrier: { label: 'Carrier', icon: 'antenna', description: 'Carrier & line type detection' },
  location: { label: 'Location', icon: 'map-pin', description: 'Geographic location & timezone' },
  social: { label: 'Social Media', icon: 'users', description: 'Linked social media accounts' },
  breach: { label: 'Data Breaches', icon: 'alert-triangle', description: 'Breach exposure check' },
  spam: { label: 'Spam Score', icon: 'shield-alert', description: 'Spam & scam reputation' },
  reputation: { label: 'Reputation', icon: 'activity', description: 'IP & network reputation' },
} as const

export type ModuleKey = keyof typeof MODULES

// ============================================
// External API Endpoints (Free tiers)
// ============================================

export const EXTERNAL_APIS = {
  // Phone validation & info
  libphonenumber: 'https://github.com/google/libphonenumber',
  freeCarrierApi: 'https://freecarrierapi.com',
  openCage: 'https://api.opencagedata.com',
  ipApi: 'http://ip-api.com',
  ipApiCom: 'https://ipapi.co',

  // Breach data
  haveIBeenPwned: 'https://haveibeenpwned.com/api/v3',

  // Spam/Reputation (some require API keys)
  truecaller: 'https://www.truecaller.com',
  shouldIAnswer: 'https://www.shouldianswer.com',
  syncMe: 'https://sync.me',
  abuseIPDB: 'https://api.abuseipdb.com',
  alienVaultOTX: 'https://otx.alienvault.com/api',
  greyNoise: 'https://api.greynoise.io',
  shodan: 'https://internetdb.shodan.io',

  // Social OSINT
  phoneInfoga: 'https://phoneinfoga.serveo.net',
  socialAnalyzer: 'https://api.social-analyzer.com',
} as const

// ============================================
// Environment Variable Keys
// ============================================

export const ENV_KEYS = {
  // Database
  DATABASE_URL: 'DATABASE_URL',
  POSTGRES_URL: 'POSTGRES_URL',

  // Auth
  SESSION_PASSWORD: 'SESSION_PASSWORD',
  SESSION_COOKIE_NAME: 'SESSION_COOKIE_NAME',

  // External APIs (optional - for enhanced results)
  OPENCAGE_API_KEY: 'OPENCAGE_API_KEY',
  ABUSEIPDB_API_KEY: 'ABUSEIPDB_API_KEY',
  OTX_API_KEY: 'OTX_API_KEY',
  GREYNOISE_API_KEY: 'GREYNOISE_API_KEY',
  SHODAN_API_KEY: 'SHODAN_API_KEY',
  HIBP_API_KEY: 'HIBP_API_KEY',
  NUMVERIFY_API_KEY: 'NUMVERIFY_API_KEY',
  ABSTRACT_API_KEY: 'ABSTRACT_API_KEY',
  TWILIO_ACCOUNT_SID: 'TWILIO_ACCOUNT_SID',
  TWILIO_AUTH_TOKEN: 'TWILIO_AUTH_TOKEN',

  // App
  NODE_ENV: 'NODE_ENV',
  NEXT_PUBLIC_APP_URL: 'NEXT_PUBLIC_APP_URL',
} as const

// ============================================
// UI Constants
// ============================================

export const UI = {
  maxPhoneLength: 20,
  defaultCountry: 'IN',
  supportedCountries: [
    { code: 'IN', name: 'India', dialCode: '+91' },
    { code: 'US', name: 'United States', dialCode: '+1' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
    { code: 'CA', name: 'Canada', dialCode: '+1' },
    { code: 'AU', name: 'Australia', dialCode: '+61' },
    { code: 'DE', name: 'Germany', dialCode: '+49' },
    { code: 'FR', name: 'France', dialCode: '+33' },
    { code: 'BR', name: 'Brazil', dialCode: '+55' },
    { code: 'MX', name: 'Mexico', dialCode: '+52' },
    { code: 'ES', name: 'Spain', dialCode: '+34' },
    { code: 'IT', name: 'Italy', dialCode: '+39' },
    { code: 'JP', name: 'Japan', dialCode: '+81' },
    { code: 'KR', name: 'South Korea', dialCode: '+82' },
    { code: 'CN', name: 'China', dialCode: '+86' },
    { code: 'RU', name: 'Russia', dialCode: '+7' },
  ] as const,
} as const

export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  INVALID_PHONE: 'INVALID_PHONE',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_FAILED: 'JOB_FAILED',
} as const

export type ErrorCode = keyof typeof ERROR_CODES