<template>
  <span class="news-artwork">
    <img v-if="imageUrl && !failed" :src="imageUrl" :alt="image?.alt ?? ''"
      loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="failed = true">
    <template v-else>
      <span class="news-artwork-fallback" :data-topic="topic" aria-hidden="true">
        <span>// {{ topic }}</span>
        <svg viewBox="0 0 100 68" class="news-artwork-mark" fill="none" stroke="currentColor"
          stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
          <g v-if="topic === 'seattle'">
            <path d="M9 57h82M15 56V44l10-7 11 7v12M40 56V42l6-4v-9h12v9l6 4v14m6 0V45h15v11M52 28V9m-13 9h26l-5 6H44z"/>
            <path d="M21 48h8m45 2h6m-37-2h16"/>
          </g>
          <g v-else-if="topic === 'space'">
            <circle cx="50" cy="34" r="17"/>
            <ellipse cx="50" cy="34" rx="39" ry="13" transform="rotate(-23 50 34)"/>
            <path d="M18 10v12m-6-6h12m59 32v12m-6-6h12"/>
          </g>
          <g v-else-if="topic === 'tech'">
            <rect x="27" y="15" width="46" height="38" rx="2"/><path d="M40 26l7 8-7 8m12 0h10M39 8v7m11-7v7m11-7v7M39 53v7m11-7v7m11-7v7M19 24h8m-8 10h8m-8 10h8m46-20h8m-8 10h8m-8 10h8"/>
          </g>
          <g v-else>
            <path d="M21 11h49v40a6 6 0 0 0 12 0V23H70M76 57H27a6 6 0 0 1-6-6zM29 20h32m-32 24h32m-32 6h23m-6-21h15m-15 6h15"/>
            <rect x="30" y="28" width="10" height="9"/>
          </g>
        </svg>
        <span>{{ source }}</span>
      </span>
    </template>
    <span v-if="showCredit && imageUrl && !failed && image?.credit"
      class="news-artwork-credit">{{ image.credit }}</span>
  </span>
</template>

<script setup>
const props = defineProps({
  image: Object,
  topic: { type: String, required: true },
  source: { type: String, required: true },
  showCredit: Boolean
})
const failed = ref(false)
const imageUrl = computed(() => {
  try {
    const url = new URL(props.image?.url)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch { return null }
})
watch(imageUrl, () => { failed.value = false })
</script>

<style scoped>
.news-artwork {
  position: relative;
  margin: 0;
  aspect-ratio: 16 / 9;
  display: grid;
  min-width: 0;
  overflow: hidden;
  background: #14110a;
  color: #ffb000;
}
.news-artwork img { width: 100%; height: 100%; object-fit: cover; min-height: 0; }
.news-artwork-fallback {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  min-height: 0;
  align-items: center;
  padding: clamp(.25rem, 1.8vw, .65rem);
  border: 1px solid currentColor;
  background: repeating-linear-gradient(0deg, transparent 0 3px, #ffb00012 3px 4px),
    radial-gradient(ellipse at 72% 30%, #533b11, #14110a 75%);
}
.news-artwork-fallback[data-topic="seattle"] { background-color: #14251b; color: #a5dda9; background-image: repeating-linear-gradient(0deg, transparent 0 3px, #a5dda91a 3px 4px); }
.news-artwork-fallback[data-topic="space"] { background-color: #1b152c; color: #deccff; background-image: repeating-linear-gradient(0deg, transparent 0 3px, #deccff1a 3px 4px); }
.news-artwork-fallback[data-topic="tech"] { background-color: #14272b; color: #9fedf4; background-image: repeating-linear-gradient(0deg, transparent 0 3px, #9fedf41a 3px 4px); }
.news-artwork-fallback span { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; letter-spacing: .09em; font-size: .6rem; }
.news-artwork-mark { width: 64%; height: 100%; min-height: 0; max-height: 7rem; justify-self: center; }
.news-artwork-credit { position: absolute; inset: auto .4rem .4rem auto; max-width: calc(100% - .8rem); background: #0a0a0a; color: #fff; padding: .14rem .3rem; font-size: .62rem; }
</style>
