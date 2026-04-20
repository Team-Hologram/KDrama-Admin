import { db } from '../admin'

const SETTINGS_DOC = 'settings/app'

/**
 * Bumps catalogUpdatedAt to now in settings/app.
 * Call this after any create/update/delete on media or episodes.
 * The mobile app's MediaProvider listens to this field and fetches
 * fresh media only when it changes — keeping Firestore reads minimal.
 */
export async function bumpCatalogVersion(): Promise<void> {
  await db.doc(SETTINGS_DOC).set(
    { catalogUpdatedAt: Date.now() },
    { merge: true }
  )
}

/**
 * Bumps notificationsUpdatedAt to now in settings/app.
 * Call this after sending or deleting a notification.
 * The mobile app's NotificationContext listens to this field and fetches
 * fresh notifications only when it changes.
 */
export async function bumpNotificationsVersion(): Promise<void> {
  await db.doc(SETTINGS_DOC).set(
    { notificationsUpdatedAt: Date.now() },
    { merge: true }
  )
}
