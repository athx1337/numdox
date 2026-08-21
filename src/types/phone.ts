import { z } from 'zod'

// ============================================
// Request Schemas
// ============================================

export const PhoneLookupRequestSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  countryCode: z.string().length(2).optional(),
  modules: z.array(z.enum([
    'validation',
    'carrier',
    'location',
    'social',
    'breach',
    'spam',
    'reputation',
    'identity',
  ])).default(['validation', 'carrier', 'location', 'social', 'breach', 'spam', 'reputation', 'identity']),
  async: z.boolean().default(true),
  forceRefresh: z.boolean().default(false),
})

export type PhoneLookupRequest = z.infer<typeof PhoneLookupRequestSchema>

// ============================================
// Response Schemas - Validation
// ============================================

export const PhoneValidationSchema = z.object({
  valid: z.boolean(),
  format: z.enum(['E164', 'INTERNATIONAL', 'NATIONAL', 'RFC3966']).optional(),
  type: z.enum(['FIXED_LINE', 'MOBILE', 'FIXED_LINE_OR_MOBILE', 'TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'VOIP', 'PERSONAL_NUMBER', 'PAGER', 'UAN', 'VOICEMAIL', 'UNKNOWN']).optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  nationalNumber: z.string().optional(),
  internationalFormat: z.string().optional(),
  nationalFormat: z.string().optional(),
  e164Format: z.string().optional(),
  rfc3966Format: z.string().optional(),
  possible: z.boolean().optional(),
  regionCode: z.string().optional(),
  leadingDigits: z.string().optional(),
})

export type PhoneValidation = z.infer<typeof PhoneValidationSchema>

// ============================================
// Response Schemas - Carrier
// ============================================

export const CarrierInfoSchema = z.object({
  name: z.string().nullable(),
  type: z.enum(['mobile', 'landline', 'voip', 'toll_free', 'premium', 'unknown']).nullable(),
  mcc: z.string().nullable(), // Mobile Country Code
  mnc: z.string().nullable(), // Mobile Network Code
  mccmnc: z.string().nullable(),
  originalNetwork: z.string().nullable(), // Before porting
  ported: z.boolean().default(false),
  confidence: z.enum(['high', 'medium', 'low']).default('low'),
  source: z.string().optional(),
})

export type CarrierInfo = z.infer<typeof CarrierInfoSchema>

// ============================================
// Response Schemas - Location
// ============================================

export const LocationInfoSchema = z.object({
  country: z.string().nullable(),
  countryCode: z.string().nullable(),
  countryName: z.string().nullable(),
  region: z.string().nullable(),
  regionCode: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  isp: z.string().nullable(),
  org: z.string().nullable(),
  asn: z.string().nullable(),
  accuracy: z.enum(['exact', 'city', 'region', 'country']).default('country'),
  source: z.string().optional(),
})

export type LocationInfo = z.infer<typeof LocationInfoSchema>

// ============================================
// Response Schemas - Social Media & UPI
// ============================================

export const SocialMediaAccountSchema = z.object({
  platform: z.string(),
  username: z.string().nullable(),
  url: z.string().nullable(),
  displayName: z.string().nullable(),
  verified: z.boolean().default(false),
  confidence: z.enum(['high', 'medium', 'low']),
  foundAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type SocialMediaAccount = z.infer<typeof SocialMediaAccountSchema>

// ============================================
// Response Schemas - Identity & Person Names
// ============================================

export const IdentityInfoSchema = z.object({
  primaryName: z.string().nullable(),
  aliases: z.array(z.string()).default([]),
  namesDiscovered: z.array(z.object({
    name: z.string(),
    source: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    type: z.string().optional(),
    details: z.string().optional(),
  })).default([]),
  confidence: z.enum(['high', 'medium', 'low']).default('low'),
  source: z.string().optional(),
  upiHandles: z.array(z.object({
    app: z.string(),
    vpa: z.string(),
    verificationUrl: z.string(),
  })).default([]),
  truecallerUrl: z.string().optional(),
})

export type IdentityInfo = z.infer<typeof IdentityInfoSchema>

// ============================================
// Response Schemas - Breach
// ============================================

export const BreachInfoSchema = z.object({
  name: z.string(),
  title: z.string(),
  domain: z.string().nullable(),
  breachDate: z.string().nullable(),
  addedDate: z.string().nullable(),
  pwnCount: z.number().default(0),
  description: z.string().nullable(),
  dataClasses: z.array(z.string()).default([]),
  isVerified: z.boolean().default(false),
  isFabricated: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
  isRetired: z.boolean().default(false),
  isSpamList: z.boolean().default(false),
  logoPath: z.string().nullable().optional(),
})

export type BreachInfo = z.infer<typeof BreachInfoSchema>

// ============================================
// Response Schemas - Spam
// ============================================

export const SpamScoreSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(['clean', 'low', 'medium', 'high']),
  reports: z.number().default(0),
  categories: z.array(z.string()).default([]),
  recentReports: z.number().default(0),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  lastReported: z.string().nullable().optional(),
  sources: z.array(z.string()).default([]),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type SpamScore = z.infer<typeof SpamScoreSchema>

// ============================================
// Response Schemas - Reputation
// ============================================

export const ReputationInfoSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(['clean', 'suspicious', 'malicious']),
  categories: z.array(z.string()).default([]),
  sources: z.array(z.object({
    name: z.string(),
    score: z.number().optional(),
    categories: z.array(z.string()).optional(),
    url: z.string().optional(),
  })).default([]),
  asn: z.string().nullable(),
  isp: z.string().nullable(),
  isVpn: z.boolean().default(false),
  isProxy: z.boolean().default(false),
  isTor: z.boolean().default(false),
  isHosting: z.boolean().default(false),
  lastSeen: z.string().datetime().nullable(),
})

export type ReputationInfo = z.infer<typeof ReputationInfoSchema>

// ============================================
// Complete Lookup Result
// ============================================

export const PhoneLookupResultSchema = z.object({
  jobId: z.string().uuid(),
  phone: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    currentModule: z.string().optional(),
  }).optional(),
  validation: PhoneValidationSchema.nullable(),
  carrier: CarrierInfoSchema.nullable(),
  location: LocationInfoSchema.nullable(),
  identity: IdentityInfoSchema.optional().nullable(),
  social: z.array(SocialMediaAccountSchema).default([]),
  breaches: z.array(BreachInfoSchema).default([]),
  spam: SpamScoreSchema.nullable(),
  reputation: ReputationInfoSchema.nullable(),
  error: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  cached: z.boolean().default(false),
})

