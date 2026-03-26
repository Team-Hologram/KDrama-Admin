import { NextRequest, NextResponse } from 'next/server'
import { getAuthUrl, getTokensFromCode } from '@/lib/google/drive'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const redirectUri = `${request.nextUrl.origin}/api/upload/auth`

  // If code is present, exchange it for tokens
  if (code) {
    try {
      const tokens = await getTokensFromCode(code, redirectUri)
      
      // Return HTML that sends token to parent window
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Drive Authentication</title>
          </head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'DRIVE_AUTH_SUCCESS',
                token: '${tokens.access_token}'
              }, '*');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `
      
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to get tokens' },
        { status: 500 }
      )
    }
  }

  // Otherwise, return the auth URL
  const authUrl = getAuthUrl(redirectUri)
  return NextResponse.json({ authUrl })
}
