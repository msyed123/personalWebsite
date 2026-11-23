# personal

> Personal website for Mamoon Syed

## Build Setup

``` bash
# install dependencies
$ npm install

# serve with hot reload at localhost:3000
$ npm run dev

# build for production and launch server
$ npm run build
$ npm start

# generate static project
$ npm run generate
```

For detailed explanation on how things work, checkout [Nuxt.js docs](https://nuxtjs.org).

## Weather radar and provider-independent traffic

The weather terminal uses **OpenFreeMap Dark** (MapLibre through Leaflet) plus the existing ASCII-like **RainViewer** radar. The basemap and radar require no traffic credentials.

The traffic renderer consumes one normalized GeoJSON feature contract from `shared/traffic.js` and never parses provider-specific formats:

| Data type | Server adapter | API | Rendering |
| --- | --- | --- | --- |
| Worldwide road flow | `server/utils/traffic/tomtom.ts` | TomTom Orbis v2 vector tiles | Road segments colored by relative free-flow speed |
| Washington highway observations | `server/utils/traffic/wsdot.ts` | WSDOT TrafficFlow | Small color-coded points at real sensor locations |

**TomTom and WSDOT are optional and independent.** Road closures and unknown measurements are distinguished explicitly, missing observations are never treated as clear roads, and stale WSDOT readings are grayed out. The frontend uses the same road/sensor GeoJSON schema no matter which server adapter is used. New providers can implement the same format without any map-component edits.

### Production configuration

Configure server environment variables in your deployment platform; do not commit keys or expose them as `NUXT_PUBLIC_*`.

- `NUXT_TOMTOM_TRAFFIC_KEY`: TomTom developer key for Orbis vector traffic tiles. Optional. Traffic vector tiles have a limited free monthly quota; enable account alerts/usage controls where available.
- `NUXT_WSDOT_ACCESS_CODE`: WSDOT Traveler Information API access code. Optional. Covers Washington highways at discrete sensors, not every road.

After changing variables, restart/redeploy the server. Either key can be configured alone; with neither, the map/radar still work and the widget says **TRF: NO KEY**.

The server APIs are `/api/traffic/status`, `/api/traffic/roads/:z/:x/:y`, and `/api/traffic/stations?bbox=west,south,east,north`. Provider credentials stay on the server. Road tiles cache for 180 seconds; sensor readings cache for 90 seconds. The browser refreshes every three minutes while the widget is open, and does not fetch traffic when hidden. The visible-road-tile limit prevents accidental global tile sweeps. WSDOT's actual measurement times are preserved; TomTom's tile retrieval time is labeled as a fetch time rather than a measurement time.

All source attributions are visible in the widget footer. The color scheme is part of the site's terminal theme, not the provider's default traffic raster colors.

### Validation

- Run `npm test` for normalization, provider-agnostic categories, timestamps, and tile bounding logic.
- Run `npm run build` to check the Nuxt/Vite integration.
- In a test deployment, run `weather` and `weather New York` and confirm the map is underneath the existing ASCII radar and that animation/play/zoom controls still work.
- With no keys: `TRF: NO KEY`, no requests to any traffic provider.
- With a TomTom key: genuine colored road segments, closure/unknown behavior, `TRF: LIVE` when returned.
- With a WSDOT code: observation dots on covered Washington highways (not synthesized road geometry); outside Washington, `NO DATA` is legitimate.
- With a bad key or service outage: `TRF: ERROR` or `DEGRADED`, never stale lines labeled live.
- Confirm that neither private key appears in a browser network request or client bundle and that traffic usage stays within the free quota.

Provider API behavior on a live deployment is not guaranteed by unit tests; credentials and an integration smoke test are required before treating the overlay as production-verified.
