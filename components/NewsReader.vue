<template>
  <section class="news-reader min-w-0 font-mono text-terminal-amber" :class="{ 'news-reader-overlay': overlay }"
    :aria-labelledby="story ? storyTitleId : titleId" @keydown.esc="onEscape">
    <div v-show="!story" ref="feed" class="news-feed" :inert="Boolean(story)">
      <header class="news-header border-b border-terminal-amber-dim/40 pb-4">
        <div class="min-w-0">
          <p class="text-xs uppercase text-terminal-amber-dim tracking-widest">// News feed</p>
          <h2 :id="titleId" class="mt-1 text-2xl sm:text-3xl font-bold text-terminal-amber">
            {{ activeTopic.label }}
          </h2>
          <p class="mt-1 text-sm text-terminal-amber-dim">{{ descriptions[topic] }}</p>
        </div>
        <button v-if="overlay" ref="closeButton" type="button" aria-label="Close news" @click="$emit('close')" class="news-control shrink-0">[x]</button>
      </header>

      <nav class="my-4 flex flex-wrap gap-2" aria-label="News topics">
        <template v-if="overlay">
          <button v-for="entry in newsTopics" :key="entry.id" type="button" :aria-pressed="topic === entry.id"
            class="news-control" :class="{ 'news-control-active': topic === entry.id }"
            @click="$emit('topic', entry.id)">{{ entry.label }}</button>
        </template>
        <template v-else>
          <NuxtLink v-for="entry in newsTopics" :key="entry.id" :to="newsLocation(entry.id)" custom v-slot="{ href, navigate }">
            <a :href="href" :aria-current="topic === entry.id ? 'page' : undefined" class="news-control"
              :class="{ 'news-control-active': topic === entry.id }" @click="navigate">{{ entry.label }}</a>
          </NuxtLink>
        </template>
      </nav>

      <div v-if="invalidTopic" role="status" class="py-5 text-sm text-terminal-amber-dim">
        Unknown topic. Choose a feed above or type <code>news --topics</code>.
      </div>
      <NewsStoryList v-else :key="topic" :topic="topic" :overlay="overlay" @preview="openStory" />

      <p class="mt-5 text-xs leading-relaxed text-terminal-amber-dim">
        <code class="text-terminal-amber">news --topic {{ topic }}</code>
        <span aria-hidden="true"> · </span>
        <code>news --topics</code>
        <template v-if="overlay">
          <span aria-hidden="true"> · </span>
          <NuxtLink :to="newsLocation(topic)" class="underline text-terminal-amber" @click="$emit('close')">Open as page</NuxtLink>
        </template>
      </p>
    </div>

    <div v-if="story" ref="storyPane" class="news-story" role="dialog" :aria-labelledby="storyTitleId">
      <div class="mx-auto max-w-3xl">
        <div class="flex flex-wrap justify-between gap-2 items-center border-b border-terminal-amber-dim/40 pb-3 mb-4">
          <button ref="backButton" type="button" class="news-control" @click="closeStory()">← Back to headlines</button>
          <button v-if="overlay" type="button" aria-label="Close news" @click="$emit('close')" class="news-control">[x]</button>
        </div>
        <p class="text-xs uppercase tracking-widest text-terminal-amber-dim">// Story preview</p>
        <h3 :id="storyTitleId" class="mt-2 text-2xl sm:text-4xl leading-tight font-bold break-words">{{ story.title }}</h3>
        <p class="my-3 flex flex-wrap items-baseline gap-2 text-xs text-terminal-amber-dim">
          <span>{{ story.source }}<template v-if="story.byline"> · {{ story.byline }}</template></span>
          <span aria-hidden="true">/</span>
          <time :datetime="story.publishedAt">{{ headlineTime.format(new Date(story.publishedAt)) }} UTC</time>
        </p>
        <NewsArtwork :key="story.url" :image="story.image" :topic="topic" :source="story.source"
          class="mt-3 max-w-xl" show-credit />
        <p v-if="story.summary" class="my-4 text-sm sm:text-base leading-relaxed whitespace-pre-line break-words">{{ story.summary }}</p>
        <p v-else class="my-4 text-sm leading-relaxed text-terminal-amber-dim">Read the full story on the publisher’s website.</p>
        <a :href="story.url" target="_blank" rel="noopener noreferrer" class="news-control news-control-active">
          Read original <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { defaultNewsTopic, newsLocation, newsTopics } from '~/utils/newsTopics.js'

const props = defineProps({
  topic: { type: String, default: defaultNewsTopic },
  invalidTopic: Boolean,
  overlay: Boolean
})
defineEmits(['topic', 'close'])
const id = useId()
const titleId = `${id}-news-title`
const storyTitleId = `${id}-story-title`
const activeTopic = computed(() => newsTopics.find(entry => entry.id === props.topic) ?? newsTopics[0])
const descriptions = {
  headlines: 'Top U.S. and world stories from NPR.',
  seattle: 'Local announcements and updates from the City of Seattle.',
  space: 'Independent space reporting and agency updates.',
  tech: 'Community-ranked technology stories from Hacker News.'
}
const headlineTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})
const feed = ref()
const story = shallowRef(null)
const closeButton = ref()
const backButton = ref()
let fromButton
let readingOffset = 0

function openStory(item, trigger) {
  fromButton = trigger
  readingOffset = props.overlay ? feed.value.scrollTop : window.scrollY
  story.value = item
  if (!props.overlay) window.scrollTo(0, 0)
  nextTick(() => backButton.value?.focus({ preventScroll: true }))
}
function closeStory() {
  if (!story.value) return false
  story.value = null
  nextTick(() => {
    if (!feed.value) return
    if (props.overlay) feed.value.scrollTop = readingOffset
    else window.scrollTo(0, readingOffset)
    fromButton?.focus({ preventScroll: true })
    fromButton = null
  })
  return true
}
function onEscape(event) {
  if (!closeStory()) return
  event.preventDefault()
  event.stopPropagation()
}
function focusStart() { closeButton.value?.focus({ preventScroll: true }) }
watch(() => props.topic, () => {
  story.value = null
  fromButton = null
  if (props.overlay && feed.value) feed.value.scrollTop = 0
})
defineExpose({ closeStory, focusStart })
</script>

<style scoped>
.news-reader-overlay { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; background: inherit; }
.news-reader-overlay .news-feed, .news-reader-overlay .news-story { min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: .75rem clamp(.65rem, 2vw, 1.4rem) 1rem; scrollbar-gutter: stable; }
.news-header { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; }
.news-control { display: inline-flex; min-height: 2.75rem; align-items: center; gap: .25rem; padding: .2rem .65rem; border: 1px solid; border-color: currentColor; color: inherit; font-size: .75rem; letter-spacing: .035em; }
.news-control:hover, .news-control-active { background: rgb(255 176 0 / 11%); font-weight: 700; }
.news-control:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
</style>
