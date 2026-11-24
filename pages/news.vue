<template>
  <section class="max-w-4xl mx-auto mt-4 px-2 pb-10 font-mono" aria-labelledby="news-title">
    <header class="border-b border-terminal-amber-dim/40 pb-4">
      <p class="text-xs uppercase text-terminal-amber-dim tracking-widest">// News feed</p>
      <h2 id="news-title" class="mt-2 text-2xl sm:text-3xl font-bold text-terminal-amber">
        {{ activeTopic.label }}
      </h2>
      <p class="mt-2 text-sm text-terminal-amber-dim">{{ descriptions[topic] }}</p>
    </header>

    <nav class="my-4 flex flex-wrap gap-2" aria-label="News topics">
      <NuxtLink v-for="entry in newsTopics" :key="entry.id" :to="newsLocation(entry.id)" custom v-slot="{ href, navigate }">
        <a :href="href" :aria-current="topic === entry.id ? 'page' : undefined" @click="navigate"
        class="min-h-11 inline-flex items-center px-3 border text-xs uppercase tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal-amber"
        :class="topic === entry.id
          ? 'text-terminal-amber border-terminal-amber font-bold'
          : 'text-terminal-amber-dim border-terminal-amber-dim/40 hover:text-terminal-amber'">
          {{ entry.label }}
        </a>
      </NuxtLink>
    </nav>

    <div v-if="invalidTopic" role="status" class="py-5 text-sm text-terminal-amber-dim">
      Unknown topic. Choose a feed above or type <code>news --topics</code>.
    </div>
    <div v-else-if="status === 'pending' || status === 'idle'" role="status" class="py-5 text-sm text-terminal-amber-dim">
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
      <ol class="divide-y divide-terminal-amber-dim/25 border-y border-terminal-amber-dim/25">
        <li v-for="item in current.items" :key="item.url" class="min-w-0 py-3">
          <a :href="item.url" target="_blank" rel="noopener noreferrer"
            class="block min-h-8 font-semibold leading-snug break-words text-terminal-amber hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-amber">
            {{ item.title }} <span aria-hidden="true" class="text-xs text-terminal-amber-dim">↗</span>
          </a>
          <p class="flex flex-wrap items-baseline gap-x-2 text-xs text-terminal-amber-dim">
            <span>{{ item.source }}<template v-if="item.byline"> · {{ item.byline }}</template></span>
            <span aria-hidden="true">/</span>
            <time :datetime="item.publishedAt">{{ headlineTime.format(new Date(item.publishedAt)) }} UTC</time>
          </p>
        </li>
      </ol>
    </template>

    <p class="mt-5 text-xs leading-relaxed text-terminal-amber-dim">
      <code class="text-terminal-amber">news --topic {{ topic }}</code>
      <span aria-hidden="true"> · </span>
      <code>news --topics</code>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { defaultNewsTopic, isNewsTopic, newsLocation, newsTopics } from '~/utils/newsTopics.js'

useHead({ title: 'News | Mamoon Syed', meta: [{ name: 'robots', content: 'noindex, follow' }] })

const route = useRoute()
const invalidTopic = computed(() => route.query.topic !== undefined && !isNewsTopic(route.query.topic))
const topic = computed(() => isNewsTopic(route.query.topic) ? route.query.topic : defaultNewsTopic)
const activeTopic = computed(() => newsTopics.find(entry => entry.id === topic.value))
const descriptions = {
  headlines: 'Top U.S. and world stories from NPR.',
  seattle: 'Local announcements and updates from the City of Seattle.',
  space: 'Independent space reporting and agency updates.',
  tech: 'Community-ranked technology stories from Hacker News.'
}
const headlineTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
})
const { data, status, error, refresh } = await useAsyncData(
  computed(() => invalidTopic.value ? 'news:invalid' : 'news:' + topic.value),
  (_app, { signal }) => invalidTopic.value
    ? Promise.resolve({ topic: null, items: [], sources: [] })
    : $fetch('/api/news', { query: { topic: topic.value }, signal }),
  { lazy: true }
)
const current = computed(() => data.value?.topic === topic.value ? data.value : null)
const degradedSources = computed(() => (current.value?.sources ?? []).flatMap(source =>
  source.state === 'fresh' ? [] :
    [source.name + (source.state === 'stale' ? ': showing last available headlines' : ': temporarily unavailable')]
))
</script>
