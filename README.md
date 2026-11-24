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

The weather terminal uses **OpenFreeMap Dark** (MapLibre through Leaflet) and provides two independently selected weather overlays. Neither needs traffic credentials.

- **Radar**: observed NOAA MRMS SeamlessHSR via the [Iowa State IEM tile service](https://mesonet.agron.iastate.edu/ogc/) when the selected location falls in the national raster's extent and the dated archive responds. It matches unique colors against the [published 0.5 dBZ palette](https://mesonet.agron.iastate.edu/GIS/rasters.php?rid=4) and renders the same Universal Blue rain palette in ASCII bands. The source cannot distinguish values below 11 dBZ in its colored tiles. Transparent, ambiguous, and missing pixels are not converted to zero. RainViewer is explicitly identified when used as the fallback. Source processing, coverage, or timings are not guaranteed to match any third-party map.
- **Precipitation**: [ECCC GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/wms_en/) GDPS 15 km model forecast, separate from observations. Each frame is millimetres accumulated in the hour ending at the timestamp. The forecast uses the provider's published color scale, not the radar dBZ legend.

Both overlays use bounded tile caches and use distinct frame times. Switching clears the old overlay and cancels its metadata load; it does not blend forecast and observations. The timeline and layer controls sit beside the map on desktop and open from **Controls** on phones.

While the weather map is visible, it checks the IEM two-minute MRMS product every two minutes, RainViewer every ten minutes, and GeoMet every 15 minutes when viewing precipitation (GDPS issues new runs twice daily). Returning to the tab catches up if a check is due. The status dot shows the latest radar frame or model run time and highlights new provider data; playback and scrubbing do not trigger updates. A failed refresh keeps the previous timeline visible and reports a delay.

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


## Website terminal

Use `help` to list commands, or `man COMMAND`, `help COMMAND`, and
`COMMAND --help` for a manual. `ls -a` adds virtual entries `.` and `..`;
`ls -l` uses long formatting and the flags can be combined as `ls -la`.
`whoami` returns the virtual terminal user. `echo` prints literal text; this
terminal does not read the host filesystem or expand shell variables. Use
`cat README` or `cat commands.txt` to read the public virtual files listed by
`ls`. On a keyboard, Tab completes known commands, flags and paths when it
can add text; otherwise it moves focus normally. Up/Down recall recent
commands in the current page only, with no persistence and no password
or `echo` text recorded.

## Spotify `nowplaying` — renew directly from the website

Spotify refresh tokens expire **six months after the user authorizes the app**.
After that, `400 invalid_grant` requires the owner to sign in to Spotify again.
The public `nowplaying` card remains read-only.

### One-time website setup (Heroku + Spotify)

A Heroku dyno cannot persist a file across a restart, and a refresh token must
never be placed in client JavaScript. This solution uses Upstash Redis over REST
for persistent token storage, encrypted on the server with AES-256-GCM.

1. Create a persistent Redis database at [Upstash](https://console.upstash.com/redis).
   Copy its **REST URL** and **Standard REST token**, not its read-only token.
   The Standard token must remain server-side.
2. In your Heroku app's **Settings → Config Vars**, retain the existing
   `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. Add these:
   - `UPSTASH_REDIS_REST_URL` — the Upstash HTTPS REST endpoint
   - `UPSTASH_REDIS_REST_TOKEN` — the Upstash **Standard** REST token
   - `SPOTIFY_TOKEN_ENCRYPTION_KEY` — a separate stable 64-character hex key
     (also generate locally with `openssl rand -hex 32`). This encrypts the
     refresh token before saving to Redis; do not rotate it casually.
   - `SPOTIFY_WEB_REDIRECT_URI` — the exact HTTPS URL on the canonical public
     website: `https://YOUR-SITE-DOMAIN/api/spotify/callback`.
   - Required: `SPOTIFY_OWNER_ACCOUNT_ID` — the immutable `account_id` returned
     by an owner-authenticated Spotify `GET /v1/me` for the intended account.
     Get it once with `node scripts/spotify-reauthorize.mjs --account-id-only`
     on a trusted computer, using the existing Spotify app credentials stored
     privately in its local environment. Register the exact loopback callback
     printed by the helper and approve in Spotify. This mode prints the account
     ID but never a token. Do not use a display name, username, or profile URL.
   - Leave `SPOTIFY_WEB_RENEWAL_ENABLED` unset (or `false`) until completing
     the setup and checks below.
3. In [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   add the **exact same** `SPOTIFY_WEB_REDIRECT_URI` as an allowed redirect URI
   for the existing Spotify application. It must use HTTPS, not localhost.
4. Before enabling reconnection, enable [Heroku router query-string redaction](https://devcenter.heroku.com/articles/http-routing#query-string-redaction)
   (`http-router-no-log-query`), and verify reverse proxies, APM, and log drains
   also redact the callback query. It includes a temporary OAuth code and state;
   application-level `no-store` and `no-referrer` do not redact infrastructure logs.
5. Verify the intended deployment has this hardening and that Upstash supports
   `GETDEL` and `EVAL` for the dedicated store. Only then set
   `SPOTIFY_WEB_RENEWAL_ENABLED=true` and validate with the owner's consent.
   Removing the flag disables web reconnect without disabling normal playback.

These one-time values are set on the server only and must **never** be prefixed
`NUXT_PUBLIC_`, committed to Git, pasted into issue comments, or placed in an
untrusted website.

### Renew the authorization (from any device)

1. Open the public website at the **same canonical HTTPS host** as the configured
   redirect URI.
2. Type `spotify --connect` or `nowplaying --connect` in the existing terminal, or visit
   `/spotify/connect` directly.
3. Select **Sign in with Spotify**. Spotify handles the login on its own site. Select the same Spotify account as before.
4. The OAuth callback consumes a short-lived, single-use Redis transaction
   bound to a separate HttpOnly/Secure/SameSite=Lax browser cookie, verifies the immutable Spotify `account_id`, and saves the
   refresh token encrypted in Redis. The token is never shown in the browser.
   If the account is different from the pinned owner, **nothing is replaced**.
5. Return to the terminal and run `nowplaying`. Playback uses the durable token; no need to update `SPOTIFY_REFRESH_TOKEN` in Heroku again.

The initial `SPOTIFY_REFRESH_TOKEN` config variable remains a migration
fallback until a successful website renewal. It may be removed after confirming
the new stored authorization works. The site also stores any rotated refresh
tokens using an atomic compare-and-set without resetting the six-month authorization age.
Public playback requests share in-flight work and a five-second cache per Heroku dyno.

### Security and failure behavior

- The public start endpoint accepts a same-origin POST and does not ask for a
  separate owner password. Only the exact configured Spotify account may
  persist an authorization, including on a fresh store.
- The browser receives a random short-lived host-only binding cookie. The store
  uses a hash of the binding and state and atomically consumes the transaction
  before exchanging the code.
- Redis applies separate shared ceilings per ten-minute window: 30 starts and
  12 provider exchanges across all dynos. It does not trust forwarding headers.
  Heavy abuse can temporarily exhaust the ceiling for the owner too.
- Tokens are encrypted before they reach Redis; only the server has the
  Redis Standard token and the encryption inputs.
- If persistent storage fails or the Spotify authorization expires, the public
  terminal shows a safe diagnostic instead of leaking any credentials.
- You can rotate `SPOTIFY_CLIENT_SECRET` without
  destroying the stored authorization. Back up `SPOTIFY_TOKEN_ENCRYPTION_KEY`
  securely: changing or losing it prevents decryption of the existing token
  until the store is reset by its administrator.
- If you want to retain the former local workflow as a backup, the helper
  `scripts/spotify-reauthorize.mjs` can still produce a token locally, but
  it is not required for the website renewal flow.

Official docs:
[Spotify refresh expiration](https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration),
[Spotify authorization-code flow](https://developer.spotify.com/documentation/web-api/tutorials/code-flow),
[Spotify redirect rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi),
[Heroku dyno filesystem](https://devcenter.heroku.com/articles/dyno-isolation).
