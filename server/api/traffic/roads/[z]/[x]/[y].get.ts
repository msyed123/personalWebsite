import { fetchTomTomRoadTile } from '~/server/utils/traffic/tomtom'

// A provider-independent GeoJSON road-tile endpoint. Replace the adapter, not the frontend.
const cachedRoadTile = defineCachedFunction(async (z: number, x: number, y: number) => {
  const key = useRuntimeConfig().tomtomTrafficKey
  if (!key) throw new Error('Traffic provider not configured')
  return fetchTomTomRoadTile(z, x, y, key)
}, {
  name: 'traffic-roads-v1',
  maxAge: 180,
  getKey: (z: number, x: number, y: number) => `${z}/${x}/${y}`
})

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).tomtomTrafficKey) {
    throw createError({ statusCode: 503, statusMessage: 'Road traffic not configured' })
  }
  const coords = ['z', 'x', 'y'].map((param) => getRouterParam(event, param))
  const isUnsignedInteger = (v: string | undefined) =>
    typeof v === 'string' && v.length > 0 &&
    [...v].every((character) => character >= '0' && character <= '9')
  if (coords.some((v) => !isUnsignedInteger(v))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tile coordinate' })
  }
  const [z, x, y] = coords.map(Number)
  if (!Number.isInteger(z) || z < 6 || z > 13 ||
      !Number.isSafeInteger(x) || x >= 2 ** z ||
      !Number.isSafeInteger(y) || y >= 2 ** z) {
    throw createError({ statusCode: 400, statusMessage: 'Tile out of bounds' })
  }
  try {
    const tile = await cachedRoadTile(z, x, y)
    setHeader(event, 'Cache-Control', 'public, max-age=180, stale-while-revalidate=60')
    return tile
  } catch (error: any) {
    // Send only a safe failure category. Never expose the TomTom key, full
    // provider URL, or raw upstream response to public visitors.
    const message = String(error?.message || '')
    const upstream = /TomTom traffic request failed: HTTP (\\d{3})/.exec(message)
    const upstreamStatus = upstream ? Number(upstream[1]) : null
    const category = upstreamStatus === 401 || upstreamStatus === 403
      ? 'AUTHORIZATION'
      : upstreamStatus === 429
      ? 'RATE_LIMIT'
      : upstreamStatus !== null
      ? 'UPSTREAM_HTTP_' + upstreamStatus
      : message.includes('unexpected tile format')
      ? 'INVALID_TILE_FORMAT'
      : message.includes('exceeds size limit')
      ? 'OVERSIZE_TILE'
      : error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'TIMEOUT'
      : 'TILE_DECODING_OR_NETWORK'
    console.warn('[TRAFFIC] TomTom request unavailable', { category, z, x, y })
    throw createError({
      statusCode: 502,
      statusMessage: 'Road traffic ' + category
    })
  }
})
