<template>
  <NewsReader class="max-w-5xl mx-auto mt-4 px-2 pb-10" :topic="topic" :invalid-topic="invalidTopic" />
</template>

<script setup>
import { defaultNewsTopic, isNewsTopic } from '~/utils/newsTopics.js'

useHead({ title: 'News | Mamoon Syed', meta: [{ name: 'robots', content: 'noindex, follow' }] })

const route = useRoute()
const invalidTopic = computed(() => route.query.topic !== undefined && !isNewsTopic(route.query.topic))
const topic = computed(() => isNewsTopic(route.query.topic) ? route.query.topic : defaultNewsTopic)
</script>
