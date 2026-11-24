<template>
  <section data-terminal-map-card class="map-panel font-mono text-sm border border-terminal-amber/30 p-3 sm:px-4 min-w-0 bg-terminal-black text-terminal-amber shadow-lg"
    :aria-label="`${trafficOnly ? 'Traffic' : 'Weather'} map: ${weatherData.location}`">
    <button type="button" aria-label="Close map" @click="$emit('close')"
      class="map-close text-terminal-amber bg-terminal-black border border-terminal-amber-dim hover:text-red-500 hover:border-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue">[x]</button>

    <!-- Weather Data Top Bar -->
    <div v-if="!trafficOnly" class="map-heading flex flex-wrap justify-between items-end gap-x-4 gap-y-1 w-full pt-1 pr-12">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Keep the original ASCII art, but allow long location names to wrap. -->
        <div class="map-art hidden sm:block flex-shrink-0 whitespace-pre leading-tight font-bold text-xs" :class="artColor">
{{ asciiArt }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="map-signal-heading mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <div class="text-xs uppercase tracking-widest text-terminal-amber-dim" :class="{'animate-pulse': isPlaying}">{{ weatherLayer === 'radar' ? 'RADAR SIGNAL' : 'MODEL PRECIPITATION FORECAST' }}</div>
            <div role="status" data-weather-freshness class="flex items-center gap-1.5 text-[10px] tabular-nums"
              :class="refreshDelayed ? 'text-terminal-amber' : newWeatherData ? 'text-green-400' : 'text-terminal-amber-dim'">
              <span aria-hidden="true" class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                :class="newWeatherData && !refreshDelayed ? 'bg-green-400' : 'bg-current opacity-70'"></span>
              <span v-if="feedRevision">{{ refreshDelayed ? 'Refresh delayed · ' : newWeatherData ? 'New data · ' : '' }}{{ weatherLayer === 'radar' ? 'Radar ' : 'Model run ' }}{{ formatFeedTime(feedRevision) }}</span>
              <span v-else>{{ layerStatus }}</span>
            </div>
          </div>
          <div class="text-lg sm:text-xl font-bold text-terminal-blue leading-tight break-words">{{ weatherData.location }}</div>
        </div>
      </div>
      <div class="flex items-end gap-2 justify-start sm:justify-end shrink-0 sm:pb-0.5">
        <span class="text-3xl sm:text-4xl text-terminal-amber font-light whitespace-nowrap leading-none">{{ weatherData.temp }}°</span>
        <span class="text-xs sm:text-sm text-terminal-amber-dim uppercase pb-0.5 whitespace-nowrap">{{ weatherData.condition }}</span>
      </div>
    </div>

    <!-- A separate traffic terminal with no weather/radar panel. -->
    <div v-else class="flex flex-wrap justify-between items-end gap-x-4 gap-y-1 pt-1 pr-12">
      <div class="min-w-0">
        <span class="block text-[11px] tracking-widest text-terminal-amber-dim">LIVE TRAFFIC SIGNAL</span>
        <div class="text-xl sm:text-2xl font-bold text-terminal-blue break-words">{{ weatherData.location }}</div>
      </div>
      <div class="flex flex-wrap justify-between items-center gap-2 text-xs text-terminal-amber-dim map-desktop-controls">
        <span>FLOW STATUS: <strong class="text-terminal-amber">{{ trafficStatus }}</strong></span>
        <button type="button" @click="toggleTraffic" :disabled="!trafficLayerReady"
          :aria-pressed="trafficVisible"
          :aria-label="trafficVisible ? 'Turn traffic overlay off' : 'Turn traffic overlay on'"
          class="border border-terminal-amber-dim/70 px-3 py-1.5 text-terminal-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-50"
        >TRAFFIC {{ trafficLayerReady ? (trafficVisible ? '[ON]' : '[OFF]') : '[NO FEED]' }}</button>
      </div>
    </div>

    <div class="map-workspace" :class="trafficOnly ? 'traffic-map-workspace' : 'weather-map-workspace'">
      <button type="button" class="map-controls-toggle map-control-bg border border-terminal-amber-dim px-3 text-xs text-terminal-amber"
        aria-controls="map-controls" :aria-expanded="controlsExpanded" @click="controlsExpanded = !controlsExpanded">
        {{ controlsExpanded ? 'Hide controls' : 'Controls' }}
      </button>
      <!-- Map Container -->
      <div
        ref="mapContainer"
        class="w-full border border-terminal-amber-dim/50 bg-terminal-black overflow-hidden map-crt-effect relative"
      >
        <!-- Explicit, keyboard-accessible traffic toggle. Radar is never affected. -->
        <div v-if="!trafficOnly" class="map-desktop-controls absolute top-2 right-2 z-[999] flex flex-col items-end gap-1">
          <button
            type="button"
            @click="toggleTraffic"
            :disabled="!trafficLayerReady"
            :aria-pressed="trafficVisible"
            :aria-label="trafficVisible ? 'Turn traffic overlay off' : 'Turn traffic overlay on'"
            class="map-control-bg border px-2.5 py-1.5 font-bold text-[10px] tracking-widest transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue"
            :class="trafficLayerReady ? (trafficVisible ? 'border-terminal-blue text-terminal-blue hover:text-terminal-amber' : 'border-terminal-amber-dim text-terminal-amber hover:text-terminal-blue') : 'border-terminal-amber-dim/40 text-terminal-amber-dim/60 cursor-not-allowed'"
          >TRAFFIC {{ trafficLayerReady ? (trafficVisible ? '[ON]' : '[OFF]') : '[NO FEED]' }}</button>
          <div v-if="trafficLayerReady && trafficVisible" class="map-control-bg border border-terminal-amber-dim/40 px-2 py-1 text-[9px] tracking-wide text-terminal-amber-dim">
            {{ trafficStatus }}<span v-if="trafficLastUpdate"> · FETCH {{ trafficLastUpdate }}</span>
          </div>
        </div>
        <div v-if="!trafficOnly && trafficVisible && (trafficStatus === 'LIVE' || trafficStatus === 'DEGRADED')" class="map-desktop-controls hidden sm:block absolute top-[72px] right-2 z-[999] map-control-bg border border-terminal-amber-dim/40 px-2 py-1 text-[9px] text-terminal-amber-dim text-right">
          <span class="text-green-500">●</span> FLOW
          <span class="text-amber-400">●</span> SLOW
          <span class="text-red-500">●</span> JAM
          <span class="text-gray-300">●</span> CLOSED
          <div v-if="trafficStationsEnabled" class="opacity-80">SENSOR READINGS: DOTS</div>
        </div>
        <!-- Keep zoom tools in the map; playback and the clock live in the
             dedicated, more legible timeline next to or below the map. -->
        <div class="absolute bottom-2 left-2 z-[999] flex map-control-bg border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
          <button aria-label="Zoom in" @click="zoomIn" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5 border-r border-terminal-amber-dim/50">+</button>
          <button aria-label="Zoom out" @click="zoomOut" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5">−</button>
        </div>
      </div>

      <!-- A proper temporal navigator: visible time, accessible playhead, and
           controls outside the map so precipitation never hides the timeline. -->
      <div id="map-controls"
        :class="{ 'map-controls-expanded': controlsExpanded, 'map-mobile-only': trafficOnly }"
        class="map-controls-panel radar-timeline min-w-0 border border-terminal-amber-dim/50 bg-terminal-black px-3 py-3 flex flex-col gap-2" role="group" :aria-label="trafficOnly ? 'Traffic controls' : weatherLayer === 'radar' ? 'Radar timeline' : 'Precipitation timeline'" :aria-busy="radarLoading">
        <template v-if="!trafficOnly">
        <div class="grid grid-cols-2 gap-1 text-xs" role="group" aria-label="Weather map layer">
          <button v-for="mode in ['radar', 'precipitation']" :key="mode" type="button"
            :aria-pressed="weatherLayer === mode"
            :class="weatherLayer === mode ? 'border-terminal-blue text-terminal-blue' : 'border-terminal-amber-dim/60 text-terminal-amber'"
            class="border px-1 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue"
            @click="selectWeatherLayer(mode)">{{ mode === 'radar' ? 'Radar' : 'Precipitation' }}</button>
        </div>
        <label class="flex flex-col gap-0.5 text-[11px] text-terminal-amber">
          <span class="flex justify-between gap-2">Weather opacity <span>{{ Math.round(weatherOpacity * 100) }}%</span></span>
          <input type="range" class="radar-scrubber block w-full h-5 cursor-pointer"
            min="0" max="100" step="5" :value="Math.round(weatherOpacity * 100)" aria-label="Weather opacity"
            :aria-valuetext="Math.round(weatherOpacity * 100) + '%'"
            :style="{ '--radar-progress': Math.round(weatherOpacity * 100) + '%' }"
            @input="setWeatherOpacity">
        </label>
        <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-1">
          <div class="flex flex-col gap-0.5">
            <span class="text-[11px] tracking-[0.17em] text-terminal-amber font-bold">{{ weatherLayer === 'radar' ? 'RADAR TIMELINE' : 'PRECIPITATION FORECAST' }}</span>
            <span class="text-[10px] text-terminal-amber-dim">{{ timestamps.length ? (isPlaying ? '◉ PLAYING' : '◯ PAUSED') : layerStatus }}</span>
          </div>
          <div class="text-right flex flex-col gap-0.5" aria-live="off">
            <span class="text-[10px] tracking-wider text-terminal-amber-dim">{{ weatherLayer === 'radar' ? 'FRAME TIME' : 'HOUR ENDING' }}</span>
            <span class="text-xl font-bold text-terminal-blue tabular-nums leading-tight">{{ formatTime(timestamps[currentFrame]) || '--:--' }}</span>
          </div>
        </div>
        <input
          id="radar-time-scrubber"
          type="range"
          class="radar-scrubber block w-full h-5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          :min="0"
          :max="Math.max(0, timestamps.length - 1)"
          :step="1"
          :value="currentFrame"
          :disabled="timestamps.length < 2"
          :style="{ '--radar-progress': timelineProgress + '%' }"
          :aria-label="weatherLayer === 'radar' ? 'Scrub radar timeline' : 'Scrub precipitation timeline'"
          :aria-valuetext="formatTime(timestamps[currentFrame]) || 'No weather frames loaded'"
          @input="scrubFrame"
        />
        <div class="flex items-center justify-between gap-2 text-[10px] text-terminal-amber-dim tabular-nums" aria-hidden="true">
          <span>{{ formatTime(timestamps[0]) || '--:--' }}</span>
          <span class="tracking-wider">{{ timestamps.length ? (currentFrame + 1) + ' / ' + timestamps.length + ' · LOOP' : 'NO FRAMES' }}</span>
          <span>{{ formatTime(timestamps[timestamps.length - 1]) || '--:--' }}</span>
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <button type="button" @click="prevFrame" :disabled="timestamps.length < 2" :aria-label="weatherLayer === 'radar' ? 'Previous radar frame' : 'Previous precipitation frame'"
            class="border border-terminal-amber-dim/60 px-3 py-1.5 text-xs text-terminal-amber hover:text-terminal-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
            ◀ PREV
          </button>
          <button type="button" @click="togglePlay" :disabled="timestamps.length < 2"
            :aria-label="(isPlaying ? 'Pause ' : 'Play ') + weatherLayer + ' animation'"
            class="border border-terminal-blue/60 px-4 py-1.5 text-xs font-bold text-terminal-blue hover:text-terminal-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
            {{ isPlaying ? '❚❚ PAUSE' : '▶ PLAY' }}
          </button>
          <button type="button" @click="nextFrame" :disabled="timestamps.length < 2" :aria-label="weatherLayer === 'radar' ? 'Next radar frame' : 'Next precipitation frame'"
            class="border border-terminal-amber-dim/60 px-3 py-1.5 text-xs text-terminal-amber hover:text-terminal-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
            NEXT ▶
          </button>
        </div>
        <p v-if="weatherSource === 'mrms'" class="text-[10px] text-terminal-amber-dim">
          Observed reflectivity (dBZ): ░ 11–24.5 · ▒ 25–39.5 · ▓ 40–54.5 · █ ≥55.
          Below 11 dBZ, missing or outside coverage is not displayed.
        </p>
        <p v-else-if="weatherSource === 'gdps'" class="text-[10px] text-terminal-amber-dim">
          ECCC GDPS model forecast. Millimetres accumulated in the preceding hour.
          <a :href="forecastLegendUrl" target="_blank" rel="noopener noreferrer" class="underline">Colour scale</a>
        </p>
        </template>
        <div class="map-mobile-only flex flex-wrap items-center justify-between gap-2 text-xs">
          <button type="button" class="border border-terminal-amber-dim px-3 py-2" @click="toggleTraffic"
            :disabled="!trafficLayerReady" :aria-pressed="trafficVisible"
            :aria-label="trafficVisible ? 'Turn traffic overlay off' : 'Turn traffic overlay on'">
            Traffic {{ trafficLayerReady ? (trafficVisible ? '[ON]' : '[OFF]') : '[NO FEED]' }}
          </button>
          <span>{{ trafficStatus }}</span>
        </div>
        <div v-if="trafficLayerReady && (trafficOnly || trafficVisible)" class="map-mobile-only flex-col gap-1 text-[10px] text-terminal-amber-dim">
          <p>TOMTOM ROADS: {{ trafficRoadHealth }} · WSDOT SENSORS: {{ trafficStationHealth }}</p>
          <p v-if="trafficLastUpdate">LATEST FETCH: {{ trafficLastUpdate }}</p>
          <p><span class="text-green-500">●</span> FLOW · <span class="text-amber-400">●</span> SLOW ·
            <span class="text-red-500">●</span> JAM · <span class="text-gray-300">●</span> CLOSED</p>
        </div>
      </div>
    </div>

    <div v-if="trafficOnly && trafficVisible && trafficLayerReady"
      class="map-desktop-controls flex flex-wrap gap-3 text-[10px] text-terminal-amber-dim tracking-wide" aria-label="Traffic legend">
      <span><span class="text-green-500">●</span> FLOW</span>
      <span><span class="text-amber-400">●</span> SLOW</span>
      <span><span class="text-red-500">●</span> JAM</span>
      <span><span class="text-gray-300">●</span> CLOSED</span>
      <span v-if="trafficStationsEnabled">SENSORS: DOTS</span>
    </div>
    <div v-if="trafficLayerReady" class="map-desktop-controls flex flex-wrap gap-3 text-[10px] text-terminal-amber-dim">
      <span>TOMTOM ROADS: {{ trafficRoadHealth }}</span>
      <span>WSDOT SENSORS: {{ trafficStationHealth }}</span>
      <span v-if="trafficLastUpdate">LATEST FETCH: {{ trafficLastUpdate }}</span>
    </div>

    <div class="text-[10px] sm:text-xs text-terminal-amber-dim/80 flex flex-wrap gap-x-3 justify-between tracking-widest uppercase mt-[-4px]">
      <span v-if="!trafficOnly">
        &gt; <a v-if="weatherSource === 'rainviewer'" href="https://www.rainviewer.com/" target="_blank"
          rel="noopener noreferrer" class="underline">{{ weatherAttribution }}</a><template v-else>{{ weatherAttribution }}</template>
        · Local conditions: Open-Meteo
      </span>
      <span v-else>> Source: Road flow / highway sensors</span>
      <span><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" class="underline">OpenFreeMap</a> © OpenMapTiles / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="underline">OpenStreetMap</a><template v-if="trafficRoadsEnabled"> / Traffic © <a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer" class="underline">TomTom</a></template><template v-if="trafficStationsEnabled"> / <a href="https://wsdot.wa.gov/traffic/api/" target="_blank" rel="noopener noreferrer" class="underline">WSDOT</a></template></span>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, shallowRef, computed, watch } from 'vue'
