import test from 'node:test'
import assert from 'node:assert/strict'
import { createNewsReader, newsSourcesByTopic, readRssHeadlines } from '../server/utils/newsFeeds.js'
import { parseTerminalCommand, completeTerminalInput } from '../utils/terminalCommands.js'

const date = 'Tue, 24 Nov 2026 20:00:00 GMT'
const rss = (...items) => '<rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>' + items.join('') + '</channel></rss>'
const item = (title = 'A &amp; B', link = 'https://example.com/story', published = date) =>
  `<item><title>${title}</title><link>${link}</link><description>Do not republish this</description>
  <pubDate>${published}</pubDate><dc:creator><![CDATA[Jane Doe]]></dc:creator></item>`

test('news supports topic options, help, list and Tab, without accepting arbitrary URLs', () => {
  assert.deepEqual(parseTerminalCommand('news'), { action:'execute', command:'news', argument:'headlines' })
  assert.deepEqual(parseTerminalCommand('news —topic SPACE'), { action:'execute', command:'news', argument:'space' })
  assert.match(parseTerminalCommand('news --topics').text, /headlines, seattle, space, tech/)
  assert.match(parseTerminalCommand('news --help').text, /--topic TOPIC/)
  assert.match(parseTerminalCommand('news --topic https://example.org').text, /unknown topic/)
  assert.equal(completeTerminalInput('news --topic sp'), 'news --topic space ')
})

test('RSS publishes only the selected display fields and rejects malformed items and DTDs', () => {
  const entries = readRssHeadlines(rss(
    item(), item('Bad scheme', 'javascript:alert(1)'), item('Bad date', 'https://example.com/', 'not-a-date'),
    item('Credentials', 'https://user:pass@example.com/'), item('Missing link', '')
  ), 'Publisher')
  assert.deepEqual(entries, [{
    title:'A & B', url:'https://example.com/story', source:'Publisher', byline:'Jane Doe',
    publishedAt:'2026-11-24T20:00:00.000Z'
  }])
  assert.throws(() => readRssHeadlines('<!DOCTYPE rss [<!ENTITY example SYSTEM "file:///unused">]>' + rss(), 'Publisher'))
  assert.throws(() => readRssHeadlines('<rss><channel>', 'Publisher'))
})

test('space combines both publishers, coalesces requests and labels stale/failing results', async () => {
  let time = 10_000, calls = 0, fail = false
  const [independent, agency] = newsSourcesByTopic.space
  const allowed = new Set([independent.feed, agency.feed])
  const read = createNewsReader({ now: () => time, request: async (url, config) => {
    calls++
    assert.ok(allowed.has(url))
    assert.equal(config.redirect, 'error')
    if (url === independent.feed && fail) return new Response('', { status:503 })
    const feedItem = url === independent.feed
      ? item('Independent', 'https://example.com/independent')
      : item('Agency', 'https://example.com/agency')
    return new Response(rss(feedItem, feedItem))
  } })
  const [first, second] = await Promise.all([read('space'), read('space')])
  assert.equal(calls, 2)
  assert.deepEqual(first, second)
  assert.deepEqual(first.items.map(x => x.source), ['Universe Today','NASA'])
  await read('space')
  assert.equal(calls, 2)
  time += 11 * 60_000
  fail = true
  assert.equal((await read('space')).sources[0].state, 'stale')
  time += 60 * 60_000
  const result = await read('space')
  assert.equal(result.sources[0].state, 'unavailable')
  assert.deepEqual(result.items.map(x => x.source), ['NASA'])
})

test('Hacker News keeps community order, refuses bad IDs, and links discussions without an article', async () => {
  const request = async url => {
    if (url.endsWith('topstories.json')) return Response.json([2, 'https://example.com/', 1, 3])
    const id = Number(url.match(/item\/(\d+)\.json$/)?.[1])
    assert.ok([1, 2, 3].includes(id))
    return Response.json({ type:'story', dead:id===3, time:1764020000 + (id === 1 ? 30 : 0),
      title:'Story ' + id, ...(id === 1 ? { url:'https://example.com/article' } : {}) })
  }
  const result = await createNewsReader({ request })('tech')
  assert.deepEqual(result.items.map(x => x.title), ['Story 2','Story 1'])
  assert.equal(result.items[0].url, 'https://news.ycombinator.com/item?id=2')
})

