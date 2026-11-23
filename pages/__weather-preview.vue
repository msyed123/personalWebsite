<template>
  <div class="min-h-screen bg-terminal-black text-terminal-amber font-mono px-4 py-8 flex justify-center items-start">
    <WeatherCard :weather-data="demoWeather" @close="() => {}" />
  </div>
</template>

<script setup>
definePageMeta({ layout: false })
// Visual-test fixture. This route is only used on the feature branch.
const demoWeather = {
  temp: 41,
  condition: 'Overcast',
  location: 'Seattle, Washington',
  code: 3,
  lat: 47.6062,
  lon: -122.3321
}
</script>
