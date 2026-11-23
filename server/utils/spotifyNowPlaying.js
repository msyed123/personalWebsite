// Isolated Spotify client, so auth failures and playback fallbacks can be tested
// without running a Nuxt server. Never send provider tokens or raw errors to clients.
const problem = (code, error) => ({ code, error })

const unauthorized = problem(
  'REAUTHORIZE',
  'Spotify authorization expired. Site owner: run spotify connect to reconnect.'
)

const unavailable = problem(
  'UPSTREAM',
  'Spotify is temporarily unavailable. Try again later.'
)

async function readJson(response) {
  try { return await response.json() } catch { return null }
}

function apiProblem(status) {
  if (status === 401 || status === 403) {
    return problem('ACCESS_DENIED', 'Spotify denied access. The site owner may need to reconnect Spotify.')
  }
  if (status === 429) {
    return problem('RATE_LIMITED', 'Spotify is rate-limiting requests. Try again later.')
  }
  return unavailable
}

function toTrack(track, isPlaying, progressMs) {
  return {
    isPlaying,
    songTitle: track.name || '',
    artist: track.artists?.map(artist => artist.name).filter(Boolean).join(', ') || '',
    albumName: track.album?.name || '',
    albumArtUrl: track.album?.images?.[0]?.url || '',
    albumUrl: track.album?.external_urls?.spotify || '',
    songUrl: track.external_urls?.spotify || '',
    progressMs,
    durationMs: track.duration_ms || 0,
    fetchedAt: Date.now()
  }
}

export async function getSpotifyNowPlaying({
  clientId, clientSecret, refreshToken, onRefreshToken, request = fetch
}) {
  if (!clientId || !clientSecret || !refreshToken) {
    return problem('NOT_CONFIGURED', 'Spotify is not configured on this site.')
  }

  try {
    const credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64')
    const grant = await request('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + credentials,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    })
    const tokenData = await readJson(grant)
    if (!grant.ok) {
      if (tokenData?.error === 'invalid_grant') return unauthorized
      if (tokenData?.error === 'invalid_client') {
        return problem('BAD_CREDENTIALS', 'Spotify app credentials are invalid.')
      }
      if (grant.status === 429) return apiProblem(429)
      return unavailable
    }
    if (!tokenData?.access_token) return unavailable
    // Spotify may rotate the token during refresh. Preserve it durably before
    // using the access token so the public card survives future requests.
    if (typeof tokenData.refresh_token === 'string' &&
        tokenData.refresh_token && tokenData.refresh_token !== refreshToken &&
        typeof onRefreshToken === 'function') {
      await onRefreshToken(tokenData.refresh_token)
    }

    const headers = { Authorization: 'Bearer ' + tokenData.access_token }
    const current = await request('https://api.spotify.com/v1/me/player/currently-playing', { headers })
    if (current.status !== 204 && !current.ok) return apiProblem(current.status)
    if (current.status === 200) {
      const data = await readJson(current)
      if (data?.item?.type === 'track') {
        return toTrack(data.item, data.is_playing === true, data.progress_ms ?? 0)
      }
    }

    // No track currently playing (or an episode): show the latest played track.
    const recent = await request('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers })
    if (!recent.ok) return apiProblem(recent.status)
    const history = await readJson(recent)
    const track = history?.items?.[0]?.track
    if (!track) return problem('NO_TRACK', 'No recent Spotify tracks were found.')
    return toTrack(track, false, null)
  } catch {
    // Do not leak access tokens, upstream response bodies, or app credentials.
    return unavailable
  }
}
