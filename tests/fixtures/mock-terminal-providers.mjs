// Only the locally spawned CI server sees fake Open-Meteo/TomTom responses.
// Neither real account credentials nor external providers are contacted.
const nativeFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === 'string' ? input : input?.url || input)
  if (url.startsWith('https://geocoding-api.open-meteo.com/v1/search')) {
    const city = new URL(url).searchParams.get('name')
    return new Response(JSON.stringify({
      results: city === 'NonexistentExampleCity' ? [] : [{
        latitude: 47.60621, longitude: -122.33207,
        name: city || 'Seattle', admin1: 'Washington', country_code: 'US'
      }]
    }), { headers: { 'Content-Type': 'application/json' } })
  }
  if (url.startsWith('https://api.open-meteo.com/v1/forecast')) {
    return new Response(JSON.stringify({
      current: { temperature_2m: 43.2, weather_code: 3 }
    }), { headers: { 'Content-Type': 'application/json' } })
  }
  if (url.startsWith('https://api.tomtom.com/maps/orbis/traffic/flow/vector/tile/')) {
    return new Response(JSON.stringify({detailedError:{code:'FORBIDDEN',message:'CI only'}}),{
      status:403, headers:{'Content-Type':'application/json'}
    })
  }
  const newsItems = {
    'https://feeds.npr.org/1001/rss.xml': ['A sample national headline', 'https://www.npr.org/example'],
    'https://news.seattle.gov/feed/': ['A sample Seattle headline', 'https://news.seattle.gov/example/'],
    'https://www.nasa.gov/news-release/feed/': ['A sample NASA headline', 'https://www.nasa.gov/example/'],
    'https://www.universetoday.com/rss.xml': ['A sample independent space headline', 'https://www.universetoday.com/articles/example']
  }
  if (Object.hasOwn(newsItems, url)) {
    const [title, link] = newsItems[url]
    const xml = '<rss><channel><item><title>' + title + '</title><link>' + link +
      '</link><pubDate>Tue, 24 Nov 2026 20:00:00 GMT</pubDate></item></channel></rss>'
    return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } })
  }
  return nativeFetch(input, init)
}
