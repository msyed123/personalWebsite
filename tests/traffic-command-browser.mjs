import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdirSync,writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

mkdirSync('preview-output',{recursive:true})
const storm=new PNG({width:256,height:256})
for(let y=0;y<256;y++)for(let x=0;x<256;x++){
 const i=(y*256+x)*4
 const c=((x-155)/48)**2+((y-165)/38)**2
 const rain=c<1.3 && (x*17+y*13)%29!==0
 storm.data[i]=rain?12:0
 storm.data[i+1]=rain?80:0
 storm.data[i+2]=rain?205:0
 storm.data[i+3]=rain?225:0
}
const stormTile=PNG.sync.write(storm)
const variants=[stormTile]
for(const variant of [1,2]) {
  const alt=new PNG({width:256,height:256})
  for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    const i=(y*256+x)*4
    // Keep all three storm fields over the small cropped Seattle viewport at
    // z=7, while changing both position and rain intensity between frames.
    const dx=(x-(variant===1?143:112))/46
    const dy=(y-(variant===1?192:175))/38
    const rain=dx*dx+dy*dy<1.4 && (x*13+y*17)%29!==0
    alt.data[i]=rain?(variant===1?210:15):0
    alt.data[i+1]=rain?(variant===1?135:195):0
    alt.data[i+2]=rain?(variant===1?45:160):0
    alt.data[i+3]=rain?225:0
  }
  variants.push(PNG.sync.write(alt))
}
const port=4357
const child=spawn(process.execPath,['.output/server/index.mjs'],{
 env:{...process.env,NITRO_PORT:String(port),NITRO_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']
})
let serverErrors=''
child.stderr.on('data',d=>serverErrors+=String(d).slice(0,15000))
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let browser
try{
 let boot=false
 for(let i=0;i<80;i++){
   try{const r=await fetch(`http://127.0.0.1:${port}`);if(r.ok){boot=true;break}}catch{}
   await sleep(200)
 }
 if(!boot)throw Error('Nuxt failed to start '+serverErrors)
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']})
 const summaries=[]
 for(const [name,width,height] of [['desktop',1100,930],['mobile',390,844]]){
   const page=await browser.newPage({viewport:{width,height},locale:'en-US',timezoneId:'America/Los_Angeles',deviceScaleFactor:1})
   const errors=[]
   let radarRequests=0
   const sourceTileRequests = new Map()
   page.on('pageerror',err=>errors.push(String(err.message)))
   page.on('request',req=>{if(req.url().includes('rainviewer.com'))radarRequests++})
   // Both terminal commands now use the same-origin Nitro proxy, not direct
   // browser requests to geocoding/forecast providers.
   await page.route('**/api/terminal-lookup**', route => {
     const query = new URL(route.request().url()).searchParams
     const city = query.get('city') || 'Seattle'
     const place = city.toLowerCase() === 'boston'
       ? { lat:42.3601, lon:-71.0589, location:'Boston, Massachusetts' }
       : { lat:47.6062, lon:-122.3321, location:'Seattle, Washington' }
     const body = query.get('mode') === 'weather'
       ? { ...place, temp:48, code:3 }
       : place
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
   })
   await page.route('https://api.rainviewer.com/public/weather-maps.json',route=>route.fulfill({
     status:200,contentType:'application/json',
     body:JSON.stringify({radar:{past:[
       {path:'/v2/radar/test-1',time:1763870700},
       {path:'/v2/radar/test-2',time:1763871300},
       {path:'/v2/radar/test-3',time:1763871900}
     ]}})
   }))
   await page.route('https://tilecache.rainviewer.com/**',route=>{
     const url=route.request().url()
     sourceTileRequests.set(url,(sourceTileRequests.get(url)||0)+1)
     const variant=url.includes('/test-3/')?2:url.includes('/test-2/')?1:0
     return route.fulfill({status:200,contentType:'image/png',body:variants[variant]})
   })
   await page.route('**/api/traffic/status',route=>route.fulfill({
     status:200,contentType:'application/json',body:JSON.stringify({roads:true,stations:true,refreshSeconds:180})
   }))
   const roadFeatures=[
     {type:'Feature',geometry:{type:'LineString',coordinates:[[-122.348,47.609],[-122.336,47.612],[-122.324,47.622]]},properties:{kind:'road',source:'TomTom',condition:'heavy',relativeSpeed:0.27,retrievedAt:'2026-11-23T08:45:00Z'}},
     {type:'Feature',geometry:{type:'LineString',coordinates:[[-122.35,47.606],[-122.332,47.604],[-122.312,47.602]]},properties:{kind:'road',source:'TomTom',condition:'slow',relativeSpeed:0.6,retrievedAt:'2026-11-23T08:45:00Z'}}
   ]
   await page.route('**/api/traffic/roads/**',route=>route.fulfill({
     status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:roadFeatures})
   }))
   await page.route('**/api/traffic/stations**',route=>route.fulfill({
     status:200,contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[-122.33,47.614]},properties:{kind:'sensor',source:'WSDOT',condition:'flowing',observedAt:'2026-11-23T08:44:00Z'}}]})
   }))
   await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'domcontentloaded',timeout:60000})
   const input=page.locator('footer input').last()
   await input.fill('traffic Seattle')
   await input.press('Enter')
   await page.getByText('LIVE TRAFFIC SIGNAL').waitFor({timeout:35000})
   await page.waitForSelector('.maplibregl-canvas',{timeout:25000})
   await page.waitForFunction(()=>document.body.innerText.includes('TOMTOM ROADS: LIVE')&&document.body.innerText.includes('WSDOT SENSORS: LIVE'),{timeout:30000})
   await page.waitForTimeout(1500)
   const card=page.locator('[class*="max-w-2xl"]').last()
   const info=await card.evaluate(el=>({
     text:el.innerText.slice(0,600),
     width:Math.round(el.getBoundingClientRect().width),
     mapHeight:Math.round(el.querySelector('.leaflet-container')?.getBoundingClientRect().height||0),
     overflowsViewport:el.getBoundingClientRect().right > innerWidth+2
   }))
   if(radarRequests!==0)throw Error('traffic mode fetched RainViewer '+radarRequests)
   if(info.overflowsViewport)throw Error('traffic card overflows viewport')
   if(info.mapHeight<310)throw Error('traffic map not tall enough')
   await card.screenshot({path:`preview-output/traffic-card-${name}-on.png`})
   await page.getByRole('button',{name:'Turn traffic overlay off'}).click()
   await page.getByRole('button',{name:'Turn traffic overlay on'}).waitFor({timeout:5000})
   await card.screenshot({path:`preview-output/traffic-card-${name}-off.png`})
   if(!info.text.includes('TOMTOM ROADS: LIVE'))throw Error('No per-provider health')
   // Existing weather command still changes modes and obtains weather.
   await input.fill('weather Seattle')
   await input.press('Enter')
   await page.getByText('LIVE RADAR SIGNAL').waitFor({timeout:30000})
   if(await page.getByText('LIVE TRAFFIC SIGNAL').count())throw Error('Traffic-only header survived weather switch')
   const timeline=page.getByRole('group',{name:'Radar timeline'})
   await timeline.waitFor({timeout:15000})
   const slider=page.getByRole('slider',{name:'Scrub radar timeline'})
   await page.waitForFunction(() => {
     const input=document.querySelector('input[aria-label="Scrub radar timeline"]')
     return input && input.max==='2'
   },{timeout:15000})
   await page.getByRole('button',{name:'Pause radar animation'}).click()
   await slider.evaluate(el=>{
     el.value='2'
     el.dispatchEvent(new Event('input',{bubbles:true}))
   })
   await page.waitForFunction(() => document.querySelector('input[aria-label="Scrub radar timeline"]')?.value==='2')
   // The scrubber may lead a tile load. Wait for the selected frame to be
   // rendered, not an arbitrary time delay.
   await page.waitForFunction(() =>
     document.querySelector('[aria-label="Radar timeline"]')?.getAttribute('aria-busy') === 'false',
     null, {timeout:20000})
   const weatherCard=page.locator('[class*="max-w-2xl"]').last()
   // The non-draggable radar map must never render a padded, overflowing GL
   // surface beside the terminal card. Check both the surface geometry and
   // compositor containment; overflow:hidden alone was not sufficient.
   const mapViewport=await weatherCard.locator('.map-crt-effect').evaluate(el=>{
     const container=el.getBoundingClientRect()
     const canvasLayer=el.querySelector('.leaflet-gl-layer')?.getBoundingClientRect()
     const style=getComputedStyle(el)
     return {
       viewportWidth:container.width,
       viewportHeight:container.height,
       layerWidth:canvasLayer?.width,
       layerHeight:canvasLayer?.height,
       layerLeft:canvasLayer?.left,
       layerRight:canvasLayer?.right,
       viewportLeft:container.left,
       viewportRight:container.right,
       containment:style.contain,
       clipPath:style.clipPath,
       filter:style.filter,
       overflowX:style.overflowX,
       overflowY:style.overflowY
     }
   })
   if(!mapViewport.layerWidth ||
      Math.abs(mapViewport.layerWidth-mapViewport.viewportWidth)>4 ||
      Math.abs(mapViewport.layerHeight-mapViewport.viewportHeight)>4 ||
      mapViewport.layerLeft<mapViewport.viewportLeft-3 ||
      mapViewport.layerRight>mapViewport.viewportRight+3) {
     throw Error('Weather GL canvas extends beyond its viewport: '+JSON.stringify(mapViewport))
   }
   if(!mapViewport.containment.includes('paint') || mapViewport.clipPath==='none' ||
      mapViewport.filter!=='none' ||
      mapViewport.overflowX!=='hidden' || mapViewport.overflowY!=='hidden') {
     throw Error('Weather viewport does not safely clip WebGL rendering: '+JSON.stringify(mapViewport))
   }
   await weatherCard.screenshot({path:`preview-output/weather-timeline-${name}.png`})
   await page.getByRole('button',{name:'Next radar frame'}).click()
   await page.waitForFunction(() => document.querySelector('input[aria-label="Scrub radar timeline"]')?.value==='0')
   await page.waitForTimeout(350)
   await weatherCard.screenshot({path:`preview-output/weather-timeline-midfade-${name}.png`})
   await page.waitForFunction(() =>
     document.querySelector('[aria-label="Radar timeline"]')?.getAttribute('aria-busy') === 'false',
     null, {timeout:20000})
   await weatherCard.screenshot({path:`preview-output/weather-timeline-wrapped-${name}.png`})
   if(radarRequests < 2)throw Error('ASCII radar was never requested inside MapLibre: '+radarRequests)
   if((await timeline.innerText()).includes('LOADING FRAME')) {
     throw Error('Timeline status must not change width for every frame')
   }

   // Load every precipitation frame for the current viewport exactly once.
   // All subsequent rounds should reuse the cached PNG and rendered ASCII
   // canvases, with no further RainViewer CDN requests.
   const timelineLayout=async () => timeline.evaluate(el=>{
     const slider=el.querySelector('[aria-label="Scrub radar timeline"]')
     const a=el.getBoundingClientRect(), b=slider.getBoundingClientRect()
     return {height:Math.round(a.height),playheadOffset:Math.round(b.top-a.top)}
   })
   const beforeLoopLayout=await timelineLayout()
   const chooseFrame=async target=>{
     await slider.evaluate((el,value)=>{
       el.value=String(value)
       el.dispatchEvent(new Event('input',{bubbles:true}))
     },target)
     await page.waitForFunction(value=>
       document.querySelector('[aria-label="Scrub radar timeline"]')?.value===String(value),
       target,{timeout:10000})
     await page.waitForFunction(()=>
       document.querySelector('[aria-label="Radar timeline"]')?.getAttribute('aria-busy')==='false',
       null,{timeout:20000})
   }
   await chooseFrame(1)
   await chooseFrame(2)
   await chooseFrame(0)
   const loadedOnce=Array.from(sourceTileRequests.values()).reduce((a,b)=>a+b,0)
   if(loadedOnce<3)throw Error('Expected first-time tiles for three frames; got '+loadedOnce)
   await chooseFrame(1)
   await chooseFrame(2)
   await chooseFrame(0)
   const afterSecondLoop=Array.from(sourceTileRequests.values()).reduce((a,b)=>a+b,0)
   if(afterSecondLoop!==loadedOnce) {
     throw Error('Loop re-fetched '+(afterSecondLoop-loadedOnce)+' cached radar PNGs')
   }
   const afterLoopLayout=await timelineLayout()
   if(JSON.stringify(beforeLoopLayout)!==JSON.stringify(afterLoopLayout)) {
     throw Error('Scrubber box shifts between frames: '+JSON.stringify({beforeLoopLayout,afterLoopLayout}))
   }
   if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors))
   summaries.push({name,radarRequestsBeforeWeather:0,radarRequestsAfterWeather:radarRequests,
     sliderMax:await slider.getAttribute('max'),sliderValue:await slider.inputValue(),
     firstPassCDNRequests:loadedOnce,secondPassCDNRequests:afterSecondLoop,
     timelineLayout:afterLoopLayout,...info,pageErrors:errors})
   await page.close()
 }
 writeFileSync('preview-output/traffic-browser-report.json',JSON.stringify(summaries,null,2))
 console.log('TRAFFIC_BROWSER_REPORT '+JSON.stringify(summaries))
} finally {if(browser)await browser.close();child.kill()}
