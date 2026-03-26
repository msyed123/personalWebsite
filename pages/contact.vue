<template>
  <div class="flex justify-center items-center min-h-[50vh] mt-4 px-2">
    <div class="w-full max-w-lg space-y-6">
      <div class="border-b border-terminal-amber-dim pb-4 mb-8">
        <h2 class="text-terminal-amber uppercase tracking-widest text-lg font-bold">// SYSTEM.COMM_LINKS</h2>
      </div>

      <div v-if="pending" class="text-terminal-amber-dim text-sm tracking-widest uppercase">
        > Establishing secure connection...
        <span class="animate-blink inline-block w-2 bg-terminal-amber h-4 ml-1"></span>
      </div>

      <div v-else-if="error" class="text-red-500 text-sm tracking-widest">
        > ERROR: Comms link severed.
      </div>

      <div v-else class="mt-4 space-y-4">
        <p class="text-terminal-amber-dim text-sm italic mb-6">> Select a communication channel:</p>
        
        <a v-for="contact in contacts" :key="contact.id" 
           :href="contact.data.link[0]?.text" 
           target="_blank"
           class="group flex items-center justify-between border border-terminal-amber-dim border-opacity-30 p-4 text-terminal-blue hover:border-terminal-blue hover:bg-black/40 transition-all">
          <span class="font-bold uppercase tracking-widest text-sm">
            > {{ contact.data.text[0]?.text || 'LINK' }}
          </span>
          <span class="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest text-terminal-amber">
            [ connect ]
          </span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePrismic } from '#imports'
const { client } = usePrismic()

const { data: contacts, pending, error } = await useAsyncData('contacts', () => {
    return client.getAllByType('contact', {
        orderings: {
            field: 'my.contact.priority',
            direction: 'asc'
        }
    })
})

useHead({
  title: 'Contact | Mamoon Syed',
})
</script>
