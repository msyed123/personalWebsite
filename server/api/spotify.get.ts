import { defineEventHandler } from 'h3'
import { ofetch } from 'ofetch'

async function getAccessToken (): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN!

  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Token exchange failed ${resp.status}: ${text}`)
  }

  const json = await resp.json() as { access_token: string }
  return json.access_token
}

export default defineEventHandler(async () => {
  try {
    const token = await getAccessToken()
    const headers = { Authorization: `Bearer ${token}` }

    // Try currently playing first
    const cpResp = await ofetch.raw('https://api.spotify.com/v1/me/player/currently-playing', {
      headers,
      ignoreResponseError: true
    })

    // 204 = nothing playing, 200 = data
    if (cpResp.status === 200 && cpResp._data) {
      const data = cpResp._data as any
      const track = data.item

      if (track && track.type === 'track') {
        return {
          isPlaying: data.is_playing === true,
          songTitle: track.name,
          artist: track.artists?.map((a: any) => a.name).join(', ') ?? '',
          albumName: track.album?.name ?? '',
          albumArtUrl: track.album?.images?.[0]?.url ?? '',
          albumUrl: track.album?.external_urls?.spotify ?? '',
          songUrl: track.external_urls?.spotify ?? '',
          progressMs: data.progress_ms ?? 0,
          durationMs: track.duration_ms ?? 0,
          fetchedAt: Date.now()
        }
      }
    }

    // Fallback: recently played
    const rpResp = await ofetch<any>('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers })
    const item = rpResp?.items?.[0]?.track

    if (!item) return { error: 'No recent tracks found.' }

    return {
      isPlaying: false,
      songTitle: item.name,
      artist: item.artists?.map((a: any) => a.name).join(', ') ?? '',
      albumName: item.album?.name ?? '',
      albumArtUrl: item.album?.images?.[0]?.url ?? '',
      albumUrl: item.album?.external_urls?.spotify ?? '',
      songUrl: item.external_urls?.spotify ?? '',
      progressMs: null,
      durationMs: item.duration_ms ?? 0,
      fetchedAt: Date.now()
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: 'Spotify API error', detail: msg }
  }
})
