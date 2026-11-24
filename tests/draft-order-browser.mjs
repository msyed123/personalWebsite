import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4376
const origin = 'http://127.0.0.1:' + port
const preview = 'preview-output'
const teams = ['Alex Kim', 'Alex Lee', 'Jordan Flores', 'Sam Morgan', 'Taylor Park', 'Casey Rivera']
const docs = teams.map((name, i) => ({
  id: 'team-' + i,
  data: {
    name: [{ text: name }],
    previousteamname: [{ text: 'League team ' + (i + 1) }],
    previousrecord: [{ text: '7–7' }],
    standing: i + 1
  }
}))
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  env: { ...process.env, NITRO_PORT: String(port), NITRO_HOST: '127.0.0.1' }
})
server.stderr.pipe(process.stderr)
mkdirSync(preview, { recursive: true })
try {
  let ready = false
  for (let i = 0; i < 70; i++) {
    try {
      if ((await fetch(origin + '/draft')).ok) { ready = true; break }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(ready, 'Built Nuxt server did not start')
  for (const [mode, width, height] of [['desktop', 1230, 900], ['mobile', 390, 844]]) {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    try {
      const page = await browser.newPage({
        viewport: { width, height }, reducedMotion: 'reduce',
        hasTouch: mode === 'mobile', isMobile: mode === 'mobile'
      })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => sessionStorage.setItem('draftUnlocked', '1'))
      await page.route('https://static.cdn.prismic.io/**', route => route.abort())
      await page.route(/^https:\/\/[^/]+\.cdn\.prismic\.io\/api\/v2(?:[/?]|$)/, async route => {
        const { pathname } = new URL(route.request().url())
        const results = {
          page: 1, results_per_page: docs.length, results_size: docs.length,
          total_results_size: docs.length, total_pages: 1, next_page: null,
          prev_page: null, results: docs
        }
        await route.fulfill({
          json: pathname.endsWith('documents/search') ? results : {
            refs: [{ id: 'master', ref: 'test-ref', isMasterRef: true }], forms: {}
          },
          headers: { 'access-control-allow-origin': '*' }
        })
      })
      await page.goto(origin + '/draft', { waitUntil: 'domcontentloaded' })
      const wheel = page.getByRole('img', { name: /^Draw wheel/ })
      await wheel.waitFor()
      const label = await wheel.getAttribute('aria-label')
      assert.match(label, /Alex K\./)
      assert.match(label, /Alex L\./)
      await page.getByRole('button', { name: 'Reveal pick 6' }).waitFor()
      const geometry = await page.evaluate(() => {
        const draw = document.querySelector('.draft-draw').getBoundingClientRect()
        const result = document.querySelector('.draft-results').getBoundingClientRect()
        const canvas = document.querySelector('.wheel-stage canvas').getBoundingClientRect()
        const button = document.querySelector('.draft-controls button').getBoundingClientRect()
        const footer = document.querySelector('footer').getBoundingClientRect()
        return { buttonBottom:button.bottom, footerTop:footer.top, drawRight: draw.right, drawBottom: draw.bottom, drawLeft: draw.left,
          resultLeft: result.left, resultTop: result.top,
          canvasSize: canvas.width, canvasHeight: canvas.height,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
      })
      assert.equal(geometry.overflow, 0)
      assert.ok(geometry.buttonBottom <= geometry.footerTop + 1, 'Primary action should clear the sticky terminal at launch')
      assert.ok(geometry.canvasSize > 250 && geometry.canvasSize <= 400)
      assert.ok(Math.abs(geometry.canvasSize - geometry.canvasHeight) < 2)
      if (mode === 'desktop') assert.ok(geometry.resultLeft > geometry.drawRight, 'Results should sit beside the wheel')
      else assert.ok(geometry.resultTop > geometry.drawBottom &&
        Math.abs(geometry.resultLeft - geometry.drawLeft) < 2, 'Results should stack below the wheel')
      await page.screenshot({ path: preview + '/draft-' + mode + '-ready.png', fullPage: true })
      for (let pick = docs.length; pick > 1; pick--) {
        await page.getByRole('button', { name: 'Reveal pick ' + pick }).click()
        await page.locator('[data-pick="' + pick + '"]').waitFor()
        assert.equal(await page.locator('[data-pick]').count(), docs.length - pick + 1)
      }
      assert.equal(await wheel.count(), 0, 'Only the final reveal should remain')
      await page.getByRole('button', { name: 'Reveal first overall' }).click()
      const picks = page.getByRole('list', { name: 'Revealed picks' })
      assert.deepEqual(await picks.locator('li').evaluateAll(rows => rows.map(x => Number(x.dataset.pick))),
        [1, 2, 3, 4, 5, 6])
      assert.deepEqual((await picks.getByRole('heading').allTextContents()).sort(), teams.slice().sort())
      assert.equal(await page.getByRole('button', { name: /Reveal/ }).count(), 0)
      assert.deepEqual(errors, [])
      await page.evaluate(() => document.body.classList.add('light-theme'))
      const panelBg = await page.locator('.draft-results').evaluate(el => getComputedStyle(el).backgroundColor)
      assert.equal(panelBg, 'rgb(248, 248, 248)')
      await page.evaluate(() => document.body.classList.remove('light-theme'))
      await page.screenshot({ path: preview + '/draft-' + mode + '-complete.png', fullPage: true })
      console.log(mode + ' layout and complete six-team draw passed')
    } finally {
      await browser.close()
    }
  }
} finally {
  server.kill()
}
