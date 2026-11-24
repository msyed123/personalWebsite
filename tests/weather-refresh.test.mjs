import test from 'node:test'
import assert from 'node:assert/strict'
import { weatherPollDelay, weatherRevision, weatherTimelineUpdate, refreshedWeatherIndex }
  from '../utils/weatherRefresh.js'

test('checks the active provider at its own cadence and retries MRMS in range', () => {
  assert.equal(weatherPollDelay('radar', 'mrms', true), 120_000)
  assert.equal(weatherPollDelay('radar', 'rainviewer', true), 120_000)
  assert.equal(weatherPollDelay('radar', 'rainviewer', false), 600_000)
  assert.equal(weatherPollDelay('precipitation', 'gdps', true), 900_000)
})

test('new scans update, unchanged polls do not, and a failed MRMS does not replace it', () => {
  const mrms = { source: 'mrms', paths: [120, 240], revision: 240 }
  assert.equal(weatherTimelineUpdate(undefined, mrms), 'new')
  assert.equal(weatherTimelineUpdate(mrms, { ...mrms, paths: [120, 240] }), 'unchanged')
  assert.equal(weatherTimelineUpdate(mrms, { ...mrms, paths: [240, 360], revision: 360 }), 'new')
  assert.equal(weatherTimelineUpdate(mrms, { ...mrms, revision: 120 }), 'delayed')
  const fallback = { source: 'rainviewer', paths: ['/older'], revision: 600 }
  assert.equal(weatherTimelineUpdate(mrms, fallback), 'delayed')
  assert.equal(weatherTimelineUpdate(fallback, mrms), 'new')
})

test('forecast highlights new model runs, not rolling forecast hours', () => {
  const run = '2026-11-24T00:00:00Z'
  const make = (run, times) => {
    const paths = times.map(time => ({ time, run }))
    return { source: 'gdps', paths, revision: weatherRevision('gdps', paths, times) }
  }
  const earlier = make(run, [1, 2, 3])
  assert.equal(earlier.revision, Date.parse(run) / 1000)
  assert.equal(weatherTimelineUpdate(earlier, make(run, [2, 3, 4])), 'window')
  assert.equal(weatherTimelineUpdate(earlier, make('2026-11-24T12:00:00Z', [1, 2, 3])), 'new')
})

test('radar live edge advances without taking over a retained historic selection', () => {
  assert.equal(refreshedWeatherIndex([1, 2, 3], [2, 3, 4], 2, true), 2)
  assert.equal(refreshedWeatherIndex([1, 2, 3], [2, 3, 4], 2, false), 1)
  assert.equal(refreshedWeatherIndex([1, 2, 3], [2, 3, 4], 1, true), 0)
  assert.equal(refreshedWeatherIndex([1, 2, 3], [2, 3, 4], 0, true), 0)
})
