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
      </nav>
    </header>

    <!-- Main Content -->
    <main :class="['flex-grow w-full mx-auto p-4 lg:p-0', route.path === '/draft' ? 'max-w-[2000px] px-8' : 'max-w-5xl']">
      <slot />
    </main>
    
    <footer class="sticky bottom-0 z-50 bg-terminal-black/95 backdrop-blur-md border-t border-terminal-amber-dim p-4 w-full flex flex-col gap-2 text-sm md:text-base opacity-95">
      <!-- Output window rendered directly in the CLI -->
      <div v-if="cmdOutput" class="text-terminal-amber-dim whitespace-pre-line w-full pb-2 mb-2 border-b border-terminal-amber-dim/20 flex justify-between items-start">
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

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const cmdInput = ref('')
const cmdOutput = ref('')
const router = useRouter()
const route = useRoute()

const availableDirs = ['about', 'projects', 'courses', 'contact', 'home']
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
      router.push('/draft').then(() => window.scrollTo(0, 0))
    } else {
      cmdOutput.value = `[AUTHENTICATION FAILED]\nIncorrect password. Access denied.`
      cmdState.value = 'normal'
    }
    return
  }

  if (!input) return

  if (input === 'help') {
    cmdOutput.value = `Available commands:\n- cd <dir>   : Navigate to directory\n- ls         : List directories\n- clear      : Clear output\n- date       : Show current date`
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
      router.push('/').then(() => window.scrollTo(0, 0))
      cmdOutput.value = `Navigated to root`
      return
    }
    
    if (dir === 'home' || dir === '/') {
      router.push('/').then(() => window.scrollTo(0, 0))
      cmdOutput.value = `Navigated to ${dir}`
      return
    }

    if (dir === 'draft') {
      cmdState.value = 'draft_password'
      cmdOutput.value = `[SECURE DIRECTORY DETECTED]\nEnter password to access /draft:`
      return
    }

    if (availableDirs.includes(dir)) {
      router.push(`/${dir}`).then(() => window.scrollTo(0, 0))
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
