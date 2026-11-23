// TomTom traffic is server-proxied: never expose the API key to the browser.
export default defineEventHandler(async (event) => {
  const key = useRuntimeConfig(event).tomtomTrafficKey
  if (!key) {
    throw createError({ statusCode: 503, statusMessage: 'Traffic feed not configured' })
  }

  const raw = ['z', 'x', 'y'].map((name) => getRouterParam(event, name))
  if (raw.some((value) => !/^\d+$/.test(value || ''))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid tile coordinate' })
  }
  const [z, x, y] = raw.map(Number)
  if (z < 6 || z > 13 || x >= 2 ** z || y >= 2 ** z) {
    throw createError({ statusCode: 400, statusMessage: 'Tile outside supported range' })
  }

  const url = `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/${z}/${x}/${y}?apiVersion=2&style=dark&tileSize=256`
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'TomTom-Api-Key': key, Accept: 'image/png' },
      signal: AbortSignal.timeout(10000)
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Traffic service unavailable' })
  }

  if (!response.ok || !(response.headers.get('content-type') || '').startsWith('image/png')) {
    throw createError({ statusCode: 502, statusMessage: 'Traffic tile request failed' })
  }
  setHeader(event, 'Content-Type', 'image/png')
  setHeader(event, 'Cache-Control', 'public, max-age=180, stale-while-revalidate=60')
  return Buffer.from(await response.arrayBuffer())
})
