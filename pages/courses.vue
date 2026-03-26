<template>
  <div class="space-y-6 max-w-5xl mx-auto mt-4 px-2">
    <div class="border-b border-terminal-amber-dim pb-4 mb-8">
      <h2 class="text-terminal-amber uppercase tracking-widest text-lg font-bold">// SYSTEM.COURSES_ARCHIVE</h2>
    </div>

    <div v-if="pending" class="text-terminal-amber-dim text-sm tracking-widest uppercase">
      > Accessing educational records...
      <span class="animate-blink inline-block w-2 bg-terminal-amber h-4 ml-1"></span>
    </div>

    <div v-else-if="error" class="text-red-500 text-sm tracking-widest">
      > ERROR: Database connection lost.
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div v-for="course in courses" :key="course.id" class="border-l-2 border-terminal-amber-dim border-opacity-30 pl-6 py-2 hover:border-terminal-blue transition-colors group">
        <h3 class="text-lg md:text-xl text-terminal-blue font-bold tracking-wide mb-4 group-hover:text-amber-400 transition-colors">
          > {{ course.data.course_name[0]?.text || 'SYS_COURSE_UNKNOWN' }}
        </h3>
        
        <div class="space-y-3">
          <span class="text-terminal-amber text-xs tracking-widest uppercase opacity-70 border-b border-terminal-amber-dim border-opacity-30 pb-1">Topics Covered:</span>
          <ul class="space-y-1.5 text-terminal-amber-dim text-sm leading-relaxed">
            <li v-for="(topic, idx) in course.data.topics" :key="idx" class="relative pl-4 before:content-['>'] before:absolute before:left-0 before:text-terminal-amber-dim before:opacity-50">
              {{ topic.topic[0]?.text }}
            </li>
          </ul>
        </div>

        <div v-if="course.data.documents?.length > 0" class="mt-6 pt-4 border-t border-terminal-amber-dim border-opacity-20 border-dashed">
          <span class="text-terminal-blue text-xs tracking-widest uppercase block mb-3">Attachments:</span>
          <div class="flex flex-wrap gap-2">
            <a v-for="(doc, idx) in course.data.documents" :key="idx" 
               :href="doc.document_link.url" 
               target="_blank"
               class="px-2 py-1 text-xs font-mono tracking-wider bg-terminal-blue bg-opacity-10 text-terminal-blue hover:bg-terminal-blue hover:text-terminal-black transition-colors uppercase">
              {{ doc.document_name[0]?.text || 'FILE' }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePrismic } from '#imports'
const { client } = usePrismic()

const { data: courses, pending, error } = await useAsyncData('courses', () => {
    return client.getAllByType('course', {
        orderings: {
            field: 'my.course.priority',
            direction: 'asc'
        }
    })
})

useHead({
  title: 'Courses | Mamoon Syed',
})
</script>
