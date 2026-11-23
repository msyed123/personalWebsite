// Render the existing pixelated RainViewer precipitation as a MapLibre raster
// layer INSIDE the vector stack. Roads, road labels and traffic always draw above
// the radar rather than being washed out by a full-screen Leaflet canvas.
let nextProtocolId = 0

export const radarBlendWeights = (fraction, opacity) => {
  const t = Math.max(0, Math.min(1, Number(fraction) || 0))
  const eased = t * t * (3 - 2 * t)
  return { previous: opacity * (1 - eased), next: opacity * eased }
}

export function createAsciiRadarLayer({
  gl, addProtocol, removeProtocol, transitionMs = 720
}) {
  const scheme = 'ascii-rain-' + (++nextProtocolId)
  // Two independently buffered raster sources permit a real crossfade between
  // whole frames instead of abruptly replacing the currently displayed cells.
  const sourceIds = ['ascii-radar-tiles-a', 'ascii-radar-tiles-b']
  const layerIds = ['ascii-radar-a', 'ascii-radar-b']
  const paths = []
  let initialized = false
  let disposed = false
  let activeSlot = 0
  let displayedIndex = 0
  let opacity = 0.7
  let blendFraction = 0
  let loadingIncoming = false
  let pendingIndex = null
  let loadingIndex = null
  let cancelPendingLoad = null
  let running = null
  let cancelFade = null
  const waiting = new Set()
  const raf = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame : callback => setTimeout(() => callback(performance.now()), 16)
  const cancelRaf = typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame : clearTimeout

  const tileUrl = frame => scheme + '://tiles/{z}/{x}/{y}?frame=' + frame

  const makeCanvas = () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    return canvas
  }

  async function fetchTile(request, abortController) {
    const output = makeCanvas()
    const ctx = output.getContext('2d')
    const uri = new URL(request.url)
    const parts = uri.pathname.match(/^\/(\d+)\/(\d+)\/(\d+)$/)
    const frame = Number(uri.searchParams.get('frame'))
    if (!parts || !Number.isInteger(frame) || !paths[frame]) {
      return { data: await createImageBitmap(output) }
    }
    const [z, x, y] = parts.slice(1).map(Number)
    if (z < 0 || z > 13 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      return { data: await createImageBitmap(output) }
    }
    const diff = Math.max(0, z - 7)
    const scale = 2 ** diff
    const fetchZ = Math.min(z, 7)
    const fetchX = Math.floor(x / scale)
    const fetchY = Math.floor(y / scale)
    const path = paths[frame]
    const url = 'https://tilecache.rainviewer.com' + path +
      '/256/' + fetchZ + '/' + fetchX + '/' + fetchY + '/6/1_1.png'
    try {
      const response = await fetch(url, { signal: abortController?.signal })
      if (!response.ok || !(response.headers.get('content-type') || '').includes('image')) {
        return { data: await createImageBitmap(output) }
      }
      const image = await createImageBitmap(await response.blob())
      const scaled = makeCanvas()
      const off = scaled.getContext('2d', { willReadFrequently: true })
      off.imageSmoothingEnabled = false
      if (diff) {
        const sub = 256 / scale
        off.drawImage(image, (x % scale) * sub, (y % scale) * sub,
          sub, sub, 0, 0, 256, 256)
      } else {
        off.drawImage(image, 0, 0, 256, 256)
      }
      image.close?.()
      const pixels = off.getImageData(0, 0, 256, 256).data
      ctx.font = 'bold 6px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let row = 0; row < 256; row += 3) {
        for (let col = 0; col < 256; col += 3) {
          const i = (row * 256 + col) * 4
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
          if (pixels[i + 3] <= 15) continue
          const top = Math.max(r,g,b), low = Math.min(r,g,b)
          const saturation = top === 0 ? 0 : (top - low) / top
          const muddy = r > g && g > b && r < 230 && b > 80 && Math.abs(r-g) < 30
          if (saturation < .1 || muddy) continue
          let mark = '░'
          if (r > 190 && g < 150) mark = '█'
          else if (g > 150) mark = '▓'
          else if (b > 150) mark = '▒'
          ctx.fillStyle = 'rgb(' +
            Math.min(255, r * 1.4) + ',' +
            Math.min(255, g * 1.4) + ',' +
            Math.min(255, b * 1.4) + ')'
          ctx.fillText(mark, col + 1.5, row + 1.5)
        }
      }
    } catch (error) {
      if (abortController?.signal?.aborted) throw error
      // RainViewer empty/failed tiles should not cover the map with error art.
    }
    return { data: await createImageBitmap(output) }
  }

  const applyBlend = () => {
    if (!initialized || disposed) return
    const alpha = radarBlendWeights(blendFraction, opacity)
    gl.setPaintProperty(layerIds[activeSlot], 'raster-opacity', alpha.previous)
    // A nearly transparent standby layer is still rendered so MapLibre
    // requests its incoming tiles before we begin fading out the old ones.
    gl.setPaintProperty(layerIds[1 - activeSlot], 'raster-opacity',
      loadingIncoming ? 0.001 : alpha.next)
  }

  function waitUntilLoaded(id) {
    if (disposed) return Promise.resolve(false)
    // MapLibre's per-source readiness is important: otherwise a slow network
    // would fade out precipitation before the incoming tiles existed.
    if (typeof gl.isSourceLoaded !== 'function' || gl.isSourceLoaded(id)) {
      return Promise.resolve(true)
    }
    return new Promise(resolve => {
      let done = false
      let timeout
      const wait = { finish }
      const cancel = () => finish(false)
      cancelPendingLoad = cancel
      function finish(success) {
        if (done) return
        done = true
        clearTimeout(timeout)
        gl.off?.('sourcedata', onData)
        if (cancelPendingLoad === cancel) cancelPendingLoad = null
        waiting.delete(wait)
        resolve(success)
      }
      function onData(event) {
        if (event.sourceId === id && gl.isSourceLoaded(id)) finish(true)
      }
      waiting.add(wait)
      gl.on?.('sourcedata', onData)
      timeout = setTimeout(() => finish(false), 8000)
      // Capture a ready event that landed just before attaching the listener.
      if (gl.isSourceLoaded(id)) finish(true)
    })
  }

  function animateTransition() {
    return new Promise(resolve => {
      const began = performance.now()
      let scheduled = null
      let finished = false
      const finish = success => {
        if (finished) return
        finished = true
        if (scheduled !== null) cancelRaf(scheduled)
        cancelFade = null
        resolve(success)
      }
      cancelFade = () => finish(false)
      const tick = now => {
        if (disposed) return finish(false)
        blendFraction = Math.min(1, (now - began) / Math.max(1, transitionMs))
        applyBlend()
        if (blendFraction >= 1) finish(true)
        else scheduled = raf(tick)
      }
      scheduled = raf(tick)
    })
  }

  async function flushRequests() {
    while (!disposed && pendingIndex !== null) {
      const incomingIndex = pendingIndex
      pendingIndex = null
      if (incomingIndex === displayedIndex) {
        blendFraction = 0
        applyBlend()
        continue
      }
      const slot = 1 - activeSlot
      blendFraction = 0
      loadingIncoming = true
      loadingIndex = incomingIndex
      gl.getSource(sourceIds[slot])?.setTiles([tileUrl(incomingIndex)])
      applyBlend()
      // Let MapLibre process the source's tile invalidation on a render frame.
      // Checking isSourceLoaded() synchronously can observe stale readiness
      // from the previous frame and start fading into missing imagery.
      await new Promise(resolve => raf(resolve))
      if (disposed) return false
      if (pendingIndex !== null) {
        loadingIncoming = false
        loadingIndex = null
        applyBlend()
        continue
      }
      const ready = await waitUntilLoaded(sourceIds[slot])
      loadingIncoming = false
      loadingIndex = null
      if (disposed) return false
      // Fast scrubbing keeps only the latest target, without flashing intermediate
      // radar frames or allowing an old tile request to overwrite a newer one.
      if (pendingIndex !== null) {
        applyBlend()
        continue
      }
      if (!ready) {
        applyBlend()
        return false
      }
      const faded = await animateTransition()
      if (!faded || disposed) return false
      const outgoingSlot = activeSlot
      activeSlot = slot
      displayedIndex = incomingIndex
      blendFraction = 0
      // Finish with one fully visible layer; the buffer can now be reused.
      gl.setPaintProperty(layerIds[outgoingSlot], 'raster-opacity', 0)
      gl.setPaintProperty(layerIds[activeSlot], 'raster-opacity', opacity)
    }
    return !disposed
  }

  function initialize(radarPaths, initialOpacity = 0.7) {
    if (initialized || !radarPaths?.length) return false
    paths.push(...radarPaths.filter(path => typeof path === 'string' && path.startsWith('/')))
    if (!paths.length) return false
    opacity = initialOpacity
    disposed = false
    addProtocol(scheme, fetchTile)

    // Radar belongs above land/water fills but below geographic lines,
    // traffic observations and all text labels.
    const style = gl.getStyle()
    const firstRoad = style.layers.find(layer =>
      layer.type === 'line' && /road|highway|motorway|street|bridge|tunnel/.test(layer.id))
    const beforeId = firstRoad?.id ||
      style.layers.find(layer => layer.type === 'symbol')?.id
    for (let i = 0; i < 2; i++) {
      gl.addSource(sourceIds[i], {
        type: 'raster',
        tiles: [tileUrl(0)],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 13
      })
      gl.addLayer({
        id: layerIds[i],
        type: 'raster',
        source: sourceIds[i],
        paint: {
          'raster-opacity': i === 0 ? opacity : 0,
          'raster-fade-duration': 0,
          'raster-resampling': 'nearest'
        }
      }, beforeId)
    }
    initialized = true
    return true
  }

  function setOpacity(alpha) {
    if (!initialized || disposed) return
    opacity = Math.max(0, Math.min(1, Number(alpha) || 0))
    applyBlend()
  }

  function showFrame(index, alpha = opacity) {
    if (!initialized || disposed || !Number.isInteger(index) || !paths[index]) {
      return Promise.resolve(false)
    }
    setOpacity(alpha)
    pendingIndex = index
    // Do not block a fast scrub on a no-longer-wanted network tile.
    if (loadingIndex !== null && loadingIndex !== index) cancelPendingLoad?.()
    if (!running) {
      running = flushRequests().finally(() => {
        running = null
        // A seek may arrive as the previous flush settles.
        if (!disposed && pendingIndex !== null) showFrame(pendingIndex, opacity)
      })
    }
    return running
  }

  function destroy() {
    if (!initialized) return
    disposed = true
    pendingIndex = null
    loadingIndex = null
    cancelPendingLoad?.()
    cancelFade?.()
    for (const item of waiting) item.finish(false)
    for (let i = 0; i < 2; i++) {
      if (gl.getLayer(layerIds[i])) gl.removeLayer(layerIds[i])
      if (gl.getSource(sourceIds[i])) gl.removeSource(sourceIds[i])
    }
    removeProtocol(scheme)
    initialized = false
  }

  return {
    initialize, setOpacity, showFrame, destroy, layerId: layerIds[0],
    layerIds, sourceIds
  }
}
