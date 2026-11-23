// Same-origin terminal lookup: browsers never have to reach Open-Meteo directly.
// There are no credentials. Traffic mode only geocodes; weather mode also fetches
// the current forecast. Both upstream calls have bounded timeouts.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const city = typeof query.city === 'string' ? query.city.trim() : 'Seattle'
  const mode = query.mode === 'traffic' ? 'traffic' : query.mode === 'weather' ? 'weather' : null

  if (!mode || city.length < 1 || city.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid location or mode' })
  }

  async function readProvider(url: string, source: string) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(9000)
      })
    } catch (error: any) {
      console.warn('[TERMINAL] Provider request failed', {
        source, cause: error?.name || 'network-error'
      })
      throw createError({
        statusCode: 502,
        statusMessage: source + ' service is temporarily unreachable'
      })
    }
    if (!response.ok) {
      console.warn('[TERMINAL] Upstream response failure', { source, status: response.status })
      throw createError({
        statusCode: 502,
        statusMessage: source + ' service returned HTTP ' + response.status
      })
    }
    try {
      return await response.json()
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: source + ' returned an invalid response'
      })
    }
  }

  const geocode = await readProvider(
    'https://geocoding-api.open-meteo.com/v1/search?' +
      new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' }),
    'Location lookup'
  )
  if (!Array.isArray(geocode.results) || geocode.results.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  }

  const place = geocode.results[0]
  const lat = Number(place.latitude)
  const lon = Number(place.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw createError({ statusCode: 502, statusMessage: 'Invalid location coordinates' })
  }

  const output: {
    lat: number; lon: number; location: string;
    temp?: number; code?: number
  } = {
    lat, lon,
    location: [place.name, place.admin1 || place.country_code].filter(Boolean).join(', ')
  }

  if (mode === 'weather') {
    const forecast = await readProvider(
      'https://api.open-meteo.com/v1/forecast?' +
        new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          current: 'temperature_2m,weather_code',
          temperature_unit: 'fahrenheit',
          wind_speed_unit: 'mph'
        }),
      'Weather forecast'
    )
    const temp = Number(forecast.current?.temperature_2m)
    const code = Number(forecast.current?.weather_code)
    if (!Number.isFinite(temp) || !Number.isFinite(code)) {
      throw createError({ statusCode: 502, statusMessage: 'Weather observations unavailable' })
    }
    output.temp = Math.round(temp)
    output.code = code
  }
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return output
})
