import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Node doesn't understand Nuxt's "~/" alias. Load the actual production renderer,
// substituting only the module specifier with its absolute file URL.
const path = new URL('../utils/trafficMap.js', import.meta.url)
const shared = new URL('../shared/traffic.js', import.meta.url).href
const rendererSource = readFileSync(path, 'utf8').replace(
  "'~/shared/traffic.js'", JSON.stringify(shared)
)
const moduleUrl = 'data:text/javascript;base64,' +
  Buffer.from(rendererSource).toString('base64')
const { createTrafficMap } = await import(moduleUrl)

test('traffic casing, measured roads and station dots render above all basemap roads and labels', async () => {
  const originalFetch = globalThis.fetch
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'highway_minor', type: 'line' },
    { id: 'road_name', type: 'symbol', layout: { 'text-field': '{name}' } },
    { id: 'place_name', type: 'symbol', layout: { 'text-field': '{name}' } }
  ]
  const sources = new Map()
  const gl = {
    getStyle: () => ({ layers }),
    addSource: (id, config) => sources.set(id, {
      ...config, setData(data) { this.data = data }
    }),
    getSource: id => sources.get(id),
    getLayer: id => layers.find(layer => layer.id === id),
    addLayer: (layer, beforeId) => {
      if (beforeId) {
        const index = layers.findIndex(candidate => candidate.id === beforeId)
        assert.notEqual(index, -1)
        layers.splice(index, 0, layer)
      } else layers.push(layer)
    }
  }
  const leafletMap = { on() {}, off() {} }
  let status
  let controller
  try {
    globalThis.fetch = async url => {
      assert.equal(url, '/api/traffic/status')
      return new Response(JSON.stringify({ roads: false, stations: false }), {
        headers: { 'content-type': 'application/json' }
      })
    }
    controller = createTrafficMap({
      gl, leafletMap,
      onStatus: value => { status = value },
      onReady() {}, onSources() {}, onUpdate() {}
    })
    await controller.start()
    const layerOrder = layers.map(layer => layer.id)
    const lastMapLabel = layerOrder.indexOf('place_name')
    const casing = layerOrder.indexOf('traffic-road-casing')
    const flow = layerOrder.indexOf('traffic-road-lines')
    const sensor = layerOrder.indexOf('traffic-station-circles')
    assert.ok(lastMapLabel < casing, 'Basemap label must be below measured traffic')
    assert.ok(casing < flow && flow < sensor, 'Traffic casing, flow and dots must be stacked in order')
    assert.equal(status, 'NO KEY')
  } finally {
    controller?.destroy()
    globalThis.fetch = originalFetch
  }
})