test('default headlines follow NPR’s curated homepage feed in editorial order', async () => {
  const reader = createNewsReader({ request: async url => {
    assert.equal(url, 'https://feeds.npr.org/1002/rss.xml')
    return new Response(rss(
      item('First editorial pick', 'https://www.npr.org/first', 'Tue, 24 Nov 2026 18:00:00 GMT'),
      item('Second editorial pick', 'https://www.npr.org/second', date)
    ))
  } })
  const { items } = await reader('headlines')
  assert.deepEqual(items.map(x => x.title), ['First editorial pick','Second editorial pick'])
})

test('previews only use plain publisher excerpts and explicitly credited NASA media', () => {
  const image = (host, credit) => `<div class="hds-media-wrapper">
    <figure><img src="${host}" alt="A satellite in orbit" onerror="danger()"></figure>
    <figcaption><div class="hds-credits">Credit: ${credit}</div></figcaption></div>`
  const build = (markup, articleTitle = 'A launch') => `<item><title>${articleTitle}</title>
    <link>https://www.nasa.gov/story</link><pubDate>${date}</pubDate>
    <description><![CDATA[<p>News &amp; launch briefing</p><script>bad()</script>]]></description>
    <content:encoded><![CDATA[${markup}]]></content:encoded></item>`
  const xml = (...entries) => rss(...entries).replace('<rss ', '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" ')
  const real = 'https://www.nasa.gov/wp-content/uploads/satellite.jpg?w=2048'
  const [valid, partner, external, ambiguous] = readRssHeadlines(xml(
    build(image(real, 'NASA')), build(image(real, 'NASA/ESA')),
    build(image('https://www.nasa.gov.example.com/lookalike.jpg', 'NASA')),
    build('<figure><img src="' + real + '"></figure><p>Credit: NASA</p>')
  ), 'NASA')
  assert.equal(valid.summary, 'News & launch briefing')
  assert.deepEqual(valid.image, { url: real.replace('2048', '900'), alt: 'A satellite in orbit', credit: 'NASA' })
  assert.equal(partner.image, undefined)
  assert.equal(external.image, undefined)
  assert.equal(ambiguous.image, undefined)
  const [npr] = readRssHeadlines(xml(build(image(real, 'NASA'))), 'NPR')
  assert.equal(npr.summary, 'News & launch briefing')
  assert.equal(npr.image, undefined)
  assert.equal(readRssHeadlines(xml(build('')), 'City of Seattle')[0].summary, undefined)
})

test('Universe Today uses actual lead photos with per-image credit and reuse terms', () => {
  const imageUrl = 'https://www.universetoday.com/article_images/space.jpg'
  const build = (caption, image = imageUrl, extra = '') => `<item><title>A space story</title>
    <link>https://www.universetoday.com/articles/story</link><pubDate>${date}</pubDate>
    <description><![CDATA[<p><img src="${image}" alt="${caption}" />${extra}</p><p>Story excerpt.</p>]]></description></item>`
  const [nasa, licensed, partner, nc, otherHost, otherPath, ambiguous] = readRssHeadlines(rss(
    build('Satellites overhead. Credit: NASA'),
    build('The Betta Fish Nebula. Image Credit: CTIO/NOIRLab/DOE/NSF/AURA Creative Commons Attribution 4.0 International License'),
    build('A spacecraft. Credit: NASA/ESA'),
    build('A spacecraft. Credit: Artist Creative Commons Attribution-NonCommercial 4.0 International License'),
    build('A spacecraft. Credit: NASA', 'https://www.universetoday.com.example.com/article_images/x.jpg'),
    build('A spacecraft. Credit: NASA', 'https://www.universetoday.com/tracking.jpg'),
    build('A spacecraft. Credit: NASA', imageUrl, '<img src="https://www.universetoday.com/article_images/other.jpg">')
  ), 'Universe Today')
  assert.deepEqual(nasa.image, { url: imageUrl, alt: 'Satellites overhead.', credit: 'NASA' })
  assert.equal(nasa.summary, 'Story excerpt.')
  assert.deepEqual(licensed.image, { url: imageUrl, alt: 'The Betta Fish Nebula.', credit: 'CTIO/NOIRLab/DOE/NSF/AURA', license: 'CC BY 4.0' })
  for (const entry of [partner, nc, otherHost, otherPath, ambiguous]) assert.equal(entry.image, undefined)
})
