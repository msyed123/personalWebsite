// Provider-neutral traffic feature contract. Coordinates are GeoJSON [longitude, latitude].
// Every returned feature has kind, condition, source and an optional observedAt.
export const TRAFFIC_CONDITIONS = Object.freeze(['flowing', 'slow', 'heavy', 'stopped', 'closed', 'unknown'])

export function classifyRelativeSpeed(value, roadClosed = false) {
  if (roadClosed) return 'closed'
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return 'unknown'
  if (value < 0.15) return 'stopped'
  if (value < 0.35) return 'heavy'
  if (value < 0.75) return 'slow'
  return 'flowing'
}

export function normalizeRoadFeature(feature, retrievedAt = null) {
  if (!feature || !['LineString', 'MultiLineString'].includes(feature.geometry?.type)) return null
  const properties = feature.properties || {}
  const speed = Number(properties.relative_speed)
  const relativeSpeed = properties.relative_speed == null || properties.relative_speed === '' ||
    !Number.isFinite(speed) || speed < 0 || speed > 1 ? null : speed
  const closed = properties.road_closure === true || properties.road_closure === 1
  return {
    type: 'Feature',
    geometry: feature.geometry,
    properties: {
      kind: 'road',
      source: 'TomTom',
      condition: classifyRelativeSpeed(relativeSpeed, closed),
      relativeSpeed,
      roadClass: typeof properties.road_category === 'string' ? properties.road_category : null,
      observedAt: null, // TomTom vector tiles do not expose per-segment observation timestamps.
      retrievedAt
    }
  }
}

export function parseWsdotTime(value) {
  if (typeof value !== 'string') return null
  // WSDOT JSON uses Microsoft's /Date(milliseconds-offset)/ format.
  const milliseconds = value.startsWith('/Date(') ? Number.parseInt(value.slice(6), 10) : NaN
  const date = new Date(Number.isFinite(milliseconds) ? milliseconds : value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

// WSDOT: 0=Unknown, 1=WideOpen, 2=Moderate, 3=Heavy, 4=StopAndGo, 5=NoData.
const WSDOT_CONDITIONS = Object.freeze(['unknown', 'flowing', 'slow', 'heavy', 'stopped', 'unknown'])
export function normalizeStationFeature(row) {
  const location = row?.FlowStationLocation
  const lat = Number(location?.Latitude)
  const lon = Number(location?.Longitude)
  if (location?.Latitude == null || location?.Longitude == null ||
      !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  const raw = row.FlowReadingValue
  const index = typeof raw === 'number' ? raw :
    ['Unknown', 'WideOpen', 'Moderate', 'Heavy', 'StopAndGo', 'NoData'].indexOf(raw)
  const observedAt = parseWsdotTime(row.Time)
  const stale = !observedAt || Date.now() - Date.parse(observedAt) > 10 * 60 * 1000 ||
    Date.parse(observedAt) > Date.now() + 2 * 60 * 1000
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      kind: 'sensor',
      source: 'WSDOT',
      condition: stale ? 'unknown' : WSDOT_CONDITIONS[index] || 'unknown',
      relativeSpeed: null, // WSDOT publishes categories, not free-flow speed ratios.
      observedAt,
      retrievedAt: null,
      label: [location.RoadName, row.StationName].filter(Boolean).join(' · ').slice(0, 120),
      stationId: row.FlowDataID == null ? null : String(row.FlowDataID)
    }
  }
}

export function emptyTrafficCollection() {
  return { type: 'FeatureCollection', features: [] }
}

// XYZ Mercator math shared by all road-tile implementations.
export function tileCoordinate(latitude, longitude, zoom) {
  const size = 2 ** zoom
  const lat = Math.min(85.05112878, Math.max(-85.05112878, latitude))
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180
  const x = Math.floor((lon + 180) / 360 * size)
  const mercator = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
  const y = Math.floor((1 - mercator / Math.PI) / 2 * size)
  return { x: Math.min(size - 1, Math.max(0, x)), y: Math.min(size - 1, Math.max(0, y)), z: zoom }
}

export function visibleTileCoordinates(bounds, zoom, limit = 12) {
  const west = bounds.west
  const east = bounds.east
  const northWest = tileCoordinate(bounds.north, west, zoom)
  const southEast = tileCoordinate(bounds.south, east, zoom)
  const maxX = 2 ** zoom
  const width = ((southEast.x - northWest.x + maxX) % maxX) + 1
  const height = Math.abs(southEast.y - northWest.y) + 1
  // Refuse huge requests rather than silently rendering a partial geographic region.
  if (width * height > limit) return []
  const tiles = []
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      tiles.push({ z: zoom, x: (northWest.x + dx) % maxX, y: northWest.y + dy })
    }
  }
  return tiles
}
