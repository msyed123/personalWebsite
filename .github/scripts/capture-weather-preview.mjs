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
const png = new PNG({ width: 256, height: 256 })
for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4
    const seam = (x - 55) * 0.65 + 65 + Math.sin(x / 24) * 23
    const mask = Math.abs(y - seam) < 40 + Math.sin(x / 17) * 15
    const pixel = mask && ((x * 17 + y * 13) % 19) !== 0
    png.data[i] = 0
    png.data[i + 1] = pixel ? 165 + (x % 50) : 0
    png.data[i + 2] = pixel ? 205 + (y % 40) : 0
    png.data[i + 3] = pixel ? 190 : 0
  }
}
const rainTile = PNG.sync.write(png)

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
await page.route('https://tilecache.rainviewer.com/**', route => route.fulfill({
  status:200,contentType:'image/png',body:rainTile
}))

await page.goto(`${base}/__weather-preview`,{waitUntil:'domcontentloaded',timeout:60_000})
await page.waitForSelector('.leaflet-container',{timeout:30_000})
await page.waitForSelector('.maplibregl-canvas',{timeout:30_000})
try {
  await page.waitForFunction(() => document.body.innerText.includes('TRAFFIC [ON]') && document.body.innerText.includes('LIVE'),{timeout:20_000})
} catch { messages.push('Timed out waiting for TRAFFIC [ON] and LIVE; status: '+(await page.locator('body').innerText()).slice(0,500)) }
await page.waitForTimeout(3500)
const card=page.locator('[class*="max-w-2xl"]').last()
await card.screenshot({path:path.join(outputDir,'weather-card-polished-on.png')})
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
