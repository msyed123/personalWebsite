import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'

const port = Number(process.env.PREVIEW_PORT || 3456)
const base = `http://127.0.0.1:${port}`
const outputDir = 'preview-output'
fs.mkdirSync(outputDir, { recursive: true })

// A test image with precipitation on part of a transparent radar tile. The
// WeatherCard's real pixel/ASCII canvas processing applies to this fixture.
// The production component fetches RainViewer at zoom 7 and crops to zoom 11.
// Put simulated rain over the Seattle Waterfront sub-region of that macro-tile,
// rather than drawing rain outside the cropped area.
function makeRadarTile(frame = 0) {
  const png = new PNG({ width: 256, height: 256 })
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4
      const shift = frame * 2.2
      const northBand = 175 + 0.28 * (x - 125) + 5 * Math.sin(x / 14 + frame / 4) + shift
      const southBand = 194 - 0.18 * (x - 165) + 5 * Math.sin(x / 16) - shift
      const thickness = 13 + 3 * Math.sin(x / 21)
      const inNorth = Math.abs(y - northBand) < thickness
      const inSouth = Math.abs(y - southBand) < 12
      const noise = ((x * 31 + y * 17 + (x * y) % 47 + frame * 29) % 100) / 100
      const raining = x > 85 && x < 225 && y > 115 && y < 235 &&
        (inNorth || inSouth) && noise > 0.19
      png.data[i] = raining ? 0 : 0
      png.data[i + 1] = raining ? 170 + (x % 45) : 0
      png.data[i + 2] = raining ? 195 + (y % 45) : 0
      png.data[i + 3] = raining ? 230 : 0
    }
  }
  return PNG.sync.write(png)
}
const rainTiles = [0, 1, 2].map(makeRadarTile)

const mockRoads = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.341,47.653],[-122.34,47.636],[-122.336,47.625],[-122.335,47.614],[-122.331,47.599],[-122.328,47.589],[-122.327,47.570]
    ] }, properties: { kind:'road', source:'TomTom', condition:'heavy', relativeSpeed:0.28, observedAt:null, retrievedAt:'2026-11-22T22:40:00Z' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.343,47.614],[-122.332,47.613],[-122.316,47.614],[-122.298,47.615],[-122.278,47.614]
    ] }, properties: { kind:'road', source:'TomTom', condition:'slow', relativeSpeed:0.62, observedAt:null, retrievedAt:'2026-11-22T22:40:00Z' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.342,47.592],[-122.333,47.589],[-122.305,47.592],[-122.277,47.591],[-122.255,47.591]
    ] }, properties: { kind:'road', source:'TomTom', condition:'flowing', relativeSpeed:0.86, observedAt:null, retrievedAt:'2026-11-22T22:40:00Z' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.343,47.646],[-122.326,47.646],[-122.292,47.646],[-122.268,47.645]
    ] }, properties: { kind:'road', source:'TomTom', condition:'closed', relativeSpeed:null, observedAt:null, retrievedAt:'2026-11-22T22:40:00Z' } }
  ]
}
const mockStations = {
  type: 'FeatureCollection',
  features: [
    [-122.337,47.627,'slow'],[-122.330,47.602,'heavy'],[-122.315,47.591,'flowing']
  ].map(([lon,lat,condition],i) => ({
    type:'Feature',
    geometry:{ type:'Point', coordinates:[lon,lat] },
    properties:{ kind:'sensor', source:'WSDOT', condition, relativeSpeed:null,
      observedAt:'2026-11-22T22:42:00Z', retrievedAt:null, stationId:String(i+1) }
  }))
}

const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']})
const page = await browser.newPage({viewport:{width:900,height:780},deviceScaleFactor:2,locale:'en-US',timezoneId:'America/Los_Angeles'})
const messages = []
page.on('console', msg => { if (msg.type()==='error') messages.push('console: '+msg.text()) })
page.on('pageerror', err => messages.push('pageerror: '+err.message))
page.on('requestfailed', req => messages.push('requestfailed: '+req.url()+' '+req.failure()?.errorText))
let radarRequests = 0

