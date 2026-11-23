import test from 'node:test'
import assert from 'node:assert/strict'
import { getSpotifyNowPlaying } from '../server/utils/spotifyNowPlaying.js'

const credentials = {
  clientId: 'sample-client',
  clientSecret: 'sample-secret',
  refreshToken: 'sample-refresh'
}
const reply = (status, body) => new Response(
  status === 204 ? null : JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } }
)
const track = {
  type: 'track',
  name: 'A Track',
  artists: [{ name: 'An Artist' }],
  album: { name: 'An Album', images: [{ url: 'https://example.test/cover.png' }],
    external_urls: { spotify: 'https://open.spotify.com/album/test' } },
  external_urls: { spotify: 'https://open.spotify.com/track/test' },
  duration_ms: 200000
}

test('missing server secrets produces a safe configuration error', async () => {
  const result = await getSpotifyNowPlaying({ request: () => { throw Error('must not fetch') } })
  assert.equal(result.code, 'NOT_CONFIGURED')
  assert.match(result.error, /not configured/i)
})

test('expired refresh token requests owner reauthorization, never retries', async () => {
  const calls = []
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async (url, options) => {
      calls.push({ url, body: options.body })
      return reply(400, { error: 'invalid_grant', error_description: 'secret upstream details' })
    }
  })
  assert.equal(result.code, 'REAUTHORIZE')
  assert.match(result.error, /reconnect/i)
  assert.doesNotMatch(JSON.stringify(result), /secret upstream details|sample-refresh/)
  assert.equal(calls.length, 1)
  assert.match(calls[0].body, /grant_type=refresh_token/)
})

test('currently playing returns all fields expected by the Spotify card', async () => {
  const urls = []
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async url => {
      urls.push(url)
      if (url.includes('/api/token')) return reply(200, { access_token: 'private-access' })
      return reply(200, { item: track, is_playing: true, progress_ms: 42000 })
    }
  })
  assert.equal(result.isPlaying, true)
  assert.equal(result.songTitle, 'A Track')
  assert.equal(result.artist, 'An Artist')
  assert.equal(result.progressMs, 42000)
  assert.equal(result.albumArtUrl, 'https://example.test/cover.png')
  assert.equal(urls.length, 2)
})

test('no current playback falls back to recently played with null progress', async () => {
  let n = 0
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async () => {
      n++
      if (n === 1) return reply(200, { access_token: 'private-access' })
      if (n === 2) return reply(204)
      return reply(200, { items: [{ track }] })
    }
  })
  assert.equal(n, 3)
  assert.equal(result.isPlaying, false)
  assert.equal(result.progressMs, null)
  assert.equal(result.songTitle, 'A Track')
})

test('denied current playback does not get disguised as an empty track', async () => {
  let n = 0
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async () => {
      n++
      return n === 1 ? reply(200, { access_token: 'private-access' })
        : reply(403, { error: { message: 'private provider response' } })
    }
  })
  assert.equal(result.code, 'ACCESS_DENIED')
  assert.equal(n, 2)
  assert.doesNotMatch(JSON.stringify(result), /private provider response/)
})

test('Spotify rate limiting is reported without automatic retry', async () => {
  let n = 0
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async () => {
      n++
      return n === 1 ? reply(200, { access_token: 'private-access' })
        : reply(429, { error: { reason: 'QUOTA_EXCEEDED' } })
    }
  })
  assert.equal(result.code, 'RATE_LIMITED')
  assert.equal(n, 2)
})

test('network failures do not disclose raw errors', async () => {
  const result = await getSpotifyNowPlaying({
    ...credentials,
    request: async () => { throw new Error('private network credentials') }
  })
  assert.equal(result.code, 'UPSTREAM')
  assert.doesNotMatch(JSON.stringify(result), /private network credentials/)
})
