import { NextResponse } from 'next/server'
import { getAppUserCount } from '@/lib/firebase/firestore/users'

// No server-side caching — Firestore count() costs exactly 1 read regardless
// of collection size, so there is no benefit to caching it. We always return
// the live value so the dashboard reflects real-time user registrations.
export async function GET() {
  try {
    const count = await getAppUserCount()

    return NextResponse.json(
      { count },
      // Prevent Vercel's edge cache and the browser from holding a stale count
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('[Users] Error fetching count:', error)
    return NextResponse.json(
      { count: 0 },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
