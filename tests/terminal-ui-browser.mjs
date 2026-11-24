import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = 4572
const child = spawn(process.execPath, [
  '--import', resolve(root,'tests/fixtures/mock-terminal-providers.mjs'),
  resolve(root,'.output/server/index.mjs')
], {
  cwd:root, env:{...process.env,NITRO_PORT:String(port),NITRO_HOST:'127.0.0.1',
    NUXT_TOMTOM_TRAFFIC_KEY:'dummy-test-credential'}, stdio:['ignore','pipe','pipe']
})
let stderr=''
child.stderr.on('data', data=>stderr+=String(data).slice(0,2000))
let browser
const wait=ms=>new Promise(r=>setTimeout(r,ms))
try {
  let up=false
  for(let i=0;i<60;i++){
    try{const response=await fetch(`http://127.0.0.1:${port}/api/traffic/status`); if(response.ok){up=true;break}}catch{}
    await wait(200)
  }
  assert.ok(up,'Preview server did not start: '+stderr.slice(-400))
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader']})
  const page=await browser.newPage({viewport:{width:900,height:720}})
  const external=[]
  page.on('request',req=>{
    if(req.url().includes('api.open-meteo.com')||req.url().includes('geocoding-api.open-meteo.com')) external.push(req.url())
  })
  await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'domcontentloaded',timeout:50000})
  const input=page.getByRole('textbox',{name:'Terminal command'})
  const prompt = page.getByRole('form',{name:'Terminal'})
  const idleOutline = await prompt.evaluate(el => {
    el.querySelector('input').blur()
    return getComputedStyle(el).outlineStyle
  })
  assert.equal(idleOutline, 'none', 'Unfocused terminal should not show a focus outline')
  const assertTerminalFocus = async () => {
    const style = await prompt.evaluate(el => {
      const { color, outlineColor, outlineStyle, outlineWidth } = getComputedStyle(el)
      return { color, outlineColor, outlineStyle, outlineWidth, inputFocused: el.contains(document.activeElement) }
    })
    assert.equal(style.inputFocused, true)
    assert.equal(style.color, 'rgb(255, 176, 0)', 'Terminal prompt should keep its amber theme')
    assert.equal(style.outlineColor, style.color)
    assert.equal(style.outlineStyle, 'solid')
    assert.equal(style.outlineWidth, '1px')
  }
  await input.fill('weather')
  await assertTerminalFocus()
  await input.press('Enter')
  await page.getByText('RADAR SIGNAL').waitFor({timeout:20000})
  assert.ok((await page.locator('body').innerText()).includes('Seattle, Washington'))
  assert.ok((await page.locator('body').innerText()).includes('43°'))
  assert.equal(external.length,0,'Forecast/geocode bypassed same-origin proxy')
  await input.fill('traffic Seattle')
  await assertTerminalFocus()
  await input.press('Enter')
  await page.getByText('LIVE TRAFFIC SIGNAL').waitFor({timeout:20000})
  assert.equal(await page.getByText('RADAR SIGNAL').count(),0,'Weather card not dismissed on new command')
  await page.waitForFunction(() => document.body.innerText.includes('TOMTOM ROADS: AUTH ERROR'), {timeout:25000})
  console.log('PASS: Browser weather uses same-origin Nitro and TomTom errors display safe provider health')
  const run = async (terminal, command) => {
    await terminal.fill(command)
    await terminal.press('Enter')
  }
  await run(input, 'news')
  const news = page.getByRole('region', { name:'Headlines' })
  await news.getByRole('link', { name:/A sample national headline/ }).waitFor()
  assert.equal(await page.getByText('LIVE TRAFFIC SIGNAL').count(), 0, 'News did not dismiss the map')
  await run(input, 'news —topic space')
  await page.waitForURL(url => url.pathname === '/news' && url.searchParams.get('topic') === 'space')
  const space = page.getByRole('region', { name:'Space' })
  await space.getByRole('link', { name:/A sample independent space headline/ }).waitFor()
  await space.getByRole('link', { name:/A sample NASA headline/ }).waitFor()
  assert.equal(await space.getByRole('link', { name:'Space', exact:true }).getAttribute('aria-current'), 'page')
  await run(input, 'news --topics')
  await page.getByText('News topics: headlines, seattle, space, tech').waitFor()
  const touch = await browser.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true })
  await touch.goto(`http://127.0.0.1:${port}/news?topic=seattle`, { waitUntil:'domcontentloaded' })
  await touch.getByRole('link', { name:/A sample Seattle headline/ }).waitFor()
  const width = await touch.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  assert.ok(width <= 1, 'Mobile news content overflows horizontally')
  assert.equal((await touch.request.get(`http://127.0.0.1:${port}/api/news?topic=https%3A%2F%2Fexample.org`)).status(), 400)
  await touch.close()
  console.log('PASS: News commands navigate to topic feeds and mobile deep links render')
  await page.close()
} finally {
  if(browser) await browser.close()
  child.kill()
}
