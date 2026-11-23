import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Persistence is external because Heroku dyno files disappear on restart.
// Every Redis request is server-to-server; never return the Redis API key or
// decrypted refresh token from a public endpoint.
const KEY = 'personalWebsite:spotify:owner-authorization:v1'

function config() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const encryptionKeyHex = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY
  if (!url || !token || !/^[0-9a-f]{64}$/i.test(encryptionKeyHex || '')) {
    throw new Error('Spotify renewal storage is not configured')
  }
  const endpoint = new URL(url)
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw new Error('Invalid Spotify token store URL')
  }
  return { endpoint: endpoint.toString(), token, encryptionKeyHex }
}

export function renewalStoreReady() {
  try { config(); return true } catch { return false }
}

function encryptionKey(settings) {
  // A separate 256-bit key stays fixed when the Spotify client secret or
  // owner login key rotates. Its hex value is server-only and never in Redis.
  return Buffer.from(settings.encryptionKeyHex, 'hex')
}

async function command(args, settings, request) {
  const response = await request(settings.endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + settings.token,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok) throw new Error('Spotify token store unavailable')
  const result = await response.json()
  if (!result || Object.hasOwn(result, 'error')) {
    throw new Error('Spotify token store unavailable')
  }
  return result.result
}

function encrypt(record, settings) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(settings), iv)
  const text = Buffer.from(JSON.stringify(record), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(text), cipher.final()])
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64')
  })
}

function decrypt(blob, settings) {
  const envelope = JSON.parse(blob)
  if (envelope.v !== 1) throw new Error('Unsupported Spotify token record')
  const decipher = createDecipheriv(
    'aes-256-gcm', encryptionKey(settings), Buffer.from(envelope.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'))
  const text = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final()
  ])
  const record = JSON.parse(text.toString('utf8'))
  if (!record || typeof record.refreshToken !== 'string' ||
      typeof record.accountId !== 'string' ||
      !record.accountId || !record.refreshToken) {
    throw new Error('Invalid Spotify token record')
  }
  return record
}

export async function readSpotifyAuthorization({ request = fetch } = {}) {
  const settings = config()
  const blob = await command(['GET', KEY], settings, request)
  if (blob === null) return null
  if (typeof blob !== 'string') throw new Error('Invalid Spotify token store result')
  return decrypt(blob, settings)
}

export async function writeSpotifyAuthorization({
  refreshToken, accountId, authorizedAt = Date.now(), request = fetch
}) {
  if (typeof refreshToken !== 'string' || !refreshToken ||
      typeof accountId !== 'string' || !accountId) {
    throw new Error('Spotify account information missing')
  }
  const settings = config()
  const value = encrypt({ refreshToken, accountId, authorizedAt }, settings)
  const result = await command(['SET', KEY, value], settings, request)
  if (result !== 'OK') throw new Error('Spotify token store unavailable')
  return true
}
