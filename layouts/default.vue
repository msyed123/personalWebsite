<template>
  <div class="flex-1 w-full flex flex-col font-mono text-terminal-amber bg-terminal-black">
    <header class="border-b border-terminal-amber-dim pb-4 mb-6 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6">
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
        <NuxtLink to="/courses" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">courses</NuxtLink>
        <NuxtLink to="/contact" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">contact</NuxtLink>
        <NuxtLink to="/diary" class="text-terminal-amber-dim hover:text-terminal-amber transition-colors duration-200 uppercase before:content-['//_'] before:text-terminal-blue before:mr-1">diary</NuxtLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main :class="['flex-grow w-full mx-auto p-4 lg:p-0', route.path === '/draft' ? 'max-w-[2000px] px-8' : 'max-w-5xl']">
      <slot />
    </main>
    
    <footer class="sticky bottom-0 z-50 bg-terminal-black/95 backdrop-blur-md border-t border-terminal-amber-dim p-4 w-full flex flex-col gap-2 text-sm md:text-base opacity-95">
      <!-- Spotify card output -->
      <div v-if="spotifyData && !spotifyData.error" class="w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-center">
        <SpotifyCard :track="spotifyData" @close="clearScreen" />
      </div>

      <!-- Weather card output -->
      <div v-else-if="weatherData" class="w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-center">
        <WeatherCard :weatherData="weatherData" @close="clearScreen" />
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
        <div>{{ cmdOutput }}</div>
        <button @click="cmdOutput = ''" class="hover:text-red-500 shrink-0 ml-4">[x]</button>
      </div>

      <div class="flex gap-3 items-center w-full">
        <span class="text-terminal-blue font-bold tracking-widest whitespace-nowrap shrink-0">{{ cmdState === 'draft_password' ? 'PASSWORD >' : '~ $' }}</span>
        <input 
          v-model="cmdInput" 
          @keydown.enter="handleCommand"
          :type="cmdState === 'draft_password' ? 'password' : 'text'" 
          class="bg-transparent border-none outline-none text-terminal-amber w-full font-mono placeholder:text-terminal-amber-dim placeholder:opacity-40 focus:ring-0 lowercase" 
          :placeholder="cmdState === 'draft_password' ? '...' : 'type command (e.g. cd projects)'"
          autofocus
        />
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { WMO_CODES } from '~/utils/weatherCodes'

const cmdInput = ref('')
const cmdOutput = ref('')
const router = useRouter()
const route = useRoute()

const activeGame = ref<string | null>(null)
const weatherData = ref<any>(null)

// --- Spotify state ---
const spotifyData = ref<any>(null)
const spotifyLoading = ref(false)
let spotifyPollTimer: ReturnType<typeof setInterval> | null = null

async function fetchSpotify () {
  try {
    const data = await $fetch('/api/spotify')
    spotifyData.value = data
    cmdOutput.value = ''
  } catch (e) {
    spotifyData.value = null
    cmdOutput.value = '[SPOTIFY] Failed to fetch track data.'
  }
}

function startSpotifyPolling () {
  stopSpotifyPolling()
  // Poll every 30 seconds to sync real playback state
  spotifyPollTimer = setInterval(async () => {
    if (!spotifyData.value) return stopSpotifyPolling()
    const prev = spotifyData.value
    try {
      const fresh = await $fetch<any>('/api/spotify')
      if (fresh && !fresh.error) {
        // If track changed, full replace; otherwise just update progress + isPlaying
        if (fresh.songTitle !== prev.songTitle) {
          spotifyData.value = fresh
        } else {
          spotifyData.value = { ...fresh }
        }
        // Stop polling if nothing is playing
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

function clearScreen () {
  stopSpotifyPolling()
  spotifyData.value = null
  cmdOutput.value = ''
  activeGame.value = null
  weatherData.value = null
}

onUnmounted(stopSpotifyPolling)

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

  // Dismiss any open cards before handling any command
  clearScreen()

  if (input.startsWith('man ')) {
    const cmd = input.split(' ')[1]
    const manPages: Record<string, string> = {
      pwd: 'NAME\n    pwd - print working directory\nSYNOPSIS\n    pwd\nDESCRIPTION\n    Outputs the absolute path of the current website route you are viewing.',
      ls: 'NAME\n    ls - list directory contents\nSYNOPSIS\n    ls\nDESCRIPTION\n    Displays a list of available directories (pages) on this website you can seamlessly navigate to using cd.',
      cd: 'NAME\n    cd - change directory\nSYNOPSIS\n    cd [directory]\nDESCRIPTION\n    Changes the current route. To go to the root directory, simply use `cd home` or `cd ..` or `cd /`.',
      clear: 'NAME\n    clear - clear the terminal screen\nSYNOPSIS\n    clear\nDESCRIPTION\n    Clears all previous command outputs and active cards (Spotify, Weather, Games).',
      date: 'NAME\n    date - print current system date\nSYNOPSIS\n    date\nDESCRIPTION\n    Fetches the actual JS date object representation of the current time locally.',
      nowplaying: 'NAME\n    nowplaying - spotify listener status\nSYNOPSIS\n    nowplaying\nDESCRIPTION\n    Hooks into the server to fetch the exact song Mamoon is currently listening to on Spotify, along with an animated progress bar.',
      chmod: 'NAME\n    chmod - change file modes/themes\nSYNOPSIS\n    chmod\nDESCRIPTION\n    A custom toggle that switches the environment from a dark CRT phosphor theme to a light paper aesthetic.',
      weather: 'NAME\n    weather - get real-time forecast\nSYNOPSIS\n    weather [location]\nDESCRIPTION\n    Contacts Open-Meteo services to pinpoint the exact location and fetch atmospheric temperature readings with ASCII display.',
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
    cmdOutput.value = `Available commands:\n- cd <dir>   : Navigate to directory\n- pwd        : Print working directory\n- ls         : List directories\n- clear      : Clear output\n- date       : Show current date\n- nowplaying : Show currently / last playing track\n- chmod      : Toggle dark/light mode\n- weather    : Show weather (e.g. weather <city>)\n- snake      : Play Snake (desktop only)\n- tetris     : Play Tetris (desktop only)\n- man <cmd>  : Read manual page for command`
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
  
  if (input.startsWith('weather')) {
    const loc = input.split(' ').slice(1).join(' ') || 'Gainesville'
    cmdOutput.value = `Fetching weather for ${loc}...`
    $fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`)
      .then((geo: any) => {
        if (!geo.results || geo.results.length === 0) {
          cmdOutput.value = `Location not found: ${loc}`
          return
        }
        const { latitude, longitude, name, admin1, country_code } = geo.results[0]
        return $fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`).then((weather: any) => {
          const temp = Math.round(weather.current.temperature_2m)
          const code = Number(weather.current.weather_code)
          const p = WMO_CODES[code as keyof typeof WMO_CODES] || 'Unknown'
          weatherData.value = {
            temp,
            condition: p,
            location: `${name}, ${admin1 || country_code || ''}`.replace(/,\s*$/, ''),
            code
          }
          cmdOutput.value = ''
        })
      })
      .catch((e: any) => {
        cmdOutput.value = `Error fetching weather: ${e.message}`
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

  if (input === 'nowplaying') {
    if (spotifyLoading.value) return
    spotifyLoading.value = true
    cmdOutput.value = '[SPOTIFY] Fetching track data...'
    spotifyData.value = null
    fetchSpotify().then(() => {
      spotifyLoading.value = false
      if (spotifyData.value && !spotifyData.value.error) {
        startSpotifyPolling()
      }
    }).catch(() => { spotifyLoading.value = false })
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
