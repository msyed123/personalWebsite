import test from 'node:test'
import assert from 'node:assert/strict'
import {
  renewalStoreReady, readSpotifyAuthorization, writeSpotifyAuthorization
} from '../server/utils/spotifyAuthorizationStore.js'
import {
  spotifyRedirectUri, validSpotifyAdminSecret, validOAuthState,
  spotifyAuthorizeUrl, spotifyAuthorizeAccount
} from '../server/utils/spotifyWebAuth.js'

const original = { ...process.env }
const restore = () => {
  for (const key of [
    'SPOTIFY_ADMIN_SECRET', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_WEB_REDIRECT_URI',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
    'SPOTIFY_TOKEN_ENCRYPTION_KEY'
  ]) {
    if (original[key] === undefined) delete process.env[key]
    else process.env[key] = original[key]
  }
}
const setup = () => {
  process.env.SPOTIFY_ADMIN_SECRET = 'owner-key-'+ 'x'.repeat(48)
  process.env.SPOTIFY_CLIENT_SECRET = 'spotify-client-secret'
  process.env.SPOTIFY_WEB_REDIRECT_URI = 'https://personal.example/api/spotify/callback'
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'server-only-redis-token'
  process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64)
}
const mockStore = () => {
  let saved = null
  let calls = 0
  return {
    request: async (url, init) => {
      calls++
      assert.equal(url, 'https://example.upstash.io/')
      assert.equal(init.headers.Authorization, 'Bearer server-only-redis-token')
      const [command, key, value] = JSON.parse(init.body)
      assert.match(key, /spotify/)
      if (command === 'SET') {
        saved = value
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 })
      }
      if (command === 'GET') {
        return new Response(JSON.stringify({ result: saved }), { status: 200 })
      }
      throw new Error('Unexpected Redis command')
    },
    get saved() { return saved },
    get calls() { return calls }
  }
}

test('owner setup is mandatory and insecure callback configuration rejected', () => {
  restore()
  delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY
  assert.equal(renewalStoreReady(), false)
  setup()
  assert.equal(renewalStoreReady(), true)
  assert.equal(spotifyRedirectUri(), 'https://personal.example/api/spotify/callback')
  process.env.SPOTIFY_WEB_REDIRECT_URI = 'http://personal.example/api/spotify/callback'
  assert.throws(spotifyRedirectUri, /HTTPS/)
  restore()
})

test('owner secret and OAuth state are checked without exposing input', () => {
  setup()
  assert.equal(validSpotifyAdminSecret(process.env.SPOTIFY_ADMIN_SECRET), true)
  assert.equal(validSpotifyAdminSecret('a'.repeat(64)), false)
  assert.equal(validOAuthState('a'.repeat(64), 'a'.repeat(64)), true)
  assert.equal(validOAuthState('a'.repeat(64), 'b'.repeat(64)), false)
  assert.equal(validOAuthState('a'.repeat(32), 'a'.repeat(32)), false)
  const auth = new URL(spotifyAuthorizeUrl({
    state: 'a'.repeat(64),
    redirectUri: spotifyRedirectUri(),
    clientId: 'client-id'
  }))
  assert.equal(auth.origin, 'https://accounts.spotify.com')
  assert.match(auth.searchParams.get('scope'), /user-read-private/)
  assert.equal(auth.searchParams.get('state'), 'a'.repeat(64))
  assert.equal(auth.searchParams.get('redirect_uri'), spotifyRedirectUri())
  restore()
})

test('stored token is AES-GCM encrypted and remains available after re-reading', async () => {
  setup()
  const store = mockStore()
  assert.equal(await readSpotifyAuthorization({ request: store.request }), null)
  await writeSpotifyAuthorization({
    refreshToken: 'SECRET-REFRESH-DO-NOT-LEAK',
    accountId: 'account-123',
    authorizedAt: 12345,
    request: store.request
  })
  assert.doesNotMatch(store.saved, /SECRET-REFRESH|account-123/)
  const read = await readSpotifyAuthorization({ request: store.request })
  assert.deepEqual(read, {
    refreshToken: 'SECRET-REFRESH-DO-NOT-LEAK',
    accountId: 'account-123',
    authorizedAt: 12345
  })
  assert.equal(store.calls, 3)
  restore()
})

test('wrong encryption secret cannot read stored credentials', async () => {
  setup()
  const store = mockStore()
  await writeSpotifyAuthorization({
    refreshToken: 'token', accountId: 'owner', request: store.request
  })
  process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64)
  await assert.rejects(readSpotifyAuthorization({ request: store.request }))
  restore()
})

test('changing owner access key does not lose the encrypted Spotify token', async () => {
  setup()
  const store = mockStore()
  await writeSpotifyAuthorization({
    refreshToken: 'persisted-token', accountId: 'owner', request: store.request
  })
  process.env.SPOTIFY_ADMIN_SECRET = 'new-admin-key-' + 'z'.repeat(48)
  const record = await readSpotifyAuthorization({ request: store.request })
  assert.equal(record.refreshToken, 'persisted-token')
  restore()
})

test('Spotify login verifies immutable account ID before a token can be saved', async () => {
  const visited = []
  const account = await spotifyAuthorizeAccount({
    code: 'short-code',
    redirectUri: 'https://personal.example/api/spotify/callback',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    request: async (url, init) => {
      visited.push(url)
      if (url.includes('accounts.spotify.com')) {
        assert.match(init.body, /grant_type=authorization_code/)
        return new Response(JSON.stringify({
          access_token: 'private-access', refresh_token: 'private-refresh'
        }), { status: 200 })
      }
      assert.equal(init.headers.Authorization, 'Bearer private-access')
      return new Response(JSON.stringify({
        account_id: 'stable-account-123', id: 'mutable-profile-id'
      }), { status: 200 })
    }
  })
  assert.deepEqual(account, {
    refreshToken: 'private-refresh',
    accountId: 'stable-account-123'
  })
  assert.equal(visited.length, 2)
})

test('Spotify identity failure prevents authorization', async () => {
  await assert.rejects(spotifyAuthorizeAccount({
    code: 'short-code', redirectUri: 'https://personal.example/api/spotify/callback',
    clientId: 'client-id', clientSecret: 'client-secret',
    request: async url => url.includes('accounts.spotify.com')
      ? new Response(JSON.stringify({ access_token: 'a', refresh_token: 'b' }), { status: 200 })
      : new Response(JSON.stringify({ id: 'only-legacy-id' }), { status: 200 })
  }), /account_id/)
})
