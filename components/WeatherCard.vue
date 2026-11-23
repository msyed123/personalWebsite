<template>
  <div data-terminal-map-card class="font-mono text-sm border border-terminal-amber/30 p-3 sm:p-4 w-full min-w-0 bg-terminal-black shadow-lg relative flex flex-col gap-4 group">
    <button @click="$emit('close')" class="absolute top-2 right-3 z-[999] text-terminal-amber bg-terminal-black/80 px-2 py-0 border border-terminal-amber-dim hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer">[x]</button>
    
    <!-- Weather Data Top Bar -->
    <div v-if="!trafficOnly" class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 items-end w-full pt-1 pr-8">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Keep the original ASCII art, but allow long location names to wrap. -->
        <div class="flex-shrink-0 whitespace-pre leading-tight font-bold text-xs" :class="artColor">
{{ asciiArt }}
        </div>
        <div class="min-w-0 flex-1 pt-2">
          <div class="text-xs uppercase tracking-widest text-terminal-amber-dim mb-1" :class="{'animate-pulse': isPlaying}">LIVE RADAR SIGNAL</div>
          <div class="text-lg sm:text-xl font-bold text-terminal-blue leading-tight break-words">{{ weatherData.location }}</div>
        </div>
      </div>
      <div class="flex items-end gap-2 justify-start sm:justify-end shrink-0 sm:pb-0.5">
        <span class="text-3xl sm:text-4xl text-terminal-amber font-light whitespace-nowrap leading-none">{{ weatherData.temp }}°</span>
        <span class="text-xs sm:text-sm text-terminal-amber-dim uppercase pb-0.5 whitespace-nowrap">{{ weatherData.condition }}</span>
      </div>
    </div>

    <!-- A separate traffic terminal with no weather/radar panel. -->
    <div v-else class="flex flex-col gap-2 pt-1 pr-8">
      <span class="text-[11px] tracking-widest text-terminal-amber-dim">LIVE TRAFFIC SIGNAL</span>
      <div class="text-xl sm:text-2xl font-bold text-terminal-blue break-words">{{ weatherData.location }}</div>
      <div class="flex flex-wrap justify-between items-center gap-2 text-xs text-terminal-amber-dim">
        <span>FLOW STATUS: <strong class="text-terminal-amber">{{ trafficStatus }}</strong></span>
        <button type="button" @click="toggleTraffic" :disabled="!trafficLayerReady"
          :aria-pressed="trafficVisible"
          :aria-label="trafficVisible ? 'Turn traffic overlay off' : 'Turn traffic overlay on'"
          class="border border-terminal-amber-dim/70 px-3 py-1.5 text-terminal-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-50"
        >TRAFFIC {{ trafficLayerReady ? (trafficVisible ? '[ON]' : '[OFF]') : '[NO FEED]' }}</button>
      </div>
    </div>

    <!-- Map Container -->
    <div 
      ref="mapContainer" 
      class="w-full border border-terminal-amber-dim/50 bg-terminal-black overflow-hidden map-crt-effect relative"
      :class="trafficOnly ? 'h-80 sm:h-[26rem]' : 'h-72 sm:h-64'"
    >
      <!-- Explicit, keyboard-accessible traffic toggle. Radar is never affected. -->
      <div v-if="!trafficOnly" class="absolute top-2 right-2 z-[999] flex flex-col items-end gap-1">
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
      <div v-if="!trafficOnly && trafficVisible && (trafficStatus === 'LIVE' || trafficStatus === 'DEGRADED')" class="hidden sm:block absolute top-[72px] right-2 z-[999] map-control-bg border border-terminal-amber-dim/40 px-2 py-1 text-[9px] text-terminal-amber-dim text-right">
        <span class="text-green-500">●</span> FLOW
        <span class="text-amber-400">●</span> SLOW
        <span class="text-red-500">●</span> JAM
        <span class="text-gray-300">●</span> CLOSED
        <div v-if="trafficStationsEnabled" class="opacity-80">SENSOR READINGS: DOTS</div>
      </div>
      <!-- Keep zoom tools in the map; playback and the clock live in the
           dedicated, more legible timeline below the geographic viewport. -->
      <div class="absolute bottom-2 left-2 z-[999] flex map-control-bg border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
        <button aria-label="Zoom in" @click="zoomIn" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5 border-r border-terminal-amber-dim/50">+</button>
        <button aria-label="Zoom out" @click="zoomOut" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5">−</button>
      </div>
    </div>

    <!-- A proper temporal navigator: visible time, accessible playhead, and
         controls outside the map so precipitation never hides the timeline. -->
    <div v-if="!trafficOnly" class="radar-timeline border border-terminal-amber-dim/50 bg-terminal-black px-3 py-3 flex flex-col gap-2" role="group" aria-label="Radar timeline" :aria-busy="radarLoading">
      <div class="flex flex-wrap justify-between items-center gap-x-4 gap-y-1">
        <div class="flex flex-col gap-0.5">
          <span class="text-[11px] tracking-[0.17em] text-terminal-amber font-bold">RADAR TIMELINE</span>
          <span class="text-[10px] text-terminal-amber-dim">{{ isPlaying ? '◉ PLAYING' : '◯ PAUSED' }} · {{ timestamps.length ? 'PAST OBSERVATIONS' : 'AWAITING RADAR' }}</span>
        </div>
        <div class="text-right flex flex-col gap-0.5" aria-live="off">
          <span class="text-[10px] tracking-wider text-terminal-amber-dim">FRAME TIME</span>
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
        aria-label="Scrub radar timeline"
        :aria-valuetext="formatTime(timestamps[currentFrame]) || 'Radar not loaded'"
        @input="scrubFrame"
      />
      <div class="flex items-center justify-between gap-2 text-[10px] text-terminal-amber-dim tabular-nums" aria-hidden="true">
        <span>{{ formatTime(timestamps[0]) || '--:--' }}</span>
        <span class="tracking-wider">{{ timestamps.length ? (currentFrame + 1) + ' / ' + timestamps.length + ' · LOOP' : 'NO FRAMES' }}</span>
        <span>{{ formatTime(timestamps[timestamps.length - 1]) || '--:--' }}</span>
      </div>
      <div class="flex flex-wrap gap-2 pt-1">
        <button type="button" @click="prevFrame" :disabled="timestamps.length < 2" aria-label="Previous radar frame"
          class="border border-terminal-amber-dim/60 px-3 py-1.5 text-xs text-terminal-amber hover:text-terminal-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
          ◀ PREV
        </button>
        <button type="button" @click="togglePlay" :disabled="timestamps.length < 2"
          :aria-label="isPlaying ? 'Pause radar animation' : 'Play radar animation'"
          class="border border-terminal-blue/60 px-4 py-1.5 text-xs font-bold text-terminal-blue hover:text-terminal-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
          {{ isPlaying ? '❚❚ PAUSE' : '▶ PLAY' }}
        </button>
        <button type="button" @click="nextFrame" :disabled="timestamps.length < 2" aria-label="Next radar frame"
          class="border border-terminal-amber-dim/60 px-3 py-1.5 text-xs text-terminal-amber hover:text-terminal-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-blue disabled:opacity-40">
          NEXT ▶
        </button>
      </div>
    </div>

    <div v-if="trafficOnly && trafficVisible && trafficLayerReady"
      class="flex flex-wrap gap-3 text-[10px] text-terminal-amber-dim tracking-wide" aria-label="Traffic legend">
      <span><span class="text-green-500">●</span> FLOW</span>
      <span><span class="text-amber-400">●</span> SLOW</span>
      <span><span class="text-red-500">●</span> JAM</span>
      <span><span class="text-gray-300">●</span> CLOSED</span>
      <span v-if="trafficStationsEnabled">SENSORS: DOTS</span>
    </div>
    <div v-if="trafficLayerReady" class="flex flex-wrap gap-3 text-[10px] text-terminal-amber-dim">
      <span>TOMTOM ROADS: {{ trafficRoadHealth }}</span>
      <span>WSDOT SENSORS: {{ trafficStationHealth }}</span>
      <span v-if="trafficLastUpdate">LATEST FETCH: {{ trafficLastUpdate }}</span>
    </div>

    <!-- On phones, keep the traffic legend outside the map viewport. -->
    <div
      v-if="!trafficOnly && trafficVisible && (trafficStatus === 'LIVE' || trafficStatus === 'DEGRADED')"
      class="sm:hidden flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-terminal-amber-dim tracking-wide"
      aria-label="Traffic legend"
    >
      <span><span class="text-green-500">●</span> FLOW</span>
      <span><span class="text-amber-400">●</span> SLOW</span>
      <span><span class="text-red-500">●</span> JAM</span>
      <span><span class="text-gray-300">●</span> CLOSED</span>
      <span v-if="trafficStationsEnabled" class="opacity-80">SENSORS: DOTS</span>
    </div>

    <div class="text-[10px] sm:text-xs text-terminal-amber-dim/80 flex flex-wrap gap-x-3 justify-between tracking-widest uppercase mt-[-4px]">
      <span v-if="!trafficOnly">> Source: Rainviewer / Open-Meteo</span>
      <span v-else>> Source: Road flow / highway sensors</span>
      <span><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer" class="underline">OpenFreeMap</a> © OpenMapTiles / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="underline">OpenStreetMap</a><template v-if="trafficRoadsEnabled"> / Traffic © <a href="https://www.tomtom.com/" target="_blank" rel="noopener noreferrer" class="underline">TomTom</a></template><template v-if="trafficStationsEnabled"> / <a href="https://wsdot.wa.gov/traffic/api/" target="_blank" rel="noopener noreferrer" class="underline">WSDOT</a></template></span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, shallowRef, computed } from 'vue'

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

