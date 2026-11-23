import { defineEventHandler } from 'h3'
import { getSpotifyNowPlaying } from '../utils/spotifyNowPlaying.js'
import {
  renewalStoreReady, readSpotifyAuthorization, writeSpotifyAuthorization
} from '../utils/spotifyAuthorizationStore.js'

// Public endpoint: only playback metadata may leave the server.
// The owner refresh token is loaded from encrypted durable storage when
// configured, with the original Heroku env var as a migration fallback.
export default defineEventHandler(async () => {
  let stored = null
  try {
    if (renewalStoreReady()) stored = await readSpotifyAuthorization()
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
          const latest = await readSpotifyAuthorization()
          if (latest && latest.refreshToken === stored.refreshToken) {
            await writeSpotifyAuthorization({ ...latest, refreshToken: token })
          }
        }
      : undefined
  })
})