export type PhoneLookupResult = z.infer<typeof PhoneLookupResultSchema>

// ============================================
// History & Pagination Schemas
// ============================================

export const LookupHistoryItemSchema = z.object({
  id: z.string().optional(),
  jobId: z.string(),
  phone: z.string(),
  maskedPhone: z.string().optional(),
  countryCode: z.string().optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional().nullable(),
  carrier: CarrierInfoSchema.optional().nullable(),
  location: LocationInfoSchema.optional().nullable(),
  reputation: ReputationInfoSchema.optional().nullable(),
  identity: IdentityInfoSchema.optional().nullable(),
})

export type LookupHistoryItem = z.infer<typeof LookupHistoryItemSchema>

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
  })
}

export const JobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.object({
    current: z.number(),
    total: z.number(),
    currentModule: z.string().optional(),
  }).optional(),
})

export function ApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }).optional(),
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string().datetime(),
      version: z.string(),
    }),
  })
}

// ============================================
// Module Definitions
// ============================================

export interface ModuleDefinition {
  name: string
  displayName: string
  description: string
  icon: string
  category: 'core' | 'intelligence' | 'security'
  status: ModuleStatus
  startedAt?: string
  completedAt?: string
}

export type ModuleStatus = 'pending' | 'processing' | 'completed' | 'failed'

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    name: 'validation',
    displayName: 'Validation',
    description: 'Format, type, and validity checks',
    icon: 'ShieldCheck',
    category: 'core',
    status: 'pending',
  },
  {
    name: 'carrier',
    displayName: 'Carrier & Routing',
    description: 'Carrier network and line type detection',
    icon: 'Smartphone',
    category: 'core',
    status: 'pending',
  },
  {
    name: 'location',
    displayName: 'Geo Footprint',
    description: 'Circle, region, and time zone resolution',
    icon: 'Globe2',
    category: 'core',
    status: 'pending',
  },
  {
    name: 'identity',
    displayName: 'Identity Graph',
    description: 'Names, aliases, and UPI handles',
    icon: 'Fingerprint',
    category: 'intelligence',
    status: 'pending',
  },
  {
    name: 'social',
    displayName: 'Social Surfaces',
    description: 'Public profile, Truecaller, and chat matches',
    icon: 'Network',
    category: 'intelligence',
    status: 'pending',
  },
  {
    name: 'breach',
    displayName: 'Breach Signals',
    description: 'Data breach and leak exposure check',
    icon: 'ShieldAlert',
    category: 'security',
    status: 'pending',
  },
  {
    name: 'spam',
    displayName: 'Spam Score',
    description: 'Spam report and telemarketing risk',
    icon: 'AlertTriangle',
    category: 'security',
    status: 'pending',
  },
  {
    name: 'reputation',
    displayName: 'Reputation',
    description: 'Fraud and threat intelligence scoring',
    icon: 'Activity',
    category: 'security',
    status: 'pending',
  },
]