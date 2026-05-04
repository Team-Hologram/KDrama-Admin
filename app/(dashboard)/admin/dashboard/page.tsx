'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Film, Tv, TrendingUp, Eye, Users, Globe, Zap, ShieldAlert, RefreshCw, WifiOff, ArrowUpRight, AlertTriangle, MapPin } from 'lucide-react'

type Period = '24h' | '7d' | '30d'

interface CFPoint { date: string; requests: number; bytes: number; cachedRequests: number; threats: number; errors4xx: number; errors5xx: number; uniques: number }
interface CFCountry { country: string; requests: number }
interface CFStats {
  totals: { requests: number; bytes: number; cachedRequests: number; threats: number; cacheHitRate: number; uncachedRequests: number; errors4xx: number; errors5xx: number; pageViews: number; uniqueVisitors: number }
  series: CFPoint[]
  countries: CFCountry[]
  period: Period
  available: boolean
}

function fmtBytes(b: number) {
  if (!b) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b)/Math.log(k))
  return `${(b/Math.pow(k,i)).toFixed(1)} ${s[i]}`
}
function fmtN(n: number) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`
  return n.toString()
}
function fmtDate(d: string) {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric' })
}
function greet(name?: string|null) {
  const h = new Date().getHours()
  const g = h<12?'Good morning':h<17?'Good afternoon':'Good evening'
  return name ? `${g}, ${name.split(' ')[0]}` : g
}
function today() {
  return new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
}

function AnimCount({ value, dur=800 }: { value:number; dur?:number }) {
  const [d,setD] = useState(0)
  const s = useRef<number|null>(null), r = useRef<number|null>(null)
  useEffect(() => {
    if(r.current) cancelAnimationFrame(r.current)
    s.current=null
    const fn=(ts:number)=>{ if(!s.current)s.current=ts; const p=Math.min((ts-s.current)/dur,1); setD(Math.round((1-Math.pow(1-p,3))*value)); if(p<1)r.current=requestAnimationFrame(fn) }
    r.current=requestAnimationFrame(fn)
    return ()=>{if(r.current)cancelAnimationFrame(r.current)}
  },[value,dur])
  return <>{d.toLocaleString()}</>
}

function Tip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((e:any,i:number)=>(
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{background:e.color}}/>
          <span className="text-gray-500">{e.name}:</span>
          <span className="font-semibold text-gray-800">{fmt?fmt(e.value,e.name):e.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ title, value, icon, accent, ic, loading, sub, na }: { title:string; value:string|number|null; icon:React.ReactNode; accent:string; ic:string; loading?:boolean; sub?:string; na?:boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
          <div className="mt-2">
            {loading ? <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse"/> :
             na ? <span className="text-3xl font-bold text-gray-300">—</span> :
             <span className="text-3xl font-bold text-gray-900">{typeof value==='number'?<AnimCount value={value}/>:value}</span>}
          </div>
          {sub&&!loading&&!na&&<p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`${accent} rounded-xl p-3 ml-3`}><div className={ic}>{icon}</div></div>
      </div>
    </div>
  )
}

function ChartWrap({ title, sub, loading, na, children }: { title:string; sub?:string; loading?:boolean; na?:boolean; children:React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {sub&&<p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center flex-col gap-3">
          <RefreshCw className="h-5 w-5 text-gray-300 animate-spin"/><span className="text-xs text-gray-400">Loading…</span>
        </div>
      ) : na ? (
        <div className="h-48 flex items-center justify-center flex-col gap-3">
          <WifiOff className="h-6 w-6 text-gray-200"/>
          <p className="text-xs text-gray-400 text-center max-w-[220px]">Add <code className="bg-gray-100 px-1 rounded">CLOUDFLARE_API_TOKEN</code> and <code className="bg-gray-100 px-1 rounded">CLOUDFLARE_ZONE_ID</code> to <code className="bg-gray-100 px-1 rounded">.env</code></p>
        </div>
      ) : children}
    </div>
  )
}

const PERIODS: {label:string; value:Period}[] = [
  {label:'24 Hours',value:'24h'},
  {label:'7 Days',  value:'7d' },
  {label:'30 Days', value:'30d'},
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const [period, setPeriod] = useState<Period>('7d')
  const [media, setMedia] = useState({ movies:0, dramas:0, views:0, trending:0, users:0 })
  const [mLoading, setMLoading] = useState(true)
  const [cf, setCf] = useState<CFStats|null>(null)
  const [cfLoad, setCfLoad] = useState(true)

  useEffect(()=>{
    setMLoading(true)
    Promise.all([
      fetch('/api/movies').then(r=>r.json()),
      fetch('/api/dramas').then(r=>r.json()),
      fetch('/api/stats/users').then(r=>r.json()),
    ]).then(([mv,dr,us])=>{
      const views=[...mv,...dr].reduce((s:number,x:any)=>s+(x.views||0),0)
      const trending=[...mv,...dr].filter((x:any)=>x.trending).length
      setMedia({movies:mv.length,dramas:dr.length,views,trending,users:us.count??0})
    }).catch(console.error).finally(()=>setMLoading(false))
  },[])

  const fetchCF = useCallback((p:Period)=>{
    setCfLoad(true)
    fetch(`/api/stats/cloudflare?period=${p}`)
      .then(r=>r.json()).then(setCf).catch(console.error).finally(()=>setCfLoad(false))
  },[])

  useEffect(()=>{ fetchCF(period) },[period,fetchCF])

  const cfOk = !cfLoad && (cf?.available??false)
  const cfNa = !cfLoad && !cfOk

  const periodLabel = PERIODS.find(p=>p.value===period)?.label ?? '7 Days'

  const chartData = (cf?.series??[]).map(d=>({
    date: fmtDate(d.date),
    Requests: d.requests,
    Cached: d.cachedRequests,
    'BW (MB)': parseFloat((d.bytes/1024/1024).toFixed(2)),
    Threats: d.threats,
    Errors: d.errors4xx + d.errors5xx,
    Visitors: d.uniques,
  }))

  const maxCountry = cf?.countries?.[0]?.requests ?? 1

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header row */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greet(session?.user?.name)}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {PERIODS.map(p=>(
              <button
                key={p.value}
                onClick={()=>setPeriod(p.value)}
                className={`px-4 py-2 text-xs font-semibold transition-all duration-150 ${period===p.value?'bg-gray-900 text-white':'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
              >{p.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-xs font-medium text-emerald-700">Operational</span>
          </div>
        </div>
      </div>

      {/* Media + user stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="App Users"   value={media.users}    icon={<Users className="h-5 w-5"/>}      accent="bg-violet-50"  ic="text-violet-500" loading={mLoading} sub="Registered devices"/>
        <StatCard title="Movies"      value={media.movies}   icon={<Film className="h-5 w-5"/>}       accent="bg-sky-50"     ic="text-sky-500"    loading={mLoading}/>
        <StatCard title="Dramas"      value={media.dramas}   icon={<Tv className="h-5 w-5"/>}         accent="bg-indigo-50"  ic="text-indigo-500" loading={mLoading}/>
        <StatCard title="Total Views" value={media.views}    icon={<Eye className="h-5 w-5"/>}        accent="bg-amber-50"   ic="text-amber-500"  loading={mLoading}/>
        <StatCard title="Trending"    value={media.trending} icon={<TrendingUp className="h-5 w-5"/>} accent="bg-emerald-50" ic="text-emerald-500" loading={mLoading} sub="Movies + Dramas"/>
      </div>

      {/* Cloudflare summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard title="Requests"        value={cf?fmtN(cf.totals.requests):null}                             icon={<Globe className="h-5 w-5"/>}       accent="bg-indigo-50"  ic="text-indigo-500"  loading={cfLoad} na={cfNa} sub={periodLabel}/>
        <StatCard title="Bandwidth"       value={cf?fmtBytes(cf.totals.bytes):null}                            icon={<ArrowUpRight className="h-5 w-5"/>} accent="bg-sky-50"     ic="text-sky-500"     loading={cfLoad} na={cfNa} sub={periodLabel}/>
        <StatCard title="Cached"          value={cf?fmtN(cf.totals.cachedRequests):null}                       icon={<Zap className="h-5 w-5"/>}          accent="bg-emerald-50" ic="text-emerald-500" loading={cfLoad} na={cfNa} sub="From edge"/>
        <StatCard title="Cache Hit"       value={cf?`${cf.totals.cacheHitRate}%`:null}                         icon={<Zap className="h-5 w-5"/>}          accent="bg-teal-50"    ic="text-teal-500"    loading={cfLoad} na={cfNa}/>
        <StatCard title="Unique Visitors" value={cf?fmtN(cf.totals.uniqueVisitors):null}                       icon={<Users className="h-5 w-5"/>}        accent="bg-purple-50"  ic="text-purple-500"  loading={cfLoad} na={cfNa} sub={periodLabel}/>
        <StatCard title="Threats"         value={cf?fmtN(cf.totals.threats):null}                              icon={<ShieldAlert className="h-5 w-5"/>}  accent="bg-yellow-50"  ic="text-yellow-500"  loading={cfLoad} na={cfNa} sub="Blocked"/>
        <StatCard title="Errors"          value={cf?fmtN(cf.totals.errors4xx+cf.totals.errors5xx):null}        icon={<AlertTriangle className="h-5 w-5"/>} accent="bg-rose-50"   ic="text-rose-500"    loading={cfLoad} na={cfNa} sub="4xx + 5xx"/>
      </div>

      {/* Charts row 1 – Requests + Bandwidth */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3">
          <ChartWrap title="Web Requests" sub={`Total vs cached — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{top:0,right:8,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={.15}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={.15}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} tickFormatter={fmtN}/>
                <Tooltip content={<Tip/>}/>
                <Legend wrapperStyle={{fontSize:12,paddingTop:8}}/>
                <Area type="monotone" dataKey="Requests" stroke="#6366f1" strokeWidth={2} fill="url(#gR)" dot={false} activeDot={{r:4}}/>
                <Area type="monotone" dataKey="Cached"   stroke="#10b981" strokeWidth={2} fill="url(#gC)" dot={false} activeDot={{r:4}}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrap>
        </div>
        <div className="xl:col-span-2">
          <ChartWrap title="Bandwidth" sub={`MB served — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{top:0,right:8,left:-20,bottom:0}}>
                <defs>
                  <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={.15}/><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip fmt={(v:number)=>`${v} MB`}/>}/>
                <Area type="monotone" dataKey="BW (MB)" stroke="#0ea5e9" strokeWidth={2} fill="url(#gB)" dot={false} activeDot={{r:4}}/>
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrap>
        </div>
      </div>

      {/* Charts row 2 – Threats Blocked bar chart */}
      <ChartWrap title="Threats Blocked" sub={`Daily security threats blocked by Cloudflare — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{top:0,right:8,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
            <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
            <Tooltip content={<Tip/>}/>
            <Bar dataKey="Threats" fill="#eab308" radius={[4,4,0,0]} maxBarSize={40}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartWrap>

      {/* Charts row 3 – Errors + Visitors */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartWrap title="HTTP Errors" sub={`Total 4xx + 5xx errors — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa}>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{top:0,right:8,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="Errors" fill="#f43f5e" radius={[4,4,0,0]} maxBarSize={40}/>
            </BarChart>
          </ResponsiveContainer>
        </ChartWrap>

        <ChartWrap title="Unique Visitors" sub={`Unique visitors per period point — ${periodLabel.toLowerCase()}`} loading={cfLoad} na={cfNa}>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={chartData} margin={{top:0,right:8,left:-20,bottom:0}}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={.15}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#9ca3af'}} axisLine={false} tickLine={false} tickFormatter={fmtN}/>
              <Tooltip content={<Tip/>}/>
              <Area type="monotone" dataKey="Visitors" stroke="#a855f7" strokeWidth={2} fill="url(#gV)" dot={false} activeDot={{r:4}}/>
            </AreaChart>
          </ResponsiveContainer>
        </ChartWrap>
      </div>

      {/* Row 3 – Regions + Quick Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Top countries */}
        <div className="xl:col-span-3">
          <ChartWrap title="Top Regions" sub="Requests by country" loading={cfLoad} na={cfNa || (cfOk && period==='24h')}>
            {cfOk && period !== '24h' && cf?.countries && cf.countries.length > 0 ? (
              <div className="space-y-2">
                {cf.countries.slice(0,8).map((c,i)=>(
                  <div key={c.country} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4 text-right">{i+1}</span>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <MapPin className="h-3 w-3 text-gray-300 flex-shrink-0"/>
                      <span className="text-sm font-medium text-gray-700 truncate">{c.country}</span>
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-indigo-400 h-2 rounded-full transition-all duration-500" style={{width:`${Math.round((c.requests/maxCountry)*100)}%`}}/>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-12 text-right">{fmtN(c.requests)}</span>
                  </div>
                ))}

              </div>
            ) : cfOk && cf?.countries?.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-gray-400">No region data available</div>
            ) : null}
          </ChartWrap>
        </div>

        {/* Quick Actions */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-full">
            <h3 className="text-sm font-semibold text-gray-800 mb-5">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {href:'/admin/movies/create', label:'Add Movie',    icon:Film,          color:'text-sky-500',    bg:'bg-sky-50'},
                {href:'/admin/dramas/create', label:'Add Drama',    icon:Tv,            color:'text-indigo-500', bg:'bg-indigo-50'},
                {href:'/admin/notifications', label:'Notify Users', icon:Globe,         color:'text-violet-500', bg:'bg-violet-50'},
                {href:'/admin/uploads',       label:'Upload File',  icon:ArrowUpRight,  color:'text-emerald-500',bg:'bg-emerald-50'},
              ].map(({href,label,icon:Icon,color,bg})=>(
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
                  <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full transition-all duration-700" style={{width:`${cf.totals.cacheHitRate}%`}}/>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{fmtN(cf.totals.cachedRequests)} cached</span>
                  <span>{fmtN(cf.totals.uncachedRequests)} uncached</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}