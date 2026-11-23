import {
  defineEventHandler, getCookie, deleteCookie, getQuery, getHeader,
  sendRedirect, setHeader, createError
} from 'h3'
import {
  allowSpotifyRenewalAttempt, consumeSpotifyTransaction, readSpotifyAuthorization, renewalStoreReady, writeSpotifyAuthorization
} from '../../utils/spotifyAuthorizationStore.js'
import {
  isSpotifyOwner, spotifyAuthorizeAccount, spotifyOAuthBrowserCookie, spotifyRedirectUri, spotifyWebRenewalEnabled
} from '../../utils/spotifyWebAuth.js'

// Only the Spotify-issued authorization code comes through this callback.
// No refresh token is ever rendered, returned to the browser, or logged.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store, private')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  if (!spotifyWebRenewalEnabled() || !renewalStoreReady() ||
      !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw createError({ statusCode: 503, statusMessage: 'Spotify owner renewal is not configured' })
  }
  const redirectUri = spotifyRedirectUri()
  if (getHeader(event, 'host') !== new URL(redirectUri).host) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const query = getQuery(event)
  const browser = getCookie(event, spotifyOAuthBrowserCookie)
  const consumed = await consumeSpotifyTransaction(query.state, browser).catch(() => {
    throw createError({ statusCode: 503, statusMessage: 'Spotify renewal storage unavailable' })
  })
  if (!consumed) {
    throw createError({ statusCode: 403, statusMessage: 'Spotify authorization state mismatch' })
  }
  deleteCookie(event, spotifyOAuthBrowserCookie, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' })
  if (query.error) return sendRedirect(event, '/spotify/connect?status=denied', 303)
  if (typeof query.code !== 'string' || !query.code || query.code.length > 4096) {
    return sendRedirect(event, '/spotify/connect?status=failed', 303)
  }
  try {
    if (!await allowSpotifyRenewalAttempt('exchange')) {
      return sendRedirect(event, '/spotify/connect?status=limited', 303)
    }
    const account = await spotifyAuthorizeAccount({
      code: query.code,
      redirectUri,
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    })
    const prior = await readSpotifyAuthorization()
    // A deployment pin must match even on an empty store.
    if (!isSpotifyOwner(account.accountId, prior?.accountId)) {
      return sendRedirect(event, '/spotify/connect?status=wrong-account', 303)
    }
    await writeSpotifyAuthorization(account)
    return sendRedirect(event, '/spotify/connect?status=connected', 303)
  } catch {
    // Upstream errors / storage failures are deliberately not exposed.
    return sendRedirect(event, '/spotify/connect?status=failed', 303)
  }
})

