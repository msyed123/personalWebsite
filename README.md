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

## Weather radar and optional live traffic

The terminal weather card uses a keyless [OpenFreeMap](https://openfreemap.org/) vector basemap with existing RainViewer radar. Road-traffic flow is provided by [TomTom's Orbis Traffic Raster Tiles](https://docs.tomtom.com/traffic-api/documentation/tomtom-orbis-maps/v2/traffic-flow/raster-flow-tiles), which have a limited free monthly allowance and require a developer API key.

To turn on real traffic, register for a TomTom developer key and set the **server-side** deployment environment variable `NUXT_TOMTOM_TRAFFIC_KEY`. Redeploy or restart the server after adding it. Do **not** put the key in `.env` variables starting with `NUXT_PUBLIC_` or commit it to Git. Without a key, the weather card displays `TRF: NO KEY`, while the map and radar remain functional.

Traffic tiles are proxied through `/api/traffic/flow/{z}/{x}/{y}` to avoid revealing the key. Tiles are cached by browsers for three minutes and the visible layer refreshes every five minutes. The public proxy still consumes TomTom quota, so monitor your free-tier usage and configure spending limits where available. The legend represents relative road speed and closures, not exact vehicle speeds. Traffic may be absent for roads without coverage.

The map includes visible OpenFreeMap/OpenMapTiles/OpenStreetMap attribution and TomTom credit when traffic is enabled.

**Manual validation after deploying**: open `weather` and `weather Seattle` and confirm the vector basemap renders under the pixelated radar. Verify zoom and timeline controls. With no traffic key, verify `TRF: NO KEY` and no traffic tile requests. With a valid key, verify colored traffic roads and `TRF: LIVE`; with an invalid key, the status should show `TRF: ERROR` without breaking the basemap or radar. Confirm the small-screen footer and source attributions remain visible.