import {
  isMrmsCoverage, mrmsFrameCandidates, mrmsFrames, mrmsArchiveUrl, mrmsTileUrl,
  forecastCapabilitiesUrl, forecastLegendUrl, forecastTileUrl, readForecastFrames,
  decodeMrmsPixel, mrmsDisplayMark
} from '~/utils/weatherMapSources.js'
import { weatherPollDelay, weatherRevision, weatherTimelineUpdate, refreshedWeatherIndex } from '~/utils/weatherRefresh.js'

const props = defineProps({
  weatherData: {
    type: Object,
    required: true
  },
  mode: {
    type: String,
    default: 'weather',
    validator: value => ['weather','traffic'].includes(value)
  }
})

const trafficOnly = computed(() => props.mode === 'traffic')

const artColor = computed(() => {
  const code = props.weatherData.code;
  if (code === 0 || code === 1) return 'text-yellow-400'; // Sunny
  if (code <= 3) return 'text-gray-400'; // Cloudy
  if (code >= 51 && code <= 67) return 'text-blue-400'; // Rain
  if (code >= 71 && code <= 86) return 'text-white'; // Snow
  if (code >= 95) return 'text-purple-400'; // Thunder
  return 'text-terminal-amber';
});

const asciiArt = computed(() => {
  const code = props.weatherData.code;
  if (code === 0 || code === 1) return `\n  \\  /   \n_ /"".\\ _\n  \\__(/  \n  /  \\   `;
  if (code === 2 || code === 3) return `\n  .--.   \n .-(  ). \n(___.__)_)\n         `;
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return `\n  .--.   \n .-(  ). \n(___.__)_)\n ‘ ‘ ‘ ‘ `;
  if (code >= 71 && code <= 86) return `\n  .--.   \n .-(  ). \n(___.__)_)\n * * * * `;
  if (code >= 95) return `\n  .--.   \n .-(  ). \n(___.__)_)\n  ⚡ ⚡   `;
  return `\n _-_ _-_ \n  _-_ -_ \n _-_ _-_ \n         `;
});

