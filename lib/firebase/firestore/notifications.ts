import { db } from '../admin'
import { bumpNotificationsVersion } from './settings'

const COLLECTION = 'notifications'

export interface NotificationPayload {
  title: string
  body: string
  imageUrl?: string
  data?: Record<string, string>
}

export interface StoredNotification extends NotificationPayload {
  id: string
  createdAt: string
}

/**
 * Save a notification to Firestore and bump notificationsUpdatedAt.
 * The mobile app detects the version bump and fetches fresh notifications.
 */
export async function createNotification(
  payload: NotificationPayload
): Promise<StoredNotification> {
  const now = new Date().toISOString()

  const docRef = await db.collection(COLLECTION).add({
    title: payload.title,
    body: payload.body,
    imageUrl: payload.imageUrl ?? null,
    data: payload.data ?? {},
    createdAt: now,
  })

  // Bump version so the mobile app knows to refresh
  await bumpNotificationsVersion()

  return { id: docRef.id, ...payload, createdAt: now }
}

/**
 * Get all notifications (for admin list view), newest first.
 */
export async function getAllNotifications(): Promise<StoredNotification[]> {
  const snapshot = await db
    .collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title ?? '',
    body: doc.data().body ?? '',
    imageUrl: doc.data().imageUrl ?? undefined,
    data: doc.data().data ?? {},
    createdAt: doc.data().createdAt ?? '',
  }))
}

/**
 * Delete a notification and bump the version.
 */
export async function deleteNotification(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete()
  await bumpNotificationsVersion()
}
