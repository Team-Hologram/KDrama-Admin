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

function periodRange(period: CFPeriod) {
  const now = new Date()
  const since = new Date(now)
  if (period === '24h') {
    since.setHours(since.getHours() - 24)
    // Hourly dataset needs full ISO datetime strings
    return { since: since.toISOString(), until: now.toISOString(), useHourly: true }
  }
  if (period === '7d') { since.setDate(since.getDate() - 7) }
  else                 { since.setDate(since.getDate() - 30) }
  // Daily dataset uses date-only strings (YYYY-MM-DD)
  return { since: since.toISOString().split('T')[0], until: now.toISOString().split('T')[0], useHourly: false }
}

async function cfFetch(token: string, query: string, variables: Record<string,string>) {
  const res = await fetch(CF_GRAPHQL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) { console.error('[CF] HTTP', res.status); return null }
  const json = await res.json()
  if (json.errors?.length) { console.error('[CF] GraphQL errors:', JSON.stringify(json.errors)); return null }
  return json
}

// ── Main analytics query (NO country dimension — keeps free plan compatible) ──
const DAILY_QUERY = `
  query($zoneId: String!, $since: String!, $until: String!) {
    viewer { zones(filter: { zoneTag: $zoneId }) {
      httpRequests1dGroups(limit: 35 filter: { date_geq: $since, date_leq: $until } orderBy: [date_ASC]) {
        dimensions { date }
        sum { requests bytes cachedRequests cachedBytes threats pageViews responseStatusMap { edgeResponseStatus requests } }
        uniq { uniques }
      }
    }}
  }
`

const HOURLY_QUERY = `
  query($zoneId: String!, $since: Time!, $until: Time!) {
    viewer { zones(filter: { zoneTag: $zoneId }) {
      httpRequests1hGroups(limit: 25 filter: { datetimeHour_geq: $since, datetimeHour_leq: $until } orderBy: [datetimeHour_ASC]) {
        dimensions { datetimeHour }
        sum { requests bytes cachedRequests cachedBytes threats pageViews responseStatusMap { edgeResponseStatus requests } }
        uniq { uniques }
      }
    }}
  }
`

// ── Separate country query (optional — if this fails, we still show main data) ──
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

export async function GET(request: NextRequest) {
  const period = (request.nextUrl.searchParams.get('period') ?? '7d') as CFPeriod
  const cacheKey = `cf-analytics-${period}`

  const cached = cacheGet<CFStats>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const token  = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID

  if (!token || !zoneId || token.startsWith('your_')) {
    console.warn('[CF] Missing credentials')
    return NextResponse.json(empty(period))
  }

  try {
    const { since, until, useHourly } = periodRange(period)
    const vars = { zoneId, since, until }

    // ── Main analytics (critical — must succeed) ───────────────────────────
    const mainJson = await cfFetch(token, useHourly ? HOURLY_QUERY : DAILY_QUERY, vars)
    if (!mainJson) return NextResponse.json(empty(period))

    const zone = mainJson.data?.viewer?.zones?.[0]
    const rawGroups: any[] = useHourly
      ? (zone?.httpRequests1hGroups ?? [])
      : (zone?.httpRequests1dGroups ?? [])

    if (!rawGroups.length) {
      const s = { ...empty(period), available: true }
      cacheSet(cacheKey, s)
      return NextResponse.json(s)
    }

    const series: CFPeriodPoint[] = rawGroups.map((g: any) => {
      const sm = g.sum?.responseStatusMap ?? []
      return {
        date:           useHourly ? g.dimensions.datetimeHour : g.dimensions.date,
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

    // ── Country query (optional — failure does NOT block main data) ─────────
    let countries: CFCountry[] = []
    if (!useHourly) {
      try {
        const cJson = await cfFetch(token, COUNTRY_QUERY, vars)
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
    console.error('[CF] Error:', error)
    return NextResponse.json(empty(period))
  }
}
