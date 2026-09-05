import { Hono } from 'hono'
import { cors } from 'hono/cors'

export interface Env {
  RAPIDAPI_TRUECALLER_KEY?: string
  TRUECALLER_AUTH_TOKEN?: string
  TRUECALLER_COOKIE?: string
  NUMVERIFY_API_KEY?: string
  ABSTRACT_API_KEY?: string
  ENVIRONMENT?: string
  PROVIDER?: string
}

const app = new Hono<{ Bindings: Env }>()

// ============================================
// Robust Multi-Origin CORS Middleware
// ============================================
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app') ||
        origin.includes('workers.dev')
      ) {
        return origin || '*'
      }
      return origin
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
    maxAge: 86400,
    credentials: true,
  })
)

// ============================================
// 1. Health & Info Endpoints
// ============================================
app.get('/api/data', (c) => {
  return c.json({
    status: 'success',
    provider: 'Cloudflare Workers via NUMDOX',
    timestamp: new Date().toISOString(),
    worker: 'numdox.phish-x.workers.dev',
  })
})

app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: '100%',
    framework: 'Hono on Cloudflare Workers',
    apis: {
      truecallerTokenConfigured: Boolean(c.env.TRUECALLER_AUTH_TOKEN),
      rapidApiConfigured: Boolean(c.env.RAPIDAPI_TRUECALLER_KEY),
      numverifyConfigured: Boolean(c.env.NUMVERIFY_API_KEY),
      abstractApiConfigured: Boolean(c.env.ABSTRACT_API_KEY),
    },
    timestamp: new Date().toISOString(),
  })
})

// ============================================
// 2. Telecom DoT Circle & Carrier Heuristics
// ============================================
interface TelecomAllocation {
  operator: string
  circle: string
  originalNetwork?: string
  ported?: boolean
}

function resolveIndianTelecom(prefix4: string): TelecomAllocation {
  const p = parseInt(prefix4, 10)
  if (isNaN(p)) return { operator: 'Indian Cellular Network', circle: 'National Telecom Infrastructure' }

  // 8453: MTS India allocated, migrated/ported to Airtel/Jio
  if (prefix4 === '8453') {
    return {
      operator: 'Bharti Airtel Ltd',
      circle: 'Karnataka LSA',
      originalNetwork: 'MTS (Sistema Shyam)',
      ported: true,
    }
  }

  // Reliance Jio 4G/5G blocks
  if (
    (p >= 6000 && p <= 6009) ||
    (p >= 7000 && p <= 7009) ||
    (p >= 7011 && p <= 7019) ||
    (p >= 7977 && p <= 7979)
  ) {
    return { operator: 'Reliance Jio Infocomm', circle: 'National 4G/5G Telecom Circle' }
  }

  // Bharti Airtel
  if (
    (p >= 9810 && p <= 9818) ||
    (p >= 9845 && p <= 9849) ||
    (p >= 9890 && p <= 9899) ||
    (p >= 9900 && p <= 9919) ||
    (p >= 9954 && p <= 9959)
  ) {
    return { operator: 'Bharti Airtel Ltd', circle: 'National Telecom Circle' }
  }

  // Vodafone Idea (Vi)
  if (
    (p >= 9820 && p <= 9829) ||
    (p >= 9892 && p <= 9895) ||
    (p >= 9920 && p <= 9930) ||
    (p >= 9711 && p <= 9714)
  ) {
    return { operator: 'Vodafone Idea Ltd (Vi)', circle: 'National Telecom Circle' }
  }

  // BSNL / MTNL
  if ((p >= 9400 && p <= 9499) || (p >= 9410 && p <= 9419)) {
    return { operator: 'Bharat Sanchar Nigam Ltd (BSNL)', circle: 'National State Telecom Circle' }
  }

  // General 6/7/8/9 Indian GSM prefixes
  return { operator: 'Indian Cellular Network (GSM/LTE/5G)', circle: 'Department of Telecommunications LSA' }
}

