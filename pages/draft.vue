<template>
  <section
    ref="shell"
    class="draft-shell bg-terminal-black/90 p-4 w-full flex justify-center items-stretch"
    :style="shellStyle"
  >
    <div class="draft-card w-full max-w-[1800px] border border-terminal-amber-dim rounded overflow-hidden flex flex-col bg-black/40">
      <div class="bg-terminal-blue text-terminal-black font-bold tracking-widest uppercase px-6 py-2 border-b border-terminal-amber-dim">
        // SYSTEM.ANDREWS_INFLATED_BALLS
      </div>
      <div class="card-body p-4 md:p-8">
        <Draft />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Draft from '~/components/Draft.vue'

const draftUnlocked = useState('draftUnlocked', () => false)
const router = useRouter()

if (!draftUnlocked.value) {
  router.push('/')
}

const shell = ref(null)
const padY = ref(16)
const padX = ref(20)
const availHeight = ref(0)

const shellStyle = computed(() => {
  return {
    '--pad-y': padY.value + 'px',
    '--pad-x': padX.value + 'px',
    '--avail-h': availHeight.value + 'px'
  }
})

const measure = () => {
  nextTick(() => {
    if (!shell.value) return
    const top = shell.value.getBoundingClientRect().top
    const h = window.innerHeight - top - (padY.value * 2)
    availHeight.value = Math.max(0, Math.floor(h))
  })
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('orientationchange', measure)
})
</script>

<style scoped>
.card-body {
  -webkit-overflow-scrolling: touch;
}

:deep(.draft-root),
:deep(.grid) {
  height: 100% !important;
  min-height: 0 !important;
}

:deep(.right) {
  max-height: none !important;
  overflow: visible !important;
}

:deep(.wheel-stage),
:deep(.pointer) {
  transition: none !important;
}

:deep(.wheel-stage:hover) {
  transform: none !important;
  cursor: default !important;
}

:deep(.reveal-btn) {
  transform: none !important;
  box-shadow: none !important;
  filter: none !important;
}

h1, p {
  margin: 0;
  font-family: monaco, monospace;
}
</style>
