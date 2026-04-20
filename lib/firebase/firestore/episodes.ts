import { db } from '../admin'
import { bumpCatalogVersion } from './settings'
import { Episode } from '@/types'

/**
 * Get all episodes for a drama (from subcollection)
 */
export async function getEpisodesByDramaId(dramaId: string): Promise<Episode[]> {
  try {
    const snapshot = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .orderBy('episodeNumber', 'asc')
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Episode[]
  } catch (error) {
    console.error('Error fetching episodes:', error)
    throw new Error('Failed to fetch episodes')
  }
}

/**
 * Get single episode
 */
export async function getEpisodeById(dramaId: string, episodeId: string): Promise<Episode | null> {
  try {
    const doc = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .doc(episodeId)
      .get()

    if (!doc.exists) {
      return null
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Episode
  } catch (error) {
    console.error('Error fetching episode:', error)
    throw new Error('Failed to fetch episode')
  }
}

/**
 * Add episode to drama (as subcollection document)
 */
export async function addEpisodeToDrama(
  dramaId: string,
  episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Episode> {
  try {
    const now = new Date().toISOString()

    // Add episode to subcollection
    const episodeRef = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .add({
        ...episode,
        createdAt: now,
        updatedAt: now,
      })

    // Get the newly created episode
    const newEpisodeDoc = await episodeRef.get()
    const newEpisode = {
      id: newEpisodeDoc.id,
      ...newEpisodeDoc.data(),
    } as Episode

    // Update drama's totalEpisodes count
    const episodesSnapshot = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .get()

    await db.collection('media').doc(dramaId).update({
      totalEpisodes: episodesSnapshot.size,
      updatedAt: now,
    })
    await bumpCatalogVersion()
    return newEpisode
  } catch (error) {
    console.error('Error adding episode:', error)
    throw new Error('Failed to add episode')
  }
}

/**
 * Update episode in drama subcollection
 */
export async function updateEpisode(
  dramaId: string,
  episodeId: string,
  data: Partial<Episode>
): Promise<Episode> {
  try {
    const episodeRef = db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .doc(episodeId)

    const episodeDoc = await episodeRef.get()

    if (!episodeDoc.exists) {
      throw new Error('Episode not found')
    }

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    }

    await episodeRef.update(updateData)

    // Update drama's updatedAt
    await db.collection('media').doc(dramaId).update({
      updatedAt: new Date().toISOString(),
    })
    await bumpCatalogVersion()

    const updatedDoc = await episodeRef.get()

    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Episode
  } catch (error) {
    console.error('Error updating episode:', error)
    throw new Error('Failed to update episode')
  }
}

/**
 * Delete episode from drama subcollection
 */
export async function deleteEpisode(dramaId: string, episodeId: string): Promise<void> {
  try {
    // Delete the episode
    await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .doc(episodeId)
      .delete()

    // Update drama's totalEpisodes count
    const episodesSnapshot = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .get()

    await db.collection('media').doc(dramaId).update({
      totalEpisodes: episodesSnapshot.size,
      updatedAt: new Date().toISOString(),
    })
    await bumpCatalogVersion()
  } catch (error) {
    console.error('Error deleting episode:', error)
    throw new Error('Failed to delete episode')
  }
}

/**
 * Batch import episodes
 */
export async function batchAddEpisodes(
  dramaId: string,
  episodes: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  try {
    const batch = db.batch()
    const now = new Date().toISOString()

    episodes.forEach(episode => {
      const episodeRef = db
        .collection('media')
        .doc(dramaId)
        .collection('episodes')
        .doc()

      batch.set(episodeRef, {
        ...episode,
        createdAt: now,
        updatedAt: now,
      })
    })

    await batch.commit()

    // Update drama's totalEpisodes count
    const episodesSnapshot = await db
      .collection('media')
      .doc(dramaId)
      .collection('episodes')
      .get()

    await db.collection('media').doc(dramaId).update({
      totalEpisodes: episodesSnapshot.size,
      updatedAt: now,
    })
    await bumpCatalogVersion()
  } catch (error) {
    console.error('Error batch adding episodes:', error)
    throw new Error('Failed to batch add episodes')
  }
}