<template>
  <section class="draft-page -mt-3 mx-auto sm:mt-0 w-full max-w-6xl px-0 sm:px-3">
    <header class="mb-3 border-b border-terminal-amber-dim/50 pb-3 sm:mb-8 sm:pb-5">
      <p class="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-terminal-blue">
        // Fantasy football
      </p>
      <h1 class="text-2xl font-bold tracking-tight text-terminal-amber sm:text-4xl">Draft order</h1>
      <p class="mt-2 text-xs text-terminal-amber-dim sm:text-sm">Andrew’s Inflated Balls</p>
    </header>
    <Draft />
  </section>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (sessionStorage.getItem('draftUnlocked') !== '1') navigateTo('/')
})
</script>
