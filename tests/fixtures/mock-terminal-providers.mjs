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
  return nativeFetch(input, init)
}
