import { SaxesParser } from 'saxes'

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'
const cacheLifetime = 10 * 60_000
const staleLifetime = 60 * 60_000
const maxRssBytes = 4 * 1024 * 1024

// Only this registry determines upstream addresses, never user input.
// Reconfirm source terms before adding a feed; never relay full RSS documents.
export const newsSourcesByTopic = Object.freeze({
  headlines: [{ id: 'npr', label: 'NPR', feed: 'https://feeds.npr.org/1001/rss.xml' }],
  seattle: [{ id: 'city-seattle', label: 'City of Seattle', feed: 'https://news.seattle.gov/feed/' }],
  space: [
    { id: 'universe-today', label: 'Universe Today', feed: 'https://www.universetoday.com/rss.xml' },
    { id: 'nasa', label: 'NASA', feed: 'https://www.nasa.gov/news-release/feed/' }
  ],
  tech: [{ id: 'hn', label: 'Hacker News', feed: HN_BASE + '/topstories.json', ranked: true }]
})

const cleanText = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim() : ''

function articleUrl(value) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    if (url.protocol === 'http:') url.protocol = 'https:'
    return url.href.length <= 2048 ? url.href : null
  } catch {
    return null
  }
}

function article({ title, link, published, byline }, source) {
  const url = articleUrl(link)
  const time = Date.parse(published)
  const name = cleanText(title)
  if (!url || !name || name.length > 360 || !Number.isFinite(time)) return null
  return {
    title: name, url, source, byline: cleanText(byline).slice(0, 120),
    publishedAt: new Date(time).toISOString()
  }
}

export function readRssHeadlines(xml, source) {
  const parser = new SaxesParser()
  const items = []
  const stack = []
  let item
  let field
  const fields = { title: 'title', link: 'link', pubDate: 'published', 'dc:creator': 'byline' }
  const append = text => {
    if (field && item[field].length < 2500) item[field] += text.slice(0, 2500)
  }
  parser.on('doctype', () => { throw new Error('RSS declarations not accepted') })
  parser.on('opentag', ({ name }) => {
    stack.push(name)
    if (stack.length > 64) throw new Error('RSS depth limit')
    if (stack.length === 3 && stack.join('/') === 'rss/channel/item' && items.length < 24) {
      item = Object.create(null)
    } else if (item && stack.length === 4 && Object.hasOwn(fields, name)) {
      field = fields[name]
      item[field] = ''
    }
  })
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    if (stack.length === 4) field = undefined
    if (item && stack.length === 3) {
      const result = article(item, source)
      if (result) items.push(result)
      item = undefined
    }
    stack.pop()
  })
  parser.write(xml).close()
  return items
}

async function providerText(url, request, maxBytes) {
  const res = await request(url, {
    signal: AbortSignal.timeout(4500), redirect: 'error',
    headers: { 'User-Agent': 'msyed.space RSS reader (headlines only)' }
  })
  if (!res.ok || !res.body) throw new Error('Feed unavailable')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return text + decoder.decode()
      size += value.byteLength
      if (size > maxBytes) throw new Error('Feed size limit')
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}

async function loadSource(source, request) {
  const text = await providerText(source.feed, request, source.ranked ? 32_768 : maxRssBytes)
  if (!source.ranked) return readRssHeadlines(text, source.label)
  const ids = JSON.parse(text)
  if (!Array.isArray(ids)) throw new Error('Unexpected story list')
  const results = await Promise.allSettled(ids.slice(0, 12).filter(id => Number.isSafeInteger(id) && id > 0)
    .map(async id => {
      const story = JSON.parse(await providerText(HN_BASE + '/item/' + id + '.json', request, 65_536))
      if (story?.type !== 'story' || story.deleted || story.dead || !Number.isFinite(story.time)) return null
      const time = new Date(story.time * 1000)
      if (!Number.isFinite(time.getTime())) return null
      return article({
        title: story.title, link: articleUrl(story.url) || 'https://news.ycombinator.com/item?id=' + id,
        published: time.toISOString()
      }, source.label)
    }))
  return results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
}

// Per-source TTL and shared in-flight requests across all visitors to the dyno.
// Only normalized display fields are held in memory; no upstream markup.
export function createNewsReader({ request = (...args) => fetch(...args), now = Date.now } = {}) {
  const cache = new Map()
  async function load(source) {
    const entry = cache.get(source.id) ?? { items: [], fetchedAt: 0, retryAt: 0, inFlight: null }
    cache.set(source.id, entry)
    if (entry.inFlight) return entry.inFlight
    const snapshot = state => ({
      state, name: source.label, fetchedAt: state === 'unavailable' ? null : entry.fetchedAt,
      items: state === 'unavailable' ? [] : entry.items
    })
    if (entry.items.length && now() - entry.fetchedAt < cacheLifetime) return snapshot('fresh')
    const fallback = () => snapshot(entry.items.length && now() - entry.fetchedAt < staleLifetime ? 'stale' : 'unavailable')
    if (entry.retryAt > now()) return fallback()
    entry.inFlight = (async () => {
      try {
        const items = await loadSource(source, request)
        if (!items.length) throw new Error('No usable headlines')
        entry.items = items
        entry.fetchedAt = now()
        return snapshot('fresh')
      } catch {
        entry.retryAt = now() + 60_000
        return fallback()
      } finally {
        entry.inFlight = null
      }
    })()
    return entry.inFlight
  }

  return async topic => {
    const sources = newsSourcesByTopic[topic]
    const results = await Promise.all(sources.map(load))
    const seen = new Set()
    const itemLimit = results.filter(result => result.items.length).length > 1 ? 6 : 10
    const items = results.flatMap(result => result.items.filter(({ url, title }) => {
      const key = cleanText(title).toLowerCase()
      if (seen.has(url) || seen.has(key)) return false
      seen.add(url)
      seen.add(key)
      return true
    }).slice(0, itemLimit))
    if (!sources[0].ranked) items.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    return {
      topic, items: items.slice(0, 10),
      sources: results.map(({ name, state, fetchedAt }) => ({ name, state, fetchedAt }))
    }
  }
}
