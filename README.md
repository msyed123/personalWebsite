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

After changing variables, restart/redeploy the server. Either key can be configured alone; with neither, the map/radar still work and the widget says **TRAFFIC [NO FEED]**.

The server APIs are `/api/traffic/status`, `/api/traffic/roads/:z/:x/:y`, and `/api/traffic/stations?bbox=west,south,east,north`. Provider credentials stay on the server. Road tiles cache for 180 seconds; sensor readings cache for 90 seconds. The browser refreshes every three minutes while the widget is open and traffic is enabled; use the explicit TRAFFIC [ON] / TRAFFIC [OFF] button to hide or restore the overlay without affecting radar playback. Hidden traffic does not fetch new tiles. The visible-road-tile limit prevents accidental global tile sweeps. WSDOT's actual measurement times are preserved; TomTom's tile retrieval time is labeled as a fetch time rather than a measurement time.

All source attributions are visible in the widget footer. Labels use the site's existing JetBrains Mono face (MapLibre local fonts, with fallback to provider glyphs), while congestion and sensor colors retain their meanings. Roads are drawn below map labels with a dark casing for contrast.

### Validation

- Run `npm test` for normalization, provider-agnostic categories, timestamps, and tile bounding logic.
- Run `npm run build` to check the Nuxt/Vite integration.
- In a test deployment, run `weather` and `weather New York` and confirm the map is underneath the existing ASCII radar and that animation/play/zoom controls still work.
- With no keys: `TRAFFIC [NO FEED]`, no requests to any traffic provider.
- With a TomTom key: genuine colored road segments, closure/unknown behavior, `TRAFFIC [ON] with LIVE status` when returned.
- With a WSDOT code: observation dots on covered Washington highways (not synthesized road geometry); outside Washington, `NO DATA` is legitimate.
- With a bad key or service outage: `TRF: ERROR` or `DEGRADED`, never stale lines labeled live.
- Confirm that neither private key appears in a browser network request or client bundle and that traffic usage stays within the free quota.

Provider API behavior on a live deployment is not guaranteed by unit tests; credentials and an integration smoke test are required before treating the overlay as production-verified.


## Spotify \`nowplaying\` — reconnecting after refresh-token expiration

Spotify announced on June 18, 2026 that refresh tokens expire **six months from the
original user authorization**, enforced for existing developer apps starting
July 20, 2026. Refreshing an *access token* does not extend that period.
An expired refresh token returns \`400 invalid_grant\` and requires an
interactive sign-in. The public website cannot safely initiate owner
reauthorization for arbitrary visitors.

The \`nowplaying\` terminal now displays a clear, non-sensitive error instead
of silently hiding failed responses. To reconnect **the site owner's account**:

1. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   edit the existing app's settings. Add this exact allowed redirect URI:
   \`http://127.0.0.1:8888/callback\` (loopback IP, **not** \`localhost\`).
   Leave the existing app's Client ID unchanged.
2. On your own trusted computer, set \`SPOTIFY_CLIENT_ID\` and
   \`SPOTIFY_CLIENT_SECRET\` as **local environment variables** using the
   values for that same app. Do not put them into the repository or share them.
   Then run \`node scripts/spotify-reauthorize.mjs\`.
3. Open the URL printed by the script **on that computer**, sign into
   the Spotify account that should appear on the website, and approve the
   two read-only scopes: \`user-read-currently-playing\` and
   \`user-read-recently-played\`.
4. The script receives the OAuth callback on \`127.0.0.1\` and prints a **new
   refresh token in the local terminal only**. In your Heroku application's
   Settings → Config Vars, replace \`SPOTIFY_REFRESH_TOKEN\` with the new
   secret and restart/redeploy as needed. Keep \`SPOTIFY_CLIENT_ID\` and
   \`SPOTIFY_CLIENT_SECRET\` unchanged.
5. Test \`nowplaying\` again. Repeat this owner-only consent workflow when
   the six-month authorization expires; never add the Spotify login flow to
   the publicly accessible terminal.

The script is local-only, uses OAuth state validation, and does not serve the
refresh token to the browser. **Never paste credentials, authorization codes,
or refresh tokens into GitHub, issue comments, screenshots, or chat.**

Relevant Spotify documentation:
[refresh-token expiration](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration),
[redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[required playback scopes](https://developer.spotify.com/documentation/web-api/concepts/scopes).
