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
  await page.close()
} finally {
  if(browser) await browser.close()
  child.kill()
}