defineEmits(['close'])
let resizeObserver
let cancelBridgeResize

const mapContainer = ref(null)
const mapInstance = shallowRef(null)

let radarController = null
let loadWeatherLayer
let layerRequest
let refreshTimer
let updateBadgeTimer
let lastWeatherCheck = 0
let activeTimeline
let lastRainViewerCheck = 0
let stopWeatherPolling
const feedRevision = ref(0)
const newWeatherData = ref(false)
const refreshDelayed = ref(false)
const weatherLayer = ref('radar')
const weatherSource = ref('')
const layerStatus = ref('AWAITING RADAR')
const weatherAttribution = computed(() => ({
  mrms: 'NOAA MRMS SeamlessHSR via Iowa State IEM',
  rainviewer: 'RainViewer radar fallback (not MRMS)',
  gdps: 'ECCC / Meteorological Service of Canada GeoMet'
}[weatherSource.value] || 'No weather overlay'))

function selectWeatherLayer(mode) {
  if (weatherLayer.value === mode) return
  weatherLayer.value = mode
  loadWeatherLayer?.(mode)
}
const timestamps = ref([])
const currentFrame = ref(0)
const isPlaying = ref(false)
const radarLoading = ref(false)
const timelineProgress = computed(() =>
  timestamps.value.length > 1 ? currentFrame.value * 100 / (timestamps.value.length - 1) : 0
)
// Keep precipitation vivid alone, but let congested roads remain visible beneath rain.
const RADAR_OPACITY_SOLO = 0.95
const RADAR_OPACITY_WITH_TRAFFIC = 0.55
const trafficStatus = ref('NO KEY')
const trafficVisible = ref(false)
const controlsExpanded = ref(false)
const customOpacity = ref(null)
const weatherOpacity = computed(() =>
  customOpacity.value ?? (trafficVisible.value ? RADAR_OPACITY_WITH_TRAFFIC : RADAR_OPACITY_SOLO))
