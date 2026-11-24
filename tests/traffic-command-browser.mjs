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
   const viewportOptions={viewport:{width,height},locale:'en-US',timezoneId:'America/Los_Angeles',deviceScaleFactor:1,hasTouch:name==='mobile',isMobile:name==='mobile'}
   const page=await browser.newPage(viewportOptions)
   const errors=[]
   let radarRequests=0
   const sourceTileRequests = new Map()
   page.on('pageerror',err=>errors.push(String(err.message)))
   page.on('request',req=>{if(req.url().includes('rainviewer.com'))radarRequests++})
   // Both terminal commands now use the same-origin Nitro proxy, not direct
   // browser requests to geocoding/forecast providers.
   let resumeSlowLookup, slowLookupHandled
   const slowLookup = new Promise(resolve=>{resumeSlowLookup=resolve})
   const completedSlowLookup = new Promise(resolve=>{slowLookupHandled=resolve})
   await page.route('**/api/terminal-lookup**', async route => {
     const query = new URL(route.request().url()).searchParams
     const city = query.get('city') || 'Seattle'
     if(city==='unlisted') {
       return route.fulfill({status:404,json:{statusMessage:'City not found'}})
     }
     if(city==='slow-city') {
       await slowLookup
       await route.fulfill({status:200,json:{lat:0,lon:0,location:'Stale city'}}).catch(()=>{})
       slowLookupHandled()
       return
     }
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
   // Exercise the labeled fallback independently of the live IEM service.
   await page.route('https://mesonet.agron.iastate.edu/archive/data/**',route=>
     route.fulfill({status:404}))
   const forecastEpoch=Math.ceil(Date.now()/3600000)*3600000
   const iso=ms=>new Date(ms).toISOString().replace('.000Z','Z')
   const forecastTimes=[1,2,3].map(h=>iso(forecastEpoch+h*3600000))
   const forecastRun=iso(forecastEpoch-12*3600000)
   let forecastRequests=0, forecastCapabilities=0, releaseSlowForecast
   const slowForecast=new Promise(resolve=>{releaseSlowForecast=resolve})
   const forecastMetadata=`<Layer><Name>GDPS_15km_Precip-Accum1h</Name>
     <Dimension name="time">${forecastTimes.join(',')}</Dimension>
     <Dimension name="reference_time" default="${forecastRun}"></Dimension>
     </Layer>`
   await page.route('https://geo.weather.gc.ca/geomet?**',async route=>{
     const params=new URL(route.request().url()).searchParams
     if(params.get('REQUEST')==='GetCapabilities') {
       if(++forecastCapabilities===1) await slowForecast
       await route.fulfill({status:200,contentType:'text/xml',body:forecastMetadata}).catch(()=>{})
       return
     }
     if(params.get('LAYERS')!=='GDPS_15km_Precip-Accum1h' ||
        params.get('CRS')!=='EPSG:3857' ||
        params.get('DIM_REFERENCE_TIME')!==forecastRun ||
        !forecastTimes.includes(params.get('TIME'))) {
       errors.push('Unexpected forecast GetMap parameters: '+params.toString())
       await route.abort()
       return
     }
     forecastRequests++
     await route.fulfill({status:200,contentType:'image/png',body:stormTile})
   })
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
   // The page-wide CRT overlay may remain as a STATIC texture. Its old
   // 14-second ::before sweep drew at the screen edges beside the opaque
   // weather footer, creating the illusion of a scrolling map.
   const scanline=await page.locator('.scanlines').evaluate(el=>{
     const overlay=getComputedStyle(el)
     const beam=getComputedStyle(el,'::before')
     return {
       texture:overlay.backgroundImage,
       animation:overlay.animationName,
       beamContent:beam.content,
       beamAnimation:beam.animationName
     }
   })
   if(!scanline.texture.includes('linear-gradient') ||
      scanline.animation!=='none' ||
      !['none','normal',''].includes(scanline.beamContent) ||
      scanline.beamAnimation!=='none') {
     throw Error('Viewport-wide animated CRT beam is still present: '+JSON.stringify(scanline))
   }
   const input=page.locator('footer input').last()
   const terminalInput = await input.evaluate(el => ({
     focused: document.activeElement === el,
     size: parseFloat(getComputedStyle(el).fontSize),
     spellcheck: el.spellcheck,
     autocorrect: el.getAttribute('autocorrect'),
     autocapitalize: el.getAttribute('autocapitalize'),
     autocomplete: el.getAttribute('autocomplete')
   }))
   if(terminalInput.size<16 || terminalInput.spellcheck || terminalInput.autocorrect!=='off' ||
      terminalInput.autocapitalize!=='none' || terminalInput.autocomplete!=='off' ||
      (name==='mobile' && terminalInput.focused)) {
     throw Error('Terminal input should not auto-edit text or focus/zoom on touch devices: '+JSON.stringify(terminalInput))
   }
   if(name==='mobile') {
     await input.tap()
     if(!await input.evaluate(el=>document.activeElement===el)) throw Error('Tapping terminal should focus it')
     await input.press('Enter')
     if(await input.evaluate(el=>document.activeElement===el)) throw Error('Blank Enter should dismiss the keyboard')
     await input.tap()
     if(!await input.evaluate(el=>document.activeElement===el)) throw Error('Tapping terminal should restore focus after Enter')
   }
   await input.fill('traffic Seattle')
   await input.press('Enter')
   await page.getByText('LIVE TRAFFIC SIGNAL').waitFor({timeout:35000})
   await page.waitForSelector('.maplibregl-canvas',{timeout:25000})
   await page.waitForFunction(()=>document.body.innerText.includes('TOMTOM ROADS: LIVE')&&document.body.innerText.includes('WSDOT SENSORS: LIVE'),{timeout:30000})
   await page.waitForTimeout(1500)
   const card=page.locator('[data-terminal-map-card]')
   const assertMapGeometry = async mode => {
     const layout = await card.evaluate(el => {
       const box = el.getBoundingClientRect()
       const map = el.querySelector('.map-crt-effect').getBoundingClientRect()
       const console = document.querySelector('footer').getBoundingClientRect()
       const input = document.querySelector('footer input')
       const field = input.getBoundingClientRect()
       const viewport = document.documentElement.clientWidth
       return { left: box.left, right: viewport-box.right, top: box.top,
         bottom: innerHeight-console.bottom, consoleOverlap:box.bottom-console.top,
         inputHit: document.elementFromPoint(field.x+10,field.y+field.height/2)===input,
         mapRatio: (Math.min(map.bottom, box.bottom) - Math.max(map.top, box.top))/innerHeight,
         scrollLocked: getComputedStyle(document.documentElement).overflowY==='hidden',
         overflow: document.documentElement.scrollWidth-viewport,
         contentOverflow: el.scrollWidth-el.clientWidth }
     })
     if(!layout.scrollLocked || !layout.inputHit || layout.consoleOverlap>0 ||
        [layout.top,layout.bottom,layout.left,layout.right].some(gap=>gap<7||gap>18) ||
        layout.mapRatio < (mode==='traffic' ? 0.72 : 0.52) ||
        layout.overflow>2 || layout.contentOverflow>2) {
       throw Error(mode+' map should stay large and leave the command line reachable: '+JSON.stringify(layout))
     }
   }
   await assertMapGeometry('traffic')
   const closeMap=page.getByRole('button',{name:'Close map'})
   if(await input.evaluate(el=>document.activeElement===el) !== (name==='desktop')) {
     throw Error('Submit must blur the touch input and preserve desktop command focus')
   }
   if(name==='mobile') {
     await input.tap()
     if(!await input.evaluate(el=>document.activeElement===el)) throw Error('Tapping the terminal under a map should focus it again')
   }
   const backgroundCanReceiveFocus=await page.locator('header nav a').first().evaluate(el=>{
     el.focus()
     return document.activeElement===el
   })
   if(backgroundCanReceiveFocus) throw Error('Background navigation stayed focusable')
   await closeMap.focus()
   let reachedTerminal=false
   for(let i=0;i<10;i++) {
     await page.keyboard.press('Tab')
     if(await input.evaluate(el=>document.activeElement===el)) { reachedTerminal=true; break }
   }
   if(!reachedTerminal) throw Error('Map controls trapped focus away from the terminal')
   if(await card.getByRole('group',{name:'Radar timeline'}).count()) {
     throw Error('Dedicated traffic mode must not contain a weather sidebar')
   }
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
   // The next map command goes through the same terminal without closing first.
   await input.fill('weather Seattle')
   await input.press('Enter')
   await page.getByText('LIVE RADAR SIGNAL').waitFor({timeout:30000})
   await assertMapGeometry('weather')
   if(await page.getByText('LIVE TRAFFIC SIGNAL').count())throw Error('Traffic-only header survived weather switch')
   const timeline=page.getByRole('group',{name:'Radar timeline'})
   await timeline.waitFor({timeout:15000})
   const weatherLayout=await card.evaluate(el=>{
     const map=el.querySelector('.map-crt-effect').getBoundingClientRect()
     const controls=el.querySelector('[aria-label="Radar timeline"]').getBoundingClientRect()
     return {mapTop:map.top,mapRight:map.right,mapBottom:map.bottom,
       mapLeft:map.left,controlsTop:controls.top,controlsLeft:controls.left,
       controlsRight:controls.right,timelines:el.querySelectorAll('[aria-label="Radar timeline"]').length}
   })
   if(weatherLayout.timelines!==1 || (name==='desktop'
     ? weatherLayout.controlsLeft<weatherLayout.mapRight+8 ||
       Math.abs(weatherLayout.controlsTop-weatherLayout.mapTop)>2
     : weatherLayout.controlsTop<weatherLayout.mapBottom+8 ||
       Math.abs(weatherLayout.controlsLeft-weatherLayout.mapLeft)>2 ||
       Math.abs(weatherLayout.controlsRight-weatherLayout.mapRight)>2)) {
     throw Error('Weather timeline should sit beside desktop map and below mobile map: '+JSON.stringify(weatherLayout))
   }
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
   const weatherCard=card
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
   const layerButtons=page.getByRole('group',{name:'Weather map layer'})
   await page.getByText('RainViewer radar fallback (not MRMS)',{exact:false}).waitFor()
   await Promise.all([
     page.waitForRequest(req=>req.url().includes('geo.weather.gc.ca') &&
       new URL(req.url()).searchParams.get('REQUEST')==='GetCapabilities',{timeout:10000}),
     layerButtons.getByRole('button',{name:'Precipitation',exact:true}).click({timeout:5000})
   ])
   await page.getByText('LOADING PRECIPITATION',{exact:true}).waitFor()
   // Supersede the metadata request before it resolves; it must not create
   // any forecast tile source or turn Radar's busy state off prematurely.
   await layerButtons.getByRole('button',{name:'Radar',exact:true}).click()
   releaseSlowForecast()
   await page.getByText('RainViewer radar fallback (not MRMS)',{exact:false}).waitFor()
   if(forecastRequests!==0 || await page.getByRole('group',{name:'Precipitation timeline'}).count()) {
     throw Error('A stale forecast replaced the radar after switching')
   }
   await Promise.all([
     page.waitForResponse(res=>res.url().includes('geo.weather.gc.ca') &&
       new URL(res.url()).searchParams.get('REQUEST')==='GetMap',{timeout:20000}),
     layerButtons.getByRole('button',{name:'Precipitation',exact:true}).click({timeout:5000})
   ])
   await page.getByText('Millimetres accumulated in the preceding hour.',{exact:false}).waitFor()
   await page.getByRole('slider',{name:'Scrub precipitation timeline'}).waitFor()
   if(!forecastRequests || await page.getByRole('group',{name:'Radar timeline'}).count()) {
     throw Error('The precipitation forecast did not replace the radar')
   }
   if(name==='mobile') {
     await page.setViewportSize({width:844,height:390})
     await page.waitForFunction(()=>{
       const map=document.querySelector('.map-crt-effect')?.getBoundingClientRect()
       const gl=document.querySelector('.leaflet-gl-layer')?.getBoundingClientRect()
       return map?.width>710 && gl && Math.abs(map.width-gl.width)<4
     },null,{timeout:10000})
     const landscape=await card.evaluate(el=>{
       const map=el.querySelector('.map-crt-effect').getBoundingClientRect()
       const bounds=el.getBoundingClientRect()
       const canScroll=el.scrollHeight>el.clientHeight
       el.scrollTop=el.scrollHeight
       const close=el.querySelector('[aria-label="Close map"]').getBoundingClientRect()
       el.scrollTop=0
       return {mapHeight:map.height,canScroll,closeStillVisible:close.top>=bounds.top}
     })
     if(landscape.mapHeight<220||!landscape.canScroll||!landscape.closeStillVisible) {
       throw Error('Short landscape modal must retain map space, scrolling and Close: '+JSON.stringify(landscape))
     }
     // A shorter portrait visual viewport simulates the phone keyboard
     // reserving space; the same input must still be reachable below the map.
     await page.setViewportSize({width,height:460})
     await page.waitForFunction(()=>{
       const input=document.querySelector('footer input')
       const rect=input.getBoundingClientRect()
       const map=document.querySelector('[data-terminal-map-card]').getBoundingClientRect()
       return rect.bottom<innerHeight && rect.top>map.bottom &&
         document.elementFromPoint(rect.x+10,rect.y+rect.height/2)===input
     },null,{timeout:10000})
     await page.setViewportSize({width,height})
   }
   await closeMap.click()
   await card.waitFor({state:'detached'})
   if(name==='desktop' && !await input.evaluate(el=>document.activeElement===el)) {
     throw Error('The Close button should return desktop focus to the command line')
   }
   if(await page.evaluate(()=>getComputedStyle(document.documentElement).overflowY==='hidden')) {
     throw Error('Closing the map should restore background scrolling')
   }
   const command = async line => { await input.fill(line); await input.press('Enter') }
   await command('traffic Seattle')
   await page.getByRole('region',{name:'Traffic map: Seattle, Washington'}).waitFor()
   await command('weather unlisted')
   await page.getByText('Error fetching weather:',{exact:false}).waitFor()
   await page.getByRole('region',{name:'Traffic map: Seattle, Washington'}).waitFor()
   await command('traffic Boston')
   await page.getByRole('region',{name:'Traffic map: Boston, Massachusetts'}).waitFor()
   if(await page.getByRole('region',{name:'Traffic map: Seattle, Washington'}).count()) {
     throw Error('Replacing a map in the same mode retained the old location')
   }
   await Promise.all([
     page.waitForRequest(req=>req.url().includes('city=slow-city'),{timeout:8000}),
     command('weather slow-city')
   ])
   await page.getByText('Locating slow-city...').waitFor()
   await page.getByRole('region',{name:'Traffic map: Boston, Massachusetts'}).waitFor()
   await command('clear')
   await card.waitFor({state:'detached'})
   const staleMapReappeared = card.waitFor({state:'attached',timeout:500}).then(()=>true, error=>{
     if(error.name!=='TimeoutError') throw error
     return false
   })
   resumeSlowLookup()
   await completedSlowLookup
   if(await staleMapReappeared) throw Error('A cancelled lookup reopened a cleared map')
   await command('pwd')
   await page.getByText('/home/user',{exact:true}).waitFor()
   if(await card.count()) throw Error('A superseded map lookup reopened the panel')
   await command('traffic Seattle')
   await card.waitFor()
   await input.press('Escape')
   await card.waitFor({state:'detached'})
   if(!await input.evaluate(el=>document.activeElement===el)) throw Error('Escape dropped terminal focus')
   await command('weather Seattle')
   await card.waitFor()
   await command('pwd')
   await page.getByText('/home/user',{exact:true}).waitFor()
   await card.waitFor({state:'detached'})
   await command('traffic Seattle')
   await card.waitFor()
   await Promise.all([
     page.waitForURL('**/about',{timeout:10000}),
     command('cd about')
   ])
   await card.waitFor({state:'detached'})
   await page.goBack()
   await page.waitForURL(`http://127.0.0.1:${port}/`)
   const output=page.locator('footer [role="status"]')
   for(const helpCommand of ['spotify —help','nowplaying --help','man spotify']) {
     await command(helpCommand)
     await output.filter({hasText:'nowplaying, spotify'}).waitFor()
     if(!(await output.innerText()).includes('--connect')) throw Error('Spotify manual omitted sign-in flag')
   }
   await command('ls -a')
   if(!(await output.innerText()).startsWith('.  ..')) throw Error('ls -a omitted dot entries')
   await command('ls -al')
   if(!/^total /.test(await output.innerText()) || !(await output.innerText()).includes('  ..')) throw Error('ls -al omitted dot entries')
   await command('ls -z')
   await output.filter({hasText:'Try ls --help.'}).waitFor()
   await command('whoami')
   await page.getByText('user',{exact:true}).waitFor()
   await command('echo Hello Seattle')
   await page.getByText('Hello Seattle',{exact:true}).waitFor()
   await input.fill('spot')
   await input.press('Tab')
   if(await input.inputValue()!=='spotify ') throw Error('Tab did not complete the command')
   if(!await input.evaluate(el=>document.activeElement===el)) throw Error('Completion lost terminal focus')
   await input.press('Tab')
   if(await input.evaluate(el=>document.activeElement===el)) throw Error('Tab trapped terminal focus')
   await input.fill('cat ~/re')
   await input.press('Tab')
   if(await input.inputValue()!=='cat ~/README ') throw Error('Tab did not complete the public virtual file')
   await input.press('Enter')
   await output.filter({hasText:'Welcome to Mamoon’s website terminal.'}).waitFor()
   await command('cat /etc/passwd')
   await output.filter({hasText:'No such virtual file'}).waitFor()
   await command('pwd')
   await input.fill('unsent draft')
   await input.press('ArrowUp')
   if(await input.inputValue()!=='pwd') throw Error('Up did not recall the prior command')
   await input.press('ArrowDown')
   if(await input.inputValue()!=='unsent draft') throw Error('Down did not restore unsent text')
   await command('echo do-not-retain-this-text')
   await command('cd draft')
   await page.locator('footer input[type="password"]').waitFor()
   await input.fill('not-a-real-password')
   await input.press('ArrowUp')
   if(await input.inputValue()!=='not-a-real-password') throw Error('History answered inside a password prompt')
   await input.press('Enter')
   await output.filter({hasText:'AUTHENTICATION FAILED'}).waitFor()
   await input.press('ArrowUp')
   if(await input.inputValue()!=='cd draft') throw Error('Password prompt leaked into history')
   await input.press('ArrowUp')
   if(await input.inputValue()!=='pwd') throw Error('Echo or a non-public file leaked into history')
   // A revoked Spotify refresh token used to silently clear the terminal.
   // Regress the visible owner-reauthorization message in both viewport sizes.
   await page.route('**/api/spotify',route=>route.fulfill({
     status:200,contentType:'application/json',
     body:JSON.stringify({code:'REAUTHORIZE',
       error:'Spotify authorization expired. Site owner: run spotify connect to reconnect.'})
   }))
   for(const playback of ['nowplaying','spotify']) {
     await Promise.all([
       page.waitForRequest(req=>new URL(req.url()).pathname==='/api/spotify',{timeout:6000}),
       command(playback)
     ])
     await page.getByText('[SPOTIFY] Spotify authorization expired. Site owner: run spotify --connect to reconnect.').waitFor({timeout:5000})
   }
   if(await page.locator('.spotify-card').count()) {
     throw Error('Nowplaying rendered stale Spotify card after auth expiry')
   }
   // The owner-only renewal UI is reachable from the actual terminal,
   // without placing credentials in a URL or exposing any token on the page.
   for(const command of ['spotify --connect','spotify —connect','spotify connect','nowplaying --connect','nowplaying —connect']){
     // Each spelling starts at the terminal in its own browser context. The
     // connect page intentionally does not need a terminal or prior history.
     const aliasPage=await browser.newPage(viewportOptions)
     aliasPage.on('pageerror',err=>errors.push(String(err.message)))
     try {
       await aliasPage.goto(`http://127.0.0.1:${port}/`,{waitUntil:'load',timeout:60000})
       const aliasInput=aliasPage.getByPlaceholder('type command (e.g. cd projects)')
       await aliasInput.fill(command)
       await Promise.all([
         aliasPage.waitForURL(`http://127.0.0.1:${port}/spotify/connect`,{timeout:10000}),
         aliasInput.press('Enter')
       ])
       await aliasPage.getByRole('heading', { name: 'Reconnect nowplaying' }).waitFor({timeout:10000})
       const renewalForm=aliasPage.locator('form[action="/api/spotify/connect"]')
       if(await renewalForm.count()!==1 ||
          await renewalForm.locator('input').count()!==0 ||
          await renewalForm.getByRole('button', { name: 'SIGN IN WITH SPOTIFY' }).count()!==1 ||
          await renewalForm.getAttribute('method')!=='POST') {
         throw Error('Secure Spotify renewal form is missing for '+command)
       }
     } finally {
       await aliasPage.close()
     }
   }
   if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors))
   await page.close()
 }
 writeFileSync('preview-output/traffic-browser-report.json',JSON.stringify(summaries,null,2))
 console.log('TRAFFIC_BROWSER_REPORT '+JSON.stringify(summaries))
} finally {if(browser)await browser.close();child.kill()}


