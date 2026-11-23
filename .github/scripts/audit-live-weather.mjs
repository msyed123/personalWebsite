import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('diagnostic-output',{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']})
const results=[]
for(const [name,width,height] of [['desktop',1366,920],['mobile',390,844]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,timezoneId:'America/Los_Angeles'})
 const errors=[], responses=[]
 page.on('pageerror',e=>errors.push(String(e.message).slice(0,300)))
 page.on('response',res=>{
   const u=new URL(res.url())
   if(u.hostname==='www.msyed.space' && u.pathname.startsWith('/api/traffic/')){
     responses.push({path:u.pathname.split('/').slice(0,5).join('/'),status:res.status()})
   }
 })
 try{
   await page.goto('https://www.msyed.space/',{waitUntil:'domcontentloaded',timeout:35000})
   const input=page.locator('input').filter({hasNot:page.locator('[type="hidden"]')}).last()
   await input.fill('weather Seattle')
   await input.press('Enter')
   await page.waitForSelector('.leaflet-container',{timeout:30000})
   await page.waitForTimeout(8000)
   const card=page.locator('[class*="max-w-2xl"]').last()
   await card.screenshot({path:`diagnostic-output/${name}-weather-card.png`})
   const metrics=await page.evaluate(()=>{
     const map=document.querySelector('.leaflet-container')
     const card=map?.closest('.max-w-2xl')
     if(!map||!card)return {}
     const m=map.getBoundingClientRect(),c=card.getBoundingClientRect()
     return {viewportWidth:innerWidth,cardWidth:Math.round(c.width),mapWidth:Math.round(m.width),mapHeight:Math.round(m.height),cardOverflow:c.right>innerWidth,trafficText:(card.innerText.match(/TRAFFIC[^\\n]*/)||[])[0]||'',trafficLines:document.querySelectorAll('.maplibregl-canvas').length}
   })
   results.push({name,metrics,errors,responses})
 }catch(e){results.push({name,error:String(e).slice(0,400),errors,responses})}
 await page.close()
}
writeFileSync('diagnostic-output/live-visibility.json',JSON.stringify(results,null,2))
console.log('LIVE_VISIBILITY '+JSON.stringify(results))
await browser.close()
