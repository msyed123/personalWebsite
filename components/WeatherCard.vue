<template>
  <div class="font-mono text-sm border border-terminal-amber/30 p-4 max-w-2xl w-full bg-terminal-black/80 shadow-lg relative flex flex-col gap-4 group">
    <button @click="$emit('close')" class="absolute top-2 right-3 z-[999] text-terminal-amber bg-terminal-black/80 px-2 py-0 border border-terminal-amber-dim hover:text-red-500 hover:border-red-500 transition-colors cursor-pointer">[x]</button>
    
    <!-- Weather Data Top Bar -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 w-full pt-1 pr-10">
      
      <div class="flex items-center gap-3">
        <!-- ASCII Art container -->
        <div class="flex-shrink-0 whitespace-pre leading-tight font-bold text-xs sm:text-xs" :class="artColor">
{{ asciiArt }}
        </div>
        <div class="pt-2">
          <div class="text-xs uppercase tracking-widest text-terminal-amber-dim mb-1" :class="{'animate-pulse': isPlaying}">LIVE RADAR SIGNAL</div>
          <div class="text-xl sm:text-2xl font-bold text-terminal-blue truncate">{{ weatherData.location }}</div>
        </div>
      </div>
      
      <div class="flex items-end gap-3 mt-2 sm:mt-0">
        <span class="text-3xl sm:text-4xl text-terminal-amber font-light">{{ weatherData.temp }}°</span>
        <span class="text-sm text-terminal-amber-dim uppercase pb-1 sm:pb-2 tracking-wide">{{ weatherData.condition }}</span>
      </div>
    </div>

    <!-- Map Container -->
    <div 
      ref="mapContainer" 
      class="w-full h-48 sm:h-64 border border-terminal-amber-dim/50 bg-terminal-black overflow-hidden map-crt-effect relative"
    >
      <!-- Controls overlays -->
      <div class="absolute bottom-2 left-2 z-[999] flex gap-3 map-control-bg px-3 py-1.5 border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
        <button @click="togglePlay" class="hover:text-terminal-blue transition-colors focus:outline-none w-16 text-left">{{ isPlaying ? '|| PAUSE' : '► PLAY' }}</button>
        <button @click="prevFrame" class="hover:text-terminal-blue transition-colors focus:outline-none">&lt;</button>
        <button @click="nextFrame" class="hover:text-terminal-blue transition-colors focus:outline-none">&gt;</button>
      </div>
      <div v-if="timestamps.length > 0" class="absolute bottom-2 right-2 z-[999] map-control-bg px-2 py-1.5 border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
        {{ formatTime(timestamps[currentFrame]) }}
      </div>
    </div>

    <div class="text-[10px] sm:text-xs text-terminal-amber-dim/50 flex justify-between tracking-widest uppercase mt-[-4px]">
      <span>> Source: Rainviewer</span>
      <span>SYS.OP.OK</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, shallowRef, computed } from 'vue'

const props = defineProps({
  weatherData: {
    type: Object,
    required: true
  }
})

defineEmits(['close'])

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
  if (code === 0 || code === 1) { // Clear / Mainly clear
    return `
  \\  /   
_ /"".\\ _
  \\__(/  
  /  \\   `;
  }
  if (code === 2 || code === 3) { // Cloudy
    return `
  .--.   
 .-(  ). 
(___.__)_)
         `;
  }
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) { // Rain
    return `
  .--.   
 .-(  ). 
(___.__)_)
 ‘ ‘ ‘ ‘ `;
  }
  if (code >= 71 && code <= 86) { // Snow
    return `
  .--.   
 .-(  ). 
(___.__)_)
 * * * * `;
  }
  if (code >= 95) { // Thunderstorm
    return `
  .--.   
 .-(  ). 
(___.__)_)
  ⚡ ⚡   `;
  }
  // Default Fog / Other
  return `
 _-_ _-_ 
  _-_ _-_
 _-_ _-_ 
         `;
});

const mapContainer = ref(null)
const mapInstance = shallowRef(null)

const radarLayers = shallowRef([])
const timestamps = ref([])
const currentFrame = ref(0)
const isPlaying = ref(false)
let animationInterval = null

function formatTime(unixTime) {
  if (!unixTime) return '';
  const d = new Date(unixTime * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stopAnimation() {
  isPlaying.value = false;
  if (animationInterval) clearInterval(animationInterval);
}

function startAnimation() {
  if (radarLayers.value.length === 0) return;
  isPlaying.value = true;
  if (animationInterval) clearInterval(animationInterval);
  animationInterval = setInterval(() => {
    nextFrame();
  }, 1000); // 1s per frame
}

function togglePlay() {
  if (isPlaying.value) stopAnimation();
  else startAnimation();
}

function showFrame(index) {
  if (radarLayers.value.length === 0) return;
  // Hide all
  radarLayers.value.forEach(layer => layer.setOpacity(0));
  // Show target
  radarLayers.value[index].setOpacity(0.85);
  currentFrame.value = index;
}

function nextFrame() {
  let next = currentFrame.value + 1;
  if (next >= radarLayers.value.length) next = 0;
  showFrame(next);
}

function prevFrame() {
  let prev = currentFrame.value - 1;
  if (prev < 0) prev = radarLayers.value.length - 1;
  showFrame(prev);
}

onMounted(async () => {
  // Dynamically import Leaflet so it doesn't break Nuxt 3 SSR
  const L = (await import('leaflet')).default;
  await import('leaflet/dist/leaflet.css');

  if (!mapContainer.value) return;

  const lat = props.weatherData.lat || 29.6516;
  const lon = props.weatherData.lon || -82.3248;

  // Disable all zooming/panning to align with simple aesthetic and free tier restrictions
  mapInstance.value = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false
  }).setView([lat, lon], 7); // Locked zooming to 7

  // CartoDB Dark Matter basemap looks pristine for a CLI environment
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value);

  // Fetch rainviewer map data config
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const data = await res.json();
    
    // get the past radar frames to loop over
    if (data.radar && data.radar.past && data.radar.past.length > 0) {
      const past = data.radar.past;
      timestamps.value = past.map(p => p.time);
      
      const layers = past.map((p, idx) => {
        // Color scheme 6 (MAC format) looks great and vibrant against dark backgrounds
        const layer = L.tileLayer(`https://tilecache.rainviewer.com${p.path}/256/{z}/{x}/{y}/6/1_1.png`, {
          tileSize: 256,
          opacity: 0,
          transparent: true,
          zIndex: 10 + idx
        });
        layer.addTo(mapInstance.value);
        return layer;
      });
      
      radarLayers.value = layers;
      
      // Start the animation immediately from the first frame
      showFrame(0);
      startAnimation();
    }
  } catch (e) {
    console.error("[RADAR] Rainviewer fetch failed", e)
  }
})

onUnmounted(() => {
  stopAnimation();
  if (mapInstance.value) {
    mapInstance.value.remove();
  }
})
</script>

<style scoped>
/* Optional styling to make the map match a CRT effect slightly */
.map-crt-effect {
  filter: contrast(1.1) saturate(1.2);
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
