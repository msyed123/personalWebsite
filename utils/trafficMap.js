import { emptyTrafficCollection, budgetedRoadTileCoordinates } from '~/shared/traffic.js'

const COLORS = {
  flowing: '#26ad6a',
  slow: '#ffb000',
  heavy: '#ff792c',
  stopped: '#ee3838',
  closed: '#d2d9db',
  unknown: '#6b7280'
}

const colorExpression = ['match', ['get', 'condition'],
  ...Object.entries(COLORS).flatMap(([name, color]) => [name, color]),
  COLORS.unknown
]

const ROAD_ID = 'traffic-roads'
const SENSOR_ID = 'traffic-sensors'

// The renderer consumes only normalized GeoJSON, never TomTom/WSDOT response types.
export function createTrafficMap({ gl, leafletMap, onStatus, onReady, onSources, onUpdate, onHealth = () => {} }) {
  let active = true
  let visible = true
  let roadEnabled = false
  let sensorEnabled = false
  let requestVersion = 0
  let refreshTimer = null
  let requestTimer = null

  const applyVisibility = () => {
    const visibility = visible ? 'visible' : 'none'
    for (const id of ['traffic-road-casing', 'traffic-road-lines', 'traffic-station-circles']) {
      if (gl.getLayer(id)) gl.setLayoutProperty(id, 'visibility', visibility)
    }
  }

  const clearData = () => {
    gl.getSource(ROAD_ID)?.setData(emptyTrafficCollection())
    gl.getSource(SENSOR_ID)?.setData(emptyTrafficCollection())
  }

  async function refresh() {
    if (!active || !visible || !gl.getSource(ROAD_ID)) return
    const version = ++requestVersion
    const zoom = Math.floor(leafletMap.getZoom())
    if (zoom < 6) {
      clearData()
      onStatus('ZOOM IN')
      return
    }

    const bounds = leafletMap.getBounds()
    const box = {
      west: bounds.getWest(), south: bounds.getSouth(),
      east: bounds.getEast(), north: bounds.getNorth()
    }
    const tiles = roadEnabled ? budgetedRoadTileCoordinates(box, zoom) : []
    if (roadEnabled && tiles.length === 0) {
      onStatus('ZOOM IN')
      clearData()
      return
    }

    onStatus('LOADING')
    const requests = []
    for (const { z, x, y } of tiles) {
      requests.push({ kind: 'road',
        request: fetch(`/api/traffic/roads/${z}/${x}/${y}`).then(parseCollection) })
    }
    if (sensorEnabled) {
      const bbox = [box.west, box.south, box.east, box.north].join(',')
      requests.push({ kind: 'sensor',
        request: fetch(`/api/traffic/stations?bbox=${encodeURIComponent(bbox)}`).then(parseCollection) })
    }

    const results = await Promise.allSettled(requests.map((item) => item.request))
    if (!active || !visible || version !== requestVersion) return

    const roads = []
    const stations = []
    let failures = 0
    let successes = 0
    let latestTime = null
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') { failures++; continue }
      successes++
      const destination = requests[i].kind === 'road' ? roads : stations
      for (const feature of result.value.features) {
        destination.push(feature)
        const iso = feature.properties?.observedAt || feature.properties?.retrievedAt
        if (iso && (!latestTime || iso > latestTime)) latestTime = iso
      }
    }

    // A failed provider does not leave stale lines masquerading as live traffic.
    gl.getSource(ROAD_ID)?.setData({ type: 'FeatureCollection', features: roads })
    gl.getSource(SENSOR_ID)?.setData({ type: 'FeatureCollection', features: stations })
    onUpdate(latestTime)
    const health = (kind, enabled) => {
      if (!enabled) return 'NO KEY'
      const sampled = results.filter((_, i) => requests[i].kind === kind)
      if (!sampled.length) return 'NO DATA'
      const succeeded = sampled.filter(item => item.status === 'fulfilled')
      if (!succeeded.length) {
        const reasons = sampled
          .filter(item => item.status === 'rejected')
          .map(item => item.reason?.message)
        if (reasons.includes('AUTHORIZATION')) return 'AUTH ERROR'
        if (reasons.includes('RATE_LIMIT')) return 'RATE LIMIT'
        if (reasons.includes('INVALID_TILE_FORMAT')) return 'TILE FORMAT'
        if (reasons.includes('TIMEOUT')) return 'TIMEOUT'
        if (reasons.includes('TILE_DECODING_OR_NETWORK')) return 'DECODE/NET'
        const upstream = reasons.find(value => /^UPSTREAM_HTTP_\d+$/.test(value || ''))
        return upstream ? upstream.replace('UPSTREAM_HTTP_', 'HTTP ') : 'ERROR'
      }
      if (succeeded.length < sampled.length) return 'DEGRADED'
      return succeeded.some(item => item.value.features.length > 0) ? 'LIVE' : 'NO DATA'
    }
    onHealth({ roads: health('road', roadEnabled), stations: health('sensor', sensorEnabled) })

    if (failures && successes) onStatus('DEGRADED')
    else if (failures) onStatus('ERROR')
    else if (!roads.length && !stations.length) onStatus('NO DATA')
    else onStatus('LIVE')
  }

  function scheduleRefresh() {
    if (!active) return
    clearTimeout(requestTimer)
    requestTimer = setTimeout(() => { refresh() }, 250)
  }

  async function start() {
    gl.addSource(ROAD_ID, { type: 'geojson', data: emptyTrafficCollection() })
    gl.addSource(SENSOR_ID, { type: 'geojson', data: emptyTrafficCollection() })
    // Place observed traffic above basemap road geometry, but underneath road
    // and place-name labels. The synthetic preview roads may not follow the
    // streets precisely; that is a mock geometry issue, not layer ordering.
    const firstLabel = gl.getStyle().layers.find(
      (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id
    const visibleTraffic = ['!=', ['get', 'condition'], 'unknown']
    gl.addLayer({
      id: 'traffic-road-casing', type: 'line', source: ROAD_ID, filter: visibleTraffic,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#080a0e',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 7, 13, 10],
        'line-opacity': 1
      }
    }, firstLabel)
    gl.addLayer({
      id: 'traffic-road-lines', type: 'line', source: ROAD_ID, filter: visibleTraffic,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colorExpression,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 4.5, 13, 7],
        'line-opacity': 1
      }
    }, firstLabel)
    gl.addLayer({
      id: 'traffic-station-circles', type: 'circle', source: SENSOR_ID,
      paint: {
        'circle-color': colorExpression,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 4.5, 13, 6],
        'circle-stroke-color': '#090c0f',
        'circle-stroke-width': 1.5,
        'circle-opacity': ['case', ['==', ['get', 'condition'], 'unknown'], 0.3, 0.95]
      }
    }, firstLabel)
    try {
      const response = await fetch('/api/traffic/status')
      if (!response.ok) throw new Error('Traffic capabilities unavailable')
      const status = await response.json()
      if (!active) return
      roadEnabled = status.roads === true
      sensorEnabled = status.stations === true
      onSources({ roads: roadEnabled, stations: sensorEnabled })
      onHealth({
        roads: roadEnabled ? 'LOADING' : 'NO KEY',
        stations: sensorEnabled ? 'LOADING' : 'NO KEY'
      })
      if (!roadEnabled && !sensorEnabled) {
        onStatus('NO KEY')
        onReady(false)
        return
      }
      onReady(true)
      onStatus('LOADING')
      leafletMap.on('moveend', scheduleRefresh)
      refreshTimer = setInterval(refresh, 180_000)
      await refresh()
    } catch {
      if (active) {
        onStatus('OFFLINE')
        onHealth({ roads: 'OFFLINE', stations: 'OFFLINE' })
      }
    }
  }

  function setVisible(next) {
    visible = Boolean(next)
    requestVersion++
    applyVisibility()
    if (visible && (roadEnabled || sensorEnabled)) refresh()
  }

  function destroy() {
    active = false
    requestVersion++
    clearTimeout(requestTimer)
    clearInterval(refreshTimer)
    leafletMap.off('moveend', scheduleRefresh)
  }

  return { start, refresh, setVisible, destroy }
}

async function parseCollection(response) {
  if (!response.ok) {
    // Only recognize sanitized error categories emitted by our server.
    // Do not display arbitrary upstream error messages or credentials.
    let category = 'ERROR'
    try {
      const error = await response.json()
      const allowed = /^(AUTHORIZATION|RATE_LIMIT|INVALID_TILE_FORMAT|OVERSIZE_TILE|TIMEOUT|TILE_DECODING_OR_NETWORK|UPSTREAM_HTTP_\d{3})$/
      const candidate = String(error?.statusMessage || '').replace(/^Road traffic /, '')
      if (allowed.test(candidate)) category = candidate
    } catch {}
    throw new Error(category)
  }
  const data = await response.json()
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Invalid normalized traffic response')
  }
  return data
}

