import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const origin = 'http://127.0.0.1:4574'
const child = spawn(process.execPath, [
  '--import', './tests/fixtures/mock-terminal-providers.mjs', '.output/server/index.mjs'
], {
  cwd: root,
  env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: '4574' },
  stdio: ['ignore', 'ignore', 'inherit']
})
const article = {
  title: 'Moon test headline', source: 'NASA', byline: 'Test Editor',
  url: 'https://www.nasa.gov/test-story/', publishedAt: '2026-11-24T20:00:00Z',
  summary: 'Test plain text <em>not markup</em>.',
  image: { url: 'https://www.nasa.gov/test-image.svg', alt: 'Moon test illustration', credit: 'NASA' }
}
const broken = {
  ...article, title: 'Unavailable image headline', url: 'https://www.nasa.gov/test-broken/',
  summary: '', image: { url: 'https://www.nasa.gov/test-broken.svg', alt: '', credit: '' }
}
const withoutImage = {
  ...broken, title: 'Headline without a photo', url: 'https://example.com/no-picture', image: undefined
}
const paddingArticles = Array.from({ length: 12 }, (_, i) => ({
  ...withoutImage, title: 'Additional headline ' + i, url: 'https://example.com/filler-' + i
}))
let browser
try {
  let ready = false
  for (let i = 0; i < 50 && !ready; i++) {
    try { ready = (await fetch(origin + '/api/traffic/status')).ok } catch {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 150))
  }
  assert.ok(ready)
  const liveFixture = await (await fetch(origin + '/api/news?topic=space')).json()
  const credited = liveFixture.items.find(item => item.source === 'NASA')
  assert.equal(credited.image?.credit, 'NASA')
  assert.equal(credited.summary, 'A short publisher preview.')
  const defaultFeed = await (await fetch(origin + '/api/news')).json()
  assert.equal(defaultFeed.items[0]?.source, 'NPR')
  assert.equal((await fetch(origin + '/api/news?topic=https%3A%2F%2Fexample.org')).status, 400)
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] })
  const desktop = await browser.newPage({ viewport: { width: 1180, height: 730 } })
  const mobile = await browser.newPage({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true })
  async function mockBrowserFeeds(page) {
    await page.route('**/api/news?topic=*', async route => {
      const topic = new URL(route.request().url()).searchParams.get('topic')
      const items = topic === 'space' ? [article, broken, withoutImage, ...paddingArticles] : [withoutImage]
      await route.fulfill({ json: { topic, items, sources: [{ name: 'Test', state: 'fresh' }] } })
    })
    await page.route('https://www.nasa.gov/test-image.svg', route => route.fulfill({
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="orange"/></svg>'
    }))
    await page.route('https://www.nasa.gov/test-broken.svg', route => route.fulfill({ status: 404, body: '' }))
  }
  async function command(page, text) {
    const input = page.getByRole('textbox', { name: 'Terminal command' })
    await input.fill(text)
    await input.press('Enter')
    return input
  }
  for (const page of [desktop, mobile]) await mockBrowserFeeds(page)
  await desktop.goto(origin + '/')
  const input = await command(desktop, 'news --topic space')
  const dialog = desktop.getByRole('dialog', { name: 'News', exact: true })
  await dialog.getByRole('heading', { name: 'Space' }).waitFor()
  assert.equal(new URL(desktop.url()).pathname, '/', 'Terminal news should not navigate')
  assert.equal(await desktop.locator('main').getAttribute('inert'), '')
  assert.ok(await input.isVisible())
  const storyButton = dialog.getByRole('button', { name: /Moon test headline/ })
  const image = storyButton.getByRole('img', { name: 'Moon test illustration' })
  assert.equal(await image.getAttribute('loading'), 'lazy')
  assert.equal(await image.getAttribute('referrerpolicy'), 'no-referrer')
  await dialog.getByRole('button', { name: /Unavailable image headline/ }).locator('.news-artwork-fallback').waitFor()
  await storyButton.click()
  const preview = dialog.getByRole('dialog', { name: 'Moon test headline' })
  await preview.waitFor()
  const back = preview.getByRole('button', { name: /Back to headlines/ })
  assert.ok(await back.evaluate(el => el === document.activeElement))
  assert.equal(await preview.getByText(article.summary, { exact: true }).count(), 1)
  assert.equal(await preview.getByRole('link', { name: /Read original/ }).getAttribute('href'), article.url)
  assert.equal(await preview.locator('iframe').count(), 0)
  await back.press('Escape')
  assert.ok(await storyButton.evaluate(el => el === document.activeElement))
  await storyButton.click()
  await command(desktop, 'news --topic space')
  await dialog.getByRole('heading', { name: 'Space' }).waitFor()
  assert.equal(await preview.count(), 0, 'Re-running the same feed command should exit the story')
  await command(desktop, 'news')
  await dialog.getByRole('heading', { name: 'Headlines' }).waitFor()
  await command(desktop, 'weather')
  await desktop.getByRole('button', { name: 'Close map' }).waitFor()
  assert.equal(await dialog.count(), 0)
  await command(desktop, 'news')
  await dialog.getByRole('heading', { name: 'Headlines' }).waitFor()
  assert.equal(await desktop.getByRole('button', { name: 'Close map' }).count(), 0)
  await input.press('Escape')
  await dialog.waitFor({ state: 'hidden' })

  await mobile.goto(origin + '/')
  const mobilePrompt = await command(mobile, 'news --topic space')
  const mobileDialog = mobile.getByRole('dialog', { name: 'News', exact: true })
  const articleAtEnd = mobileDialog.getByRole('button', { name: /Additional headline 11/ })
  await articleAtEnd.scrollIntoViewIfNeeded()
  const feed = mobileDialog.locator('.news-feed')
  const before = await feed.evaluate(el => el.scrollTop)
  assert.ok(before > 100, 'Fixture should scroll inside the panel, not the whole page')
  await articleAtEnd.tap()
  await mobileDialog.getByRole('button', { name: /Back to headlines/ }).tap()
  assert.ok(Math.abs(await feed.evaluate(el => el.scrollTop) - before) < 5)
  assert.ok(await articleAtEnd.evaluate(el => el === document.activeElement))
  assert.ok(await mobilePrompt.isVisible())
  await mobileDialog.getByRole('button', { name: 'Close news' }).tap()
  await mobileDialog.waitFor({ state: 'hidden' })

  // The route still serves the feed on a direct visit, using local test RSS.
  await desktop.unroute('**/api/news?topic=*')
  await desktop.goto(origin + '/news?topic=seattle')
  await desktop.getByRole('heading', { name: 'Seattle' }).waitFor()
  assert.equal(await desktop.locator('nav[aria-label="News topics"] [aria-current="page"]').count(), 1)
  await command(desktop, 'news')
  await dialog.getByRole('heading', { name: 'Headlines' }).waitFor()
  assert.equal(new URL(desktop.url()).searchParams.get('topic'), 'seattle')
  await dialog.getByRole('button', { name: 'Close news' }).click()
  await desktop.getByRole('button', { name: /A sample Seattle headline/ }).click()
  await desktop.getByRole('dialog', { name: 'A sample Seattle headline' }).waitFor()
  await desktop.getByRole('button', { name: /Back to headlines/ }).click()
  assert.ok(await desktop.getByRole('button', { name: /A sample Seattle headline/ }).isVisible())
  console.log('PASS: terminal news modal, article previews, source imagery/fallback, scroll/focus restoration, map replacement, and bookmarked feed')
} finally {
  await browser?.close()
  child.kill()
}
