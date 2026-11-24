const IEM = 'https://mesonet.agron.iastate.edu'
const GEOMET = 'https://geo.weather.gc.ca/geomet'
const FORECAST_LAYER = 'GDPS_15km_Precip-Accum1h'
const HALF_WORLD = 20037508.342789244
const ISO_TIME = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/

export function isMrmsCoverage(lat, lon) {
  // Extent of the IEM national raster, not a radar coverage guarantee.
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= 20 && lat < 55 && lon >= -130 && lon < -60
}

function iemDate(unix) {
  return new Date(unix * 1000).toISOString().slice(0, 16).replace(/\D/g, '')
}

export function mrmsFrameCandidates(now = Date.now()) {
  // Archive lags several minutes. Probe the newest candidate before using it.
  const latest = Math.floor((now / 1000 - 4 * 60) / 120) * 120
  return Array.from({ length: 6 }, (_, i) => latest - i * 120)
}

export function mrmsFrames(latest) {
  return Array.from({ length: 12 }, (_, i) => latest - (11 - i) * 120)
}

export function mrmsArchiveUrl(unix) {
  const t = iemDate(unix)
  return IEM + '/archive/data/' + t.slice(0, 4) + '/' + t.slice(4, 6) + '/' +
    t.slice(6, 8) + '/GIS/mrms/lcref_' + t + '.png'
}

export function mrmsTileUrl(frame, z, x, y) {
  // The verified historical IEM /cache endpoint uses north-origin XYZ,
  // even though the service is documented under TMS. Do not invert y.
  return IEM + '/cache/tile.py/1.0.0/mrms::lcref-' + iemDate(frame) +
    '/' + z + '/' + x + '/' + y + '.png'
}

export function xyzBbox(z, x, y) {
  const side = 2 * HALF_WORLD / 2 ** z
  return [x * side - HALF_WORLD, HALF_WORLD - (y + 1) * side,
    (x + 1) * side - HALF_WORLD, HALF_WORLD - y * side]
}

export const forecastCapabilitiesUrl = GEOMET + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&LAYER=' + FORECAST_LAYER
export const forecastLegendUrl = GEOMET + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&STYLE=PRECIPMM&FORMAT=image/png&LAYER=' + FORECAST_LAYER

export function forecastTileUrl(frame, z, x, y) {
  const iso = new Date(frame.time * 1000).toISOString().replace('.000Z', 'Z')
  return GEOMET + '?' + new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap',
    LAYERS: FORECAST_LAYER, STYLES: 'PRECIPMM', CRS: 'EPSG:3857',
    BBOX: xyzBbox(z, x, y).join(','), WIDTH: '256', HEIGHT: '256',
    FORMAT: 'image/png', TRANSPARENT: 'TRUE', TIME: iso, DIM_REFERENCE_TIME: frame.run
  })
}

export function readForecastFrames(xml, now = Date.now()) {
  if (!xml.includes('<Name>' + FORECAST_LAYER + '</Name>')) return []
  const times = xml.match(/<Dimension\b[^>]*\bname="time"[^>]*>([^<]*)<\/Dimension>/i)?.[1] ?? ''
  const runDimension = xml.match(/<Dimension\b[^>]*\bname="reference_time"[^>]*>/i)?.[0] ?? ''
  const run = runDimension.match(/\bdefault="([^"]*)"/)?.[1]
  if (!run || !ISO_TIME.test(run) || !Number.isFinite(Date.parse(run))) return []
  return [...new Set(times.split(',').map(x => x.trim()))].filter(x => ISO_TIME.test(x))
    .map(x => Date.parse(x) / 1000).filter(t => t * 1000 > now && t * 1000 > Date.parse(run))
    .sort((a, b) => a - b).slice(0, 12).map(time => ({ time, run }))
}

