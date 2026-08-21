import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'numdox — Phone intelligence, without the noise',
  description: 'A sharp, privacy-first phone intelligence workspace for turning one number into a map of public signals.',
  keywords: ['OSINT', 'phone lookup', 'carrier lookup', 'phone validation', 'breach signals', 'spam score', 'threat intelligence', 'numdox'],
  authors: [{ name: 'NUMDOX' }],
  creator: 'NUMDOX',
  publisher: 'numdox',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://numdox.dev',
    title: 'numdox — Phone intelligence, without the noise',
    description: 'A sharp, privacy-first phone intelligence workspace for turning one number into a map of public signals.',
    siteName: 'numdox',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'numdox — Phone intelligence',
    description: 'Privacy-first phone intelligence workspace',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e14' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased transition-colors duration-200`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}