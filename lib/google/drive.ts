import { google } from 'googleapis'
import { Readable } from 'stream'
import { DriveFile } from '@/types'

/**
 * Create OAuth2 client
 */
export function createOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_DRIVE_REDIRECT_URI
  )
}

/**
 * Get authorization URL
 */
export function getAuthUrl(redirectUri?: string): string {
  const oauth2Client = createOAuth2Client(redirectUri)
  
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ]

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  })
}

/**
 * Get tokens from authorization code
 */
export async function getTokensFromCode(code: string, redirectUri?: string) {
  const oauth2Client = createOAuth2Client(redirectUri)
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

/**
 * Convert Buffer to Readable Stream
 */
function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable()
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buffer)
  readable.push(null)
  return readable
}

/**
 * Upload file to Google Drive
 */
export async function uploadToDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  accessToken: string
): Promise<DriveFile> {
  try {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Convert buffer to stream
    const fileStream = bufferToStream(file)

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
      },
      media: {
        mimeType: mimeType,
        body: fileStream,
      },
      fields: 'id, name, mimeType, size, createdTime',
    })

    const fileId = response.data.id!

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    // Generate URLs
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
    const previewUrl = `https://drive.google.com/uc?export=preview&id=${fileId}`

    return {
      fileId: fileId,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      size: parseInt(response.data.size || '0'),
      createdTime: response.data.createdTime!,
      downloadUrl,
      previewUrl,
    }
  } catch (error) {
    console.error('Error uploading to Drive:', error)
    throw new Error('Failed to upload file to Google Drive')
  }
}

/**
 * Delete file from Google Drive
 */
export async function deleteFromDrive(fileId: string, accessToken: string): Promise<void> {
  try {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    await drive.files.delete({
      fileId: fileId,
    })
  } catch (error) {
    console.error('Error deleting from Drive:', error)
    throw new Error('Failed to delete file from Google Drive')
  }
}

/**
 * Get file metadata from Google Drive
 */
export async function getFileMetadata(fileId: string, accessToken: string) {
  try {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime',
    })

    return response.data
  } catch (error) {
    console.error('Error fetching file metadata:', error)
    throw new Error('Failed to fetch file metadata')
  }
}

/**
 * List files from Google Drive
 */
export async function listDriveFiles(accessToken: string, pageSize = 10) {
  try {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const response = await drive.files.list({
      pageSize: pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
      orderBy: 'createdTime desc',
    })

    return response.data.files || []
  } catch (error) {
    console.error('Error listing files:', error)
    throw new Error('Failed to list files from Google Drive')
  }
}
