'use client'

import React, { useState, useEffect } from 'react'
import { Sun, Moon, Sparkles, Monitor } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={`flex items-center border-2 border-foreground bg-card p-1 shadow-[3px_3px_0_var(--foreground)] ${className}`}>
        <div className="size-7 rounded-none bg-muted animate-pulse" />
      </div>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <div className={`flex items-center gap-1 border-2 border-foreground bg-card p-1 shadow-[3px_3px_0_var(--foreground)] select-none ${className}`}>
      {/* Interactive Quick Toggle Button */}
      <button
        onClick={toggleTheme}
        title={`Current: ${resolvedTheme.toUpperCase()} (Click to switch)`}
        aria-label="Toggle theme"
        className="group relative flex items-center justify-center size-8 border border-border bg-background hover:bg-primary hover:text-primary-foreground transition-all duration-200 active:translate-x-0.5 active:translate-y-0.5"
      >
        <Sun
          className={`size-4 text-amber-500 transition-all duration-300 ${
            isDark ? 'rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          className={`size-4 text-cyan-400 transition-all duration-300 ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0 absolute'
          }`}
        />
      </button>

      {/* Mode Selector Chips */}
      <div className="flex items-center text-[10px] font-mono font-bold tracking-tight">
        <button
          onClick={() => setTheme('light')}
          className={`px-2 py-1 transition-all ${
            theme === 'light'
              ? 'bg-foreground text-background font-black shadow-[1px_1px_0_var(--background)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          LT
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`px-2 py-1 transition-all ${
            theme === 'dark'
              ? 'bg-foreground text-background font-black shadow-[1px_1px_0_var(--background)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          DK
        </button>
        <button
          onClick={() => setTheme('system')}
          title="System Sync"
          className={`px-2 py-1 transition-all ${
            theme === 'system'
              ? 'bg-foreground text-background font-black shadow-[1px_1px_0_var(--background)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Monitor className="size-3 inline" />
        </button>
      </div>
    </div>
  )
}
