import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mrmsTileUrl, mrmsArchiveUrl, mrmsFrameCandidates, mrmsFrames, isMrmsCoverage,
  decodeMrmsPixel, mrmsDisplayMark, forecastTileUrl, xyzBbox, readForecastFrames
} from '../utils/weatherMapSources.js'

test('IEM uses north-origin XYZ and a frame timestamp, not inverted TMS Y', () => {
  const ian = Date.parse('2022-09-28T18:00:00Z') / 1000
  assert.match(mrmsTileUrl(ian, 7, 35, 53), /\/cache\/tile\.py\/1\.0\.0\/mrms::lcref-202209281800\/7\/35\/53\.png$/)
  assert.match(mrmsArchiveUrl(ian), /\/2022\/09\/28\/GIS\/mrms\/lcref_202209281800\.png$/)
  assert.equal(isMrmsCoverage(47.55, -122.33), true)
  assert.equal(isMrmsCoverage(51.50, -0.12), false)
  assert.equal(isMrmsCoverage(61.2, -149.9), false)
  const now = Date.parse('2026-11-23T00:05:55Z')
  const [latest, previous] = mrmsFrameCandidates(now)
  assert.equal(new Date(latest * 1000).toISOString(), '2026-11-22T23:56:00.000Z')
  assert.equal(latest - previous, 120)
  assert.equal(mrmsFrames(latest).length, 12)
  assert.equal(mrmsFrames(latest).at(-1), latest)
})

test('documented unique MRMS palette colors recover actual sampled dBZ values', () => {
  // Seattle 2026-11-23 23:30Z (verified against indexed national archive).
  assert.equal(decodeMrmsPixel(154, 154, 246, 255), 12.5)
  // Ian 2022-09-28 18:00Z tile samples (100,60) and (200,160).
  assert.equal(decodeMrmsPixel(62, 125, 249, 255), 21.5)
  assert.equal(decodeMrmsPixel(255, 217, 0, 255), 44)
  assert.equal(decodeMrmsPixel(0, 0, 0, 255), null)
  assert.equal(decodeMrmsPixel(154, 154, 246, 0), null)
  assert.equal(decodeMrmsPixel(100, 123, 10, 255), null)
  assert.equal(mrmsDisplayMark(12.5)[0], '░')
  assert.deepEqual(mrmsDisplayMark(44), ['▓', 'rgb(255,181,0)'])
  assert.deepEqual(mrmsDisplayMark(20), ['░', 'rgb(0,228,255)'])
})

test('precip forecast uses exact valid times and EPSG:3857 easting/northing bounds', () => {
  const run = '2026-11-23T12:00:00Z'
  const time = '2026-11-24T00:00:00Z'
  const xml = `<Layer><Name>GDPS_15km_Precip-Accum1h</Name>
    <Dimension name="time" units="ISO8601">2026-11-23T22:00:00Z,${time},${time},invalid</Dimension>
    <Dimension name="reference_time" default="${run}">ignored</Dimension></Layer>`
  const [frame] = readForecastFrames(xml, Date.parse('2026-11-23T23:30:00Z'))
  assert.deepEqual(readForecastFrames(xml, Date.parse(time)), [])
  assert.equal(frame.run, run)
  assert.deepEqual(readForecastFrames(xml, Date.parse(run)).map(x => x.time), [1795471200, 1795478400])
  const params = new URL(forecastTileUrl(frame, 2, 1, 1)).searchParams
  assert.equal(params.get('TIME'), time)
  assert.equal(params.get('DIM_REFERENCE_TIME'), run)
  assert.equal(params.get('CRS'), 'EPSG:3857')
  assert.equal(params.get('LAYERS'), 'GDPS_15km_Precip-Accum1h')
  assert.equal(params.get('STYLES'), 'PRECIPMM')
  assert.deepEqual(params.get('BBOX').split(',').map(Number), xyzBbox(2, 1, 1))
  assert.deepEqual(xyzBbox(2, 1, 1).map(Math.round), [-10018754, 0, 0, 10018754])
})
