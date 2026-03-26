<template>
  <div class="space-y-8 animate-pulse-slow">
    <div class="border border-terminal-amber-dim border-opacity-50 p-6 relative bg-terminal-black">
      <div class="absolute -top-3 left-6 bg-terminal-black px-3 text-terminal-blue text-sm tracking-widest uppercase">
        // SYSTEM.ABOUT_ME
      </div>
      
      <div class="mt-4 flex flex-col md:flex-row gap-8 items-start">
        <div class="md:w-1/3">
          <div class="border border-terminal-amber-dim p-2 inline-block">
            <!-- Using a standard terminal ascii fallback since image loading in a real terminal might fail :) -->
            <pre class="text-xs text-terminal-amber font-mono leading-none">
     ////^\\\\
     | ^   ^ |
    @ (o) (o) @
     |   <   |
     |  ___  |
      \_____/
            </pre>
          </div>
        </div>
        
        <div class="md:w-2/3 space-y-4 text-justify">
          <p>> EXEC: WHOAMI</p>
          <p>
            I am a native born Floridian with the goal of trying to figure out how to make things go up.
            Growing up on the Space Coast has greatly shaped who I am today. I was always lucky to be within
            a stones throw of some of the cutting-edge work in the field, and I quickly knew that aerospace
            was for me. Currently, I am a senior at Florida Tech in Aerospace Engineering.
          </p>
          <p>
            I do my best to keep myself busy with projects I find interesting, ranging from leading my
            school's inaugural Hyperloop team, to designing a solid-state sensor that can directly quantify
            the amount of liquid water in lunar regolith. Currently, I am a member of the Florida Tech Dynamic
            Systems and Controls Lab where my research involves developing and characterizing a visual-inertial
            navigation control suite for eventual deployment on Astrobee, a free-flying robot on the ISS.
          </p>
          <p>
            I have always considered myself to be very fortunate. Because of this, I believe it is incumbent
            upon me to try to give back to those around me in any way that I can. I volunteer at schools
            around my district, mentoring a science research program at the middle school I graduated from,
            and volunteering at a drone program at my high school.
          </p>
        </div>
      </div>
    </div>

    <div class="border border-terminal-amber-dim border-opacity-50 p-6 relative bg-terminal-black">
      <div class="absolute -top-3 left-6 bg-terminal-black px-3 text-terminal-blue text-sm tracking-widest uppercase">
        // SYSTEM.INTERESTS
      </div>
      
      <div class="mt-4">
        <div v-if="pending" class="text-terminal-amber-dim animate-pulse">
          > Fetching interests data from Prismic mainframe...
        </div>
        <div v-else-if="error" class="text-red-500 glow">
          > ERROR: Could not retrieve interests data. Connection terminated.
        </div>
        <ul v-else class="list-disc list-inside space-y-2 text-terminal-amber">
          <li v-for="interest in interests" :key="interest.id" class="ml-4">
            {{ interest.data.name[0]?.text || 'UNKNOWN_DATA' }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePrismic } from '#imports'
const { client } = usePrismic()

useHead({
  title: 'About | Mamoon Syed',
})

const { data: interests, pending, error } = await useAsyncData('interests', () => {
    return client.getAllByType('interest', {
        orderings: {
            field: 'my.interest.priority',
            direction: 'asc'
        }
    })
})
</script>

<style scoped>
.animate-pulse-slow {
  animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.9; }
}
</style>
