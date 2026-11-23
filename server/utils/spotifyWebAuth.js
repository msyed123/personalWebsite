// All checks here run on the server. The browser never handles a client secret,
// access token, refresh token, or Redis credential.
export function spotifyRedirectUri() {
  const value = process.env.SPOTIFY_WEB_REDIRECT_URI
  if (!value) throw new Error('Spotify website callback is not configured')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.pathname !== '/api/spotify/callback' ||
      url.search || url.hash || url.username || url.password) {
    throw new Error('Spotify website callback must be an exact HTTPS callback URL')
  }
  return url.toString()
}

export const spotifyOAuthBrowserCookie = '__Host-spotify_oauth_browser'

export function spotifyWebRenewalEnabled() {
  return process.env.SPOTIFY_WEB_RENEWAL_ENABLED === 'true' &&
    Boolean(process.env.SPOTIFY_OWNER_ACCOUNT_ID?.trim())
}

export function isSpotifyOwner(accountId, priorAccountId) {
  const owner = process.env.SPOTIFY_OWNER_ACCOUNT_ID
  return Boolean(owner && accountId === owner && (!priorAccountId || priorAccountId === owner))
}

export function spotifyAuthorizeUrl({ state, redirectUri, clientId }) {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'user-read-currently-playing user-read-recently-played user-read-private',
    state,
    show_dialog: 'true'
  }).toString()
  return url.toString()
}

export async function spotifyAuthorizeAccount({
  code, redirectUri, clientId, clientSecret, request = fetch
}) {
  const response = await request('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri
    }).toString(),
    signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new Error('Spotify authorization exchange failed')
  const data = await response.json()
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('Spotify did not return a refresh token')
  }
  // Identify the authenticated account BEFORE storing any credentials. The
  // immutable account_id is preferred to the legacy mutable Spotify user id.
  const profileResponse = await request('https://api.spotify.com/v1/me', {
    headers: { Authorization: 'Bearer ' + data.access_token },
    signal: AbortSignal.timeout(15000)
  })
  if (!profileResponse.ok) throw new Error('Spotify account verification failed')
  const profile = await profileResponse.json()
  if (typeof profile?.account_id !== 'string' || !profile.account_id) {
    throw new Error('Spotify account_id is missing')
  }
  return { refreshToken: data.refresh_token, accountId: profile.account_id }
}

