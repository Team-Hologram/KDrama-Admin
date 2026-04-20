import { db } from '../admin'
import { bumpCatalogVersion } from './settings'
import { Movie } from '@/types'

const COLLECTION = 'media'
const MOVIE_TYPE = 'movie'

/**
 * Get all movies
 */
export async function getAllMovies(): Promise<Movie[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('type', '==', MOVIE_TYPE)
      .get()
    
    // Sort in memory to avoid needing composite index
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
    
    return docs as Movie[]
  } catch (error) {
    console.error('Error fetching movies:', error)
    throw new Error('Failed to fetch movies')
  }
}

/**
 * Get movie by ID
 */
export async function getMovieById(id: string): Promise<Movie | null> {
  try {
    const doc = await db.collection(COLLECTION).doc(id).get()
    
    if (!doc.exists) {
      return null
    }

    const data = doc.data()
    
    // Check if document is actually a movie
    if (data?.type !== MOVIE_TYPE) {
      return null
    }

    return {
      id: doc.id,
      ...data,
    } as Movie
  } catch (error) {
    console.error('Error fetching movie:', error)
    throw new Error('Failed to fetch movie')
  }
}

/**
 * Create new movie
 */
export async function createMovie(
  data: Omit<Movie, 'id' | 'createdAt' | 'updatedAt' | 'views'>
): Promise<Movie> {
  try {
    const now = new Date().toISOString()
    const docRef = await db.collection(COLLECTION).add({
      ...data,
      type: MOVIE_TYPE,
      views: 0,
      createdAt: now,
      updatedAt: now,
    })

    const newDoc = await docRef.get()
    await bumpCatalogVersion()
    return {
      id: newDoc.id,
      ...newDoc.data(),
    } as Movie
  } catch (error) {
    console.error('Error creating movie:', error)
    throw new Error('Failed to create movie')
  }
}

/**
 * Update movie
 */
export async function updateMovie(id: string, data: Partial<Movie>): Promise<Movie> {
  try {
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      throw new Error('Movie not found')
    }

    // Verify it's a movie
    if (doc.data()?.type !== MOVIE_TYPE) {
      throw new Error('Document is not a movie')
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
    } as Movie
  } catch (error) {
    console.error('Error updating movie:', error)
    throw new Error('Failed to update movie')
  }
}

/**
 * Delete movie
 */
export async function deleteMovie(id: string): Promise<void> {
  try {
    const docRef = db.collection(COLLECTION).doc(id)
    const doc = await docRef.get()

    if (!doc.exists) {
      throw new Error('Movie not found')
    }

    // Verify it's a movie
    if (doc.data()?.type !== MOVIE_TYPE) {
      throw new Error('Document is not a movie')
    }

    await docRef.delete()
    await bumpCatalogVersion()
  } catch (error) {
    console.error('Error deleting movie:', error)
    throw new Error('Failed to delete movie')
  }
}

/**
 * Get trending movies
 */
export async function getTrendingMovies(): Promise<Movie[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('type', '==', MOVIE_TYPE)
      .where('trending', '==', true)
      .get()

    // Sort in memory to avoid composite index requirement
    const docs = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)

    return docs as Movie[]
  } catch (error) {
    console.error('Error fetching trending movies:', error)
    throw new Error('Failed to fetch trending movies')
  }
}

/**
 * Search movies
 */
export async function searchMovies(query: string): Promise<Movie[]> {
  try {
    const snapshot = await db
      .collection(COLLECTION)
      .where('type', '==', MOVIE_TYPE)
      .get()
    
    const movies = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Movie[]

    return movies.filter(movie => 
      movie.title.toLowerCase().includes(query.toLowerCase()) ||
      movie.titleSinhala?.toLowerCase().includes(query.toLowerCase())
    )
  } catch (error) {
    console.error('Error searching movies:', error)
    throw new Error('Failed to search movies')
  }
}