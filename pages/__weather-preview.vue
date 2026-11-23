<template>
  <div class="min-h-screen bg-terminal-black text-terminal-amber font-mono px-4 py-8 flex flex-col items-center gap-3">
    <p class="text-[11px] text-terminal-amber-dim tracking-widest w-full max-w-2xl">
      WEATHER CARD / ACTUAL COMPONENT · RADAR & TRAFFIC SIMULATED · WEATHER {{ weatherStatus }}
    </p>
    <WeatherCard :weather-data="demoWeather" @close="() => {}" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
definePageMeta({ layout: false })
// Test fixture only. Never package this route as a live weather feature.
const demoWeather = ref({
  temp: 41,
  condition: 'Overcast',
  location: 'Seattle Waterfront, Washington',
  code: 3,
  lat: 47.6066,
  lon: -122.3394
})
const weatherStatus = ref('MOCK FALLBACK')

onMounted(async () => {
  try {
    // Open-Meteo is keyless. Weather values are live if this request succeeds.
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=47.6066&longitude=-122.3394&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles')
    if (!response.ok) throw new Error('Open-Meteo unavailable')
    const data = await response.json()
    const temp = data.current?.temperature_2m
    const code = data.current?.weather_code
    if (!Number.isFinite(temp) || !Number.isFinite(code)) throw new Error('Missing observations')
    const conditions = code <= 1 ? 'Clear' : code <= 3 ? 'Overcast' : code <= 48 ? 'Fog' : code <= 67 ? 'Rain' : code <= 77 ? 'Snow' : code <= 82 ? 'Showers' : code <= 86 ? 'Snow' : 'Storm'
    demoWeather.value = { ...demoWeather.value, temp: Math.round(temp), code, condition: conditions }
    weatherStatus.value = 'OPEN-METEO CURRENT'
  } catch {
    weatherStatus.value = 'MOCK FALLBACK'
  }
})
</script>