watch(weatherOpacity, value => radarController?.setOpacity(value))

function setWeatherOpacity(event) {
  const amount = Number(event.target.value)
  if (Number.isFinite(amount)) customOpacity.value = Math.max(0, Math.min(100, amount)) / 100
}
const trafficLayerReady = ref(false)
const trafficRoadsEnabled = ref(false)
const trafficStationsEnabled = ref(false)
const trafficLastUpdate = ref('')
const trafficRoadHealth = ref('OFFLINE')
const trafficStationHealth = ref('OFFLINE')
let trafficController = null
let weatherMapDisposed = false
let animationInterval = null
let playbackGeneration = 0
let frameRequest = 0

function formatFeedTime(unixTime) {
  return new Date(unixTime * 1000).toLocaleString([], {
    ...(weatherLayer.value === 'precipitation' ? { weekday: 'short' } : {}),
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  })
}

function formatTime(unixTime) {
  if (!unixTime) return '';
  const d = new Date(unixTime * 1000);
  if (weatherLayer.value === 'precipitation') {
    return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stopAnimation() {
  playbackGeneration++
  isPlaying.value = false
  if (animationInterval !== null) clearTimeout(animationInterval)
  animationInterval = null
}

function scheduleNextPlayback(generation) {
  const active = () => generation === playbackGeneration && isPlaying.value && !weatherMapDisposed
  if (!active()) return
  // Delay after a completed crossfade; avoid advancing into unloaded frames.
  animationInterval = setTimeout(async () => {
    if (!active()) return
    animationInterval = null
    await nextFrame()
    if (active()) scheduleNextPlayback(generation)
  }, 400)
}

function startAnimation() {
  if (!radarController || timestamps.value.length < 2) return
  stopAnimation()
  isPlaying.value = true
  scheduleNextPlayback(playbackGeneration)
}

function togglePlay() {
  if (isPlaying.value) stopAnimation()
  else startAnimation()
}

async function showFrame(index) {
  if (!radarController || !Number.isInteger(index) || !timestamps.value[index]) {
    return false
  }
  // The playhead shows the requested time immediately. A brief buffering
  // indicator explains why the prior frame stays visible until tiles arrive.
  const activeController = radarController
  const generation = ++frameRequest
  currentFrame.value = index
  radarLoading.value = true
  try {
    return await activeController.showFrame(index,
      weatherOpacity.value)
  } finally {
    // Rapid scrubs can supersede this request; only the most recent selection
    // may clear its pending/loading indicator.
    if (radarController === activeController && frameRequest === generation) radarLoading.value = false
  }
}

function nextFrame() {
  if (timestamps.value.length < 2) return Promise.resolve(false)
  return showFrame((currentFrame.value + 1) % timestamps.value.length)
}

function prevFrame() {
  if (timestamps.value.length < 2) return Promise.resolve(false)
  stopAnimation()
  return showFrame((currentFrame.value + timestamps.value.length - 1) % timestamps.value.length)
}

function scrubFrame(event) {
  const index = Number(event.target.value)
  if (!Number.isInteger(index) || index < 0 || index >= timestamps.value.length) return
  stopAnimation()
  void showFrame(index)
}

function toggleTraffic() {
  if (weatherMapDisposed || !trafficController || !trafficLayerReady.value) return
  trafficVisible.value = !trafficVisible.value
  trafficController.setVisible(trafficVisible.value)
  // Weather opacity defaults to a lower value when traffic is visible.
}

function zoomIn() {
  if (mapInstance.value) mapInstance.value.zoomIn();
}

function zoomOut() {
  if (mapInstance.value) mapInstance.value.zoomOut();
}

function guardBridgeTransitions(layer, L) {
  // The Leaflet–MapLibre bridge's transition callback reads its map on the
  // next animation frame even after removal. Cancelling/safeguarding the
  // frame matters when the next command replaces a map during a resize.
  let pendingFrame = null
  const cancel = () => {
    if (pendingFrame !== null) L.Util.cancelAnimFrame(pendingFrame)
    pendingFrame = null
  }
  layer._transitionEnd = function () {
    cancel()
    pendingFrame = L.Util.requestAnimFrame(() => {
      pendingFrame = null
      const map = this._map
      const gl = this.getMaplibreMap()
      if (!map || !gl) return
      const center = map.getCenter()
      const offset = map.latLngToContainerPoint(map.getBounds().getNorthWest())
      this._resizeContainer()
      L.DomUtil.setTransform(gl._actualCanvas, offset, 1)
      gl.once('moveend', () => {
        if (this._map === map && this.getMaplibreMap() === gl) this._zoomEnd()
      })
      gl.jumpTo({ center, zoom: map.getZoom() - 1 })
    })
  }
  return cancel
}

onMounted(async () => {
  // Dynamically import Leaflet so it doesn't break Nuxt 3 SSR
  const L = (await import('leaflet')).default;
  const { maplibreGL } = await import('@maplibre/maplibre-gl-leaflet');
  const { setWorkerUrl, addProtocol, removeProtocol } = await import('maplibre-gl');
  const { default: workerUrl } = await import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url');
  setWorkerUrl(workerUrl);
  await import('leaflet/dist/leaflet.css');
  await import('maplibre-gl/dist/maplibre-gl.css');

  if (!mapContainer.value) return;

  const lat = props.weatherData.lat ?? 47.6062;
  const lon = props.weatherData.lon ?? -122.3321;

  // Set default zoom dramatically closer to 10
  mapInstance.value = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: trafficOnly.value,
    touchZoom: trafficOnly.value,
    doubleClickZoom: trafficOnly.value,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    minZoom: 4,
    maxZoom: 13
  }).setView([lat, lon], trafficOnly.value ? 12 : 11);

  // Leaflet listens for window resizes, but sidebar and timeline sizes can
  // also change while the viewport stays the same.
  resizeObserver = new ResizeObserver(() =>
    mapInstance.value?.invalidateSize({ animate: false, debounceMoveend: true }))
  resizeObserver.observe(mapContainer.value)

  // MapLibre owns the whole vector/raster stack. A separate Leaflet radar pane
  // would otherwise cover road text and traffic regardless of its alpha value.
  const baseMap = maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/dark',
    interactive: false,
    attributionControl: false,
    // The bridge normally draws a 20%-oversized canvas for panning. Weather
    // mode does not pan, so keep its WebGL surface within the map viewport.
    // Preserve the buffer for the draggable, traffic-only map.
    padding: trafficOnly.value ? 0.1 : 0
  })
  cancelBridgeResize = guardBridgeTransitions(baseMap, L)
  baseMap.addTo(mapInstance.value)

  // The WebGL map has its own label fonts: CSS font-family alone cannot change them.
  // MapLibre 6 supports local glyphs when the remote glyph URL is unset. The same
  // JetBrains Mono face already loaded by the Nuxt app can then render map labels.
  const gl = baseMap.getMaplibreMap();
  gl.once('load', async () => {
    if (weatherMapDisposed) return;
    try {
      await document.fonts.load('12px "JetBrains Mono"');
      if (weatherMapDisposed) return;
      gl.setGlyphs(null);
    } catch (error) {
      // Leave the provider's default glyph stack usable if local font loading fails.
      console.warn('[MAP] Local map font unavailable; using hosted glyphs', error);
    }
    for (const layer of gl.getStyle().layers || []) {
      const id = layer.id;
      if (id === 'background' && layer.type === 'background') gl.setPaintProperty(id, 'background-color', '#090c0f');
      if (id === 'water' && layer.type === 'fill') gl.setPaintProperty(id, 'fill-color', '#111e27');
      if (id === 'waterway' && layer.type === 'line') gl.setPaintProperty(id, 'line-color', '#1b3545');
      // Neutral basemap roads are context, not traffic observations.
      // Keep amber for labels/UI; reserve saturated green/amber/red for measured traffic.
      if (layer.type === 'line' && /^highway_(major|minor|motorway)/.test(id)) {
        const isCasing = id.includes('casing');
        const isMinor = id.includes('minor');
        gl.setPaintProperty(id, 'line-color',
          isCasing ? '#202830' : (isMinor ? '#29343d' : '#35414a'));
      }
      if (layer.type === 'symbol' && layer.layout?.['text-field']) {
        if (gl.getGlyphs() === null) {
          gl.setLayoutProperty(id, 'text-font', ['JetBrains Mono', 'Courier New', 'monospace']);
        }
        gl.setPaintProperty(id, 'text-color', /road|highway|place|label/.test(id) ? '#c28b33' : '#8c713f');
        gl.setPaintProperty(id, 'text-halo-color', '#090c0f');
        gl.setPaintProperty(id, 'text-halo-width', 1.25);
        gl.setPaintProperty(id, 'text-opacity', 0.9);
      }
    }
    const { createTrafficMap } = await import('~/utils/trafficMap.js');
    if (weatherMapDisposed) return;
    trafficController = createTrafficMap({
      gl,
      leafletMap: mapInstance.value,
      onStatus: (status) => { trafficStatus.value = status },
      onReady: (ready) => {
        trafficLayerReady.value = ready;
        trafficVisible.value = ready;
      },
      onSources: ({ roads, stations }) => {
        trafficRoadsEnabled.value = roads;
        trafficStationsEnabled.value = stations;
      },
      onHealth: ({ roads, stations }) => {
        trafficRoadHealth.value = roads;
        trafficStationHealth.value = stations;
      },
      onUpdate: (iso) => {
        trafficLastUpdate.value = iso
          ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
      }
    });
    trafficController.start();

    if (!trafficOnly.value) {
      const inMrmsCoverage = isMrmsCoverage(lat, lon)
      const activeDelay = () => weatherPollDelay(weatherLayer.value, weatherSource.value, inMrmsCoverage)
      const canPoll = () => !weatherMapDisposed && !document.hidden
      const scheduleRefresh = () => {
        clearTimeout(refreshTimer)
        if (!canPoll()) return
        const delay = Math.max(0, lastWeatherCheck + activeDelay() - Date.now())
        refreshTimer = setTimeout(() => void loadWeatherLayer(weatherLayer.value, true), delay)
      }
      document.addEventListener('visibilitychange', scheduleRefresh)
      stopWeatherPolling = () => document.removeEventListener('visibilitychange', scheduleRefresh)

      loadWeatherLayer = async (mode, refresh = false) => {
        if (refresh && (!canPoll() || layerRequest)) return
        clearTimeout(refreshTimer)
        layerRequest?.abort()
        const request = new AbortController()
        layerRequest = request
        const { signal } = request
        const stillActive = () => !signal.aborted && !weatherMapDisposed
        const fetchMetadata = (url, options = {}) => fetch(url, {
          ...options, cache: 'no-cache', signal: AbortSignal.any([signal, AbortSignal.timeout(6500)])
        })
        if (!refresh) {
          stopAnimation()
          radarController?.destroy()
          radarController = null
          timestamps.value = []
          currentFrame.value = 0
          weatherSource.value = ''
          activeTimeline = undefined
          lastRainViewerCheck = 0
          feedRevision.value = 0
          refreshDelayed.value = false
          newWeatherData.value = false
          clearTimeout(updateBadgeTimer)
        }
        if (!activeTimeline) {
          radarLoading.value = true
          layerStatus.value = 'Loading ' + (mode === 'radar' ? 'radar' : 'forecast') + '…'
        }
        try {
          const { createAsciiRadarLayer } = await import('~/utils/asciiRadarLayer.js')
          if (!stillActive()) return
          let paths = [], times = [], source = '', settings = {}
          if (mode === 'precipitation') {
            const response = await fetchMetadata(forecastCapabilitiesUrl)
            if (!response.ok) throw Error('Forecast metadata unavailable')
            paths = readForecastFrames(await response.text())
            times = paths.map(frame => frame.time)
            source = 'gdps'
            settings = { providerTile: forecastTileUrl, providerMaxZoom: 6, keepProviderColors: true }
          } else {
            if (inMrmsCoverage) {
              for (const time of mrmsFrameCandidates()) {
                if (!stillActive()) return
                try {
                  const available = await fetchMetadata(mrmsArchiveUrl(time), { method: 'HEAD' })
                  if (!available.ok || !available.headers.get('content-type')?.includes('image/png')) continue
                  paths = times = mrmsFrames(time)
                  source = 'mrms'
                  settings = {
                    providerTile: mrmsTileUrl, providerMaxZoom: 8,
                    pixelMark: (r, g, b, a) => mrmsDisplayMark(decodeMrmsPixel(r, g, b, a))
                  }
                  break
                } catch {
                  // Network or timeout: try the existing observation provider
                  // instead of spending up to four timeouts on archive probes.
                  break
                }
              }
            }
            if (!stillActive()) return
            if (!paths.length) {
              if (activeTimeline?.source === 'mrms') throw Error('MRMS archive unavailable')
              if (activeTimeline?.source === 'rainviewer' &&
                Date.now() - lastRainViewerCheck < weatherPollDelay('radar', 'rainviewer', false)) return
              lastRainViewerCheck = Date.now()
              const response = await fetchMetadata('https://api.rainviewer.com/public/weather-maps.json')
              if (!response.ok) throw Error('Radar metadata unavailable')
              const past = (await response.json()).radar?.past ?? []
              const frames = [...new Map(past.filter(frame => frame.path?.startsWith('/') &&
                Number.isFinite(frame.time)).map(frame => [frame.time, frame])).values()]
                .sort((a, b) => a.time - b.time).slice(-12)
              paths = frames.map(frame => frame.path)
              times = frames.map(frame => frame.time)
              source = 'rainviewer'
            }
          }
          if (!stillActive()) return
          if (!paths.length) throw Error('No weather frames available')
          const revision = weatherRevision(source, paths, times)
          const nextTimeline = { source, paths, revision }
          const update = weatherTimelineUpdate(activeTimeline, nextTimeline)
          const before = activeTimeline
          refreshDelayed.value = update === 'delayed'
          if (update === 'unchanged' || update === 'delayed') return

          const selected = !before
            ? (mode === 'radar' ? times.length - 1 : 0)
            : refreshedWeatherIndex(timestamps.value, times, currentFrame.value, mode === 'radar' && !isPlaying.value)
          if (!radarController || before?.source !== source) {
            radarController?.destroy()
            radarController = null
            const layer = createAsciiRadarLayer({ gl, addProtocol, removeProtocol, ...settings })
            if (!layer.initialize(paths, weatherOpacity.value, selected)) {
              throw Error('Weather layer did not initialize')
            }
            radarController = layer
          } else {
            radarController.setFrames(paths)
          }
          timestamps.value = times
          activeTimeline = nextTimeline
          weatherSource.value = source
          feedRevision.value = revision
          if (before && update === 'new') {
            newWeatherData.value = true
            clearTimeout(updateBadgeTimer)
            updateBadgeTimer = setTimeout(() => { newWeatherData.value = false }, 12_000)
          }
          // Same-provider refreshes reuse the existing controller and cached tiles.
          // Never restart playback or reset a retained selection on a refresh.
          void showFrame(selected)
          if (!before && mode === 'radar') startAnimation()
        } catch {
          if (stillActive()) {
            refreshDelayed.value = !!activeTimeline
            layerStatus.value = mode === 'radar' ? 'Radar unavailable' : 'Forecast unavailable'
          }
        } finally {
          if (layerRequest === request) {
            layerRequest = null
            if (stillActive()) {
              if (!activeTimeline) radarLoading.value = false
              lastWeatherCheck = Date.now()
              scheduleRefresh()
            }
          }
        }
      }
      void loadWeatherLayer(weatherLayer.value)
    }
  });


})

