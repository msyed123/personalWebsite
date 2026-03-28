<template>
  <div class="max-w-4xl mx-auto mt-4 px-2 pb-10 space-y-6">

    <!-- Header -->
    <div class="border-b border-terminal-amber-dim pb-4">
      <h2 class="text-terminal-amber uppercase tracking-widest text-lg font-bold">// SYSTEM.DIARY</h2>
      <p class="text-terminal-amber-dim text-xs mt-1.5 tracking-widest opacity-70">
        &gt; Personal log: film reviews and written dispatches.
      </p>
    </div>

    <!-- Tab Bar -->
    <div class="flex border border-terminal-amber-dim/50 w-fit">
      <button
        @click="activeTab = 'letterboxd'"
        :class="[
          'px-5 py-2.5 text-xs tracking-[0.15em] uppercase font-bold font-mono transition-colors',
          activeTab === 'letterboxd'
            ? 'bg-terminal-amber text-terminal-black'
            : 'text-terminal-amber-dim hover:text-terminal-amber'
        ]"
      >
        [ LETTERBOXD ]
      </button>
      <button
        @click="activeTab = 'substack'"
        :class="[
          'px-5 py-2.5 text-xs tracking-[0.15em] uppercase font-bold font-mono transition-colors border-l border-terminal-amber-dim/50',
          activeTab === 'substack'
            ? 'bg-terminal-amber text-terminal-black'
            : 'text-terminal-amber-dim hover:text-terminal-amber'
        ]"
      >
        [ SUBSTACK ]
      </button>
    </div>

    <!-- ── Letterboxd Tab ── -->
    <div v-show="activeTab === 'letterboxd'">
      <div v-if="lbPending" class="text-terminal-amber-dim text-sm tracking-widest animate-pulse py-6">
        &gt; Fetching screenings archive...
        <span class="inline-block w-2 bg-terminal-amber h-4 ml-1 animate-blink"></span>
      </div>
      <div v-else-if="lbError" class="text-red-500 text-sm tracking-widest py-4">
        &gt; ERROR: Failed to load Letterboxd feed.
      </div>
      <div v-else-if="!lbFeed.length" class="text-terminal-amber-dim text-sm opacity-50 py-6">
        &gt; No reviews found.
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="(item, idx) in lbFeed"
          :key="idx"
          :id="`lb-${idx}`"
          @click="openModal(item, 'letterboxd')"
          class="text-left border border-terminal-amber-dim/40 hover:border-terminal-amber bg-black/20 hover:bg-black/40 transition-all duration-300 group flex flex-col cursor-pointer"
        >
          <!-- Poster -->
          <div class="h-44 overflow-hidden bg-black/50">
            <img
              v-if="item.imageUrl"
              :src="item.imageUrl"
              :alt="item.title"
              class="w-full h-full object-cover filter grayscale opacity-75 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="text-terminal-amber-dim text-xs tracking-widest opacity-40">[ NO POSTER ]</span>
            </div>
          </div>
          <!-- Info -->
          <div class="p-3 flex-1 flex flex-col gap-1.5">
            <p class="text-terminal-amber font-bold text-sm tracking-wide group-hover:text-terminal-blue transition-colors leading-snug line-clamp-2">
              {{ item.title }}
            </p>
            <p class="text-terminal-amber-dim text-xs">
              {{ starsDisplay(item.rating) }}
              <span v-if="item.filmYear"> · {{ item.filmYear }}</span>
            </p>
            <p class="text-terminal-amber-dim/50 text-xs">{{ formatDate(item.watchedDate || item.pubDate) }}</p>
            <p v-if="item.reviewText" class="text-terminal-amber-dim text-xs opacity-60 line-clamp-2 mt-0.5">
              {{ item.reviewText }}
            </p>
            <span class="text-terminal-blue text-xs mt-auto pt-2 opacity-50 group-hover:opacity-100 transition-opacity tracking-widest">
              &gt; READ &#8599;
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Substack Tab ── -->
    <div v-show="activeTab === 'substack'">
      <div v-if="ssPending" class="text-terminal-amber-dim text-sm tracking-widest animate-pulse py-6">
        &gt; Fetching dispatch archive...
        <span class="inline-block w-2 bg-terminal-amber h-4 ml-1 animate-blink"></span>
      </div>
      <div v-else-if="ssError" class="text-red-500 text-sm tracking-widest py-4">
        &gt; ERROR: Failed to load Substack feed.
      </div>
      <div v-else-if="!ssFeed.length" class="text-terminal-amber-dim text-sm opacity-50 py-6">
        &gt; No posts found.
      </div>
      <div v-else class="space-y-3">
        <button
          v-for="(item, idx) in ssFeed"
          :key="idx"
          :id="`ss-${idx}`"
          @click="openModal(item, 'substack')"
          class="w-full text-left border border-terminal-amber-dim/40 hover:border-terminal-amber bg-black/20 hover:bg-black/40 transition-all duration-300 group p-4 flex flex-col gap-1.5 cursor-pointer"
        >
          <p class="text-terminal-amber font-bold text-sm md:text-base tracking-wide group-hover:text-terminal-blue transition-colors">
            {{ item.title }}
          </p>
          <p class="text-terminal-amber-dim text-xs tracking-widest opacity-60">{{ formatDate(item.pubDate) }}</p>
          <p v-if="item.excerpt" class="text-terminal-amber-dim text-xs opacity-50 line-clamp-2 mt-0.5">
            {{ item.excerpt }}
          </p>
          <span class="text-terminal-blue text-xs mt-1 opacity-50 group-hover:opacity-100 transition-opacity tracking-widest">
            &gt; READ POST &#8599;
          </span>
        </button>
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
import { ref, computed, watch } from 'vue'
import { useRoute } from '#imports'

const route = useRoute()

useHead({
  title: 'Diary | Mamoon Syed',
  meta: [{ name: 'description', content: 'Film reviews and written dispatches by Mamoon Syed.' }]
})

// Tab state driven by ?tab= query param
const activeTab = ref(route.query.tab === 'substack' ? 'substack' : 'letterboxd')
watch(() => route.query.tab, (t) => {
  if (t === 'substack' || t === 'letterboxd') activeTab.value = t
})

// Feeds — lazy so SSR doesn't block on slow external RSS
const { data: lbData, pending: lbPending, error: lbError } = useAsyncData('lb-feed-diary', () =>
  $fetch('/api/feed?type=letterboxd'), { lazy: true }
)
const lbFeed = computed(() => Array.isArray(lbData.value) ? lbData.value : [])

const { data: ssData, pending: ssPending, error: ssError } = useAsyncData('ss-feed-diary', () =>
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
