// Render the existing pixelated RainViewer precipitation as a MapLibre raster
// layer INSIDE the vector stack. Roads, road labels and traffic always draw above
// the radar rather than being washed out by a full-screen Leaflet canvas.
let nextProtocolId = 0

export function createAsciiRadarLayer({ gl, addProtocol, removeProtocol }) {
  const scheme = 'ascii-rain-' + (++nextProtocolId)
  const sourceId = 'ascii-radar-tiles'
  const layerId = 'ascii-radar'
  const paths = []
  let initialized = false

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

  function initialize(radarPaths, opacity = .7) {
    if (initialized || !radarPaths?.length) return false
    paths.push(...radarPaths.filter(path => typeof path === 'string' && path.startsWith('/')))
    if (!paths.length) return false
    addProtocol(scheme, fetchTile)
    gl.addSource(sourceId, {
      type: 'raster',
      tiles: [tileUrl(0)],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 13
    })
    // Radar belongs above geographic land/water fills but BELOW every road and
    // map label. Traffic renderer adds measured roads above this layer.
    const style = gl.getStyle()
    const firstRoad = style.layers.find(layer =>
      layer.type === 'line' && /road|highway|motorway|street|bridge|tunnel/.test(layer.id))
    const beforeId = firstRoad?.id ||
      style.layers.find(layer => layer.type === 'symbol')?.id
    gl.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': opacity,
        'raster-fade-duration': 0,
        'raster-resampling': 'nearest'
      }
    }, beforeId)
    initialized = true
    return true
  }

  function setOpacity(alpha) {
    if (initialized && gl.getLayer(layerId)) {
      gl.setPaintProperty(layerId, 'raster-opacity', alpha)
    }
  }

  function showFrame(index, alpha) {
    if (!initialized || !paths[index]) return
    setOpacity(alpha)
    gl.getSource(sourceId)?.setTiles([tileUrl(index)])
  }

  function destroy() {
    if (!initialized) return
    if (gl.getLayer(layerId)) gl.removeLayer(layerId)
    if (gl.getSource(sourceId)) gl.removeSource(sourceId)
    removeProtocol(scheme)
    initialized = false
  }

  return { initialize, setOpacity, showFrame, destroy, layerId }
}
