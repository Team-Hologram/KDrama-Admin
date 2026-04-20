'use client'

import { useState, useEffect } from 'react'
import { Bell, Send, Trash2, Image, Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
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
}

interface SendResult {
  success: boolean
  id?: string
  pushed?: number
  failed?: number
  error?: string
}

export default function NotificationsPage() {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sending, setSending]   = useState(false)
  const [result, setResult]     = useState<SendResult | null>(null)

  const [notifications, setNotifications] = useState<SentNotification[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId]         = useState<string | null>(null)

  // Load notification history
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
    if (!confirm('Delete this notification?')) return
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Send Notification</h1>
          <p className="text-sm text-gray-400">Push notifications to all registered devices</p>
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Compose</h2>

        <div className="space-y-2">
          <Label htmlFor="notif-title" className="text-gray-300">Title <span className="text-red-400">*</span></Label>
          <Input
            id="notif-title"
            placeholder="e.g. New Episode Available!"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 text-right">{title.length}/100</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notif-body" className="text-gray-300">Message <span className="text-red-400">*</span></Label>
          <Textarea
            id="notif-body"
            placeholder="Write your notification message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            rows={4}
            className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-gray-500 text-right">{body.length}/300</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notif-image" className="text-gray-300 flex items-center gap-2">
            <Image className="h-4 w-4" /> Image URL <span className="text-gray-500 font-normal">(optional)</span>
          </Label>
          <Input
            id="notif-image"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 focus:border-blue-500"
          />
        </div>

        {/* Preview */}
        {(title || body) && (
          <div className="rounded-lg border border-gray-600 bg-gray-900 p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Preview</p>
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600">
                <Bell className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-white text-sm truncate">{title || 'Title'}</p>
                <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{body || 'Message'}</p>
              </div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover border border-gray-600"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-start gap-3 rounded-lg p-4 ${
            result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
          }`}>
            {result.success
              ? <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
              : <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            }
            <div>
              {result.success ? (
                <>
                  <p className="text-green-400 font-medium">Notification sent!</p>
                  <p className="text-green-300/70 text-sm mt-0.5">
                    Delivered to {result.pushed} device{result.pushed !== 1 ? 's' : ''}
                    {result.failed ? ` · ${result.failed} failed` : ''}
                  </p>
                </>
              ) : (
                <p className="text-red-400">{result.error ?? 'Failed to send'}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>Sends to all registered devices</span>
          </div>
          <Button
            onClick={handleSend}
            disabled={!isFormValid || sending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[120px]"
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4" /> Send</>
            )}
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Sent Notifications</h2>
          <span className="inline-flex items-center rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-300">
            {notifications.length} total
          </span>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-gray-400">No notifications sent yet</p>
            <p className="text-gray-500 text-sm mt-1">Compose your first notification above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-4 rounded-lg border border-gray-700 bg-gray-900 p-4 group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20">
                  <Bell className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white text-sm truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 shrink-0 mt-0.5">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{n.body}</p>
                  {n.imageUrl && (
                    <p className="text-xs text-blue-400 mt-1 truncate">📎 {n.imageUrl}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-opacity"
                  onClick={() => handleDelete(n.id)}
                  disabled={deletingId === n.id}
                >
                  {deletingId === n.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />
                  }
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
