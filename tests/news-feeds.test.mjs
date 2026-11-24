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
