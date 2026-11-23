import { normalizeStationFeature } from '~/shared/traffic.js'

// WSDOT is point observations on Washington highways, not street-segment geometry.
// Keep its categories separate from TomTom's relative-speed measurements.
export async function fetchWsdotStations(accessCode: string) {
  const url = 'https://wsdot.wa.gov/traffic/api/TrafficFlow/TrafficFlowREST.svc/GetTrafficFlowsAsJson'
  const response = await fetch(`${url}?AccessCode=${encodeURIComponent(accessCode)}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000)
  })
  if (!response.ok) throw new Error(`WSDOT traffic request failed: HTTP ${response.status}`)
  const body = await response.json()
  const rows = typeof body?.d === 'string' ? JSON.parse(body.d) : (body?.d ?? body)
  if (!Array.isArray(rows)) throw new Error('Unexpected WSDOT traffic response')
  return {
    type: 'FeatureCollection',
    features: rows.slice(0, 20000).map(normalizeStationFeature).filter(Boolean)
  }
}
