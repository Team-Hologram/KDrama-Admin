import { db } from '../admin'
import { bumpCatalogVersion } from './settings'
import { Drama } from '@/types'

const COLLECTION = 'media'
const DRAMA_TYPE = 'drama'

/**
 * Get all dramas (without episodes)
 */
export async function getAllDramas(): Promise<Drama[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('type', '==', DRAMA_TYPE)
      .get()
    
    // Sort in memory instead of in Firestore
    const docs = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => {
        const aDate = new Date(a.createdAt || 0).getTime()
        const bDate = new Date(b.createdAt || 0).getTime()
        return bDate - aDate
      })
    
    return docs as Drama[]
  } catch (error) {
    console.error('Error fetching dramas:', error)
    throw new Error('Failed to fetch dramas')
  }
}

/**
 * Get drama by ID (without episodes)
 */
export async function getDramaById(id: string): Promise<Drama | null> {
  try {
    const doc = await db.collection(COLLECTION).doc(id).get()
    
    if (!doc.exists) {
      return null
    }

    const data = doc.data()
    
    // Check if document is actually a drama
    if (data?.type !== DRAMA_TYPE) {
      return null
    }

    return {
      id: doc.id,
      ...data,
    } as Drama
  } catch (error) {
    console.error('Error fetching drama:', error)
    throw new Error('Failed to fetch drama')
  }
}

/**
 * Create new drama
 */
export async function createDrama(
  data: Omit<Drama, 'id' | 'createdAt' | 'updatedAt' | 'views'>
): Promise<Drama> {
  try {
    const now = new Date().toISOString()
    const docRef = await db.collection(COLLECTION).add({
      ...data,
      type: DRAMA_TYPE,
      views: 0,
      completed: data.completed ?? false,
      totalEpisodes: data.totalEpisodes ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    
    const newDoc = await docRef.get()
    await bumpCatalogVersion()
    return {
      id: newDoc.id,
      ...newDoc.data(),
    } as Drama
  } catch (error) {
    console.error('Error creating drama:', error)
    throw new Error('Failed to create drama')
  }
}

/**
 * Update drama
 */
export async function updateDrama(id: string, data: Partial<Drama>): Promise<Drama> {
  try {
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()
    
    if (!doc.exists) {
      throw new Error('Drama not found')
    }

    // Verify it's a drama
    if (doc.data()?.type !== DRAMA_TYPE) {
      throw new Error('Document is not a drama')
    }

    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    }
    
    // Remove type from update to prevent changing it
    delete updateData.type

    await docRef.update(updateData)
    const updatedDoc = await docRef.get()
    await bumpCatalogVersion()
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Drama
  } catch (error) {
    console.error('Error updating drama:', error)
    throw new Error('Failed to update drama')
  }
}

/**
 * Delete drama and all its episodes
 */
export async function deleteDrama(id: string): Promise<void> {
  try {
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      throw new Error('Drama not found')
    }

    // Verify it's a drama
    if (doc.data()?.type !== DRAMA_TYPE) {
      throw new Error('Document is not a drama')
    }

    const batch = db.batch()
    
    // Delete all episodes in subcollection
    const episodesSnapshot = await docRef.collection('episodes').get()
    
    episodesSnapshot.docs.forEach(episodeDoc => {
      batch.delete(episodeDoc.ref)
    })
    
    // Delete the drama document
    batch.delete(docRef)
    await batch.commit()
    await bumpCatalogVersion()
  } catch (error) {
    console.error('Error deleting drama:', error)
    throw new Error('Failed to delete drama')
  }
}

/**
 * Get trending dramas
 */
export async function getTrendingDramas(): Promise<Drama[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('type', '==', DRAMA_TYPE)
      .where('trending', '==', true)
      .orderBy('views', 'desc')
      .limit(10)
      .get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Drama[]
  } catch (error) {
    console.error('Error fetching trending dramas:', error)
    throw new Error('Failed to fetch trending dramas')
  }
}
