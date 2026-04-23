import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import admin from '@/lib/firebase/admin'
import { db } from '@/lib/firebase/admin'
import { createNotification, NotificationPayload } from '@/lib/firebase/firestore/notifications'

/**
 * POST /api/notifications/send
 *
 * Collects FCM tokens → sends multicast → saves notification to Firestore with
 * real delivery stats (totalDevices, pushed, failed).
 * Automatically bumps notificationsUpdatedAt so the mobile app updates its cache.
 *
 * Body: { title, body, imageUrl?, data? }
 */
export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allowedEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  if (!allowedEmails.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as NotificationPayload & { sendPush?: boolean }
  const { title, body: notifBody, imageUrl, data, sendPush = true } = body

  if (!title?.trim() || !notifBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  try {
    // 1. Collect all FCM tokens from Firestore
    const tokensSnapshot = await db.collection('fcmTokens').get()
    const tokens = tokensSnapshot.docs.map((d) => d.data().token as string).filter(Boolean)
    const totalDevices = tokens.length

    if (!sendPush || tokens.length === 0) {
      const stored = await createNotification(
        { title, body: notifBody, imageUrl, data },
        { totalDevices, pushed: 0, failed: 0 }
      )
      return NextResponse.json({
        success: true,
        id: stored.id,
        totalDevices,
        pushed: 0,
        failed: 0,
        message: tokens.length === 0 ? 'No tokens registered' : undefined,
      })
    }

    // 2. Build FCM message template (notificationId patched after save)
    const messageTpl: Omit<admin.messaging.MulticastMessage, 'tokens'> = {
      notification: {
        title,
        body: notifBody,
        ...(imageUrl ? { imageUrl } : {}),
      },
      data: {
        alreadySaved: 'true', // tells the mobile app not to re-save to Firestore
        ...(data ?? {}),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'general',
          sound: 'default',
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    }

    // 3. Send to all tokens in batches of 500 (FCM limit)
    const BATCH_SIZE = 500
    let successCount = 0
    let failureCount = 0
    const invalidTokens: string[] = []

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE)
      const batchMessage = { ...messageTpl, tokens: batch }
      const response = await admin.messaging().sendEachForMulticast(batchMessage)

      successCount += response.successCount
      failureCount += response.failureCount

      // Collect invalid/expired tokens for cleanup
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r.error?.code
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(batch[idx])
          }
        }
      })
    }

    // 4. Save to Firestore now that we have real stats
    const stored = await createNotification(
      { title, body: notifBody, imageUrl, data },
      { totalDevices, pushed: successCount, failed: failureCount }
    )

    // 5. Clean up invalid tokens (fire-and-forget)
    if (invalidTokens.length > 0) {
      const cleanupBatch = db.batch()
      const tokenDocs = await db
        .collection('fcmTokens')
        .where('token', 'in', invalidTokens.slice(0, 30)) // Firestore 'in' limit
        .get()
      tokenDocs.docs.forEach((d) => cleanupBatch.delete(d.ref))
      cleanupBatch.commit().catch(console.error)
      console.log(`[FCM] Cleaned up ${invalidTokens.length} invalid tokens`)
    }

    console.log(`[FCM] Sent: success=${successCount} failure=${failureCount} total=${totalDevices}`)

    return NextResponse.json({
      success: true,
      id: stored.id,
      totalDevices,
      pushed: successCount,
      failed: failureCount,
      invalidTokensCleaned: invalidTokens.length,
    })
  } catch (error) {
    console.error('[FCM] Send error:', error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}

/**
 * GET /api/notifications/send
 * Returns list of sent notifications for the admin panel.
 */
export async function GET() {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { getAllNotifications } = await import('@/lib/firebase/firestore/notifications')
  const notifications = await getAllNotifications()
  return NextResponse.json({ notifications })
}

/**
 * DELETE /api/notifications/send?id=<notificationId>
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { deleteNotification } = await import('@/lib/firebase/firestore/notifications')
  await deleteNotification(id)
  return NextResponse.json({ success: true })
}
