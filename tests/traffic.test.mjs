import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyRelativeSpeed, normalizeRoadFeature, normalizeStationFeature,
  parseWsdotTime, tileCoordinate, visibleTileCoordinates, emptyTrafficCollection
} from '../shared/traffic.js'

test('speed brackets map to the site traffic palette', () => {
  assert.equal(classifyRelativeSpeed(1), 'flowing')
  assert.equal(classifyRelativeSpeed(0.75), 'flowing')
  assert.equal(classifyRelativeSpeed(0.5), 'slow')
  assert.equal(classifyRelativeSpeed(0.2), 'heavy')
  assert.equal(classifyRelativeSpeed(0.1), 'stopped')
  assert.equal(classifyRelativeSpeed(0.95, true), 'closed')
  assert.equal(classifyRelativeSpeed(null), 'unknown')
  assert.equal(classifyRelativeSpeed(-1), 'unknown')
  assert.equal(classifyRelativeSpeed(2), 'unknown')
})

test('TomTom vector roads become normalized GeoJSON without leaking raw props', () => {
  const road = normalizeRoadFeature({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[-122.3, 47.6], [-122.31, 47.61]] },
    properties: { relative_speed: 0.4, road_closure: false, road_category: 'primary', arbitrary: 'secret' }
  }, '2026-11-22T21:00:00.000Z')
  assert.equal(road.type, 'Feature')
  assert.equal(road.properties.source, 'TomTom')
  assert.equal(road.properties.kind, 'road')
  assert.equal(road.properties.condition, 'slow')
  assert.equal(road.properties.relativeSpeed, 0.4)
  assert.equal(road.properties.observedAt, null)
  assert.equal(road.properties.arbitrary, undefined)
  assert.equal(road.geometry.type, 'LineString')
})

test('Road closures override congestion and no-speed means unknown, never green', () => {
  const feature = {
    geometry: { type: 'MultiLineString', coordinates: [[[-122.3, 47.6], [-122.31, 47.61]]] },
    properties: { road_closure: true }
  }
  assert.equal(normalizeRoadFeature(feature).properties.condition, 'closed')
  feature.properties = {}
  assert.equal(normalizeRoadFeature(feature).properties.condition, 'unknown')
  assert.equal(normalizeRoadFeature({ geometry: { type: 'Point', coordinates: [0, 0] } }), null)
})

test('WSDOT Microsoft date format resolves milliseconds and ignores zone suffix', () => {
  assert.equal(parseWsdotTime('/Date(928174800000-0700)/'), '1999-05-31T18:20:00.000Z')
  assert.equal(parseWsdotTime('bad data'), null)
})

test('WSDOT sensor observations are points, not invented road segments or speeds', () => {
  const recent = new Date(Date.now() - 30_000).toISOString()
  const item = normalizeStationFeature({
    FlowStationLocation: { Latitude: 47.605, Longitude: -122.338, RoadName: 'I-5' },
    FlowReadingValue: 3, Time: recent, StationName: 'Downtown', FlowDataID: 4
  })
  assert.deepEqual(item.geometry.coordinates, [-122.338, 47.605])
  assert.equal(item.properties.kind, 'sensor')
  assert.equal(item.properties.source, 'WSDOT')
  assert.equal(item.properties.condition, 'heavy')
  assert.equal(item.properties.relativeSpeed, null)
  assert.equal(item.properties.stationId, '4')
})

test('WSDOT missing, stale or invalid observations do not imply free-flowing traffic', () => {
  const base = { FlowStationLocation: { Latitude: 47.6, Longitude: -122.3 } }
  assert.equal(normalizeStationFeature({ ...base, FlowReadingValue: 1, Time: '1999-01-01' }).properties.condition, 'unknown')
  assert.equal(normalizeStationFeature({ ...base, FlowReadingValue: 5, Time: new Date().toISOString() }).properties.condition, 'unknown')
  assert.equal(normalizeStationFeature({ FlowStationLocation: { Latitude: 181, Longitude: -122.3 } }), null)
})

test('visible tile grid limits calls and follows Web Mercator', () => {
  const point = tileCoordinate(47.6062, -122.3321, 10)
  assert.equal(point.z, 10)
  assert.ok(point.x >= 0 && point.x < 1024)
  assert.ok(point.y >= 0 && point.y < 1024)
  const bounds = { west: -122.34, south: 47.60, east: -122.32, north: 47.62 }
  const tiles = visibleTileCoordinates(bounds, 10)
  assert.ok(tiles.length >= 1 && tiles.length <= 4)
  assert.equal(visibleTileCoordinates({ west: -179, south: -80, east: 179, north: 80 }, 10, 4).length, 0)
  assert.deepEqual(emptyTrafficCollection(), { type: 'FeatureCollection', features: [] })
})
