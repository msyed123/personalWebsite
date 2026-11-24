<template>
  <span v-if="url && !failed" class="news-photo">
    <img :src="url" :alt="image.alt || ''" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="unavailable">
    <span class="news-photo-credit">
      {{ image.credit }}
      <template v-if="image.license === 'CC BY 4.0'">
        · <a v-if="showLicense" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" class="underline">CC BY 4.0</a>
        <template v-else>CC BY 4.0</template>
      </template>
    </span>
  </span>
</template>

<script setup>
const props = defineProps({ image: { type: Object, required: true }, showLicense: Boolean })
const emit = defineEmits(['unavailable'])
const failed = ref(false)
function unavailable() {
  failed.value = true
  emit('unavailable')
}
const url = computed(() => {
  try {
    const parsed = new URL(props.image.url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port ? parsed.href : null
  } catch { return null }
})
watch(url, () => { failed.value = false })
</script>

<style scoped>
.news-photo { display: grid; align-self: start; min-width: 0; gap: .25rem; }
.news-photo img { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #14110a; }
.news-photo-credit { font-size: .65rem; line-height: 1.3; overflow-wrap: anywhere; }
</style>