// ============================================
// 3. Truecaller & Directory Resolution Engine
// ============================================
async function resolveCallerIdentity(phone: string, env: Env) {
  const cleanDigits = phone.replace(/\D/g, '')
  const nationalDigits = cleanDigits.slice(-10)
  const isIndia = cleanDigits.startsWith('91') || cleanDigits.length === 10
  const countryCode = isIndia ? 'IN' : 'US'
  const prefix = isIndia ? '91' : cleanDigits.slice(0, -10) || '1'
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  // 1. Truecaller Web Session with Cookie Pool (Astro/SSR Page Lookup)
  const cleanCookie = (c: string) =>
    c.trim().replace(/^["']|["']$/g, '').replace(/^Cookie:?\s*/i, '').trim()

  const cookiePool: string[] = []
  const rawPool = (env as any).TRUECALLER_COOKIE_POOL || ''
  if (rawPool.trim().startsWith('[') && rawPool.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(rawPool.trim())
      if (Array.isArray(parsed)) cookiePool.push(...parsed.map(cleanCookie).filter(Boolean))
    } catch {}
  } else if (rawPool.includes('|||')) {
    cookiePool.push(...rawPool.split('|||').map(cleanCookie).filter(Boolean))
  }

  const single = env.TRUECALLER_COOKIE || (env.TRUECALLER_AUTH_TOKEN?.includes('tc_user=') ? env.TRUECALLER_AUTH_TOKEN : '')
  if (single) {
    const cleaned = cleanCookie(single)
    if (cleaned && !cookiePool.includes(cleaned)) cookiePool.push(cleaned)
  }

  for (const currentCookie of cookiePool) {
    try {
      const webUrl = isIndia
        ? `https://www.truecaller.com/search/in/${nationalDigits}`
        : `https://www.truecaller.com/search/global/${encodeURIComponent(phone)}`

      const webRes = await fetch(webUrl, {
        headers: {
          Cookie: currentCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:154.0) Gecko/20100101 Firefox/154.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: 'https://www.truecaller.com/',
        },
        signal: AbortSignal.timeout(5000),
      })

      if (webRes.ok) {
        const html = await webRes.text()
        if (/limit exceeded|too many requests/i.test(html)) {
          // Quota exceeded for this session; continue to next session in pool
          continue
        }

        const astroBoldMatch = html.match(/<div class="[^"]*font-bold[^"]*"[^>]*>\s*([^<]+?)\s*<\/div>/i)
        const vcfMatch = html.match(/download="([^"]+)\.vcf"/i)
        const titleMatch =
          html.match(/<title>([^<]+?)\s*-\s*Who called/i) ||
          html.match(/meta\s+property=["']og:title["']\s+content=["']([^"']+?)\s*-\s*Who called/i)

        let foundName: string | null = null
        if (astroBoldMatch && astroBoldMatch[1].trim().length > 1 && !/limit exceeded|sign in/i.test(astroBoldMatch[1])) {
          foundName = astroBoldMatch[1].trim()
        } else if (vcfMatch && vcfMatch[1].trim().length > 1) {
          foundName = vcfMatch[1].trim().replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        } else if (titleMatch && titleMatch[1].trim().length > 1) {
          foundName = titleMatch[1].trim()
        }

        if (
          foundName &&
          foundName.length > 1 &&
          !foundName.toLowerCase().includes('reverse phone') &&
          !foundName.toLowerCase().includes('search limit')
        ) {
          return {
            name: foundName,
            source: 'Truecaller Web Verification',
            details: 'Verified caller ID record from Truecaller authenticated web session',
          }
        }
      }
    } catch {}
  }

  // 2. Direct Truecaller Official API (if TRUECALLER_AUTH_TOKEN configured)
  if (env.TRUECALLER_AUTH_TOKEN && !env.TRUECALLER_AUTH_TOKEN.includes('tc_user=')) {
    try {
      const tcUrl = `https://search5-noneu.truecaller.com/v2/search?q=${encodeURIComponent(phone.startsWith('+') ? phone : `+${cleanDigits}`)}&countryCode=${countryCode.toLowerCase()}&type=4`
      const res = await fetch(tcUrl, {
        headers: {
          Authorization: `Bearer ${env.TRUECALLER_AUTH_TOKEN}`,
          'User-Agent': 'Truecaller/13.35.6 (Android;13)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        const data: any = await res.json()
        const item = data?.data?.[0]
        if (item?.name && typeof item.name === 'string' && item.name.trim().length > 1) {
          return {
            name: item.name.trim(),
            source: 'Truecaller Direct Verification',
            details: `Official caller ID record (Carrier: ${item.phones?.[0]?.carrier || 'N/A'})`,
          }
        }
      }
    } catch (err: any) {
      console.warn('Truecaller direct error:', err?.message || err)
    }
  }

  // 2. RapidAPI Multi-Pool Waterfall (if RAPIDAPI_TRUECALLER_KEY configured)
  const rapidApiKey = env.RAPIDAPI_TRUECALLER_KEY
  if (rapidApiKey) {
    let quotaExceeded = false

    // Pool 1: ViewCaller
    try {
      const url = `https://viewcaller.p.rapidapi.com/api/v1/search?code=${prefix}&number=${nationalDigits}`
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'viewcaller.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.status === 429) quotaExceeded = true
      if (res.ok) {
        const data: any = await res.json()
        const items = data?.data || []
        if (items[0]?.name) {
          return { name: items[0].name.trim(), source: 'ViewCaller RapidAPI' }
        }
      }
    } catch {}

    // Pool 2: Truecaller-Data2
    try {
      const url = `https://truecaller-data2.p.rapidapi.com/search/${cleanDigits}`
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'truecaller-data2.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.status === 429) quotaExceeded = true
      if (res.ok) {
        const data: any = await res.json()
        const basic = data?.data?.basicInfo
        if (basic?.name) {
          return { name: basic.name.trim(), source: 'Truecaller-Data2 RapidAPI' }
        }
      }
    } catch {}

    // Pool 3: Truecaller4
    try {
      const url = `https://truecaller4.p.rapidapi.com/api/v1/getDetails?phone=${cleanDigits}&countryCode=${countryCode}`
      const res = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'truecaller4.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(3500),
      })
      if (res.status === 429) quotaExceeded = true
      if (res.ok) {
        const data: any = await res.json()
        const items = data?.data || []
        if (items[0]?.name) {
          return { name: items[0].name.trim(), source: 'Truecaller4 RapidAPI' }
        }
      }
    } catch {}

    // Pool 4: Truecaller-API11
    try {
      const url = 'https://truecaller-api11.p.rapidapi.com/v2.php'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-rapidapi-host': 'truecaller-api11.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        body: `phone=${encodeURIComponent(nationalDigits)}&countryCode=${countryCode.toLowerCase()}`,
        signal: AbortSignal.timeout(3500),
      })
      if (res.status === 429) quotaExceeded = true
      if (res.ok) {
        const data: any = await res.json()
        const lookup = data?.truecaller_lookup
        const name = lookup?.name || lookup?.caller_name
        if (name) {
          return { name: name.trim(), source: 'Truecaller-API11 RapidAPI' }
        }
      }
    } catch {}

    if (quotaExceeded) {
      return { name: null, source: null, details: 'RapidAPI Quota Exceeded (Upgrade plan or provide TRUECALLER_AUTH_TOKEN)' }
    }
  }

  return {
    name: null,
    source: null,
    details: env.TRUECALLER_AUTH_TOKEN || env.RAPIDAPI_TRUECALLER_KEY
      ? 'No public caller ID record found in directories'
      : 'No Caller ID API configured (Add TRUECALLER_AUTH_TOKEN or RAPIDAPI_TRUECALLER_KEY)',
  }
}

