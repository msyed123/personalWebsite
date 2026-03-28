<template>
  <div class="space-y-5 mt-4 pb-10">

    <!-- ═══ COMPACT STATUS BAR ═══ -->
    <div class="border border-terminal-amber-dim px-4 py-3 bg-black/20 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono">
      <span class="text-terminal-blue font-bold tracking-widest uppercase">MAMOON_SYED_TERMINAL_V2</span>
      <span class="text-terminal-amber-dim opacity-40">|</span>
      <span class="text-terminal-amber-dim uppercase tracking-wide opacity-70">SYS_INIT · Kernel: Aerospace_Root</span>
      <span class="text-terminal-amber-dim opacity-40">|</span>
      <span class="flex items-center gap-2">
        <span class="text-terminal-amber-dim">[*] PRISMIC_CDN</span>
        <span v-if="repoPending" class="text-terminal-amber animate-pulse font-bold">[WAIT]</span>
        <span v-else-if="repoError" class="text-red-500 font-bold">[FAIL]</span>
        <span v-else class="text-green-500 font-bold">[OK]</span>
      </span>
      <span v-if="repoInfo" class="text-terminal-amber-dim opacity-60">
        REF: {{ repoInfo.refs?.[0]?.ref?.substring(0, 12) }}...
      </span>
      <span v-if="repoInfo" class="text-terminal-amber-dim opacity-60">
        TYPES: {{ Object.keys(repoInfo.types || {}).length }}
      </span>
      <span class="text-terminal-amber-dim opacity-40">|</span>
      <span class="text-green-500 opacity-80 italic tracking-wide">&gt; System ready.</span>
      <span class="text-terminal-amber-dim text-xs opacity-50 ml-auto hidden sm:inline">&gt; Use 'help' for commands</span>
    </div>

    <!-- ═══ PROJECTS PANEL ═══ -->
    <div class="border border-terminal-amber-dim bg-black/10">
      <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-terminal-amber-dim/30">
        <h2 class="text-terminal-blue text-xs tracking-[0.2em] uppercase font-bold">// PROJECTS_ARCHIVE</h2>
        <NuxtLink
          to="/projects"
          class="text-terminal-amber-dim text-xs tracking-widest uppercase hover:text-terminal-amber transition-colors"
        >
          See all //
        </NuxtLink>
      </div>

      <div class="p-4">
        <div v-if="projectsPending" class="text-terminal-amber-dim text-xs tracking-widest animate-pulse py-6 text-center">
          &gt; Querying project databases...
          <span class="inline-block w-1.5 h-3 bg-terminal-amber ml-1 animate-blink"></span>
        </div>
        <div v-else-if="projectsError" class="text-red-500 text-xs py-6 text-center">
          &gt; ERROR: Failed to load project data.
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NuxtLink
            v-for="project in topProjects"
            :key="project.id"
            :to="`/projects#${project.uid || project.id}`"
            class="group border border-terminal-amber-dim/30 hover:border-terminal-amber transition-all duration-300 flex flex-col bg-black/20 hover:bg-black/40 cursor-pointer"
          >
            <!-- Image -->
            <div class="overflow-hidden bg-black/50" style="aspect-ratio: 16/9;">
              <img
                v-if="project.data.project_image?.url"
                :src="project.data.project_image.url"
                :alt="project.data.project_title[0]?.text || 'Project'"
                class="w-full h-full object-cover filter grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <span class="text-terminal-amber-dim text-xs tracking-widest opacity-50">[ NO IMAGE ]</span>
              </div>
            </div>
            <!-- Info -->
            <div class="p-3 flex-1 flex flex-col justify-between gap-2">
              <p class="text-terminal-amber text-xs md:text-sm font-bold tracking-wide group-hover:text-terminal-blue transition-colors leading-snug">
                {{ project.data.project_title[0]?.text || 'UNTITLED' }}
              </p>
              <span class="text-terminal-amber-dim text-xs opacity-50 tracking-widest group-hover:opacity-90 transition-opacity">&gt; VIEW &#8599;</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- ═══ DIARY WIDGETS ═══ -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

      <!-- Letterboxd Widget -->
      <div class="border border-terminal-amber-dim/60 bg-black/10">
        <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-terminal-amber-dim/30">
          <h2 class="text-terminal-blue text-xs tracking-[0.2em] uppercase font-bold">// LETTERBOXD_FEED</h2>
          <NuxtLink
            to="/diary?tab=letterboxd"
            class="text-terminal-amber-dim text-xs tracking-widest uppercase hover:text-terminal-amber transition-colors"
          >
            See more //
          </NuxtLink>
        </div>
        <div class="p-3">
          <div v-if="lbPending" class="text-terminal-amber-dim text-xs animate-pulse py-4 text-center">
            &gt; Fetching latest screenings...
          </div>
          <div v-else-if="!lbFeed.length" class="text-terminal-amber-dim text-xs py-4 opacity-50 text-center">
            &gt; No data available.
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="(item, idx) in lbFeed.slice(0, 3)"
              :key="idx"
              @click="openModal(item, 'letterboxd')"
              class="w-full text-left flex items-center gap-3 p-2 hover:bg-terminal-amber-dim/10 transition-colors group border border-transparent hover:border-terminal-amber-dim/20 cursor-pointer"
            >
              <div class="w-8 h-12 shrink-0 overflow-hidden border border-terminal-amber-dim/30">
                <img
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  :alt="item.title"
                  class="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-300"
                />
                <div v-else class="w-full h-full bg-black/40 flex items-center justify-center">
                  <span class="text-[7px] text-terminal-amber-dim">IMG</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-terminal-amber text-xs font-bold truncate group-hover:text-terminal-blue transition-colors">
                  {{ item.title }}
                </p>
                <p class="text-terminal-amber-dim text-xs opacity-60 mt-0.5">
                  {{ starsDisplay(item.rating) }} · {{ formatDate(item.watchedDate || item.pubDate) }}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Substack Widget -->
      <div class="border border-terminal-amber-dim/60 bg-black/10">
        <div class="flex items-center justify-between px-4 pt-4 pb-3 border-b border-terminal-amber-dim/30">
          <h2 class="text-terminal-blue text-xs tracking-[0.2em] uppercase font-bold">// SUBSTACK_FEED</h2>
          <NuxtLink
            to="/diary?tab=substack"
            class="text-terminal-amber-dim text-xs tracking-widest uppercase hover:text-terminal-amber transition-colors"
          >
            See more //
          </NuxtLink>
        </div>
        <div class="p-3">
          <div v-if="ssPending" class="text-terminal-amber-dim text-xs animate-pulse py-4 text-center">
            &gt; Fetching latest dispatches...
          </div>
          <div v-else-if="!ssFeed.length" class="text-terminal-amber-dim text-xs py-4 opacity-50 text-center">
            &gt; No data available.
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="(item, idx) in ssFeed.slice(0, 3)"
              :key="idx"
              @click="openModal(item, 'substack')"
              class="w-full text-left p-2 hover:bg-terminal-amber-dim/10 transition-colors group border border-transparent hover:border-terminal-amber-dim/20 cursor-pointer"
            >
              <p class="text-terminal-amber text-xs font-bold truncate group-hover:text-terminal-blue transition-colors">
                {{ item.title }}
              </p>
              <p class="text-terminal-amber-dim text-xs opacity-60 mt-0.5">{{ formatDate(item.pubDate) }}</p>
              <p v-if="item.excerpt" class="text-terminal-amber-dim text-xs opacity-40 mt-1 truncate">
                {{ item.excerpt }}
              </p>
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Modal -->
  <DiaryModal
    :show="modalVisible"
    :item="modalItem"
    :type="modalType"
    @close="modalVisible = false"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePrismic, useAsyncData } from '#imports'