await page.route('**/api/traffic/status', route => route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify({roads:true,stations:true,refreshSeconds:180})
}))
await page.route('**/api/traffic/roads/**', route => {
  // Only one visible tile supplies the road geometry, avoiding duplicates.
  const pathMatch = route.request().url().match(/\/api\/traffic\/roads\/(\d+)\/(\d+)\/(\d+)/)
  const shouldShow = Boolean(pathMatch) && (() => {
    const [, z, x, y] = pathMatch.map(Number)
    const centerLon = -122.3394, centerLat = 47.6066
    const tileX = Math.floor(((centerLon + 180) / 360) * (2 ** z))
    const sin = Math.sin(centerLat * Math.PI / 180)
    const tileY = Math.floor((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * (2 ** z))
    return x === tileX && y === tileY
  })()
  return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(shouldShow ? mockRoads : {type:'FeatureCollection',features:[]})})
})
await page.route('**/api/traffic/stations**', route => route.fulfill({
  status:200,contentType:'application/json',body:JSON.stringify(mockStations)
}))
const times=[1763851200,1763851800,1763852400]
await page.route('https://api.rainviewer.com/public/weather-maps.json', route => route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({radar:{past:times.map((time,i)=>({time,path:`/v2/radar/fixture-${i}`}))}})
}))
await page.route('https://tilecache.rainviewer.com/**', route => {
  radarRequests++
  const index = Number(route.request().url().match(/fixture-(\\d+)/)?.[1] || 0)
  return route.fulfill({status:200,contentType:'image/png',body:rainTiles[index] ?? rainTiles[0]})
})

await page.goto(`${base}/__weather-preview`,{waitUntil:'domcontentloaded',timeout:60_000})
await page.waitForSelector('.leaflet-container',{timeout:30_000})
await page.waitForSelector('.maplibregl-canvas',{timeout:30_000})
try {
  await page.waitForFunction(() => document.body.innerText.includes('TRAFFIC [ON]') && document.body.innerText.includes('LIVE'),{timeout:20_000})
} catch { messages.push('Timed out waiting for TRAFFIC [ON] and LIVE; status: '+(await page.locator('body').innerText()).slice(0,500)) }
await page.waitForTimeout(3500)
const card=page.locator('[class*="max-w-2xl"]').last()
await card.screenshot({path:path.join(outputDir,'weather-card-polished-on.png')})
const pixels = PNG.sync.read(fs.readFileSync(path.join(outputDir,'weather-card-polished-on.png')))
let radarPixelCount = 0
for (let i = 0; i < pixels.data.length; i += 4) {
  const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]
  if (b > 125 && b > r * 1.6 && g > r * 1.5) radarPixelCount++
}
const mapPixels = (() => {
  let count = 0
  const minY = Math.floor(pixels.height * 0.27)
  const maxY = Math.floor(pixels.height * 0.82)
  for (let y = minY; y < maxY; y++) {
    for (let x = 35; x < pixels.width - 35; x++) {
      const i = (y * pixels.width + x) * 4
      const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2]
      if (b > 165 && g > 130 && b > r * 1.7) count++
    }
  }
  return count
})()
console.log('Map cyan pixels:', mapPixels, 'radar requests:', radarRequests)
if (!radarRequests) throw new Error('Radar tile endpoint was never requested')
if (mapPixels < 1000) throw new Error('Radar not visibly present inside map: '+mapPixels)
console.log('Radar pixels visible:', radarPixelCount)
await page.screenshot({path:path.join(outputDir,'weather-preview-context.png'),fullPage:true})
const trafficButton = page.getByRole('button',{name:'Turn traffic overlay off'})
if (!await trafficButton.isVisible()) throw new Error('Traffic ON toggle missing')
await trafficButton.click()
await page.getByRole('button',{name:'Turn traffic overlay on'}).waitFor({timeout:5000})
if (!await page.locator('button:has-text("TRAFFIC [OFF]")').isVisible()) throw new Error('Traffic OFF label missing')
await card.screenshot({path:path.join(outputDir,'weather-card-polished-off.png')})
await page.getByRole('button',{name:'Turn traffic overlay on'}).click()
await page.getByRole('button',{name:'Turn traffic overlay off'}).waitFor({timeout:5000})

// The real card appears in a narrow footer on mobile. Catch regressions there too.
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(1500)
await card.screenshot({path:path.join(outputDir,'weather-card-mobile-on.png')})
await page.getByRole('button',{name:'Turn traffic overlay off'}).click()
await page.getByRole('button',{name:'Turn traffic overlay on'}).waitFor({timeout:5000})
await card.screenshot({path:path.join(outputDir,'weather-card-mobile-off.png')})
const fitsViewport = await card.evaluate(node => {
  const bounds = node.getBoundingClientRect()
  return bounds.left >= -1 && bounds.right <= window.innerWidth + 1
})
if (!fitsViewport) throw new Error('Weather card overflows mobile viewport')
fs.writeFileSync(path.join(outputDir,'browser-debug.txt'),messages.join('\n'))
console.log(JSON.stringify({url:page.url(),title:await page.title(),
  cardSize:await card.boundingBox(),status:(await page.locator('body').innerText()).slice(0,600),
  errors:messages.slice(0,15)}))
await browser.close()
