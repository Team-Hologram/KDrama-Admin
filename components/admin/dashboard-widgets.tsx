'use client'

import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronUp, RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// ── Animated counter ──────────────────────────────────────────────────────────
export function AnimCount({ value, dur = 800 }: { value: number; dur?: number }) {
  const [d, setD] = useState(0)
  const s = useRef<number | null>(null)
  const r = useRef<number | null>(null)
  useEffect(() => {
    if (r.current) cancelAnimationFrame(r.current)
    s.current = null
    const fn = (ts: number) => {
      if (!s.current) s.current = ts
      const p = Math.min((ts - s.current) / dur, 1)
      setD(Math.round((1 - Math.pow(1 - p, 3)) * value))
      if (p < 1) r.current = requestAnimationFrame(fn)
    }
    r.current = requestAnimationFrame(fn)
    return () => { if (r.current) cancelAnimationFrame(r.current) }
  }, [value, dur])
  return <>{d.toLocaleString()}</>
}

// ── Trend badge ───────────────────────────────────────────────────────────────
export function TrendBadge({ pct }: { pct: number }) {
  if (pct === 0) return null
  const up = pct > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
      {up ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  )
}

// ── Tiny sparkline ────────────────────────────────────────────────────────────
export function Spark({ data, color, uid }: { data: number[]; color: string; uid: string }) {
  if (!data.length) return <div className="h-10" />
  const d = data.map((v, i) => ({ i, v }))
  const gid = `sg-${uid}`
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={d} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string
  value: string | number | null
  icon: React.ReactNode
  accent: string
  ic: string
  loading?: boolean
  sub?: string
  na?: boolean
  spark?: number[]
  sparkColor?: string
  trend?: number
  danger?: boolean
}

export function StatCard({ title, value, icon, accent, ic, loading, sub, na, spark, sparkColor = '#6366f1', trend, danger }: StatCardProps) {
  const isDanger = danger && !na && !loading && typeof value === 'number' && value > 50
  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 ${isDanger ? 'border border-rose-200' : 'border border-gray-100'}`}>
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">{title}</p>
              {trend !== undefined && !na && !loading && <TrendBadge pct={trend} />}
              {isDanger && <span className="flex h-2 w-2"><span className="animate-ping absolute h-2 w-2 rounded-full bg-rose-400 opacity-75"/><span className="relative h-2 w-2 rounded-full bg-rose-500"/></span>}
            </div>
            {loading
              ? <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
              : na
              ? <span className="text-3xl font-bold text-gray-300">—</span>
              : <span className={`text-3xl font-bold break-all ${isDanger ? 'text-rose-600' : 'text-gray-900'}`}>
                  {typeof value === 'number' ? <AnimCount key={value} value={value} /> : value}
                </span>
            }
            {sub && !loading && !na && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`${isDanger ? 'bg-rose-50' : accent} rounded-xl p-2.5 flex-shrink-0`}>
            <div className={isDanger ? 'text-rose-500' : ic}>{icon}</div>
          </div>
        </div>
      </div>
      {spark && !na && !loading && (
        <div className="-mt-1 px-1 pb-1">
          <Spark data={spark} color={sparkColor} uid={title.replace(/\s+/g, '-')} />
        </div>
      )}
    </div>
  )
}

// ── Collapsible chart section ─────────────────────────────────────────────────
interface ChartSectionProps {
  id: string
  title: string
  sub?: string
  loading?: boolean
  na?: boolean
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function ChartSection({ title, sub, loading, na, collapsed, onToggle, children }: ChartSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/80 transition-colors group">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 text-left">{title}</h3>
          {sub && <p className="text-xs text-gray-400 mt-0.5 text-left">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          {na && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-medium">No CF data</span>}
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            : <ChevronUp   className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />}
        </div>
      </button>
      {!collapsed && (
        <div className="px-6 pb-6">
          {loading ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-5 w-5 text-gray-300 animate-spin" />
              <span className="text-xs text-gray-400">Loading…</span>
            </div>
          ) : na ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3">
              <WifiOff className="h-6 w-6 text-gray-200" />
              <p className="text-xs text-gray-400 text-center max-w-[220px]">
                Add <code className="bg-gray-100 px-1 rounded">CLOUDFLARE_API_TOKEN</code> and{' '}
                <code className="bg-gray-100 px-1 rounded">CLOUDFLARE_ZONE_ID</code> to Vercel env vars
              </p>
            </div>
          ) : children}
        </div>
      )}
    </div>
  )
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
export function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: string; fmt?: (v: number, name: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
          <span className="text-gray-500">{e.name}:</span>
          <span className="font-semibold text-gray-800">{fmt ? fmt(e.value, e.name) : e.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── Country flag lookup ───────────────────────────────────────────────────────
const FLAGS: Record<string, string> = {
  'Sri Lanka': '🇱🇰', 'India': '🇮🇳', 'United States': '🇺🇸',
  'United Kingdom': '🇬🇧', 'Australia': '🇦🇺', 'Canada': '🇨🇦',
  'Singapore': '🇸🇬', 'Malaysia': '🇲🇾', 'Pakistan': '🇵🇰',
  'Bangladesh': '🇧🇩', 'New Zealand': '🇳🇿', 'United Arab Emirates': '🇦🇪',
  'Thailand': '🇹🇭', 'Philippines': '🇵🇭', 'South Korea': '🇰🇷',
  'Japan': '🇯🇵', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'China': '🇨🇳',
  'Nepal': '🇳🇵', 'Saudi Arabia': '🇸🇦', 'Qatar': '🇶🇦',
  'Kuwait': '🇰🇼', 'Maldives': '🇲🇻', 'Myanmar': '🇲🇲',
}
export function countryFlag(name: string) { return FLAGS[name] ?? '🌍' }

// ── Trend calc (first half vs second half of series) ─────────────────────────
export function calcTrend(vals: number[]): number {
  if (vals.length < 4) return 0
  const mid = Math.floor(vals.length / 2)
  const a = vals.slice(0, mid).reduce((s, v) => s + v, 0)
  const b = vals.slice(mid).reduce((s, v) => s + v, 0)
  if (a === 0) return b > 0 ? 100 : 0
  return Math.round(((b - a) / a) * 100)
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function fmtBytes(b: number) {
  if (!b) return '0 B'
  const k = 1024, u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${u[i]}`
}
export function fmtN(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toString()
}
export function fmtDate(d: string) {
  try {
    const dt = new Date(d)
    if (d.includes('T')) return dt.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return d }
}
export function greet(name?: string | null) {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${g}, ${name.split(' ')[0]}` : g
}
export function today() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}
export function timeAgo(d: Date | null): string {
  if (!d) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'Updated just now'
  if (s < 3600) return `Updated ${Math.floor(s / 60)}m ago`
  return `Updated ${Math.floor(s / 3600)}h ago`
}