// IEM mrms_lcref published color table, entries 86..255, in 0.5 dBZ
// increments. Black (indices 0..85) cannot distinguish values <=10.5 dBZ.
// https://mesonet.agron.iastate.edu/GIS/rasters.php?rid=4
const mrmsColors = [
  0xa4a4ff, 0xa1a1fc, 0x9e9ef9, 0x9a9af6, 0x9797f2, 0x9494ef, 0x9191ec, 0x8e8ee9, 0x8a8ae6, 0x8787e3,
  0x8484e0, 0x8181dc, 0x7e7ed9, 0x7a7ad6, 0x7777d3, 0x7474d0, 0x7171cd, 0x6e6ec9, 0x6a6ac6, 0x6767c3,
  0x4080ff, 0x3e7df9, 0x3d7af2, 0x3b76ec, 0x3a73e6, 0x3870df, 0x366dd9, 0x356ad3, 0x3366cc, 0x3263c6,
  0x3060c0, 0x2e5db9, 0x2d5ab3, 0x2b56ac, 0x2a53a6, 0x2850a0, 0x264d99, 0x254a93, 0x23468d, 0x224386,
  0x204080, 0x00f900, 0x00f200, 0x00ec00, 0x00e600, 0x00df00, 0x00d900, 0x00d300, 0x00cc00, 0x00c600,
  0x00c000, 0x00b900, 0x00b300, 0x00ac00, 0x00a600, 0x00a000, 0x009900, 0x009300, 0x008d00, 0x008600,
  0x008000, 0xfff900, 0xfff200, 0xffec00, 0xffe600, 0xffdf00, 0xffd900, 0xffd300, 0xffcc00, 0xffc600,
  0xffc000, 0xffb900, 0xffb300, 0xffac00, 0xffa600, 0xffa000, 0xff9900, 0xff9300, 0xff8d00, 0xff8600,
  0xff0000, 0xfa0000, 0xf50000, 0xf10000, 0xec0000, 0xe70000, 0xe30000, 0xde0000, 0xd90000, 0xd40000,
  0xcf0000, 0xcb0000, 0xc60000, 0xc10000, 0xbd0000, 0xb80000, 0xb30000, 0xae0000, 0xaa0000, 0xa50000,
  0xff00ff, 0xf900f9, 0xf200f2, 0xec00ec, 0xe600e6, 0xdf00df, 0xd900d9, 0xd300d3, 0xcc00cc, 0xc600c6,
  0xc000c0, 0xb900b9, 0xb300b3, 0xac00ac, 0xa600a6, 0xa000a0, 0x990099, 0x930093, 0x8d008d, 0x860086,
  0xffffff, 0xf9f9f9, 0xf2f2f2, 0xececec, 0xe6e6e6, 0xdfdfdf, 0xd9d9d9, 0xd3d3d3, 0xcccccc, 0xc6c6c6,
  0xc0c0c0, 0xb9b9b9, 0xb3b3b3, 0xacacac, 0xa6a6a6, 0xa0a0a0, 0x999999, 0x939393, 0x8d8d8d, 0x868686,
  0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080,
  0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080,
  0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080, 0x808080,
]
const dbzByColor = new Map()
for (const [i, color] of mrmsColors.entries()) {
  // Duplicate colors are ambiguous; don't fabricate a physical value.
  dbzByColor.set(color, dbzByColor.has(color) ? null : 11 + i / 2)
}

export function decodeMrmsPixel(r, g, b, a) {
  if (a !== 255 || (r === 0 && g === 0 && b === 0)) return null
  return dbzByColor.get((r << 16) | (g << 8) | b) ?? null
}

// The current RainViewer display palette, Universal Blue (rain).
// Physical reflectivity values still come from the independent IEM lookup.
// https://www.rainviewer.com/api/color-schemes.html
const universalBlueRain = [
  0xd2c48b, 0xd6c88f, 0xdacc93, 0xded097, 0x88ddee, 0x6cd1eb, 0x51c5e8, 0x36bae5, 0x1baee2, 0x00a3e0,
  0x009ad5, 0x0091ca, 0x0088bf, 0x007fb4, 0x0077aa, 0x0070a3, 0x00699c, 0x006295, 0x005b8e, 0x005588,
  0x005180, 0x004e78, 0x004a70, 0x004768, 0xffee00, 0xffe000, 0xffd200, 0xffc500, 0xffb700, 0xffaa00,
  0xff9f00, 0xff9500, 0xff8b00, 0xff8100, 0xff4400, 0xf23600, 0xe62800, 0xd91b00, 0xcd0d00, 0xc10000,
  0xa80000, 0x8f0000, 0x760000, 0x5d0000, 0xffaaff, 0xff9fff, 0xff95ff, 0xff8bff, 0xff81ff, 0xff77ff,
  0xff6cff, 0xff62ff, 0xff58ff, 0xff4eff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff,
  0xffffff, 0xffffff, 0xffffff, 0xffffff, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00,
  0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00,
  0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00, 0x00ff00,
]

export function mrmsDisplayMark(dbz) {
  if (!Number.isFinite(dbz) || dbz < 11) return null
  const color = universalBlueRain[Math.min(universalBlueRain.length - 1, Math.round(dbz) - 11)]
  const rgb = [color >> 16, (color >> 8) & 255, color & 255]
  // Keep the original ASCII radar's visual brightness.
  const bright = rgb.map(channel => Math.min(255, Math.round(channel * 1.4)))
  const mark = dbz >= 55 ? '█' : dbz >= 40 ? '▓' : dbz >= 25 ? '▒' : '░'
  return [mark, 'rgb(' + bright.join(',') + ')']
}
