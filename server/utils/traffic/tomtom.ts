import { VectorTile } from '@mapbox/vector-tile'
import Protobuf from 'pbf'
import { emptyTrafficCollection, normalizeRoadFeature } from '~/shared/traffic.js'

// One provider adapter. No TomTom fields escape into the map-rendering code.
export async function fetchTomTomRoadTile(z: number, x: number, y: number, key: string) {
  const url = `https://api.tomtom.com/maps/orbis/traffic/flow/vector/tile/${z}/${x}/${y}?apiVersion=2`
  const response = await fetch(url, {
    headers: { 'TomTom-Api-Key': key, Accept: 'application/vnd.mapbox-vector-tile' },
    signal: AbortSignal.timeout(10000)
  })
  if (response.status === 204) return emptyTrafficCollection()
  if (!response.ok) throw new Error(`TomTom traffic request failed: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  const expectedTypes = ['application/vnd.mapbox-vector-tile', 'application/octet-stream', 'application/x-protobuf']
  if (!expectedTypes.some((type) => contentType.includes(type))) {
    throw new Error('TomTom returned an unexpected tile format')
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error('Traffic tile exceeds size limit')
  if (!bytes.byteLength) return emptyTrafficCollection()

  const tile = new VectorTile(new Protobuf(bytes))
  const retrievedAt = new Date().toISOString()
  const features: any[] = []
  for (const [name, layer] of Object.entries(tile.layers)) {
    if (name === 'empty') continue
    for (let i = 0; i < layer.length; i++) {
      const road = layer.feature(i)
      if (road.type !== 2) continue // LineStrings only; never pretend points or polygons are roads.
      const normalized = normalizeRoadFeature(road.toGeoJSON(x, y, z), retrievedAt)
      if (normalized) features.push(normalized)
    }
  }
  return { type: 'FeatureCollection', features }
}
