import { defineEventHandler } from 'h3'
import { getSpotifyNowPlaying } from '../utils/spotifyNowPlaying.js'
import {
  renewalStoreReady, readSpotifyAuthorizationSnapshot, rotateSpotifyAuthorization
} from '../utils/spotifyAuthorizationStore.js'

// Public endpoint: only playback metadata may leave the server.
// The owner refresh token is loaded from encrypted durable storage when
// configured, with the original Heroku env var as a migration fallback.
// Coalesce polls within one dyno and briefly cache even upstream failures.
let pending: ReturnType<typeof loadPlayback> | undefined
let cached: Awaited<ReturnType<typeof loadPlayback>> | undefined
let cacheUntil = 0

async function loadPlayback() {
  let stored = null
  try {
    if (renewalStoreReady()) stored = await readSpotifyAuthorizationSnapshot()
  } catch {
    return {
      code: 'STORAGE_UNAVAILABLE',
      error: 'Spotify connection storage is temporarily unavailable.'
    }
  }

  return getSpotifyNowPlaying({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: stored?.refreshToken || process.env.SPOTIFY_REFRESH_TOKEN,
    onRefreshToken: stored
      ? async token => {
          // Provider may rotate a refresh token; retain original six-month
          // authorization timestamp, and never persist a new token from the
          // older Heroku fallback after a website reauthorization.
          await rotateSpotifyAuthorization(stored, token)
        }
      : undefined
  })
}

export default defineEventHandler(async () => {
  if (cached && Date.now() < cacheUntil) return cached
  pending ??= loadPlayback().then(result => {
    cached = result
    cacheUntil = Date.now() + 5000
    return result
  }).finally(() => { pending = undefined })
  return pending
})

