<template>
  <div class="flex flex-col min-h-[60vh] justify-center max-w-2xl mx-auto px-4 mt-8 w-full">
    <div class="border border-terminal-amber-dim p-6 shadow-sm bg-black/20 w-full">
      <div class="mb-6 border-b border-terminal-amber-dim pb-2 space-y-1">
        <p class="text-terminal-amber-dim uppercase text-xs tracking-widest">// SYS_INIT</p>
        <p class="text-terminal-blue font-bold tracking-widest text-lg">MAMOON_SYED_TERMINAL_V2</p>
        <p class="text-terminal-amber-dim text-sm opacity-80 uppercase tracking-wide">Kernel loaded: Aerospace_Root</p>
      </div>

      <div class="space-y-4 font-mono text-sm md:text-base">
        <!-- Pinging Mainframe -->
        <div class="flex items-start flex-col gap-1 border border-terminal-amber-dim border-opacity-30 p-4">
          <div class="flex items-center gap-2 w-full">
            <span class="text-terminal-blue font-bold">[*]</span>
            <span class="text-terminal-amber opacity-90 tracking-wide uppercase text-xs md:text-sm">Pinging Primary Databank (Prismic CDN)...</span>
            <span v-if="pending" class="text-terminal-amber animate-pulse font-bold ml-auto">[WAIT]</span>
            <span v-else-if="error" class="text-red-500 font-bold ml-auto">[FAIL]</span>
            <span v-else class="text-green-500 font-bold ml-auto">[OK]</span>
          </div>
          
          <div v-if="!pending && repoInfo" class="mt-2 text-xs text-terminal-amber-dim opacity-80 pl-6 border-l border-terminal-amber-dim border-opacity-30">
            <p>> MASTER_REF: {{ repoInfo.refs[0]?.ref.substring(0, 16) }}...</p>
            <p>> API_VERSION: {{ repoInfo.version }}</p>
            <p>> TYPES_LOADED: {{ Object.keys(repoInfo.types).length }} tables found</p>
            <p class="text-terminal-blue mt-1 font-bold">> AUTHENTICATION ALIVE</p>
          </div>
        </div>

        <!-- Mounting UI -->
        <div class="flex items-center gap-2 border border-terminal-amber-dim border-opacity-30 p-4">
          <span class="text-terminal-blue font-bold">[*]</span>
          <span class="text-terminal-amber opacity-90 tracking-wide uppercase text-xs md:text-sm">Mounting Graphical Interface...</span>
          <span class="text-green-500 font-bold ml-auto">[OK]</span>
        </div>
      </div>

      <div class="mt-8 pt-4 border-t border-terminal-amber-dim border-opacity-30">
        <p class="text-terminal-amber-dim italic tracking-widest">> System ready.</p>
        <p class="text-terminal-amber mt-2 uppercase tracking-wide text-xs">> Please use the command line below (e.g. 'cd projects') or the navigation links above.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePrismic, useAsyncData } from '#imports'

const { client } = usePrismic()

useHead({
  title: 'Terminal | Mamoon Syed',
  meta: [
    { name: 'description', content: 'Personal Terminal of Mamoon Syed, Aerospace Engineer.' }
  ]
})

const { data: repoInfo, pending, error } = await useAsyncData('repoPing', () => {
    return client.getRepository()
})
</script>