defineEmits(['close'])
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

const mapContainer = ref(null)
const mapInstance = shallowRef(null)

let radarController = null
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
const trafficLayerReady = ref(false)
const trafficRoadsEnabled = ref(false)
const trafficStationsEnabled = ref(false)
const trafficLastUpdate = ref('')
const trafficRoadHealth = ref('OFFLINE')
const trafficStationHealth = ref('OFFLINE')
let trafficController = null
let weatherMapDisposed = false
let animationInterval = null

function formatTime(unixTime) {
  if (!unixTime) return '';
  const d = new Date(unixTime * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stopAnimation() {
  isPlaying.value = false
  if (animationInterval !== null) clearTimeout(animationInterval)
  animationInterval = null
}

function scheduleNextPlayback() {
  if (!isPlaying.value || weatherMapDisposed) return
  // Delay after a completed crossfade; avoid advancing into unloaded frames.
  animationInterval = setTimeout(async () => {
    if (!isPlaying.value || weatherMapDisposed) return
    await nextFrame()
    if (isPlaying.value && !weatherMapDisposed) scheduleNextPlayback()
  }, 400)
}

function startAnimation() {
  if (!radarController || timestamps.value.length < 2) return
  stopAnimation()
  isPlaying.value = true
  scheduleNextPlayback()
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
  currentFrame.value = index
  radarLoading.value = true
  try {
    return await radarController.showFrame(index,
      trafficVisible.value ? RADAR_OPACITY_WITH_TRAFFIC : RADAR_OPACITY_SOLO)
  } finally {
    // Rapid scrubs can supersede this request; only the most recent selection
    // may clear its pending/loading indicator.
    if (currentFrame.value === index) radarLoading.value = false
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
  // Opaque roads and labels render on top of precipitation.
  radarController?.setOpacity(trafficVisible.value ? RADAR_OPACITY_WITH_TRAFFIC : RADAR_OPACITY_SOLO)
}

function zoomIn() {
  if (mapInstance.value) mapInstance.value.zoomIn();
}

function zoomOut() {
  if (mapInstance.value) mapInstance.value.zoomOut();
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
  }).addTo(mapInstance.value);

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
        radarController?.setOpacity(ready ? RADAR_OPACITY_WITH_TRAFFIC : RADAR_OPACITY_SOLO);
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
      // Keep the pixelated RainViewer aesthetic, with geographic lines and
      // all labels drawn on top inside the MapLibre style.
      try {
        const [{ createAsciiRadarLayer }, response] = await Promise.all([
          import('~/utils/asciiRadarLayer.js'),
          fetch('https://api.rainviewer.com/public/weather-maps.json')
        ]);
        if (!response.ok) throw new Error('RainViewer metadata unavailable');
        const meta = await response.json();
        if (weatherMapDisposed) return;
        const past = meta.radar?.past || [];
        if (past.length) {
          const radar = createAsciiRadarLayer({ gl, addProtocol, removeProtocol });
          if (radar.initialize(past.map(frame => frame.path),
            trafficVisible.value ? RADAR_OPACITY_WITH_TRAFFIC : RADAR_OPACITY_SOLO
          )) {
            radarController = radar;
            timestamps.value = past.map(frame => frame.time);
            showFrame(0);
            startAnimation();
          }
        }
      } catch (error) {
        console.error('[RADAR] Precipitation layer unavailable', error);
      }
    }
  });


})

onUnmounted(() => {
  weatherMapDisposed = true;
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

