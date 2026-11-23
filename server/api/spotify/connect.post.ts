import { randomBytes } from 'node:crypto'
import {
  defineEventHandler, getHeader, readFormData, sendRedirect, setCookie, setHeader,
  createError
} from 'h3'
import { renewalStoreReady } from '../../utils/spotifyAuthorizationStore.js'
import {
  spotifyAuthorizeUrl, spotifyRedirectUri, validSpotifyAdminSecret
} from '../../utils/spotifyWebAuth.js'

// POST-only owner action: a secret goes in the HTTPS form body, never in a URL.
// An unrelated visitor may reach the form, but may not initiate account renewal.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  const redirectUri = spotifyRedirectUri()
  const redirect = new URL(redirectUri)
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET ||
      !renewalStoreReady()) {
    throw createError({ statusCode: 503, statusMessage: 'Spotify owner renewal is not configured' })
  }

  // Reject cross-origin POSTs even before examining the owner secret.
  if (getHeader(event, 'origin') !== redirect.origin ||
      getHeader(event, 'host') !== redirect.host) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const length = Number(getHeader(event, 'content-length') || '0')
  // Browser forms include a small Content-Length. Reject unknown/chunked or
  // oversized bodies before attempting FormData parsing.
  if (!Number.isInteger(length) || length < 1 || length > 1024 ||
      !String(getHeader(event, 'content-type') || '').startsWith(
    'application/x-www-form-urlencoded'
  )) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid renewal form' })
  }
  const body = await readFormData(event)
  if (!validSpotifyAdminSecret(body.get('adminSecret'))) {
    // Credential is NEVER echoed, included in a URL, logged, or retained.
    throw createError({ statusCode: 403, statusMessage: 'Owner authentication failed' })
  }
  const state = randomBytes(32).toString('hex')
  setCookie(event, 'spotify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/spotify/callback'
  })
  const url = spotifyAuthorizeUrl({
    state, redirectUri, clientId: process.env.SPOTIFY_CLIENT_ID
  })
  return sendRedirect(event, url, 303)
})