onUnmounted(() => {
  weatherMapDisposed = true;
  resizeObserver?.disconnect();
  cancelBridgeResize?.();
  layerRequest?.abort();
  clearTimeout(refreshTimer);
  clearTimeout(updateBadgeTimer);
  stopWeatherPolling?.();
  stopAnimation();
  radarLoading.value = false;
  if (trafficController) trafficController.destroy();
  trafficController = null;
  radarController?.destroy();
  radarController = null;
  if (mapInstance.value) {
    mapInstance.value.remove();
  }
})
</script>

<style scoped>
.radar-scrubber {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  outline-offset: 4px;
  background: linear-gradient(to right,
    #00d2ff 0%, #00d2ff var(--radar-progress),
    #374151 var(--radar-progress), #374151 100%);
  background-clip: content-box;
  padding: 8px 0;
  height: 22px;
  border-radius: 0;
}

.radar-scrubber::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  height: 16px;
  width: 9px;
  border: 2px solid #0a0a0a;
  border-radius: 1px;
  background: #00d2ff;
  box-shadow: 0 0 0 1px #00d2ff;
}

.radar-scrubber::-moz-range-thumb {
  height: 14px;
  width: 7px;
  border: 2px solid #0a0a0a;
  border-radius: 1px;
  background: #00d2ff;
  box-shadow: 0 0 0 1px #00d2ff;
}

