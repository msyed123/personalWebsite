#!/usr/bin/env node
// One-time, LOCAL owner-only OAuth renewal. This is not a public site route.
// Never paste the resulting refresh token into an issue, PR, or chat.
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback'
const redirect = new URL(redirectUri)

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET locally before running this script.')
  process.exit(1)
}
if (redirect.protocol !== 'http:' || redirect.hostname !== '127.0.0.1' ||
    !redirect.port || !redirect.pathname || redirect.search || redirect.hash ||
    redirect.username || redirect.password) {
  console.error('Use a loopback callback, e.g. http://127.0.0.1:8888/callback.')
  process.exit(1)
}

const state = randomBytes(24).toString('hex')
const authUrl = new URL('https://accounts.spotify.com/authorize')
authUrl.search = new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: redirectUri,
  scope: 'user-read-currently-playing user-read-recently-played',
  state,
  show_dialog: 'true'
}).toString()

let finished = false
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', redirectUri)
  if (req.method !== 'GET' || url.pathname !== redirect.pathname) {
    res.writeHead(404).end('Not found')
    return
  }
  if (finished) {
    res.writeHead(409).end('Authorization already handled')
    return
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(403).end('OAuth state mismatch')
    return
  }

  finished = true
  try {
    if (url.searchParams.get('error')) {
      throw new Error('Authorization denied: ' + url.searchParams.get('error'))
    }
    const code = url.searchParams.get('code')
    if (!code) throw new Error('Missing Spotify authorization code')
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    })
    const json = await response.json()
    if (!response.ok || !json.refresh_token) {
      throw new Error('Spotify did not issue a refresh token (HTTP ' + response.status + ')')
    }
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end('Spotify reauthorized. Close this tab and return to your local terminal.')
    console.log('\nNEW SPOTIFY_REFRESH_TOKEN (keep private):\n' + json.refresh_token)
    console.log('\nReplace SPOTIFY_REFRESH_TOKEN in your Heroku app Config Vars and redeploy/restart.')
    console.log('This authorization is valid for six months. Do not commit this token.')
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end('Authorization failed. See the local terminal.')
    console.error(error.message)
  } finally {
    server.close()
  }
})

server.on('error', error => {
  console.error('Could not start local callback server:', error.message)
  process.exitCode = 1
})
server.listen(Number(redirect.port), '127.0.0.1', () => {
  console.log('Register this exact callback in your Spotify app settings: ' + redirectUri)
  console.log('\nOpen the following Spotify login URL in a browser on THIS computer:\n')
  console.log(authUrl.toString())
  console.log('\nAfter approving, the new token is printed here, not in your browser.')
})
setTimeout(() => {
  if (!finished) {
    console.error('Timed out waiting for Spotify authorization. Run the script again.')
    server.close()
  }
}, 10 * 60 * 1000).unref()
