import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// ============================================
// Users Table (for API key management)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}))

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  passwordHash: z.string().min(8),
})
export const selectUserSchema = createSelectSchema(users)
export type User = z.infer<typeof selectUserSchema>
export type NewUser = z.infer<typeof insertUserSchema>

// ============================================
// API Keys Table
// ============================================

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(), // First 8 chars for display
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  rateLimit: integer('rate_limit').default(100).notNull(), // requests per hour
  isActive: boolean('is_active').default(true).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  keyPrefixIdx: uniqueIndex('api_keys_key_prefix_idx').on(table.keyPrefix),
}))

export const insertApiKeySchema = createInsertSchema(apiKeys)
export const selectApiKeySchema = createSelectSchema(apiKeys)
export type ApiKey = z.infer<typeof selectApiKeySchema>
export type NewApiKey = z.infer<typeof insertApiKeySchema>

// ============================================
// Phone Lookups Table (History & Caching)
// ============================================

export const phoneLookups = pgTable('phone_lookups', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').defaultRandom().notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  phone: varchar('phone', { length: 50 }).notNull(),
  maskedPhone: varchar('masked_phone', { length: 50 }).notNull(),
  countryCode: varchar('country_code', { length: 2 }),
  modules: jsonb('modules').$type<string[]>().default([]).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  validation: jsonb('validation'),
  carrier: jsonb('carrier'),
  location: jsonb('location'),
  social: jsonb('social').$type<unknown[]>().default([]),
  breaches: jsonb('breaches').$type<unknown[]>().default([]),
  spam: jsonb('spam'),
  reputation: jsonb('reputation'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  cached: boolean('cached').default(false).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
}, (table) => ({
  jobIdIdx: uniqueIndex('phone_lookups_job_id_idx').on(table.jobId),
  userIdIdx: index('phone_lookups_user_id_idx').on(table.userId),
  phoneIdx: index('phone_lookups_phone_idx').on(table.phone),
  statusIdx: index('phone_lookups_status_idx').on(table.status),
  createdAtIdx: index('phone_lookups_started_at_idx').on(table.startedAt),
}))

export const insertPhoneLookupSchema = createInsertSchema(phoneLookups)
export const selectPhoneLookupSchema = createSelectSchema(phoneLookups)
export type PhoneLookup = z.infer<typeof selectPhoneLookupSchema>
export type NewPhoneLookup = z.infer<typeof insertPhoneLookupSchema>

// ============================================
// Rate Limiting Table
// ============================================

export const rateLimits = pgTable('rate_limits', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(), // IP or API key prefix
  identifierType: varchar('identifier_type', { length: 20 }).notNull(), // 'ip' | 'api_key'
  endpoint: varchar('endpoint', { length: 100 }).notNull(),
  count: integer('count').default(1).notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),
  windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
}, (table) => ({
  identifierIdx: index('rate_limits_identifier_idx').on(table.identifier),
  windowIdx: index('rate_limits_window_idx').on(table.windowStart, table.windowEnd),
}))

export const insertRateLimitSchema = createInsertSchema(rateLimits)
export const selectRateLimitSchema = createSelectSchema(rateLimits)
export type RateLimit = z.infer<typeof selectRateLimitSchema>
export type NewRateLimit = z.infer<typeof insertRateLimitSchema>

// ============================================
// Cache Table (for API response caching)
// ============================================

export const apiCache = pgTable('api_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  cacheKey: varchar('cache_key', { length: 500 }).notNull().unique(),
  module: varchar('module', { length: 50 }).notNull(),
  phoneHash: varchar('phone_hash', { length: 64 }).notNull(), // SHA256 of phone
  response: jsonb('response').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cacheKeyIdx: uniqueIndex('api_cache_cache_key_idx').on(table.cacheKey),
  phoneHashIdx: index('api_cache_phone_hash_idx').on(table.phoneHash),
  moduleIdx: index('api_cache_module_idx').on(table.module),
  expiresAtIdx: index('api_cache_expires_at_idx').on(table.expiresAt),
}))

export const insertApiCacheSchema = createInsertSchema(apiCache)
export const selectApiCacheSchema = createSelectSchema(apiCache)
export type ApiCache = z.infer<typeof selectApiCacheSchema>
export type NewApiCache = z.infer<typeof insertApiCacheSchema>