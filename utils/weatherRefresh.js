// Poll the active feed only. A forecast hour is a validity time, not a new model run.
export function weatherPollDelay(mode, source, inMrmsCoverage) {
  if (mode === 'precipitation') return 15 * 60_000
  if (source === 'mrms' || inMrmsCoverage) return 2 * 60_000
  return 10 * 60_000
}

export function weatherFrameKey(frame) {
  return typeof frame === 'object' ? frame.run + '/' + frame.time : String(frame)
}

export function weatherRevision(source, paths, times) {
  return source === 'gdps' ? Date.parse(paths[0]?.run) / 1000 : times.at(-1)
}

export function weatherTimelineUpdate(previous, next) {
  if (!previous) return 'new'
  if (previous.source === 'mrms' && next.source !== 'mrms') return 'delayed'
  if (previous.source === next.source && next.revision < previous.revision) return 'delayed'
  if (previous.source !== next.source || next.revision > previous.revision) return 'new'
  return next.paths.map(weatherFrameKey).join('|') === previous.paths.map(weatherFrameKey).join('|')
    ? 'unchanged' : 'window'
}

export function refreshedWeatherIndex(before, after, index, followLatest) {
  if (!before.length || (followLatest && index === before.length - 1)) return after.length - 1
  const target = before[index]
  const retained = after.indexOf(target)
  if (retained !== -1) return retained
  const next = after.findIndex(time => time >= target)
  return next === -1 ? after.length - 1 : next
}
