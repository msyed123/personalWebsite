import { defineEventHandler } from 'h3'
import { getSpotifyNowPlaying } from '../utils/spotifyNowPlaying.js'

// Only the site owner's authorized Spotify account is queried. OAuth secrets
// and refresh tokens remain server-side, never exposed to public visitors.
export default defineEventHandler(() => getSpotifyNowPlaying({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
}))
