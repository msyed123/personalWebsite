<template>
  <div class="min-h-screen bg-terminal-black text-terminal-amber p-8 font-mono">
    <div class="scanlines"></div>
    <div class="border border-red-500 border-opacity-50 p-6 shadow-sm bg-black/40 w-full max-w-4xl mx-auto mt-12">
      <div class="mb-6 border-b border-red-500 pb-2 space-y-1">
        <p class="text-red-500 font-bold tracking-widest text-xl uppercase">// CRITICAL_SYSTEM_FAILURE</p>
        <p class="text-red-400 text-sm opacity-80 uppercase tracking-wide">STATUS_CODE: {{ error?.statusCode }}</p>
      </div>

      <div class="space-y-4 font-mono text-sm">
        <div class="flex flex-col gap-2 p-4 bg-red-900/10 border-l-[4px] border-red-500">
          <p class="text-red-200 uppercase font-bold text-xs tracking-wider">Exception Trace:</p>
          <p class="text-white">{{ error?.message }}</p>
          <pre v-if="error?.stack" class="text-xs text-red-300 opacity-70 mt-4 whitespace-pre-wrap overflow-x-auto">{{ error.stack }}</pre>
        </div>
      </div>

      <div class="mt-8 pt-4 border-t border-red-500 border-opacity-30 flex justify-between items-center">
        <p class="text-red-400 italic tracking-widest text-xs">> Terminal halted.</p>
        <button @click="handleError" class="px-4 py-2 bg-red-900/40 text-red-500 border border-red-500 hover:bg-red-500 hover:text-terminal-black transition-colors text-xs font-bold uppercase tracking-widest">
          [ REBOOT_SYSTEM ]
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  error: Object
})

const handleError = () => clearError({ redirect: '/' })
</script>
