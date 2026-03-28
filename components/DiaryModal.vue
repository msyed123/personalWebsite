<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="$emit('close')"></div>

        <!-- Panel -->
        <div class="relative z-10 w-full max-w-2xl max-h-[88vh] flex flex-col border border-terminal-amber bg-terminal-black shadow-[0_0_40px_rgba(255,176,0,0.15)]">
          <!-- Scanline effect strip -->
          <div class="absolute top-0 left-0 right-0 h-px bg-terminal-amber opacity-60"></div>

          <!-- Header -->
          <div class="border-b border-terminal-amber-dim px-5 py-4 flex items-start justify-between gap-4 shrink-0">
            <div class="space-y-0.5 min-w-0">
              <p class="text-terminal-blue text-xs tracking-[0.2em] uppercase font-mono">
                {{ type === 'letterboxd' ? '// LETTERBOXD.REVIEW' : '// SUBSTACK.POST' }}
              </p>
              <h3 class="text-terminal-amber font-bold text-base md:text-lg tracking-wide leading-snug">
                {{ item?.title }}
              </h3>
              <p v-if="type === 'letterboxd' && item?.filmYear" class="text-terminal-amber-dim text-xs opacity-70">
                {{ item.filmYear }}
              </p>
            </div>
            <button
              @click="$emit('close')"
              class="text-terminal-amber-dim hover:text-red-500 transition-colors font-mono text-sm shrink-0 mt-0.5 border border-transparent hover:border-red-500/30 px-1"
            >
              [X]
            </button>
          </div>

          <!-- Body -->
          <div class="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            <!-- Letterboxd -->
            <template v-if="type === 'letterboxd'">
              <div class="flex gap-5">
                <div v-if="item?.imageUrl" class="w-28 md:w-36 shrink-0">
                  <div class="border border-terminal-amber-dim/50 p-0.5">
                    <img :src="item.imageUrl" :alt="item.title" class="w-full object-cover" />
                  </div>
                </div>
                <div class="space-y-2 min-w-0">
                  <p class="text-terminal-amber text-2xl tracking-wider">{{ starsDisplay(item?.rating) }}</p>
                  <p class="text-terminal-amber-dim text-xs tracking-widest uppercase">
                    &gt; Watched: {{ formatDate(item?.watchedDate || item?.pubDate) }}
                  </p>
                  <div v-if="item?.reviewText" class="pt-1">
                    <p class="text-terminal-amber-dim text-xs tracking-widest uppercase mb-1">// REVIEW</p>
                    <p class="text-terminal-amber text-sm leading-relaxed">{{ item.reviewText }}</p>
                  </div>
                  <p v-else class="text-terminal-amber-dim text-sm italic opacity-60">&gt; No written review.</p>
                </div>
              </div>
            </template>

            <!-- Substack -->
            <template v-if="type === 'substack'">
              <p class="text-terminal-amber-dim text-xs tracking-widest uppercase">
                &gt; Published: {{ formatDate(item?.pubDate) }}
              </p>
              <div class="border-t border-terminal-amber-dim/20 pt-3">
                <div
                  v-if="item?.content"
                  class="substack-content text-terminal-amber-dim text-sm leading-relaxed"
                  v-html="item.content"
                ></div>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="border-t border-terminal-amber-dim/50 px-5 py-3 shrink-0 flex items-center justify-between">
            <span class="text-terminal-amber-dim text-xs opacity-50 tracking-widest">
              {{ type === 'letterboxd' ? '// LETTERBOXD.ARCHIVE' : '// SUBSTACK.PUBLICATION' }}
            </span>
            <a
              :href="item?.link"
              target="_blank"
              rel="noopener noreferrer"
              class="text-terminal-blue text-xs tracking-widest uppercase hover:text-terminal-amber transition-colors font-mono"
            >
              View on {{ type === 'letterboxd' ? 'Letterboxd' : 'Substack' }} &#8599;
            </a>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  show: Boolean,
  item: Object,
  type: String
})
defineEmits(['close'])

function starsDisplay (rating) {
  if (!rating && rating !== 0) return '—'
  const full = Math.floor(rating)
  const half = (rating % 1) >= 0.25
  return '★'.repeat(full) + (half ? '½' : '')
}

function formatDate (dateStr) {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Substack rendered HTML styles */
:deep(.substack-content) p {
  margin-bottom: 0.875rem;
}
:deep(.substack-content) h1,
:deep(.substack-content) h2,
:deep(.substack-content) h3,
:deep(.substack-content) h4 {
  color: #ffb000;
  font-weight: bold;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}
:deep(.substack-content) a {
  color: #00d2ff;
  text-decoration: underline;
}
:deep(.substack-content) img {
  max-width: 100%;
  border: 1px solid #b37700;
  padding: 2px;
  margin: 0.5rem 0;
}
:deep(.substack-content) blockquote {
  border-left: 2px solid #b37700;
  padding-left: 1rem;
  color: #b37700;
  font-style: italic;
  margin: 0.75rem 0;
}
:deep(.substack-content) ul,
:deep(.substack-content) ol {
  padding-left: 1.5rem;
  margin-bottom: 0.875rem;
}
:deep(.substack-content) li {
  margin-bottom: 0.25rem;
}
</style>
