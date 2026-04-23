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

// ── Stat pill ──────────────────────────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'blue' | 'green' | 'red'
}) {
  const colors = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    green: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    red: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  }
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colors[color]}`}>
      <span className="opacity-70">{icon}</span>
      <div>
        <p className="text-xs opacity-60 leading-none mb-0.5">{label}</p>
        <p className="text-base font-bold leading-none">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}

// ── Delivery stats row ─────────────────────────────────────────────────────────
function DeliveryStats({
  totalDevices,
  pushed,
  failed,
  compact = false,
}: {
  totalDevices: number
  pushed: number
  failed: number
  compact?: boolean
}) {
  const successRate = totalDevices > 0 ? Math.round((pushed / totalDevices) * 100) : 0

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
          <Smartphone className="h-3 w-3" />
          {totalDevices} devices
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {pushed} delivered
        </span>
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
            <XCircle className="h-3 w-3" />
            {failed} failed
          </span>
        )}
        <span className="text-xs text-white/30">
          {successRate}% delivery
        </span>
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

      {/* Delivery rate bar */}
      {totalDevices > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-white/40">
            <span>Delivery rate</span>
            <span className="text-white/70 font-medium">{successRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── History item ───────────────────────────────────────────────────────────────
function HistoryItem({
  n,
  deletingId,
  onDelete,
}: {
  n: SentNotification
  deletingId: string | null
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="group rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-200 overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 ring-1 ring-violet-500/30">
          <Bell className="h-4 w-4 text-violet-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-white/90 text-sm leading-snug">{n.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <span className="inline-flex items-center gap-1 text-xs text-white/30">
                <Clock className="h-3 w-3" />
                {new Date(n.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          <p className="text-white/40 text-sm mt-1 line-clamp-2 leading-relaxed">{n.body}</p>

          {/* Compact stats */}
          <DeliveryStats
            totalDevices={n.totalDevices ?? 0}
            pushed={n.pushed ?? 0}
            failed={n.failed ?? 0}
            compact
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-400/10 transition-all opacity-0 group-hover:opacity-100"
            onClick={() => onDelete(n.id)}
            disabled={deletingId === n.id}
          >
            {deletingId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3 space-y-3">
          <DeliveryStats
            totalDevices={n.totalDevices ?? 0}
            pushed={n.pushed ?? 0}
            failed={n.failed ?? 0}
          />
          {n.imageUrl && (
            <div className="flex items-center gap-2 text-xs text-violet-400/70">
              <Image className="h-3 w-3" />
              <span className="truncate">{n.imageUrl}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mobile notification preview ────────────────────────────────────────────────
function MobilePreview({ title, body, imageUrl }: { title: string; body: string; imageUrl?: string }) {
  return (
    <div className="relative mx-auto" style={{ width: 320 }}>
      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-2 border-white/10 bg-gradient-to-b from-zinc-800 to-zinc-900 p-2 shadow-2xl">
        {/* Screen */}
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

          {/* Blurred wallpaper hint */}
          <div className="px-4 py-2">
            <div
              className="rounded-xl overflow-hidden shadow-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(109,40,217,0.3) 0%, rgba(219,39,119,0.2) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="p-3">
                {/* App header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-5 rounded-md bg-violet-600 flex items-center justify-center">
                    <Film className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-[10px] text-white/50 font-medium tracking-wide uppercase">KDSL</span>
                  <span className="text-[10px] text-white/30 ml-auto">now</span>
                </div>

                {/* Notification content */}
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
                      src={imageUrl}
                      alt="preview"
                      className="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-center text-xs text-white/20 mt-3">Live Preview</p>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
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
      setNotifications(json.notifications ?? [])
    } catch {
      console.error('Failed to load notifications')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
        }),
      })
      const json = await res.json()
      setResult(json)

      if (json.success) {
        setTitle('')
        setBody('')
        setImageUrl('')
        await loadHistory()
      }
    } catch {
      setResult({ success: false, error: 'Network error' })
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notification from history?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/notifications/send?id=${id}`, { method: 'DELETE' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      alert('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const isFormValid = title.trim().length > 0 && body.trim().length > 0
  const showPreview = title.trim().length > 0 || body.trim().length > 0

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(180deg, #0a0a12 0%, #0d0d18 50%, #09090f 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 70% 10%, rgba(109,40,217,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(219,39,119,0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
              boxShadow: '0 0 32px rgba(124,58,237,0.35)',
            }}
          >
            <Bell className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Push Notifications</h1>
            <p className="text-sm text-white/40 mt-0.5">Broadcast messages to all registered devices</p>
          </div>

          <div className="ml-auto hidden sm:flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2">
            <Activity className="h-4 w-4 text-violet-400" />
            <span className="text-sm text-white/50">
              <span className="text-white/80 font-semibold">{notifications.length}</span> sent
            </span>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

          {/* ── Left: Compose card ── */}
          <div
            className="rounded-2xl border border-white/[0.07] p-6 space-y-5"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Card header */}
            <div className="flex items-center gap-3 pb-2 border-b border-white/[0.06]">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <h2 className="font-semibold text-white/90">Compose Message</h2>
            </div>

            {/* Title field */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-title" className="text-white/60 text-xs tracking-wide uppercase">
                Title <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="notif-title"
                placeholder="e.g. New Episode Available! 🎬"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20 focus:border-violet-500/60 focus:ring-violet-500/20 rounded-xl h-11"
              />
              <p className="text-xs text-white/20 text-right">{title.length}/100</p>
            </div>

            {/* Body field */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-body" className="text-white/60 text-xs tracking-wide uppercase">
                Message <span className="text-rose-400">*</span>
              </Label>
              <Textarea
                id="notif-body"
                placeholder="Write your notification message here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={300}
                rows={4}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20 focus:border-violet-500/60 focus:ring-violet-500/20 resize-none rounded-xl"
              />
              <p className="text-xs text-white/20 text-right">{body.length}/300</p>
            </div>

            {/* Image URL field */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-image" className="text-white/60 text-xs tracking-wide uppercase flex items-center gap-1.5">
                <Image className="h-3 w-3" /> Image URL
                <span className="text-white/30 font-normal lowercase normal-case">(optional)</span>
              </Label>
              <Input
                id="notif-image"
                placeholder="https://example.com/poster.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/20 focus:border-violet-500/60 focus:ring-violet-500/20 rounded-xl h-11"
              />
            </div>

            {/* ── Send result ── */}
            {result && (
              <div
                className={`rounded-xl p-4 ${
                  result.success
                    ? 'border border-emerald-500/20 bg-emerald-500/5'
                    : 'border border-rose-500/20 bg-rose-500/5'
                }`}
              >
                {result.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      <p className="font-semibold text-emerald-300">Notification sent successfully!</p>
                    </div>
                    <DeliveryStats
                      totalDevices={result.totalDevices ?? 0}
                      pushed={result.pushed ?? 0}
                      failed={result.failed ?? 0}
                    />
                    {result.message && (
                      <p className="text-xs text-white/30 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {result.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    <p className="text-rose-300">{result.error ?? 'Failed to send'}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Footer: send button ── */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-sm text-white/30">
                <Users className="h-4 w-4" />
                <span>Broadcasts to all devices</span>
              </div>

              <button
                onClick={handleSend}
                disabled={!isFormValid || sending}
                className="relative inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: isFormValid && !sending
                    ? 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: isFormValid && !sending
                    ? '0 0 24px rgba(124,58,237,0.4), 0 4px 12px rgba(0,0,0,0.3)'
                    : 'none',
                }}
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Now</>
                )}
              </button>
            </div>
          </div>

          {/* ── Right: Live preview ── */}
          <div
            className="rounded-2xl border border-white/[0.07] p-6 flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-2 mb-6 self-start w-full pb-2 border-b border-white/[0.06]">
              <Smartphone className="h-4 w-4 text-violet-400" />
              <h2 className="font-semibold text-white/90">Device Preview</h2>
            </div>

            <div className={`w-full flex justify-center transition-opacity duration-300 ${showPreview ? 'opacity-100' : 'opacity-40'}`}>
              <MobilePreview title={title} body={body} imageUrl={imageUrl || undefined} />
            </div>

            {!showPreview && (
              <p className="text-center text-xs text-white/25 mt-4">
                Start typing to see a live preview
              </p>
            )}
          </div>
        </div>

        {/* ── History card ── */}
        <div
          className="rounded-2xl border border-white/[0.07] p-6 space-y-4"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <Film className="h-4 w-4 text-violet-400" />
              <h2 className="font-semibold text-white/90">Notification History</h2>
            </div>
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-violet-300"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              <Bell className="h-3 w-3" />
              {notifications.length} total
            </div>
          </div>

          {/* List */}
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400/60" />
              <p className="text-sm text-white/25">Loading history…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.12)',
                }}
              >
                <Bell className="h-7 w-7 text-violet-400/40" />
              </div>
              <div>
                <p className="text-white/40 font-medium">No notifications yet</p>
                <p className="text-white/20 text-sm mt-1">Compose your first message above</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <HistoryItem
                  key={n.id}
                  n={n}
                  deletingId={deletingId}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
