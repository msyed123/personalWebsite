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
  const assertPromptAppearance = async (form, focused) => {
    const style = await form.evaluate(el => {
      const field = el.querySelector('input')
      const inputStyle = getComputedStyle(field)
      return {
        color: getComputedStyle(el).color,
        outline: getComputedStyle(el).outlineStyle,
        fieldOutlineHidden: inputStyle.outlineStyle === 'none' || inputStyle.outlineColor === 'rgba(0, 0, 0, 0)',
        focused: field === document.activeElement
      }
    })
    assert.equal(style.focused, focused)
    assert.equal(style.color, 'rgb(255, 176, 0)', 'Terminal prompt should keep its amber theme')
    assert.equal(style.outline, 'none', 'The prompt should not draw a box around typed input')
    assert.equal(style.fieldOutlineHidden, true, 'The input should not draw a separate outline')
  }
  // Exercise a phone plus a touch device whose primary pointer is fine,
  // as on a tablet with a trackpad. Blur isn't tied to (pointer: coarse).
  for (const primaryCoarse of [true, false]) {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    if (!primaryCoarse) {
      await mobile.addInitScript(() => {
        const nativeMatchMedia = window.matchMedia.bind(window)
        window.matchMedia = query => query === '(pointer: coarse)'
          ? nativeMatchMedia('not all')
          : nativeMatchMedia(query)
      })
    }
    await mobile.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' })
    const mobilePrompt = mobile.getByRole('form', { name: 'Terminal' })
    const field = mobilePrompt.locator('input')
    await assertPromptAppearance(mobilePrompt, false)
    await field.tap()
    await field.fill('echo keyboard-test')
    await assertPromptAppearance(mobilePrompt, true)
    if (primaryCoarse) {
      await field.press('Enter')
    } else {
      // Some soft keyboards submit the form rather than emitting keydown.
      await mobilePrompt.evaluate(form => form.requestSubmit())
    }
    await mobile.getByRole('status').filter({ hasText: 'keyboard-test' }).waitFor()
    await assertPromptAppearance(mobilePrompt, false)

    await field.tap()
    await assertPromptAppearance(mobilePrompt, true)
    await field.press('Enter') // Blank Enter still dismisses the keyboard.
    await assertPromptAppearance(mobilePrompt, false)

    await field.tap()
    await field.fill('cd draft')
    await field.press('Enter')
    await mobile.getByText('Enter password to access /draft:').waitFor()
    await assertPromptAppearance(mobilePrompt, false)
    await field.tap()
    await field.fill('not-the-password')
    await field.press('Enter')
    await mobile.getByText('Incorrect password. Access denied.').waitFor()
    await assertPromptAppearance(mobilePrompt, false)
    await mobile.close()
  }
  console.log('PASS: No typing outline; mobile Enter/Go dismisses focus and taps restore it')
  await input.fill('weather')
  await assertPromptAppearance(prompt, true)
  await input.press('Enter')
  await page.getByText('RADAR SIGNAL').waitFor({timeout:20000})
  assert.ok((await page.locator('body').innerText()).includes('Seattle, Washington'))
  assert.ok((await page.locator('body').innerText()).includes('43°'))
  assert.equal(external.length,0,'Forecast/geocode bypassed same-origin proxy')
  await input.fill('traffic Seattle')
  await assertPromptAppearance(prompt, true)
  await input.press('Enter')
  await page.getByText('LIVE TRAFFIC SIGNAL').waitFor({timeout:20000})
  assert.equal(await page.getByText('RADAR SIGNAL').count(),0,'Weather card not dismissed on new command')
  await page.waitForFunction(() => document.body.innerText.includes('TOMTOM ROADS: AUTH ERROR'), {timeout:25000})
  await assertPromptAppearance(prompt, true)
  console.log('PASS: Browser weather uses same-origin Nitro and TomTom errors display safe provider health')
  await page.close()
} finally {
  if(browser) await browser.close()
  child.kill()
}
