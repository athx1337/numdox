'use client'

import * as React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MODULES, ModuleKey } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ModuleSelectorProps {
  selectedModules: ModuleKey[]
  onChange: (modules: ModuleKey[]) => void
  disabled?: boolean
  className?: string
}

export function ModuleSelector({
  selectedModules,
  onChange,
  disabled,
  className,
}: ModuleSelectorProps) {
  const allModules: ModuleKey[] = Object.keys(MODULES) as ModuleKey[]

  const toggleModule = (module: ModuleKey) => {
    if (selectedModules.includes(module)) {
      onChange(selectedModules.filter((m) => m !== module))
    } else {
      onChange([...selectedModules, module])
    }
  }

  const selectAll = () => onChange(allModules)
  const selectNone = () => onChange([])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled || selectedModules.length === allModules.length}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          Select All
        </button>
        <button
          type="button"
          onClick={selectNone}
          disabled={disabled || selectedModules.length === 0}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          Select None
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {allModules.map((module) => {
          const config = MODULES[module]
          const isSelected = selectedModules.includes(module)

          return (
            <label
              key={module}
              className={cn(
                'group relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all',
                isSelected
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleModule(module)}
                disabled={disabled}
                className="h-4 w-4 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{config.icon}</span>
                  <span className="font-medium truncate">{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{config.description}</p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// Quick toggle buttons for common presets
export function ModulePresets({
  selectedModules,
  onChange,
  disabled,
}: ModuleSelectorProps) {
  const presets = {
    'Quick Scan': ['validation', 'carrier', 'location'] as ModuleKey[],
    'Full OSINT': ['validation', 'carrier', 'location', 'social', 'breach', 'spam', 'reputation'] as ModuleKey[],
    'Reputation Only': ['spam', 'reputation'] as ModuleKey[],
    'Social & Breach': ['social', 'breach'] as ModuleKey[],
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(presets).map(([label, modules]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(modules)}
          disabled={disabled}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md border transition-colors',
            selectedModules.length === modules.length &&
              modules.every((m) => selectedModules.includes(m))
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-accent'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}