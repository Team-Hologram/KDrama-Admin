import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet } from '@/lib/cache'

const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'

export type CFPeriod = '24h' | '7d' | '30d'

export interface CFPeriodPoint {
  date: string
  requests: number
  bytes: number
  cachedRequests: number
  threats: number
  errors4xx: number
  errors5xx: number
  pageViews: number
  uniques: number
}

export interface CFCountry { country: string; requests: number }

export interface CFStats {
  totals: {
    requests: number; bytes: number; cachedRequests: number; threats: number
    cacheHitRate: number; uncachedRequests: number; errors4xx: number
    errors5xx: number; pageViews: number; uniqueVisitors: number
  }
  series: CFPeriodPoint[]
  countries: CFCountry[]
  period: CFPeriod
  available: boolean
}

function empty(period: CFPeriod): CFStats {
  return {
    totals: { requests:0, bytes:0, cachedRequests:0, threats:0, cacheHitRate:0, uncachedRequests:0, errors4xx:0, errors5xx:0, pageViews:0, uniqueVisitors:0 },
    series: [], countries: [], period, available: false,
  }
}

function count4xx(sm: any[]): number {
  if (!Array.isArray(sm)) return 0
  return sm.filter((s:any)=>s.edgeResponseStatus>=400&&s.edgeResponseStatus<500).reduce((a:number,s:any)=>a+(s.requests??0),0)
}
function count5xx(sm: any[]): number {
  if (!Array.isArray(sm)) return 0
  return sm.filter((s:any)=>s.edgeResponseStatus>=500).reduce((a:number,s:any)=>a+(s.requests??0),0)
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Daily query — all fields available on free plan
const DAILY_QUERY = `
  query($zoneId: String!, $since: String!, $until: String!) {
    viewer { zones(filter: { zoneTag: $zoneId }) {
      httpRequests1dGroups(limit: 35 filter: { date_geq: $since, date_leq: $until } orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests bytes cachedRequests threats pageViews responseStatusMap { edgeResponseStatus requests } }
        uniq { uniques }
      }
    }}
  }
`

// Hourly query — stripped to only fields reliably available on free plan
// (responseStatusMap and uniq.uniques are NOT available in hourly dataset on free plan)
const HOURLY_QUERY = `
  query($zoneId: String!, $since: String!, $until: String!) {
    viewer { zones(filter: { zoneTag: $zoneId }) {
      httpRequests1hGroups(limit: 25 filter: { datetimeHour_geq: $since, datetimeHour_leq: $until } orderBy: [datetimeHour_ASC]) {
        dimensions { datetimeHour }
        sum { requests bytes cachedRequests threats pageViews }
      }
    }}
  }
`

// Country query — separate optional request
const COUNTRY_QUERY = `
  query($zoneId: String!, $since: String!, $until: String!) {
    viewer { zones(filter: { zoneTag: $zoneId }) {
      httpRequests1dGroups(limit: 35 filter: { date_geq: $since, date_leq: $until } orderBy: [date_ASC]) {
        dimensions { date clientCountryName }
        sum { requests }
      }
    }}
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cfFetch(token: string, query: string, variables: Record<string,string>) {
  const res = await fetch(CF_GRAPHQL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) {
    console.error('[CF] HTTP', res.status, await res.text())
    return null
  }
  const json = await res.json()
  if (json.errors?.length) {
    console.error('[CF] GraphQL errors:', JSON.stringify(json.errors))
    console.error('[CF] Variables:', JSON.stringify(variables))
    return null
  }
  return json
}

function dailyRange(days: number) {
  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - days)
  return {
    since: since.toISOString().split('T')[0],
    until: now.toISOString().split('T')[0],
  }
}

function hourlyRange() {
  const now = new Date()
  const since = new Date(now)
  since.setHours(since.getHours() - 24)
  // Cloudflare expects ISO datetime strings for hourly filter
  return {
    since: since.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    until: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const period = (request.nextUrl.searchParams.get('period') ?? '7d') as CFPeriod
  const cacheKey = `cf-v2-${period}`

  const cached = cacheGet<CFStats>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const token  = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID

  if (!token || !zoneId || token.startsWith('your_')) {
    return NextResponse.json(empty(period))
  }

  try {
    let rawGroups: any[] = []
    let useHourly = false

    if (period === '24h') {
      // ── Try hourly first ─────────────────────────────────────────────────
      const { since, until } = hourlyRange()
      const hJson = await cfFetch(token, HOURLY_QUERY, { zoneId, since, until })

      if (hJson) {
        const hGroups: any[] = hJson.data?.viewer?.zones?.[0]?.httpRequests1hGroups ?? []
        if (hGroups.length > 0) {
          rawGroups = hGroups
          useHourly = true
          console.log(`[CF] 24h: hourly OK — ${hGroups.length} points`)
        } else {
          console.warn('[CF] 24h: hourly returned 0 points, falling back to daily')
        }
      } else {
        console.warn('[CF] 24h: hourly query failed, falling back to daily')
      }

      // ── Fallback: use daily data for last 2 days ─────────────────────────
      if (!useHourly) {
        const { since: ds, until: du } = dailyRange(2)
        const dJson = await cfFetch(token, DAILY_QUERY, { zoneId, since: ds, until: du })
        if (dJson) {
          rawGroups = dJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []
          console.log(`[CF] 24h fallback: daily returned ${rawGroups.length} points`)
        }
      }
    } else {
      // ── 7d / 30d — always daily ──────────────────────────────────────────
      const days = period === '7d' ? 7 : 30
      const { since, until } = dailyRange(days)
      const dJson = await cfFetch(token, DAILY_QUERY, { zoneId, since, until })
      if (!dJson) return NextResponse.json(empty(period))
      rawGroups = dJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []
    }

    if (!rawGroups.length) {
      const s = { ...empty(period), available: true }
      cacheSet(cacheKey, s)
      return NextResponse.json(s)
    }

    // ── Parse series ───────────────────────────────────────────────────────
    const series: CFPeriodPoint[] = rawGroups.map((g: any) => {
      const sm = g.sum?.responseStatusMap ?? []
      const date = useHourly
        ? (g.dimensions?.datetimeHour ?? g.dimensions?.date ?? '')
        : (g.dimensions?.date ?? '')
      return {
        date,
        requests:       g.sum?.requests       ?? 0,
        bytes:          g.sum?.bytes          ?? 0,
        cachedRequests: g.sum?.cachedRequests ?? 0,
        threats:        g.sum?.threats        ?? 0,
        errors4xx:      count4xx(sm),
        errors5xx:      count5xx(sm),
        pageViews:      g.sum?.pageViews      ?? 0,
        uniques:        g.uniq?.uniques       ?? 0,
      }
    })

    // ── Aggregate totals ───────────────────────────────────────────────────
    const t = series.reduce((a,d)=>({
      requests:       a.requests       + d.requests,
      bytes:          a.bytes          + d.bytes,
      cachedRequests: a.cachedRequests + d.cachedRequests,
      threats:        a.threats        + d.threats,
      errors4xx:      a.errors4xx      + d.errors4xx,
      errors5xx:      a.errors5xx      + d.errors5xx,
      pageViews:      a.pageViews      + d.pageViews,
      uniqueVisitors: a.uniqueVisitors + d.uniques,
    }), { requests:0, bytes:0, cachedRequests:0, threats:0, errors4xx:0, errors5xx:0, pageViews:0, uniqueVisitors:0 })

    const cacheHitRate = t.requests > 0 ? Math.round((t.cachedRequests/t.requests)*100) : 0

    // ── Country query (optional, daily only) ──────────────────────────────
    let countries: CFCountry[] = []
    if (!useHourly && period !== '24h') {
      try {
        const days = period === '7d' ? 7 : 30
        const { since, until } = dailyRange(days)
        const cJson = await cfFetch(token, COUNTRY_QUERY, { zoneId, since, until })
        if (cJson) {
          const cGroups: any[] = cJson.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []
          const map: Record<string,number> = {}
          cGroups.forEach((g:any) => {
            const name = g.dimensions?.clientCountryName
            if (name) map[name] = (map[name]??0) + (g.sum?.requests??0)
          })
          countries = Object.entries(map)
            .map(([country,requests])=>({country,requests}))
            .sort((a,b)=>b.requests-a.requests)
            .slice(0,10)
        }
      } catch (e) {
        console.warn('[CF] Country query failed (non-critical):', e)
      }
    }

    const stats: CFStats = {
      totals: { ...t, cacheHitRate, uncachedRequests: t.requests - t.cachedRequests },
      series, countries, period, available: true,
    }

    cacheSet(cacheKey, stats)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('[CF] Unexpected error:', error)
    return NextResponse.json(empty(period))
  }
}
