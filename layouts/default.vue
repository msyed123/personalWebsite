<template>
  <div class="flex-1 w-full flex flex-col font-mono text-terminal-amber bg-terminal-black">
    <header :inert="Boolean(weatherData)" class="border-b border-terminal-amber-dim pb-4 mb-6 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6">
      <div class="space-y-1">
        <h1 class="text-2xl md:text-3xl font-mono tracking-wider font-bold uppercase text-terminal-amber">
          <NuxtLink to="/" class="hover:text-terminal-blue transition-colors duration-300">mamoon_syed<span class="animate-blink text-terminal-blue">_</span></NuxtLink>
        </h1>
        <h2 class="text-xs md:text-sm text-terminal-amber-dim opacity-75 uppercase tracking-widest font-mono">
          // Aerospace Engineer
        </h2>
      </div>

      <nav class="flex flex-wrap gap-6 text-sm md:text-base font-mono tracking-widest">
        <NuxtLink to="/about" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">about</NuxtLink>
        <NuxtLink to="/projects" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">projects</NuxtLink>
        <a href="/sgrs/index.html" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">s-grs</a>
        <NuxtLink to="/courses" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">courses</NuxtLink>
        <NuxtLink to="/contact" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">contact</NuxtLink>
        <NuxtLink to="/diary" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">diary</NuxtLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main :inert="Boolean(weatherData)" :class="['flex-grow w-full mx-auto p-4 lg:p-0', route.path === '/draft' ? 'max-w-[2000px] px-8' : 'max-w-5xl']">
      <slot />
    </main>

    <div class="terminal-workspace" :class="{ 'terminal-workspace-map': weatherData }"
      :style="weatherData ? visualViewportStyle : undefined" @keydown.esc="dismissMap">
      <WeatherCard v-if="weatherData" :key="activeMapKey"
        :weatherData="weatherData" :mode="activeCardMode" @close="dismissMap" />
      <footer class="sticky bottom-0 z-50 w-full backdrop-blur-md border-t border-terminal-amber-dim bg-terminal-black/95 opacity-95 px-4 py-4 flex flex-col gap-2 text-sm md:text-base">
        <!-- Spotify card output -->
        <div v-if="spotifyData && !spotifyData.error" class="w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-center">
          <SpotifyCard :track="spotifyData" @close="clearScreen" />
        </div>

        <!-- Games output -->
        <div v-else-if="activeGame === 'snake'" class="w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-center overflow-x-auto">
          <TerminalSnake @close="clearScreen" />
        </div>
        <div v-else-if="activeGame === 'tetris'" class="w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-center overflow-x-auto">
          <TerminalTetris @close="clearScreen" />
        </div>

        <!-- Plain text output -->
        <div v-else-if="cmdOutput" class="text-terminal-amber-dim whitespace-pre-line w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-between items-start">
          <div role="status">{{ cmdOutput }}</div>
          <button @click="cmdOutput = ''" class="hover:text-red-500 shrink-0 ml-4">[x]</button>
        </div>

        <form class="flex gap-3 items-center w-full" aria-label="Terminal" @submit.prevent="handleCommand">
          <span class="text-terminal-blue font-bold tracking-widest whitespace-nowrap shrink-0">{{ cmdState === 'draft_password' ? 'PASSWORD >' : '~ $' }}</span>
          <input
            ref="terminalInput"
            v-model="cmdInput"
            aria-label="Terminal command"
            enterkeyhint="go"
            :type="cmdState === 'draft_password' ? 'password' : 'text'"
            class="bg-transparent border-none outline-none text-terminal-amber w-full min-w-0 text-base font-mono placeholder:text-terminal-amber-dim placeholder:opacity-40 focus:ring-0 lowercase"
            :placeholder="cmdState === 'draft_password' ? '...' : 'type command (e.g. cd projects)'"
            spellcheck="false"
            autocorrect="off"
            autocapitalize="none"
            autocomplete="off"
          />
        </form>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { WMO_CODES } from '~/utils/weatherCodes'