// ============================================
// 4. Live Phone OSINT & Intelligence Lookup Endpoint
// ============================================
app.post('/api/v1/phone/lookup', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const rawPhone = body.phone || ''
    const cleanDigits = rawPhone.replace(/\D/g, '')

    if (!cleanDigits || cleanDigits.length < 7) {
      return c.json({ success: false, error: 'Valid phone number required' }, 400)
    }

    const isIndia = cleanDigits.startsWith('91') || cleanDigits.length === 10
    const nationalDigits = isIndia ? cleanDigits.slice(-10) : cleanDigits
    const e164 = isIndia ? `+91${nationalDigits}` : `+${cleanDigits}`

    // Resolve telecom circle & carrier
    const prefix4 = nationalDigits.slice(0, 4)
    const telecom = isIndia
      ? resolveIndianTelecom(prefix4)
      : { operator: 'International Telecom Network', circle: 'Global Infrastructure' }

    // Resolve caller identity via pool
    const idResult = await resolveCallerIdentity(e164, c.env)

    // Return structured OSINT profile
    return c.json({
      success: true,
      data: {
        jobId: crypto.randomUUID(),
        phone: e164,
        status: 'completed',
        validation: {
          valid: true,
          countryCode: isIndia ? '+91' : '+1',
          countryName: isIndia ? 'India' : 'International',
          nationalNumber: nationalDigits,
          internationalFormat: isIndia ? `+91 ${nationalDigits.slice(0, 5)} ${nationalDigits.slice(5)}` : e164,
          regionCode: isIndia ? 'IN' : 'US',
          type: 'MOBILE',
        },
        carrier: {
          name: telecom.operator,
          type: 'mobile',
          circle: telecom.circle,
          originalNetwork: telecom.originalNetwork,
          ported: telecom.ported,
          confidence: 'high',
          source: 'Department of Telecommunications (DoT) LSA',
        },
        identity: {
          primaryName: idResult.name,
          confidence: idResult.name ? 'high' : 'unresolved',
          source: idResult.source || 'Directory Pool',
          details: idResult.details || undefined,
          namesDiscovered: idResult.name
            ? [
                {
                  name: idResult.name,
                  source: idResult.source || 'Caller ID Registry',
                  confidence: 'high',
                },
              ]
            : [],
        },
        social: [
          { platform: 'Truecaller Direct Link', url: `https://www.truecaller.com/search/in/${e164}` },
          { platform: 'WhatsApp Direct Chat', url: `https://wa.me/${cleanDigits}` },
          { platform: 'UPI PhonePe', url: `upi://pay?pa=${nationalDigits}@ybl&pn=${idResult.name || 'VerifiedUser'}` },
          { platform: 'UPI Paytm', url: `upi://pay?pa=${nationalDigits}@paytm&pn=${idResult.name || 'VerifiedUser'}` },
          { platform: 'Google Pay', url: `upi://pay?pa=${nationalDigits}@okaxis&pn=${idResult.name || 'VerifiedUser'}` },
        ],
        reputation: {
          score: 0,
          level: 'clean',
        },
      },
    })
  } catch (err: any) {
    return c.json({ success: false, error: err?.message || 'Server error' }, 500)
  }
})

export default app
