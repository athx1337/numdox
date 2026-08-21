'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { getCountryFlag, UI } from '@/lib/constants'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  onCountryChange: (countryCode: string) => void
  countryCode: string
  disabled?: boolean
  error?: string
  placeholder?: string
}

export function PhoneInput({
  value,
  onChange,
  onCountryChange,
  countryCode,
  disabled,
  error,
  placeholder = 'Enter phone number',
}: PhoneInputProps) {
  const [formattedValue, setFormattedValue] = React.useState(value)

  React.useEffect(() => {
    setFormattedValue(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    // Allow only digits, +, spaces, dashes, parentheses
    const cleaned = rawValue.replace(/[^\d+\-\s()]/g, '')
    setFormattedValue(cleaned)
    onChange(cleaned)
  }

  return (
    <div className="flex gap-2">
      {/* Country Selector */}
      <div className="w-32 shrink-0">
        <Select
          value={countryCode}
          onValueChange={onCountryChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="🌐" />
          </SelectTrigger>
          <SelectContent position="popper">
            {UI.supportedCountries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{getCountryFlag(country.code)}</span>
                  <span>{country.dialCode} {country.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phone Input */}
      <div className="flex-1 relative">
        <Input
          type="tel"
          value={formattedValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          error={!!error}
          className="pr-10"
          autoComplete="tel"
          aria-label="Phone number"
        />
        {error && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive text-sm">
            ⚠
          </span>
        )}
      </div>
    </div>
  )
}

// Hook for phone formatting
export function usePhoneFormat(initialValue = '') {
  const [value, setValue] = React.useState(initialValue)

  const format = React.useCallback((input: string) => {
    // Basic formatting: (XXX) XXX-XXXX for US numbers
    const digits = input.replace(/\D/g, '')
    if (digits.length === 0) return ''
    if (digits.length <= 3) return `(${digits}`
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }, [])

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = format(e.target.value)
    setValue(formatted)
  }, [format])

  return { value, onChange: handleChange, setValue }
}