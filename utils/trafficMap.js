import { emptyTrafficCollection, visibleTileCoordinates } from '~/shared/traffic.js'

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
export function createTrafficMap({ gl, leafletMap, onStatus, onReady, onSources, onUpdate }) {
  let active = true
  let visible = true
  let roadEnabled = false
  let sensorEnabled = false
  let requestVersion = 0
  let refreshTimer = null
  let requestTimer = null

  const applyVisibility = () => {
    const visibility = visible ? 'visible' : 'none'
    for (const id of ['traffic-road-lines', 'traffic-station-circles']) {
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
    const tiles = roadEnabled ? visibleTileCoordinates(box, Math.min(13, zoom), 12) : []
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
    gl.addLayer({
      id: 'traffic-road-lines', type: 'line', source: ROAD_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colorExpression,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2.6, 13, 4],
        'line-opacity': ['case', ['==', ['get', 'condition'], 'unknown'], 0, 0.8]
      }
    })
    gl.addLayer({
      id: 'traffic-station-circles', type: 'circle', source: SENSOR_ID,
      paint: {
        'circle-color': colorExpression,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 3.5, 13, 5],
        'circle-stroke-color': '#090c0f',
        'circle-stroke-width': 1.3,
        'circle-opacity': ['case', ['==', ['get', 'condition'], 'unknown'], 0.4, 0.95]
      }
    })
    try {
      const response = await fetch('/api/traffic/status')
      if (!response.ok) throw new Error('Traffic capabilities unavailable')
      const status = await response.json()
      if (!active) return
      roadEnabled = status.roads === true
      sensorEnabled = status.stations === true
      onSources({ roads: roadEnabled, stations: sensorEnabled })
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
      if (active) onStatus('OFFLINE')
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
  if (!response.ok) throw new Error('Traffic feed unavailable')
  const data = await response.json()
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('Invalid normalized traffic response')
  }
  return data
}
