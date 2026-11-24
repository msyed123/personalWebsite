<template>
  <div class="draft-portrait" aria-hidden="true">
    <img v-if="src && failedSrc !== src" :src="src" :loading="eager ? 'eager' : 'lazy'"
      alt="" @error="failedSrc = src">
    <span v-else>{{ initials }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  name: { type: String, default: '' },
  eager: Boolean
})
const failedSrc = ref('')
const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map(part => part[0]).join('') || '?'
})
</script>

<style scoped>
.draft-portrait {
  width: 100%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  background: var(--avatar-bg);
  color: var(--bar-text);
  font-size: 1.25rem;
  font-weight: 700;
  text-transform: uppercase;
}
.draft-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 36%;
}
</style>