const { client } = usePrismic()

useHead({
  title: 'Terminal | Mamoon Syed',
  meta: [{ name: 'description', content: 'Personal Terminal of Mamoon Syed, Aerospace Engineer.' }]
})

// Prismic repo ping
const { data: repoInfo, pending: repoPending, error: repoError } = await useAsyncData('repoPing', () =>
  client.getRepository()
)

// Projects — top 3
const { data: allProjects, pending: projectsPending, error: projectsError } = await useAsyncData('projects-home', () =>
  client.getAllByType('project', { orderings: { field: 'my.project.priority', direction: 'asc' } })
)
const topProjects = computed(() => (allProjects.value || []).slice(0, 3))

// Letterboxd feed — lazy (client-side) to avoid blocking SSR on slow external RSS
const { data: lbData, pending: lbPending } = useAsyncData('lb-feed', () =>
  $fetch('/api/feed?type=letterboxd'), { lazy: true }
)
const lbFeed = computed(() => Array.isArray(lbData.value) ? lbData.value : [])

// Substack feed — lazy (client-side) to avoid blocking SSR on slow external RSS
const { data: ssData, pending: ssPending } = useAsyncData('ss-feed', () =>
  $fetch('/api/feed?type=substack'), { lazy: true }
)
const ssFeed = computed(() => Array.isArray(ssData.value) ? ssData.value : [])

// Modal
const modalVisible = ref(false)
const modalItem = ref(null)
const modalType = ref('letterboxd')

function openModal (item, type) {
  modalItem.value = item
  modalType.value = type
  modalVisible.value = true
}

function starsDisplay (rating) {
  if (!rating && rating !== 0) return '—'
  const full = Math.floor(rating)
  const half = (rating % 1) >= 0.25
  return '★'.repeat(full) + (half ? '½' : '')
}

function formatDate (dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}
</script>