const terminalInput = ref<HTMLInputElement | null>(null)
const visualViewportStyle = ref<Record<string, string>>({})
let viewport: VisualViewport | null = null
function syncVisualViewport () {
  if (!viewport) return
  // Follow the on-screen keyboard and shifting browser UI, without interfering
  // with user pinch zoom.
  if (viewport.scale === 1) {
    visualViewportStyle.value = {
      '--terminal-viewport-height': viewport.height + 'px',
      '--terminal-viewport-top': viewport.offsetTop + 'px'
    }
  } else {
    visualViewportStyle.value = {}
  }
}
function desktopPointer () {
  return navigator.maxTouchPoints === 0 &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
onMounted(() => {
  viewport = window.visualViewport
  viewport?.addEventListener('resize', syncVisualViewport)
  viewport?.addEventListener('scroll', syncVisualViewport)
  syncVisualViewport()
  // Preserve the desktop keyboard shortcut without opening a touch keyboard
  // or jumping to the sticky footer on phones and tablets.
  if (desktopPointer()) {
    terminalInput.value?.focus({ preventScroll: true })
  }
})
const cmdInput = ref('')
const cmdOutput = ref('')
const router = useRouter()
const route = useRoute()

const activeGame = ref<string | null>(null)
const weatherData = ref<any>(null)
const activeCardMode = ref<'weather' | 'traffic'>('weather')
const activeMapKey = ref(0)
// Cancel superseded lookups so an old response cannot reopen a dismissed card.
let terminalRunId = 0
let lookupController: AbortController | null = null

// --- Spotify state ---
const spotifyData = ref<any>(null)
const spotifyLoading = ref(false)
let spotifyPollTimer: ReturnType<typeof setInterval> | null = null

async function fetchSpotify (requestId: number) {
  try {
    const data = await $fetch<any>('/api/spotify')
    if (requestId !== terminalRunId) return
    if (data?.error) {
      spotifyData.value = null
      cmdOutput.value = '[SPOTIFY] ' + String(data.error).replace('spotify connect', 'spotify --connect')
      return
    }
    spotifyData.value = data
    cmdOutput.value = ''
  } catch (e) {
    if (requestId !== terminalRunId) return
    spotifyData.value = null
    cmdOutput.value = '[SPOTIFY] Failed to fetch track data.'
  }
}

function startSpotifyPolling (requestId: number) {
  stopSpotifyPolling()
  // Poll every 30 seconds to sync real playback state
  spotifyPollTimer = setInterval(async () => {
    if (!spotifyData.value) return stopSpotifyPolling()
    try {
      const fresh = await $fetch<any>('/api/spotify')
      if (requestId !== terminalRunId) return
      if (fresh?.error) {
        // An expired authorization must not leave a stale "now playing" card.
        spotifyData.value = null
        cmdOutput.value = '[SPOTIFY] ' + String(fresh.error).replace('spotify connect', 'spotify --connect')
        stopSpotifyPolling()
        return
      }
      if (fresh) {
        // Sync the displayed track and progress from Spotify.
        spotifyData.value = { ...fresh }
        if (!fresh.isPlaying) stopSpotifyPolling()
      }
    } catch { /* silently ignore poll errors */ }
  }, 30_000)
}

function stopSpotifyPolling () {
  if (spotifyPollTimer !== null) {
    clearInterval(spotifyPollTimer)
    spotifyPollTimer = null
  }
}

function resetTerminal (keepMap = false) {
  terminalRunId++
  lookupController?.abort()
  lookupController = null
  stopSpotifyPolling()
  spotifyData.value = null
  spotifyLoading.value = false
  cmdOutput.value = ''
  activeGame.value = null
  if (!keepMap) {
    weatherData.value = null
    activeCardMode.value = 'weather'
  }
}

function clearScreen () { resetTerminal() }

function dismissMap (event?: KeyboardEvent) {
  if (!weatherData.value && !lookupController) return
  event?.preventDefault()
  const restoreFocus = Boolean(weatherData.value) && desktopPointer()
  clearScreen()
  if (restoreFocus) nextTick(() => terminalInput.value?.focus({ preventScroll: true }))
}

watch(() => route.path, () => {
  // Browser back/forward is another way to leave a map or an in-flight lookup.
  if (weatherData.value || lookupController) clearScreen()
})

onUnmounted(() => {
  terminalRunId++
  lookupController?.abort()
  stopSpotifyPolling()
  viewport?.removeEventListener('resize', syncVisualViewport)
  viewport?.removeEventListener('scroll', syncVisualViewport)
})

const availableDirs = ['about', 'projects', 'courses', 'contact', 'diary', 'home']
const cmdState = ref('normal') // 'normal' | 'draft_password'

const draftUnlocked = ref(false)

const handleCommand = () => {
  const input = cmdInput.value.trim().toLowerCase()
  cmdInput.value = ''

  if (cmdState.value === 'draft_password') {
    if (input === 'aib') {
      cmdOutput.value = `[AUTHENTICATION SUCCESSFUL]\nAccess granted. Initializing draft sequence...`
      cmdState.value = 'normal'
      draftUnlocked.value = true
      if (process.client) sessionStorage.setItem('draftUnlocked', '1')
      router.push('/draft').then(() => { if (process.client) window.scrollTo(0, 0) })
    } else {
      cmdOutput.value = `[AUTHENTICATION FAILED]\nIncorrect password. Access denied.`
      cmdState.value = 'normal'
    }
    return
  }

  if (!input) return

  const isWeatherCommand = input === 'weather' || input.startsWith('weather ')
  const isTrafficCommand = input === 'traffic' || input.startsWith('traffic ')
  // Keep the current map available while resolving a replacement. Ordinary
  // commands clear it so their output or destination has the screen.
  resetTerminal(isWeatherCommand || isTrafficCommand)

  if (input.startsWith('man ')) {
    const cmd = input.split(' ')[1]
    const manPages: Record<string, string> = {
      pwd: 'NAME\n    pwd - print working directory\nSYNOPSIS\n    pwd\nDESCRIPTION\n    Outputs the absolute path of the current website route you are viewing.',
      ls: 'NAME\n    ls - list directory contents\nSYNOPSIS\n    ls\nDESCRIPTION\n    Displays a list of available directories (pages) on this website you can seamlessly navigate to using cd.',
      cd: 'NAME\n    cd - change directory\nSYNOPSIS\n    cd [directory]\nDESCRIPTION\n    Changes the current route. To go to the root directory, simply use `cd home` or `cd ..` or `cd /`.',
      clear: 'NAME\n    clear - clear the terminal screen\nSYNOPSIS\n    clear\nDESCRIPTION\n    Clears all previous command outputs and active cards (Spotify, Weather, Games).',
      date: 'NAME\n    date - print current system date\nSYNOPSIS\n    date\nDESCRIPTION\n    Fetches the actual JS date object representation of the current time locally.',
      nowplaying: 'NAME\n    nowplaying - spotify listener status\nSYNOPSIS\n    nowplaying\nDESCRIPTION\n    Hooks into the server to fetch the exact song Mamoon is currently listening to on Spotify, along with an animated progress bar.',
      spotify: 'NAME\n    spotify --connect - manage the site owner Spotify authorization\nSYNOPSIS\n    spotify --connect\nDESCRIPTION\n    Opens the owner-only secure website reconnection form. Only the configured Spotify owner account can reconnect.',
      chmod: 'NAME\n    chmod - change file modes/themes\nSYNOPSIS\n    chmod\nDESCRIPTION\n    A custom toggle that switches the environment from a dark CRT phosphor theme to a light paper aesthetic.',
      weather: 'NAME\n    weather - get real-time forecast\nSYNOPSIS\n    weather [location]\nDESCRIPTION\n    Contacts Open-Meteo services to pinpoint the exact location and fetch atmospheric temperature readings with ASCII display.',
      traffic: 'NAME\n    traffic - live road-flow and highway-sensor monitor\nSYNOPSIS\n    traffic [location]\nDESCRIPTION\n    Opens a standalone traffic map without precipitation or weather data. Uses available TomTom/WSDOT feeds.',
      snake: 'NAME\n    snake - launch snake simulation\nSYNOPSIS\n    snake\nDESCRIPTION\n    A fully-playable clone of the classic cell-arcade game right inside the footer, optimized for keyboard and standard DOS block-graphics.',
      tetris: 'NAME\n    tetris - launch tetris simulation\nSYNOPSIS\n    tetris\nDESCRIPTION\n    A block-dropping puzzle game clone leveraging rich ANSI color codes. Highly addictive.'
    }

    if (manPages[cmd]) {
      cmdOutput.value = manPages[cmd]
    } else {
      cmdOutput.value = `No manual entry for ${cmd}`
    }
    return
  }

  if (input === 'help') {
    cmdOutput.value = `Available commands:\n- cd <dir>   : Navigate to directory\n- pwd        : Print working directory\n- ls         : List directories\n- clear      : Clear output\n- date       : Show current date\n- nowplaying : Show currently / last playing track\n- spotify --connect : Reauthorize the site owner's Spotify account\n- chmod      : Toggle dark/light mode\n- weather    : Show weather (e.g. weather <city>)\n- traffic    : Show road traffic (e.g. traffic <city>)\n- snake      : Play Snake (desktop only)\n- tetris     : Play Tetris (desktop only)\n- man <cmd>  : Read manual page for command`
    return
  }

  if (input === 'pwd') {
    cmdOutput.value = route.path === '/' ? '/home/user' : `/home/user${route.path}`
    return
  }

  if (input === 'chmod') {
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme')
      cmdOutput.value = 'Switched to dark mode (755)'
    } else {
      document.body.classList.add('light-theme')
      cmdOutput.value = 'Switched to light mode (777)'
    }
    return
  }

  if (isWeatherCommand || isTrafficCommand) {
    const loc = input.split(' ').slice(1).join(' ') || 'Seattle'
    const requestId = terminalRunId
    const controller = new AbortController()
    lookupController = controller
    const timeout = setTimeout(() => controller.abort(), 20_000)

    cmdOutput.value = `Locating ${loc}...`
    // Our Nitro server performs both upstream requests, so the browser never
    // needs a direct connection to the Open-Meteo forecast API.
    $fetch<any>('/api/terminal-lookup', {
      query: { city: loc, mode: isTrafficCommand ? 'traffic' : 'weather' },
      signal: controller.signal
    })
      .then((data: any) => {
        if (requestId !== terminalRunId) return
        activeMapKey.value = requestId
        if (isTrafficCommand) {
          activeCardMode.value = 'traffic'
          weatherData.value = {
            lat: data.lat, lon: data.lon, location: data.location
          }
        } else {
          const code = Number(data.code)
          const condition = WMO_CODES[code as keyof typeof WMO_CODES] || 'Unknown'
          activeCardMode.value = 'weather'
          weatherData.value = {
            lat: data.lat, lon: data.lon, location: data.location,
            temp: data.temp, code, condition
          }
        }
        cmdOutput.value = ''
      })
      .catch((error: any) => {
        if (requestId !== terminalRunId) return
        const timedOut = controller.signal.aborted
        const description = timedOut
          ? 'Request timed out. Try again.'
          : (error?.data?.statusMessage || error?.statusMessage ||
              'Service temporarily unavailable. Try again.')
        cmdOutput.value = `Error fetching ${isTrafficCommand ? 'traffic location' : 'weather'}: ${description}`
      })
      .finally(() => {
        clearTimeout(timeout)
        if (lookupController === controller) lookupController = null
      })
    return
  }

  if (input === 'snake') {
    if (window.innerWidth < 768) {
      cmdOutput.value = `Snake requires a desktop display.`
    } else {
      activeGame.value = 'snake'
    }
    return
  }

  if (input === 'tetris') {
    if (window.innerWidth < 768) {
      cmdOutput.value = `Tetris requires a desktop display.`
    } else {
      activeGame.value = 'tetris'
    }
    return
  }

  if (/^spotify\s+(?:--|—)?connect$/.test(input)) {
    router.push('/spotify/connect')
    cmdOutput.value = '[SPOTIFY] Opening owner authorization...'
    return
  }

  if (input === 'nowplaying') {
    if (spotifyLoading.value) return
    spotifyLoading.value = true
    cmdOutput.value = '[SPOTIFY] Fetching track data...'
    spotifyData.value = null
    const requestId = terminalRunId
    fetchSpotify(requestId).then(() => {
      if (requestId !== terminalRunId) return
      spotifyLoading.value = false
      if (spotifyData.value && !spotifyData.value.error) startSpotifyPolling(requestId)
    })
    return
  }

  if (input === 'ls') {
    cmdOutput.value = `total 6\n` + [...availableDirs, 'draft (protected)'].map(d => `drwxr-xr-x  2 user  staff   64B  ${d}`).join('\n')
    return
  }

  if (input === 'clear') {
    cmdOutput.value = ''
    return
  }

  if (input === 'date') {
    cmdOutput.value = new Date().toString()
    return
  }

  if (input.startsWith('cd ')) {
    const dir = input.split(' ')[1]
    if (dir === '..') {
      router.push('/').then(() => { if (process.client) window.scrollTo(0, 0) })
      cmdOutput.value = `Navigated to root`
      return
    }

    if (dir === 'home' || dir === '/') {
      router.push('/').then(() => { if (process.client) window.scrollTo(0, 0) })
      cmdOutput.value = `Navigated to ${dir}`
      return
    }

    if (dir === 'draft') {
      cmdState.value = 'draft_password'
      cmdOutput.value = `[SECURE DIRECTORY DETECTED]\nEnter password to access /draft:`
      return
    }

    if (availableDirs.includes(dir)) {
      router.push(`/${dir}`).then(() => { if (process.client) window.scrollTo(0, 0) })
      cmdOutput.value = `Navigated to ${dir}`
    } else {
      cmdOutput.value = `-bash: cd: ${dir}: No such file or directory`
    }
    return
  }

  cmdOutput.value = `-bash: ${input}: command not found`
}

// Global hotkey listening could be added here if we want to focus the input anytime they type
</script>



<style scoped>
.terminal-workspace { display: contents; }

.terminal-workspace-map {
  position: fixed;
  z-index: 100;
  inset-inline: 0;
  inset-block-start: var(--terminal-viewport-top, 0px);
  block-size: var(--terminal-viewport-height, 100dvh);
  box-sizing: border-box;
  --map-margin: clamp(8px, 1.35vmin, 16px);
  padding-block-start: max(var(--map-margin), env(safe-area-inset-top));
  padding-block-end: max(var(--map-margin), env(safe-area-inset-bottom));
  padding-inline-start: max(var(--map-margin), env(safe-area-inset-left));
  padding-inline-end: max(var(--map-margin), env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: .35rem;
  background: rgb(0 0 0 / 75%);
}

.terminal-workspace-map footer {
  position: static;
  flex: none;
  opacity: 1;
  padding-block: .6rem;
  min-width: 0;
}

.terminal-workspace-map footer form:focus-within {
  outline: 1px solid #00d2ff;
  outline-offset: 3px;
}

:global(html:has(.terminal-workspace-map)),
:global(body:has(.terminal-workspace-map)) {
  overflow: hidden;
  overscroll-behavior: none;
}
</style>
