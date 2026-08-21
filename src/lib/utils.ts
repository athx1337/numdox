import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return ''
  return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
}

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return ''
  const cleaned = formatPhoneNumber(phone)
  if (cleaned.length <= 4) return cleaned
  return cleaned.slice(0, -4).replace(/\d/g, '*') + cleaned.slice(-4)
}

export function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode || typeof countryCode !== 'string') return '🌐'
  const code = countryCode.toUpperCase()
  if (code.length !== 2) return '🌐'
  return code
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}