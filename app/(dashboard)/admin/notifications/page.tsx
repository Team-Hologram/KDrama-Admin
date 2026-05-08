'use client'

import { useState, useEffect } from 'react'
import {
  Bell, Send, Trash2, Image, Users, CheckCircle2, XCircle,
  Loader2, Smartphone, Activity, AlertTriangle, Sparkles,
  Clock, ChevronDown, ChevronUp, Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface SentNotification {
  id: string
  title: string
  body: string
  imageUrl?: string
  createdAt: string
  totalDevices: number
  pushed: number
  failed: number
}

interface SendResult {
  success: boolean
  id?: string
  totalDevices?: number
  pushed?: number
  failed?: number
  error?: string
  message?: string
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number
  color: 'blue' | 'green' | 'red'
}) {
  const colors = {
    blue:  'bg-sky-50 border-sky-100 text-sky-700',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    red:   'bg-rose-50 border-rose-100 text-rose-700',
  }
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${colors[color]}`}>
      <span className="opacity-70">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 leading-none mb-0.5">{label}</p>
        <p className="text-base font-bold leading-none">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

// ── Delivery stats ────────────────────────────────────────────────────────────
function DeliveryStats({ totalDevices, pushed, failed, compact = false }: {
  totalDevices: number; pushed: number; failed: number; compact?: boolean
}) {
  const successRate = totalDevices > 0 ? Math.round((pushed / totalDevices) * 100) : 0

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-xs text-sky-600">
          <Smartphone className="h-3 w-3" />{totalDevices} devices
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />{pushed} delivered
        </span>
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-xs text-rose-600">
            <XCircle className="h-3 w-3" />{failed} failed
          </span>
        )}
        <span className="text-xs text-gray-400">{successRate}% delivery</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <StatPill icon={<Smartphone className="h-4 w-4" />} label="Total Devices" value={totalDevices} color="blue" />
        <StatPill icon={<CheckCircle2 className="h-4 w-4" />} label="Delivered" value={pushed} color="green" />
        <StatPill icon={<XCircle className="h-4 w-4" />} label="Failed" value={failed} color="red" />
      </div>
      {totalDevices > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Delivery rate</span>
            <span className="font-semibold text-gray-700">{successRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── History item ──────────────────────────────────────────────────────────────
function HistoryItem({ n, deletingId, onDelete }: {
  n: SentNotification; deletingId: string | null; onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-all duration-150 overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100">
          <Bell className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm leading-snug">{n.title}</p>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 shrink-0">
              <Clock className="h-3 w-3" />
              {new Date(n.createdAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
          <DeliveryStats totalDevices={n.totalDevices ?? 0} pushed={n.pushed ?? 0} failed={n.failed ?? 0} compact />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
            onClick={() => onDelete(n.id)}
            disabled={deletingId === n.id}
          >
            {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          <DeliveryStats totalDevices={n.totalDevices ?? 0} pushed={n.pushed ?? 0} failed={n.failed ?? 0} />
          {n.imageUrl && (
            <div className="flex items-center gap-2 text-xs text-indigo-500/70">
              <Image className="h-3 w-3" />
              <span className="truncate">{n.imageUrl}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mobile notification preview ───────────────────────────────────────────────
function MobilePreview({ title, body, imageUrl }: { title: string; body: string; imageUrl?: string }) {
  return (
    <div className="relative mx-auto" style={{ width: 300 }}>
      <div className="relative rounded-[2.5rem] border-2 border-gray-200 bg-gradient-to-b from-gray-800 to-gray-900 p-2 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 min-h-[200px]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2">
            <span className="text-[10px] text-white/50 font-medium">9:41</span>
            <div className="w-20 h-4 rounded-full bg-black mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
            <div className="flex gap-1 items-center">
              <div className="h-2 w-4 rounded-sm bg-white/30" />
              <div className="h-2 w-2 rounded-full bg-white/30" />
            </div>
          </div>
          {/* Notification card */}
          <div className="px-4 py-2">
            <div
              className="rounded-xl overflow-hidden shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-5 rounded-md bg-indigo-600 flex items-center justify-center">
                    <Film className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-[10px] text-white/50 font-medium tracking-wide uppercase">KDSL</span>
                  <span className="text-[10px] text-white/30 ml-auto">now</span>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white leading-snug">
                      {title || 'Notification Title'}
                    </p>
                    <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2 leading-relaxed">
                      {body || 'Your notification message will appear here...'}
                    </p>
                  </div>
                  {imageUrl && (
                    <img
                      key={imageUrl}
                      src={imageUrl} alt="preview"
                      className="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">Live Preview</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [notifications, setNotifications] = useState<SentNotification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      const res = await fetch('/api/notifications/send')
      const json = await res.json()
      setNotifications(Array.isArray(json) ? json : (json.notifications ?? []))
    } catch { console.error('Failed to load notifications') }
    finally { setLoadingHistory(false) }
  }

  useEffect(() => { loadHistory() }, [])

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), imageUrl: imageUrl.trim() || undefined }),
      })
      const json = await res.json()
      setResult(json)
      if (json.success) { setTitle(''); setBody(''); setImageUrl(''); await loadHistory() }
    } catch { setResult({ success: false, error: 'Network error' }) }
    finally { setSending(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification from history?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/notifications/send?id=${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch { alert('Failed to delete') }
    finally { setDeletingId(null) }
  }

  const isFormValid = title.trim().length > 0 && body.trim().length > 0
  const showPreview = title.trim().length > 0 || body.trim().length > 0

  return (
    <div className="space-y-5 max-w-[1200px] mx-auto">

      {/* ── Header (matches dashboard style) ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900 p-6 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.2),transparent_60%)] pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-400/20">
              <Bell className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Push Notifications</h1>
              <p className="text-sm text-indigo-200/60 mt-0.5">Broadcast messages to all registered devices</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <Activity className="h-4 w-4 text-indigo-300" />
            <span className="text-sm text-white/60">
              <span className="text-white font-semibold">{notifications.length}</span> sent
            </span>
          </div>
        </div>
      </div>

      {/* ── Compose + Preview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* Compose */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Compose Message</h2>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-title" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Title <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="notif-title"
              placeholder="e.g. New Episode Available! 🎬"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
              className="rounded-xl h-11 border-gray-200 focus:border-indigo-400 focus:ring-indigo-500/20"
            />
            <p className="text-xs text-gray-400 text-right">{title.length}/100</p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-body" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Message <span className="text-rose-400">*</span>
            </Label>
            <Textarea
              id="notif-body"
              placeholder="Write your notification message here..."
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={300}
              rows={4}
              className="rounded-xl border-gray-200 focus:border-indigo-400 focus:ring-indigo-500/20 resize-none"
            />
            <p className="text-xs text-gray-400 text-right">{body.length}/300</p>
          </div>

          {/* Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="notif-image" className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
              <Image className="h-3 w-3" /> Image URL
              <span className="text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
            </Label>
            <Input
              id="notif-image"
              placeholder="https://example.com/poster.jpg"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="rounded-xl h-11 border-gray-200 focus:border-indigo-400 focus:ring-indigo-500/20"
            />
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.success ? 'border border-emerald-100 bg-emerald-50' : 'border border-rose-100 bg-rose-50'}`}>
              {result.success ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    <p className="font-semibold text-emerald-700">Notification sent successfully!</p>
                  </div>
                  <DeliveryStats totalDevices={result.totalDevices ?? 0} pushed={result.pushed ?? 0} failed={result.failed ?? 0} />
                  {result.message && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{result.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                  <p className="text-rose-700">{result.error ?? 'Failed to send'}</p>
                </div>
              )}
            </div>
          )}

          {/* Send footer */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="h-4 w-4" />
              <span>Broadcasts to all devices</span>
            </div>
            <button
              onClick={handleSend}
              disabled={!isFormValid || sending}
              className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] ${
                isFormValid && !sending
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send Now</>}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100 mb-6">
            <Smartphone className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Device Preview</h2>
          </div>
          <div className={`flex-1 flex items-center justify-center transition-opacity duration-300 ${showPreview ? 'opacity-100' : 'opacity-50'}`}>
            <MobilePreview title={title} body={body} imageUrl={imageUrl || undefined} />
          </div>
          {!showPreview && (
            <p className="text-center text-xs text-gray-400 mt-4">Start typing to see a live preview</p>
          )}
        </div>
      </div>

      {/* ── History ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-800">Notification History</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-xs font-medium text-indigo-600">
            <Bell className="h-3 w-3" />{notifications.length} total
          </span>
        </div>

        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
            <p className="text-sm text-gray-400">Loading history…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100">
              <Bell className="h-7 w-7 text-indigo-300" />
            </div>
            <div>
              <p className="text-gray-500 font-medium">No notifications yet</p>
              <p className="text-gray-400 text-sm mt-1">Compose your first message above</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <HistoryItem key={n.id} n={n} deletingId={deletingId} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