.radar-scrubber:focus-visible {
  outline: 2px solid #00d2ff;
}

.map-panel {
  flex: 1 1 0;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  gap: .65rem;
  overflow: auto;
  overscroll-behavior: contain;
}

.map-panel > :not(.map-workspace) {
  flex-shrink: 0;
}

.map-close {
  position: sticky;
  top: 0;
  align-self: flex-end;
  margin-bottom: -3rem;
  width: 2.75rem;
  height: 2.75rem;
  z-index: 1001;
}

.map-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.65rem;
  flex: 1 0 auto;
  min-width: 0;
}

.traffic-map-workspace {
  grid-template-rows: minmax(clamp(240px, 75dvh, 800px), 1fr);
}

.weather-map-workspace {
  grid-template-rows: minmax(clamp(230px, 55dvh, 520px), 1fr) auto;
}

@media (min-width: 1024px) {
  .weather-map-workspace {
    grid-template-columns: minmax(0, 1fr) clamp(17rem, 23vw, 21rem);
    grid-template-rows: minmax(290px, 1fr);
  }

  .weather-map-workspace .radar-timeline {
    align-self: start;
  }
}

.map-controls-toggle, .map-mobile-only { display: none; }

@media (max-width: 639px), (max-height: 560px) and (pointer: coarse) {
  .map-panel .map-desktop-controls, .map-panel .map-art { display: none; }
  .map-workspace {
    position: relative;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    min-height: 0;
    flex: 1 1 0;
  }
  .map-controls-toggle {
    display: block;
    position: absolute;
    top: .5rem;
    left: .5rem;
    z-index: 1000;
    min-height: 44px;
  }
  .map-mobile-only { display: flex; }
  .map-controls-panel {
    display: none;
    position: absolute;
    z-index: 1000;
    left: .5rem;
    right: .5rem;
    bottom: .5rem;
    max-height: min(54%, calc(100% - 3.65rem));
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .map-controls-panel.map-controls-expanded { display: flex; }
}
/* Leaflet transforms its panes and MapLibre composites a WebGL canvas.
   Clip at the viewport's own paint boundary, not only via overflow, to keep
   precipitation from appearing beside the sticky terminal during animation.
   Do not filter this ancestor: filtering promotes the entire map to a
   separate compositing surface on some browsers. */
.map-crt-effect {
  contain: paint;
  isolation: isolate;
  clip-path: inset(0);
  overflow: hidden;
}

.map-control-bg {
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
}

:deep(.leaflet-container) {
  background: #000000;
  font-family: inherit;
}
:deep(.leaflet-control-container) {
  display: none !important;
}
</style>

