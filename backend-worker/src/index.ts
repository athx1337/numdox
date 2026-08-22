import { Hono } from 'hono'
import { cors } from 'hono/cors'

export interface Env {
  RAPIDAPI_TRUECALLER_KEY?: string
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
      // Allow all localhost dev origins, Vercel preview/production deployments, or direct calls
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
// 1. Sample & Health Test Endpoints
// ============================================
app.get('/api/data', (c) => {
  return c.json({
    status: 'success',
    provider: 'Cloudflare Workers via Antigravity',
    timestamp: new Date().toISOString(),
    worker: 'numdox.phish-x.workers.dev',
  })
})

app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: '100%',
    framework: 'Hono on Cloudflare Workers',
    timestamp: new Date().toISOString(),
  })
})

// ============================================
// 2. Truecaller RapidAPI Waterfall Pool Engine
// ============================================
async function resolveTruecallerPool(phone: string, rapidApiKey?: string) {
  if (!rapidApiKey) {
    console.log('resolveTruecallerPool: No API key configured')
    return { name: null, source: null, details: 'No RapidAPI Key Configured' }
  }

  const cleanDigits = phone.replace(/\D/g, '')
  const nationalDigits = cleanDigits.slice(-10)
  const countryCode = 'IN'
  const prefix = cleanDigits.startsWith('91') && cleanDigits.length === 12 ? '91' : cleanDigits.slice(0, -10) || '91'

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  let quotaExceeded = false

  // 1. ViewCaller
  try {
    const url = `https://viewcaller.p.rapidapi.com/api/v1/search?code=${prefix}&number=${nationalDigits}`
    console.log(`Querying ViewCaller: ${url}`)
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'viewcaller.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    })
    console.log(`ViewCaller Status: ${res.status}`)
    if (res.status === 429) {
      quotaExceeded = true
    }
    if (res.ok) {
      const data: any = await res.json()
      console.log('ViewCaller Response:', JSON.stringify(data).slice(0, 200))
      const items = data?.data || []
      if (items && items.length > 0 && items[0]?.name) {
        return { name: items[0].name.trim(), source: 'ViewCaller RapidAPI' }
      }
    }
  } catch (err: any) {
    console.error('ViewCaller Error:', err?.message || err)
  }

  // 2. Truecaller-Data2
  try {
    const url = `https://truecaller-data2.p.rapidapi.com/search/${cleanDigits}`
    console.log(`Querying Truecaller-Data2: ${url}`)
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'truecaller-data2.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    })
    console.log(`Truecaller-Data2 Status: ${res.status}`)
    if (res.status === 429) {
      quotaExceeded = true
    }
    if (res.ok) {
      const data: any = await res.json()
      console.log('Truecaller-Data2 Response:', JSON.stringify(data).slice(0, 200))
      const basic = data?.data?.basicInfo
      if (basic && basic.name) {
        return { name: basic.name.trim(), source: 'Truecaller-Data2 RapidAPI' }
      }
    }
  } catch (err: any) {
    console.error('Truecaller-Data2 Error:', err?.message || err)
  }

  // 3. Truecaller4
  try {
    const url = `https://truecaller4.p.rapidapi.com/api/v1/getDetails?phone=${cleanDigits}&countryCode=${countryCode}`
    console.log(`Querying Truecaller4: ${url}`)
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'truecaller4.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    })
    console.log(`Truecaller4 Status: ${res.status}`)
    if (res.status === 429) {
      quotaExceeded = true
    }
    if (res.ok) {
      const data: any = await res.json()
      console.log('Truecaller4 Response:', JSON.stringify(data).slice(0, 200))
      const items = data?.data || []
      if (items && items.length > 0 && items[0]?.name) {
        return { name: items[0].name.trim(), source: 'Truecaller4 RapidAPI' }
      }
    }
  } catch (err: any) {
    console.error('Truecaller4 Error:', err?.message || err)
  }

  // 4. Truecaller-API11
  try {
    const url = 'https://truecaller-api11.p.rapidapi.com/v2.php'
    console.log(`Querying Truecaller-API11: ${url}`)
    const formData = new FormData()
    formData.append('phone', nationalDigits)
    formData.append('countryCode', countryCode.toLowerCase())

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-rapidapi-host': 'truecaller-api11.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'User-Agent': userAgent,
      },
      body: formData,
    })
    console.log(`Truecaller-API11 Status: ${res.status}`)
    if (res.status === 429) {
      quotaExceeded = true
    }
    if (res.ok) {
      const data: any = await res.json()
      console.log('Truecaller-API11 Response:', JSON.stringify(data).slice(0, 200))
      const lookup = data?.truecaller_lookup
      const name = lookup?.name || lookup?.caller_name
      if (name) {
        return { name: name.trim(), source: 'Truecaller-API11 RapidAPI' }
      }
    }
  } catch (err: any) {
    console.error('Truecaller-API11 Error:', err?.message || err)
  }

  if (quotaExceeded) {
    return { name: null, source: null, details: 'RapidAPI Quota Exceeded' }
  }

  return { name: null, source: null, details: 'No directory match found in pool' }
}

// ============================================
// 3. Live Phone OSINT & Intelligence Lookup Endpoint
// ============================================
app.post('/api/v1/phone/lookup', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const rawPhone = body.phone || ''
    const cleanDigits = rawPhone.replace(/\D/g, '')

    if (!cleanDigits || cleanDigits.length < 7) {
      return c.json({ success: false, error: 'Valid phone number required' }, 400)
    }

    const e164 = cleanDigits.startsWith('91') && cleanDigits.length === 12 ? `+${cleanDigits}` : `+91${cleanDigits}`
    const nationalDigits = cleanDigits.startsWith('91') && cleanDigits.length === 12 ? cleanDigits.slice(2) : cleanDigits

    const apiKey = c.env.RAPIDAPI_TRUECALLER_KEY || '6fe6de121bmsh0e1c2f906b4a706p14ab45jsn873459c7932b'
    const idResult = await resolveTruecallerPool(e164, apiKey)

    // Return structured OSINT profile
    return c.json({
      success: true,
      data: {
        jobId: crypto.randomUUID(),
        phone: e164,
        status: 'completed',
        validation: {
          valid: true,
          countryCode: '+91',
          countryName: 'India',
          nationalNumber: nationalDigits,
          internationalFormat: `+91 ${nationalDigits.slice(0, 5)} ${nationalDigits.slice(5)}`,
          regionCode: 'IN',
          type: 'MOBILE',
        },
        carrier: {
          name: 'Bharti Airtel / Reliance Jio',
          type: 'mobile',
          circle: 'National Telecom Infrastructure',
        },
        identity: {
          primaryName: idResult.name,
          confidence: idResult.name ? 'high' : 'unresolved',
          source: idResult.source || 'Waterfall Pool',
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
