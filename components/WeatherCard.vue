<template>
  <div class="font-mono text-sm border border-terminal-amber/30 p-4 max-w-lg w-full bg-terminal-black/80 shadow-lg relative flex flex-col sm:flex-row gap-6 items-center sm:items-start group">
    <button @click="$emit('close')" class="absolute top-2 right-3 text-terminal-amber-dim opacity-50 hover:opacity-100 hover:text-red-500 transition-opacity">[x]</button>
    
    <!-- ASCII Art container -->
    <div class="flex-shrink-0 whitespace-pre leading-tight font-bold text-xs sm:text-sm mt-2 sm:mt-0" :class="artColor">
{{ asciiArt }}
    </div>
    
    <!-- Weather Data -->
    <div class="flex flex-col flex-grow justify-center w-full sm:w-auto text-center sm:text-left pt-2">
      <div class="text-xs uppercase tracking-widest text-terminal-amber-dim mb-1">Current Weather</div>
      <div class="text-xl sm:text-2xl font-bold text-terminal-blue mb-1 truncate">{{ weatherData.location }}</div>
      
      <div class="flex items-end justify-center sm:justify-start gap-3 mt-1">
        <span class="text-4xl text-terminal-amber font-light">{{ weatherData.temp }}°</span>
        <span class="text-sm text-terminal-amber-dim uppercase pb-1 tracking-wide">{{ weatherData.condition }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
      /  \\       
`;
  }
  
  if (code === 2 || code === 3) { // Cloudy
    return `
      .--.       
   .-(    ).     
  (___.__)__)    
                 
`;
  }
  
  if (code >= 51 && code <= 67 || code >= 80 && code <= 82) { // Rain
    return `
      .--.       
   .-(    ).     
  (___.__)__)    
   ‘  ‘  ‘  ‘    
`;
  }
  
  if (code >= 71 && code <= 86) { // Snow
    return `
      .--.       
   .-(    ).     
  (___.__)__)    
   *  *  *  *    
`;
  }
  
  if (code >= 95) { // Thunderstorm
    return `
      .--.       
   .-(    ).     
  (___.__)__)    
    ⚡  ⚡       
`;
  }
  
  // Default Fog / Other
  return `
   _-_ _ _-_     
    _-_ _ _-_    
   _-_ _ _-_     
                 
`;
});
</script>
