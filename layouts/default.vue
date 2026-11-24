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
        <div v-else-if="cmdOutput" class="text-terminal-amber-dim whitespace-pre-wrap w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-between items-start">
          <div role="status" class="min-w-0 break-words">{{ cmdOutput }}</div>
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
import { formatTerminalDirectory, parseTerminalCommand } from '~/utils/terminalCommands.js'

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
  const input = cmdInput.value.trim()
  cmdInput.value = ''
  // Dismiss the touch keyboard in the submit gesture, not after an async
  // result that might arrive after the user has already tapped to type again.
  if (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches) {
    terminalInput.value?.blur()
  }

  if (cmdState.value === 'draft_password') {
    if (input.toLowerCase() === 'aib') {
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

  const parsed = parseTerminalCommand(input)
  const isWeatherCommand = parsed.action === 'execute' && parsed.command === 'weather'
  const isTrafficCommand = parsed.action === 'execute' && parsed.command === 'traffic'
  // Keep the current map available while resolving a replacement. Ordinary
  // commands clear it so their output or destination has the screen.
  resetTerminal(isWeatherCommand || isTrafficCommand)

  if (parsed.action === 'output') {
    cmdOutput.value = parsed.text
    return
  }

  if (parsed.action === 'connect') {
    router.push('/spotify/connect')
    cmdOutput.value = '[SPOTIFY] Opening owner authorization...'
    return
  }

  const { command } = parsed

  if (command === 'pwd') {
    cmdOutput.value = route.path === '/' ? '/home/user' : `/home/user${route.path}`
    return
  }

  if (command === 'chmod') {
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
    const loc = parsed.argument
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

  if (command === 'snake') {
    if (window.innerWidth < 768) {
      cmdOutput.value = `Snake requires a desktop display.`
    } else {
      activeGame.value = 'snake'
    }
    return
  }

  if (command === 'tetris') {
    if (window.innerWidth < 768) {
      cmdOutput.value = `Tetris requires a desktop display.`
    } else {
      activeGame.value = 'tetris'
    }
    return
  }

  if (command === 'nowplaying') {
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

  if (command === 'ls') {
    cmdOutput.value = formatTerminalDirectory([...availableDirs, 'draft (protected)'], parsed)
    return
  }

  if (command === 'whoami') {
    cmdOutput.value = 'user'
    return
  }

  if (command === 'echo') {
    cmdOutput.value = parsed.argument || ''
    return
  }

  if (command === 'clear') {
    cmdOutput.value = ''
    return
  }

  if (command === 'date') {
    cmdOutput.value = new Date().toString()
    return
  }

  if (command === 'cd') {
    const rawDirectory = parsed.argument || 'home'
    const dir = rawDirectory.startsWith('/') && rawDirectory !== '/' ? rawDirectory.slice(1) : rawDirectory
    if (dir === '.') {
      cmdOutput.value = 'Already in the current directory'
      return
    }
    if (dir === '..' || dir === '~') {
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
  }
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
