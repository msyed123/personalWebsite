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
      <div class="absolute bottom-2 left-2 z-[999] flex map-control-bg border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
        <button @click="togglePlay" class="hover:text-terminal-blue transition-colors focus:outline-none w-16 text-left px-3 py-1.5">{{ isPlaying ? '|| PAUSE' : '► PLAY' }}</button>
        <button @click="prevFrame" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5">&lt;</button>
        <button @click="nextFrame" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5">&gt;</button>
        <div class="border-l border-terminal-amber-dim/50 flex">
          <button @click="zoomIn" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5 border-r border-terminal-amber-dim/50">+</button>
          <button @click="zoomOut" class="hover:text-terminal-blue transition-colors focus:outline-none px-3 py-1.5">-</button>
        </div>
      </div>
      <div v-if="timestamps.length > 0" class="absolute bottom-2 right-2 z-[999] map-control-bg px-2 py-1.5 border border-terminal-amber-dim/50 text-xs text-terminal-amber font-bold">
        {{ formatTime(timestamps[currentFrame]) }}
      </div>
    </div>

    <div class="text-[10px] sm:text-xs text-terminal-amber-dim/50 flex justify-between tracking-widest uppercase mt-[-4px]">
      <span>> Source: Rainviewer / Open-Meteo</span>
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
  if (code === 0 || code === 1) return `\n  \\  /   \n_ /"".\\ _\n  \\__(/  \n  /  \\   `;
  if (code === 2 || code === 3) return `\n  .--.   \n .-(  ). \n(___.__)_)\n         `;
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return `\n  .--.   \n .-(  ). \n(___.__)_)\n ‘ ‘ ‘ ‘ `;
  if (code >= 71 && code <= 86) return `\n  .--.   \n .-(  ). \n(___.__)_)\n * * * * `;
  if (code >= 95) return `\n  .--.   \n .-(  ). \n(___.__)_)\n  ⚡ ⚡   `;
  return `\n _-_ _-_ \n  _-_ -_ \n _-_ _-_ \n         `;
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
  radarLayers.value[index].setOpacity(1); // Grid layer opacity native works weirdly sometimes, 1 is best
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

function zoomIn() {
  if (mapInstance.value) mapInstance.value.zoomIn();
}

function zoomOut() {
  if (mapInstance.value) mapInstance.value.zoomOut();
}

