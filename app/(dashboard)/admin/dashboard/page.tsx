'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Film, Tv, TrendingUp, Eye, Users, Globe, Zap, ShieldAlert, ArrowUpRight, AlertTriangle, MapPin, RefreshCw, Clock } from 'lucide-react'
import {
  AnimCount, TrendBadge, StatCard, ChartSection, Tip, Spark,
  calcTrend, countryFlag, fmtBytes, fmtN, fmtDate, greet, today, timeAgo,
} from '@/components/admin/dashboard-widgets'

type Period = '24h' | '7d' | '30d'
interface CFPoint { date: string; requests: number; bytes: number; cachedRequests: number; threats: number; errors4xx: number; errors5xx: number; pageViews: number; uniques: number }
interface CFCountry { country: string; requests: number }
interface CFStats {
  totals: { requests: number; bytes: number; cachedRequests: number; threats: number; cacheHitRate: number; uncachedRequests: number; errors4xx: number; errors5xx: number; pageViews: number; uniqueVisitors: number }
  series: CFPoint[]; countries: CFCountry[]; period: Period; available: boolean
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '24 Hours', value: '24h' },
  { label: '7 Days',   value: '7d'  },
  { label: '30 Days',  value: '30d' },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const [period, setPeriod] = useState<Period>('7d')
  const [media, setMedia] = useState({ movies: 0, dramas: 0, views: 0, trending: 0, users: 0 })
  const [mLoading, setMLoading] = useState(true)
  const [cf, setCf] = useState<CFStats | null>(null)
  const [cfLoad, setCfLoad] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (key: string) => setCollapsed(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })

  // ── Movies + dramas (load once) ──────────────────────────────────────────
  useEffect(() => {
    setMLoading(true)
    Promise.all([
      fetch('/api/movies').then(r => r.json()),
      fetch('/api/dramas').then(r => r.json()),
    ]).then(([mv, dr]) => {
      const views = [...mv, ...dr].reduce((s: number, x: any) => s + (x.views || 0), 0)
      const trending = [...mv, ...dr].filter((x: any) => x.trending).length
      setMedia(p => ({ ...p, movies: mv.length, dramas: dr.length, views, trending }))
    }).catch(console.error).finally(() => setMLoading(false))
  }, [])

  // ── User count — live, polls every 30s ───────────────────────────────────
  const fetchUsers = useCallback(() => {
    fetch('/api/stats/users').then(r => r.json())
      .then((d: any) => setMedia(p => ({ ...p, users: d.count ?? 0 })))
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetchUsers()
    const iv = setInterval(fetchUsers, 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') fetchUsers() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', fetchUsers)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', fetchUsers) }
  }, [fetchUsers])

  // ── Cloudflare analytics ─────────────────────────────────────────────────
  const fetchCF = useCallback((p: Period, force = false) => {
    setCfLoad(true)
    const url = `/api/stats/cloudflare?period=${p}${force ? `&t=${Date.now()}` : ''}`
    fetch(url).then(r => r.json()).then(d => { setCf(d); setLastUpdated(new Date()) })
      .catch(console.error).finally(() => setCfLoad(false))
  }, [])

  useEffect(() => { fetchCF(period) }, [period, fetchCF])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchCF(period, true)
    setTimeout(() => setRefreshing(false), 1200)
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const cfOk = !cfLoad && (cf?.available ?? false)
  const cfNa = !cfLoad && !cfOk
  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? '7 Days'
  const s = cf?.series ?? []

  const chartData = s.map(d => ({
    date: fmtDate(d.date),
    Requests: d.requests,
    Cached: d.cachedRequests,
    'BW (MB)': parseFloat((d.bytes / 1024 / 1024).toFixed(2)),
    Threats: d.threats,
    Errors: d.errors4xx + d.errors5xx,
    Visitors: d.uniques,
  }))

  // Sparkline data per metric
  const spk = {
    requests:  s.map(d => d.requests),
    bytes:     s.map(d => d.bytes),
    cached:    s.map(d => d.cachedRequests),
    visitors:  s.map(d => d.uniques),
    threats:   s.map(d => d.threats),
    errors:    s.map(d => d.errors4xx + d.errors5xx),
  }

  // Trend: first-half vs second-half of series
  const trend = {
    requests: calcTrend(spk.requests),
    bytes:    calcTrend(spk.bytes),
    cached:   calcTrend(spk.cached),
    visitors: calcTrend(spk.visitors),
    threats:  calcTrend(spk.threats),
    errors:   calcTrend(spk.errors),
  }

  const maxCountry = cf?.countries?.[0]?.requests ?? 1
  const totalCountryReq = cf?.countries?.reduce((s, c) => s + c.requests, 0) ?? 1

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900 p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_60%)] pointer-events-none" />
        <div className="relative flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{greet(session?.user?.name)}</h1>
            <p className="text-sm text-indigo-200/70 mt-0.5">{today()}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Last updated */}
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-200/60">
                <Clock className="h-3 w-3" />
                {timeAgo(lastUpdated)}
              </div>
            )}
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={cfLoad}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all duration-150 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {/* Period filter */}
            <div className="flex bg-white/10 rounded-xl overflow-hidden border border-white/10">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 text-xs font-semibold transition-all duration-150 ${period === p.value ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                >{p.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300">Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── App stat cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="App Users"   value={media.users}    icon={<Users className="h-5 w-5"/>}       accent="bg-violet-50"  ic="text-violet-500"  loading={mLoading} sub="Registered devices"/>
        <StatCard title="Movies"      value={media.movies}   icon={<Film className="h-5 w-5"/>}        accent="bg-sky-50"     ic="text-sky-500"     loading={mLoading}/>
        <StatCard title="Dramas"      value={media.dramas}   icon={<Tv className="h-5 w-5"/>}          accent="bg-indigo-50"  ic="text-indigo-500"  loading={mLoading}/>
        <StatCard title="Total Views" value={media.views}    icon={<Eye className="h-5 w-5"/>}         accent="bg-amber-50"   ic="text-amber-500"   loading={mLoading}/>
        <StatCard title="Trending"    value={media.trending} icon={<TrendingUp className="h-5 w-5"/>}  accent="bg-emerald-50" ic="text-emerald-500" loading={mLoading} sub="Movies + Dramas"/>
      </div>

      {/* ── CF traffic cards (4) with sparklines + trends ────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Requests"  value={cf ? fmtN(cf.totals.requests) : null}        icon={<Globe className="h-5 w-5"/>}       accent="bg-indigo-50"  ic="text-indigo-500"  loading={cfLoad} na={cfNa} sub={periodLabel} spark={spk.requests}  sparkColor="#6366f1" trend={trend.requests}/>
        <StatCard title="Bandwidth" value={cf ? fmtBytes(cf.totals.bytes) : null}        icon={<ArrowUpRight className="h-5 w-5"/>} accent="bg-sky-50"     ic="text-sky-500"     loading={cfLoad} na={cfNa} sub={periodLabel} spark={spk.bytes}     sparkColor="#0ea5e9" trend={trend.bytes}/>
        <StatCard title="Cached"    value={cf ? fmtN(cf.totals.cachedRequests) : null}   icon={<Zap className="h-5 w-5"/>}          accent="bg-emerald-50" ic="text-emerald-500" loading={cfLoad} na={cfNa} sub="From edge"   spark={spk.cached}    sparkColor="#10b981" trend={trend.cached}/>
        <StatCard title="Cache Hit" value={cf ? `${cf.totals.cacheHitRate}%` : null}     icon={<Zap className="h-5 w-5"/>}          accent="bg-teal-50"    ic="text-teal-500"    loading={cfLoad} na={cfNa}/>
      </div>

      {/* ── CF security / visitor cards (3) with sparklines + trends ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Unique Visitors" value={cf ? fmtN(cf.totals.uniqueVisitors) : null} icon={<Users className="h-5 w-5"/>}        accent="bg-purple-50" ic="text-purple-500" loading={cfLoad} na={cfNa} sub={periodLabel} spark={spk.visitors} sparkColor="#a855f7" trend={trend.visitors}/>
        <StatCard title="Threats Blocked" value={cf ? fmtN(cf.totals.threats) : null}         icon={<ShieldAlert className="h-5 w-5"/>}  accent="bg-yellow-50" ic="text-yellow-500" loading={cfLoad} na={cfNa} sub="Blocked"      spark={spk.threats}  sparkColor="#eab308" trend={trend.threats}/>
        <StatCard title="Errors"           value={cf ? fmtN(cf.totals.errors4xx + cf.totals.errors5xx) : null} icon={<AlertTriangle className="h-5 w-5"/>} accent="bg-rose-50" ic="text-rose-500" loading={cfLoad} na={cfNa} sub="4xx + 5xx" spark={spk.errors} sparkColor="#f43f5e" trend={trend.errors} danger/>
      </div>

      {/* ── Requests + Bandwidth ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <ChartSection id="requests" title="Web Requests" sub={`Total vs cached — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa} collapsed={collapsed.has('requests')} onToggle={() => toggle('requests')}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={.15}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={.15}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtN}/>
                <Tooltip content={<Tip/>}/>
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }}/>
                <Area type="monotone" dataKey="Requests" stroke="#6366f1" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{ r: 4 }}/>
                <Area type="monotone" dataKey="Cached"   stroke="#10b981" strokeWidth={2} fill="url(#gC)" dot={false} activeDot={{ r: 4 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        </div>
        <div className="xl:col-span-2">
          <ChartSection id="bandwidth" title="Bandwidth" sub={`MB served — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa} collapsed={collapsed.has('bandwidth')} onToggle={() => toggle('bandwidth')}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={.15}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip fmt={(v: number) => `${v} MB`}/>}/>
                <Area type="monotone" dataKey="BW (MB)" stroke="#0ea5e9" strokeWidth={2} fill="url(#gB)" dot={false} activeDot={{ r: 4 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        </div>
      </div>

      {/* ── Threats ──────────────────────────────────────────────────────── */}
      <ChartSection id="threats" title="Threats Blocked" sub={`Security threats blocked by Cloudflare — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa} collapsed={collapsed.has('threats')} onToggle={() => toggle('threats')}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="Threats" fill="#eab308" radius={[4, 4, 0, 0]} maxBarSize={40}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* ── Errors + Visitors ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartSection id="errors" title="HTTP Errors" sub={`4xx + 5xx errors — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa} collapsed={collapsed.has('errors')} onToggle={() => toggle('errors')}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="Errors" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection id="visitors" title="Unique Visitors" sub={`Unique visitors — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa} collapsed={collapsed.has('visitors')} onToggle={() => toggle('visitors')}>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={chartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={.15}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={fmtN}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="Visitors" stroke="#a855f7" strokeWidth={2} fill="url(#gV)" dot={false} activeDot={{ r: 4 }}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>

      {/* ── Regions table + Quick actions ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Regions */}
        <div className="xl:col-span-3">
          <ChartSection id="regions" title="Top Regions" sub="Requests by country" loading={cfLoad} na={cfNa || (cfOk && period === '24h')} collapsed={collapsed.has('regions')} onToggle={() => toggle('regions')}>
            {cfOk && period !== '24h' && cf?.countries && cf.countries.length > 0 ? (
              <div className="space-y-1">
                {cf.countries.slice(0, 8).map((c, i) => {
                  const pct = Math.round((c.requests / totalCountryReq) * 100)
                  const barW = Math.round((c.requests / maxCountry) * 100)
                  return (
                    <div key={c.country} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${i % 2 === 0 ? 'bg-gray-50/60' : ''}`}>
                      <span className="text-xs text-gray-400 w-5 text-center font-bold">{i + 1}</span>
                      <span className="text-lg w-7 flex-shrink-0">{countryFlag(c.country)}</span>
                      <span className="text-sm font-medium text-gray-700 w-32 truncate">{c.country}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${barW}%` }}/>
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      <span className="text-xs font-semibold text-gray-700 w-12 text-right">{fmtN(c.requests)}</span>
                    </div>
                  )
                })}

              </div>
            ) : cfOk && period !== '24h' ? (
              <div className="h-40 flex items-center justify-center text-xs text-gray-400">No region data available</div>
            ) : null}
          </ChartSection>
        </div>

        {/* Quick actions */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/admin/movies/create', label: 'Add Movie',    icon: Film,          color: 'text-sky-500',     bg: 'bg-sky-50' },
                { href: '/admin/dramas/create', label: 'Add Drama',    icon: Tv,            color: 'text-indigo-500',  bg: 'bg-indigo-50' },
                { href: '/admin/notifications', label: 'Notify Users', icon: Users,         color: 'text-violet-500',  bg: 'bg-violet-50' },
                { href: '/admin/uploads',       label: 'Upload File',  icon: ArrowUpRight,  color: 'text-emerald-500', bg: 'bg-emerald-50' },
              ].map(({ href, label, icon: Icon, color, bg }) => (
                <a key={href} href={href} className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-150">
                  <div className={`${bg} rounded-xl p-2.5 group-hover:scale-105 transition-transform`}><Icon className={`h-5 w-5 ${color}`}/></div>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                </a>
              ))}
            </div>

            {cfOk && cf && (
              <div className="mt-5 pt-5 border-t border-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Cache Hit Rate</span>
                  <span className="text-xs font-bold text-emerald-600">{cf.totals.cacheHitRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full transition-all duration-700" style={{ width: `${cf.totals.cacheHitRate}%` }}/>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{fmtN(cf.totals.cachedRequests)} cached</span>
                  <span>{fmtN(cf.totals.uncachedRequests)} uncached</span>
                </div>
                {/* Mini sparkline for cache rate */}
                <div className="-mx-1 mt-1">
                  <Spark data={spk.cached.map((c, i) => spk.requests[i] > 0 ? Math.round((c / spk.requests[i]) * 100) : 0)} color="#10b981" uid="cache-hit-rate"/>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}