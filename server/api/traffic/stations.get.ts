import { fetchWsdotStations } from '~/server/utils/traffic/wsdot'

// All WSDOT readings are fetched/cached once; bounding-box filtering is performed locally.
const cachedStations = defineCachedFunction(async () => {
  const code = useRuntimeConfig().wsdotAccessCode
  if (!code) throw new Error('WSDOT access code not configured')
  return fetchWsdotStations(code)
}, { name: 'traffic-wsdot-stations-v1', maxAge: 90 })

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).wsdotAccessCode) {
    throw createError({ statusCode: 503, statusMessage: 'Sensor feed not configured' })
  }
  const input = getQuery(event).bbox
  if (typeof input !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Expected west,south,east,north bbox' })
  }
  const box = input.split(',').map(Number)
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) ||
      box[0] < -180 || box[0] > 180 || box[2] < -180 || box[2] > 180 ||
      box[1] < -90 || box[3] > 90 || box[1] > box[3]) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bbox' })
  }
  try {
    const collection = await cachedStations()
    const [west, south, east, north] = box
    const features = collection.features.filter((feature: any) => {
      const [lon, lat] = feature.geometry.coordinates
      return lat >= south && lat <= north &&
        (west <= east ? lon >= west && lon <= east : lon >= west || lon <= east)
    })
    setHeader(event, 'Cache-Control', 'public, max-age=90, stale-while-revalidate=30')
    return { type: 'FeatureCollection', features }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Highway sensor provider unavailable' })
  }
})
