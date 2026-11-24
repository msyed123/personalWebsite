<template>
  <div v-if="status === 'pending' || status === 'idle'" role="status" class="py-5 text-sm text-terminal-amber-dim">
    &gt; Loading headlines…
  </div>
  <div v-else-if="error || !current?.items.length" role="status" class="py-5 text-sm text-terminal-amber-dim">
    No headlines are available right now.
    <button type="button" class="min-h-11 px-2 text-terminal-amber underline" @click="refresh()">Try again</button>
  </div>
  <template v-else>
    <p v-if="degradedSources.length" role="status" class="mb-3 text-xs text-terminal-amber-dim">
      {{ degradedSources.join(' · ') }}
    </p>
    <ol class="news-articles">
      <li v-for="item in current.items" :key="item.url" class="min-w-0">
        <button type="button" class="news-story-button text-terminal-amber border border-terminal-amber-dim/40"
          @click="$emit('preview', item, $event.currentTarget)">
          <NewsArtwork :image="item.image" :topic="topic" :source="item.source" show-credit />
          <span class="news-article-copy">
            <span class="font-bold leading-snug break-words">{{ item.title }}</span>
            <span class="flex flex-wrap items-baseline gap-x-2 text-xs text-terminal-amber-dim">
              <span>{{ item.source }}<template v-if="item.byline"> · {{ item.byline }}</template></span>
              <span aria-hidden="true">/</span>
              <time :datetime="item.publishedAt">{{ headlineTime.format(new Date(item.publishedAt)) }} UTC</time>
            </span>
          </span>
        </button>
      </li>
    </ol>
  </template>
</template>

<script setup>
const props = defineProps({ topic: { type: String, required: true }, overlay: Boolean })
defineEmits(['preview'])
const headlineTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})
const { data, status, error, refresh } = useLazyAsyncData(
  'news:' + (props.overlay ? 'overlay:' : 'page:') + props.topic,
  (_app, { signal }) => $fetch('/api/news', { query: { topic: props.topic }, signal })
)
const current = computed(() => data.value?.topic === props.topic ? data.value : null)
const degradedSources = computed(() => (current.value?.sources ?? []).flatMap(source =>
  source.state === 'fresh' ? [] :
    [source.name + (source.state === 'stale' ? ': showing last available headlines' : ': temporarily unavailable')]
))
</script>

<style scoped>
.news-articles { display: grid; gap: .65rem; grid-template-columns: 1fr; }
.news-story-button { text-align: start; display: grid; width: 100%; height: 100%; min-width: 0; grid-template-columns: minmax(0, 35%) minmax(0, 1fr); gap: .65rem; padding: .45rem; align-items: center; }
.news-story-button:hover { background: rgb(255 176 0 / 8%); }
.news-story-button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.news-article-copy { display: grid; min-width: 0; gap: .35rem; }
@media (min-width: 640px) {
  .news-articles { grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); }
  .news-story-button { grid-template-columns: minmax(0, 1fr); align-content: start; padding: .55rem; }
}
</style>
