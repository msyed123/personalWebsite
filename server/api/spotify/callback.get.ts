import {
  defineEventHandler, getCookie, deleteCookie, getQuery, getHeader,
  sendRedirect, setHeader, createError
} from 'h3'
import {
  readSpotifyAuthorization, writeSpotifyAuthorization
} from '../../utils/spotifyAuthorizationStore.js'
import {
  spotifyAuthorizeAccount, spotifyRedirectUri, validOAuthState
} from '../../utils/spotifyWebAuth.js'

// Only the Spotify-issued authorization code comes through this callback.
// No refresh token is ever rendered, returned to the browser, or logged.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store, private')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const redirectUri = spotifyRedirectUri()
  if (getHeader(event, 'host') !== new URL(redirectUri).host) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const query = getQuery(event)
  const expected = getCookie(event, 'spotify_oauth_state')
  deleteCookie(event, 'spotify_oauth_state', { path: '/api/spotify/callback' })
  if (!validOAuthState(query.state, expected)) {
    throw createError({ statusCode: 403, statusMessage: 'Spotify authorization state mismatch' })
  }
  if (query.error) return sendRedirect(event, '/spotify/connect?status=denied', 303)
  if (typeof query.code !== 'string' || !query.code || query.code.length > 4096) {
    return sendRedirect(event, '/spotify/connect?status=failed', 303)
  }
  try {
    const account = await spotifyAuthorizeAccount({
      code: query.code,
      redirectUri,
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    })
    const prior = await readSpotifyAuthorization()
    const owner = process.env.SPOTIFY_OWNER_ACCOUNT_ID
    // The first successful, secret-authenticated link pins this Spotify
    // account. Subsequent renewals cannot replace it with another account.
    if ((owner && owner !== account.accountId) ||
        (prior?.accountId && prior.accountId !== account.accountId)) {
      return sendRedirect(event, '/spotify/connect?status=wrong-account', 303)
    }
    await writeSpotifyAuthorization(account)
    return sendRedirect(event, '/spotify/connect?status=connected', 303)
  } catch {
    // Upstream errors / storage failures are deliberately not exposed.
    return sendRedirect(event, '/spotify/connect?status=failed', 303)
  }
})
