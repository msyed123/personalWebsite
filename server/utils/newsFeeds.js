import { SaxesParser } from 'saxes'
import { parseFragment } from 'parse5'

const HN_BASE = 'https://hacker-news.firebaseio.com/v0'
const cacheLifetime = 10 * 60_000
const staleLifetime = 60 * 60_000
const maxRssBytes = 4 * 1024 * 1024

// Only this registry determines upstream addresses, never user input.
// Reconfirm source terms before adding a feed; never relay full RSS documents.
export const newsSourcesByTopic = Object.freeze({
  headlines: [{ id: 'npr', label: 'NPR', feed: 'https://feeds.npr.org/1002/rss.xml', editorial: true }],
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

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value
const hasClass = (node, name) => attr(node, 'class')?.split(/\s+/).includes(name)
const ignoredTags = new Set(['script', 'style', 'template', 'iframe', 'object', 'noscript'])
function* children(root) {
  // Use an iterative walk so even deeply nested feed markup can't overflow the JS stack.
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (ignoredTags.has(node.tagName)) continue
    yield node
    if (node.childNodes) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i])
  }
}

function visibleText(node) {
  return cleanText(Array.from(children(node), child => child.nodeName === '#text' ? child.value : '').join(' '))
}

function nasaImage(encoded) {
  if (!encoded) return null
  for (const wrapper of children(parseFragment(encoded))) {
    if (!hasClass(wrapper, 'hds-media-wrapper')) continue
    const figure = wrapper.childNodes?.find(node => node.tagName === 'figure')
    if (!figure) continue
    const caption = wrapper.childNodes?.find(node => node.tagName === 'figcaption')
      ?? figure.childNodes?.find(node => node.tagName === 'figcaption')
    if (!caption) continue
    const creditNode = Array.from(children(caption)).find(node => hasClass(node, 'hds-credits'))
    const credit = creditNode && visibleText(creditNode).replace(/^Credit:\s*/i, '')
    // NASA also publishes partner and copyrighted images. Only use artwork
    // explicitly credited to NASA itself, in the same wrapper as that image.
    if (credit !== 'NASA') continue
    const images = Array.from(children(figure)).filter(node => node.tagName === 'img')
    if (images.length !== 1) continue
    try {
      const url = new URL(attr(images[0], 'src'))
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !['www.nasa.gov', 'science.nasa.gov', 'assets.science.nasa.gov'].includes(url.hostname) ||
          !/\.(?:jpe?g|png|webp)$/i.test(url.pathname)) continue
      // Use NASA's existing width transform on eligible WordPress media.
      if (url.hostname === 'www.nasa.gov' && url.searchParams.has('w')) url.searchParams.set('w', '900')
      const alt = cleanText(attr(images[0], 'alt')).slice(0, 500)
      return { url: url.href, alt, credit }
    } catch { /* unsupported image, try the next candidate */ }
  }
  return null
}

function article({ title, link, published, byline, description, encoded }, source) {
  const url = articleUrl(link)
  const time = Date.parse(published)
  const name = cleanText(title)
  if (!url || !name || name.length > 360 || !Number.isFinite(time)) return null
  const summary = description ? visibleText(parseFragment(description)) : ''
  const image = source === 'NASA' ? nasaImage(encoded) : null
  return {
    title: name, url, source, byline: cleanText(byline).slice(0, 120),
    publishedAt: new Date(time).toISOString(),
    ...(summary && summary.length <= 600 ? { summary } : {}),
    ...(image ? { image } : {})
  }
}

export function readRssHeadlines(xml, source) {
  const parser = new SaxesParser()
  const items = []
  const stack = []
  let item
  let field
  const fields = { title: 'title', link: 'link', pubDate: 'published', 'dc:creator': 'byline' }
  if (['NPR', 'NASA', 'Universe Today'].includes(source)) fields.description = 'description'
  if (source === 'NASA') fields['content:encoded'] = 'encoded'
  const append = text => {
    if (!field) return
    // Image attributes and credits appear in larger NASA entries; never hold
    // an unbounded article. The original markup is neither cached nor sent.
    const budget = field === 'encoded' ? 200_000 : 2500
    if (item[field].length < budget) item[field] += text.slice(0, budget - item[field].length)
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

async function providerText(url, request, maxBytes, signal) {
  const res = await request(url, {
    signal, redirect: 'error',
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
  // One deadline spans the index and item requests, not a new wait per story.
  const signal = AbortSignal.timeout(12_000)
  const text = await providerText(source.feed, request, source.ranked ? 32_768 : maxRssBytes, signal)
  if (!source.ranked) return readRssHeadlines(text, source.label)
  const ids = JSON.parse(text)
  if (!Array.isArray(ids)) throw new Error('Unexpected story list')
  const results = await Promise.allSettled(ids.slice(0, 12).filter(id => Number.isSafeInteger(id) && id > 0)
    .map(async id => {
      const story = JSON.parse(await providerText(HN_BASE + '/item/' + id + '.json', request, 65_536, signal))
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
    if (!sources[0].ranked && !sources[0].editorial) items.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    return {
      topic, items: items.slice(0, 10),
      sources: results.map(({ name, state, fetchedAt }) => ({ name, state, fetchedAt }))
    }
  }
}
