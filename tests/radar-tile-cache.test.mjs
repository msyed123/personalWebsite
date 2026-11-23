import test from 'node:test'
import assert from 'node:assert/strict'
import { createRadarTileCache } from '../utils/radarTileCache.js'

test('one fetch/render serves concurrent requests and later animation loops', async () => {
  const cache = createRadarTileCache(8)
  let loads = 0
  const loader = async () => {
    loads++
    await new Promise(resolve => setTimeout(resolve, 5))
    return { pixels: 'precipitation' }
  }
  const first = cache.load('frame-1/z11/x1/y1', loader)
  const concurrent = cache.load('frame-1/z11/x1/y1', loader)
  assert.strictEqual(first, concurrent)
  assert.deepEqual(await first, { pixels: 'precipitation' })
  assert.deepEqual(await cache.load('frame-1/z11/x1/y1', loader), { pixels: 'precipitation' })
  assert.equal(loads, 1, 'Repeated playback must not re-fetch or re-render')
  assert.equal(cache.size, 1)
})

test('bounded LRU evicts old geographic tiles while retaining recently used frames', async () => {
  const cache = createRadarTileCache(2)
  const loads = new Map()
  const loader = key => () => {
    loads.set(key, (loads.get(key) || 0) + 1)
    return key
  }
  await cache.load('frame-a', loader('frame-a'))
  await cache.load('frame-b', loader('frame-b'))
  await cache.load('frame-a', loader('frame-a'))
  await cache.load('frame-c', loader('frame-c'))
  assert.equal(cache.has('frame-a'), true)
  assert.equal(cache.has('frame-b'), false)
  assert.equal(cache.has('frame-c'), true)
  await cache.load('frame-a', loader('frame-a'))
  assert.equal(loads.get('frame-a'), 1)
  await cache.load('frame-b', loader('frame-b'))
  assert.equal(loads.get('frame-b'), 2)
  assert.ok(cache.size <= 2)
})

test('network failures can retry and destroying map drops references', async () => {
  const cache = createRadarTileCache(2)
  let tries = 0
  await assert.rejects(cache.load('tile', () => {
    tries++
    throw new Error('Temporary RainViewer outage')
  }), /Temporary/)
  // Rejected promises are removed, never cached as permanent empty sky.
  assert.equal(cache.has('tile'), false)
  assert.equal(await cache.load('tile', () => { tries++; return 'recovered' }), 'recovered')
  assert.equal(tries, 2)
  cache.clear()
  assert.equal(cache.size, 0)
  assert.equal(cache.has('tile'), false)
})

test('capacity validation guards against accidental unbounded memory', () => {
  assert.throws(() => createRadarTileCache(0), RangeError)
  assert.throws(() => createRadarTileCache(-1), RangeError)
  assert.throws(() => createRadarTileCache(1.25), RangeError)
})