onMounted(async () => {
  // Dynamically import Leaflet so it doesn't break Nuxt 3 SSR
  const L = (await import('leaflet')).default;
  await import('leaflet/dist/leaflet.css');

  if (!mapContainer.value) return;

  const lat = props.weatherData.lat || 29.6516;
  const lon = props.weatherData.lon || -82.3248;

  // Set default zoom dramatically closer to 10
  mapInstance.value = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    minZoom: 4,
    maxZoom: 13
  }).setView([lat, lon], 10); 

  // CartoDB Dark Matter basemap looks pristine for a CLI environment
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(mapInstance.value);

  // Define the custom ASCII Canvas GridLayer
  const AsciiRadarLayer = L.GridLayer.extend({
    createTile: function(coords, done) {
      var tile = document.createElement('canvas');
      var tileSize = this.getTileSize();
      tile.width = tileSize.x;
      tile.height = tileSize.y;
      var ctx = tile.getContext('2d', { willReadFrequently: true });
      
      const rainPath = this.options.rainPath;
      if (!rainPath) {
        done(null, tile);
        return tile;
      }

      // Automatically wrap longitudinal bounds so panning behaves gracefully
      var max = Math.pow(2, coords.z);
      var rx = coords.x % max;
      if (rx < 0) rx += max;
      var ry = coords.y;
      // Do not try to request tiles outside map bounds
      if (ry < 0 || ry >= max) {
         done(null, tile);
         return tile;
      }

      // Rainviewer's Free Tier hard-blocks zoom levels > 7 and returns an "Out of coverage" image artifact.
      // We mathematically bypass this limitation by artificially capping the fetch to Z=7,
      // and later extracting/upscaling the specific sub-region mapped to the user's coordinate.
      let fetchZ = coords.z;
      let fetchX = rx;
      let fetchY = ry;
      
      let zDiff = 0;
      if (fetchZ > 7) {
        zDiff = fetchZ - 7;
        fetchZ = 7;
        fetchX = Math.floor(rx / Math.pow(2, zDiff));
        fetchY = Math.floor(ry / Math.pow(2, zDiff));
      }

      const url = `https://tilecache.rainviewer.com${rainPath}/256/${fetchZ}/${fetchX}/${fetchY}/6/1_1.png`;

      // By explicitly using fetch, we can catch Rainviewer's 404 HTTP empty tile 
      // BEFORE it gets rendered natively into the canvas as a raw "404 Not Found" image
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Clear sky or empty radar tile');
          return res.blob();
        })
        .then(blob => {
          var img = new Image();
          var objUrl = URL.createObjectURL(blob);
          img.onload = () => {
            var off = document.createElement('canvas');
            off.width = tileSize.x; 
            off.height = tileSize.y;
            var oCtx = off.getContext('2d', { willReadFrequently: true });
            
            // If we fetched a Z=7 macro-tile to bypass the API limit, we must slice out the correct 
            // sub-region corresponding to the native zoomed-in tile before rendering it.
            if (zDiff > 0) {
              const scale = Math.pow(2, zDiff);
              const subSize = 256 / scale;
              const sx = (rx % scale) * subSize;
              const sy = (ry % scale) * subSize;
              
              // Disable interpolation to ensure upscaled radar clusters remain crisp pixel blocks
              oCtx.imageSmoothingEnabled = false;
              oCtx.drawImage(img, sx, sy, subSize, subSize, 0, 0, 256, 256);
            } else {
              oCtx.drawImage(img, 0, 0);
            }
            
            var imgData = oCtx.getImageData(0,0,tileSize.x,tileSize.y).data;
            
            var stepX = 3; 
            var stepY = 3; 
            ctx.font = 'bold 6px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            for(var y=0; y<tileSize.y; y+=stepY) {
              for(var x=0; x<tileSize.x; x+=stepX) {
                var idx = ((y * tileSize.x) + x) * 4;
                var r = imgData[idx];
                var g = imgData[idx+1];
                var b = imgData[idx+2];
                var a = imgData[idx+3];
                
                // RainViewer injects a muddy pale-yellow watermark text onto its free tier tiles.
                // It ALSO injects a perfectly grayscale '404' text on out-of-bounds tiles.
                // Genuine precipitation in Color Scheme 6 uses vibrant blues, greens, yellows, and reds.
                var maxC = Math.max(r, g, b);
                var minC = Math.min(r, g, b);
                var sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

                var isGrayscale = sat < 0.1;
                var isMuddyBrown = (r > g && g > b && r < 230 && b > 80 && Math.abs(r - g) < 30);

                if (a > 15 && !isGrayscale && !isMuddyBrown) {
                  var char = '░'; 
                  if (r > 190 && g < 150) char = '█'; // red/magenta (Heavy Rain)
                  else if (g > 150) char = '▓'; // green/yellow (Moderate Rain)
                  else if (b > 150) char = '▒'; // blue/cyan (Light Rain)

                  var fillR = Math.min(255, r * 1.4);
                  var fillG = Math.min(255, g * 1.4);
                  var fillB = Math.min(255, b * 1.4);
                  
                  ctx.fillStyle = `rgba(${fillR}, ${fillG}, ${fillB}, 1)`;
                  // Preserve map density sizes
                  ctx.font = 'bold 6px monospace';
                  ctx.fillText(char, x + stepX/2, y + stepY/2);
                }
              }
            }
            URL.revokeObjectURL(objUrl);
            done(null, tile);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objUrl);
            done(null, tile);
          }
          img.src = objUrl;
        })
        .catch(() => {
          // Empty sky / 404 tile means we shouldn't draw rain
          done(null, tile);
        });

      return tile;
    }
  });

  // Fetch rainviewer map data config
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    const data = await res.json();
    
    // get the past radar frames to loop over
    if (data.radar && data.radar.past && data.radar.past.length > 0) {
      const past = data.radar.past;
      timestamps.value = past.map(p => p.time);
      
      const layers = past.map((p, idx) => {
        const layer = new AsciiRadarLayer({
          tileSize: 256,
          opacity: 0,
          zIndex: 10 + idx,
          rainPath: p.path
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
