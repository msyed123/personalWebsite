// Small bounded LRU of promises: coalesces simultaneous tile requests and
// reuses a completed rendering when the radar animation loops.
// Values are retained only while their geographical/frame key is in the cache.
export function createRadarTileCache(maxEntries = 256) {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('Radar cache capacity must be a positive integer')
  }
  const entries = new Map()

  function load(key, loader) {
    if (entries.has(key)) {
      const existing = entries.get(key)
      // Refresh recency on reads. A cache hit never invokes the loader.
      entries.delete(key)
      entries.set(key, existing)
      return existing
    }
    const task = Promise.resolve().then(loader)
    entries.set(key, task)
    task.catch(() => {
      // Transient failed requests must be eligible for retry.
      if (entries.get(key) === task) entries.delete(key)
    })
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value)
    }
    return task
  }

  return {
    load,
    clear: () => entries.clear(),
    get size() { return entries.size },
    has: key => entries.has(key)
  }
}
