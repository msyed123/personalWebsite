<template>
  <div class="space-y-6 max-w-4xl mx-auto mt-4 px-2">
    <div class="border-b border-terminal-amber-dim pb-4 mb-8">
      <h2 class="text-terminal-amber uppercase tracking-widest text-lg font-bold">// SYSTEM.PROJECTS_ARCHIVE</h2>
    </div>

    <div v-if="pending" class="text-terminal-amber-dim text-sm tracking-widest uppercase">
      > Querying project databases...
      <span class="animate-blink inline-block w-2 bg-terminal-amber h-4 ml-1"></span>
    </div>
    
    <div v-else-if="error" class="text-red-500 text-sm tracking-widest">
      > ERROR: Failed to load project data. Sector corrupted.
    </div>
    
    <div v-else class="space-y-16">
      <div v-for="project in projects" :key="project.id" class="relative group">
        
        <div class="flex items-center justify-between mb-4 border-b border-terminal-amber-dim border-opacity-30 pb-2">
          <h3 class="text-xl md:text-2xl text-terminal-blue font-bold tracking-wide group-hover:text-amber-400 transition-colors">
            {{ project.data.project_title[0]?.text || 'UNTITLED' }}
          </h3>
          <span class="text-terminal-amber-dim text-xs md:text-sm tracking-widest font-mono hidden sm:inline-block">
            {{ project.data.project_dates[0]?.text || 'N/A' }}
          </span>
        </div>
        
        <div class="flex flex-col md:flex-row gap-8">
          <div class="md:w-1/3" v-if="project.data.project_image?.url">
            <div class="border border-terminal-amber-dim border-opacity-40 p-1 bg-black/50">
              <img :src="project.data.project_image.url" class="filter grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-500 w-full object-cover" alt="Project Image" />
            </div>
          </div>
          
          <div class="md:w-2/3 space-y-5">
            <p class="text-terminal-amber text-sm font-semibold tracking-wide uppercase">
              > Role: {{ project.data.project_role[0]?.text || 'N/A' }}
            </p>
            
            <ul class="space-y-3 text-terminal-amber-dim text-sm md:text-base leading-relaxed text-justify">
              <li v-for="(desc, idx) in project.data.project_details" :key="idx" class="relative pl-4 before:content-['>'] before:absolute before:left-0 before:text-terminal-amber-dim before:opacity-50">
                {{ desc.text }}
              </li>
            </ul>
            
            <div v-if="project.data.docs?.length > 0" class="mt-6 pt-4 border-t border-terminal-amber-dim border-opacity-30">
              <span class="text-terminal-blue text-xs tracking-widest uppercase block mb-3">Attached Documents:</span>
              <div class="flex flex-wrap gap-3">
                <a v-for="(doc, idx) in project.data.docs" :key="idx" 
                   :href="doc.doc?.url" 
                   target="_blank"
                   class="px-3 py-1.5 text-xs font-mono tracking-wider border border-terminal-blue text-terminal-blue hover:bg-terminal-blue hover:text-terminal-black transition-colors uppercase">
                  {{ doc.doc_name[0]?.text || 'DOCUMENT' }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePrismic } from '#imports'
const { client } = usePrismic()

useHead({
  title: 'Projects | Mamoon Syed',
})

const { data: projects, pending, error } = await useAsyncData('projects', () => {
    return client.getAllByType('project', {
        orderings: {
            field: 'my.project.priority',
            direction: 'asc'
        }
    })
})
</script>
