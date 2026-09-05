// ============================================
// GitHub Public OSINT Collector
// Searches public GitHub code, commits, and user profiles
// ============================================

import { Collector, CollectorStatus, EvidenceItem, NormalizedPhoneVariants } from '../types'

export class GitHubCollector implements Collector {
  name = 'GitHub Public OSINT'
  type = 'github' as const

  private token = process.env.GITHUB_TOKEN

  async collect(
    phone: NormalizedPhoneVariants,
    onProgress?: (status: CollectorStatus) => void
  ): Promise<EvidenceItem[]> {
    const evidenceItems: EvidenceItem[] = []
    const seenUsers = new Set<string>()

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'scanning',
      resultsCount: 0,
      message: 'Searching public GitHub repositories, code, and developer profiles...',
    })

    const queries = [
      `"${phone.e164}"`,
      `"${phone.national}"`,
    ]

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NUMDOX-Intelligence-Engine/1.0',
    }
    if (this.token) {
      headers.Authorization = `token ${this.token}`
    }

    // 1. Query GitHub Search API for code & commits
    for (const q of queries) {
      try {
        const codeUrl = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=5`
        const res = await fetch(codeUrl, {
          headers,
          signal: AbortSignal.timeout(4000),
        })

        if (res.ok) {
          const data = await res.json()
          const items = data.items || []

          for (const item of items) {
            const repoOwner = item.repository?.owner?.login
            const repoName = item.repository?.full_name || 'Public Repository'
            const htmlUrl = item.html_url || `https://github.com/${repoName}`

            if (repoOwner && !seenUsers.has(repoOwner.toLowerCase())) {
              seenUsers.add(repoOwner.toLowerCase())

              // Fetch detailed user profile
              const userDetails = await this.fetchUserDetails(repoOwner, headers)
              const displayName = userDetails?.name || repoOwner

              evidenceItems.push({
                id: `gh-code-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'person',
                value: displayName,
                source: `GitHub (@${repoOwner})`,
                sourceType: 'github',
                sourceUrl: htmlUrl,
                matchedPhone: q.replace(/"/g, ''),
                evidence: `Phone matched in repository: ${repoName} (${item.path || 'code'}). Author bio: ${userDetails?.bio || 'Developer profile'}`,
                matchType: 'profile',
                confidence: userDetails?.name ? 0.85 : 0.65,
                confidenceLevel: userDetails?.name ? 'high' : 'medium',
                timestamp: new Date().toISOString(),
                metadata: {
                  username: repoOwner,
                  email: userDetails?.email,
                  company: userDetails?.company,
                  location: userDetails?.location,
                },
              })

              if (userDetails?.email) {
                evidenceItems.push({
                  id: `gh-email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  type: 'email',
                  value: userDetails.email,
                  source: `GitHub (@${repoOwner})`,
                  sourceType: 'github',
                  sourceUrl: `https://github.com/${repoOwner}`,
                  matchedPhone: q.replace(/"/g, ''),
                  evidence: `Verified public email for GitHub user: @${repoOwner}`,
                  matchType: 'profile',
                  confidence: 0.9,
                  confidenceLevel: 'high',
                  timestamp: new Date().toISOString(),
                })
              }
            }
          }
        }
      } catch {
        // API rate-limit or error, continue
      }
    }

    // 2. Query GitHub Public User Search API
    for (const q of queries) {
      try {
        const userUrl = `https://api.github.com/search/users?q=${encodeURIComponent(q)}&per_page=5`
        const res = await fetch(userUrl, {
          headers,
          signal: AbortSignal.timeout(4000),
        })

        if (res.ok) {
          const data = await res.json()
          const items = data.items || []

          for (const item of items) {
            const login = item.login
            if (login && !seenUsers.has(login.toLowerCase())) {
              seenUsers.add(login.toLowerCase())
              const userDetails = await this.fetchUserDetails(login, headers)
              const candidate = userDetails?.name || login

              evidenceItems.push({
                id: `gh-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'person',
                value: candidate,
                source: `GitHub (@${login})`,
                sourceType: 'github',
                sourceUrl: item.html_url || `https://github.com/${login}`,
                matchedPhone: q.replace(/"/g, ''),
                evidence: `Phone associated with GitHub user profile @${login}. Bio: ${userDetails?.bio || 'Public developer'}`,
                matchType: 'profile',
                confidence: userDetails?.name ? 0.85 : 0.65,
                confidenceLevel: userDetails?.name ? 'high' : 'medium',
                timestamp: new Date().toISOString(),
              })
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // 3. Fallback: Search GitHub via public search dork if API returned 0 (or was rate limited)
    if (evidenceItems.length === 0) {
      try {
        const ghQuery = `site:github.com "${phone.e164}" OR site:github.com "${phone.national}"`
        const res = await fetch('https://html.duckduckgo.com/html/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          body: `q=${encodeURIComponent(ghQuery)}`,
          signal: AbortSignal.timeout(4000),
        })

        if (res.ok) {
          const html = await res.text()
          const snippetMatches = Array.from(html.matchAll(/<a[^>]+class="result__snippet[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g))
          const titleMatches = Array.from(html.matchAll(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g))

          const results = [...snippetMatches, ...titleMatches]
          for (const m of results.slice(0, 3)) {
            let targetUrl = m[1]
            if (targetUrl.includes('uddg=')) {
              const uddg = targetUrl.match(/uddg=([^&]+)/)
              if (uddg) targetUrl = decodeURIComponent(uddg[1])
            }
            if (!targetUrl.includes('github.com')) continue

            const text = m[2].replace(/<[^>]+>/g, '').trim()
            // Extract user from URL if e.g. github.com/username
            const urlPath = new URL(targetUrl).pathname.split('/').filter(Boolean)
            const possibleUser = urlPath[0]

            if (possibleUser && !['features', 'topics', 'marketplace', 'explore'].includes(possibleUser)) {
              evidenceItems.push({
                id: `gh-dork-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: 'person',
                value: `@${possibleUser}`,
                source: `GitHub (@${possibleUser})`,
                sourceType: 'github',
                sourceUrl: targetUrl,
                matchedPhone: phone.national,
                evidence: text.slice(0, 140),
                matchType: 'proximity',
                confidence: 0.65,
                confidenceLevel: 'medium',
                timestamp: new Date().toISOString(),
              })
            }
          }
        }
      } catch {
        // Fallback completed
      }
    }

    onProgress?.({
      name: this.name,
      type: this.type,
      status: 'completed',
      resultsCount: evidenceItems.length,
      message: `Completed GitHub scan. Extracted ${evidenceItems.length} evidence findings.`,
    })

    return evidenceItems
  }

  private async fetchUserDetails(
    username: string,
    headers: Record<string, string>
  ): Promise<{ name?: string; bio?: string; company?: string; location?: string; email?: string } | null> {
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
        headers,
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Return null on failure
    }
    return null
  }
}
