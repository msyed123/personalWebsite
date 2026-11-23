import {
  defineEventHandler, getHeader, sendRedirect, setCookie, setHeader,
  createError
} from 'h3'
import { allowSpotifyRenewalAttempt, beginSpotifyTransaction, renewalStoreReady, spotifyTransactionLifetime } from '../../utils/spotifyAuthorizationStore.js'
import {
  spotifyAuthorizeUrl, spotifyOAuthBrowserCookie, spotifyRedirectUri, spotifyWebRenewalEnabled
} from '../../utils/spotifyWebAuth.js'

// Anyone may start an enabled flow; only the pinned Spotify owner may finish it.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  if (!spotifyWebRenewalEnabled() || !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET ||
      !renewalStoreReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Spotify owner renewal is not configured' })
  }

  const redirectUri = spotifyRedirectUri()
  const redirect = new URL(redirectUri)
  // Reject cross-origin browser POSTs before touching Redis.
  if (getHeader(event, 'origin') !== redirect.origin ||
      getHeader(event, 'host') !== redirect.host) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const allowed = await allowSpotifyRenewalAttempt('start').catch(() => {
    throw createError({ statusCode: 503, statusMessage: 'Spotify renewal storage unavailable' })
  })
  if (!allowed) {
    setHeader(event, 'Retry-After', String(spotifyTransactionLifetime))
    throw createError({ statusCode: 429, statusMessage: 'Too many Spotify connection attempts' })
  }
  const { state, browser } = await beginSpotifyTransaction().catch(() => {
    throw createError({ statusCode: 503, statusMessage: 'Spotify renewal storage unavailable' })
  })
  setCookie(event, spotifyOAuthBrowserCookie, browser, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: spotifyTransactionLifetime,
    path: '/'
  })
  const url = spotifyAuthorizeUrl({
    state, redirectUri, clientId: process.env.SPOTIFY_CLIENT_ID
  })
  return sendRedirect(event, url, 303)
})

