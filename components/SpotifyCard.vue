<template>
  <div class="spotify-card">
    <!-- Header bar -->
    <div class="card-header">
      <span class="spotify-badge">
        <svg class="spotify-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        {{ track.isPlaying ? '▶ NOW PLAYING' : '⏱ LAST PLAYED' }}
      </span>
      <button class="close-btn" @click="$emit('close')">[x]</button>
    </div>

    <!-- Main content -->
    <div class="card-body">
      <!-- Album art -->
      <div class="album-art-wrap">
        <img
          :src="track.albumArtUrl"
          :alt="track.albumName"
          class="album-art"
          :class="{ 'art-playing': track.isPlaying }"
        />
        <div v-if="track.isPlaying" class="art-glow" />
      </div>

      <!-- Track info -->
      <div class="track-info">
        <a :href="track.songUrl" target="_blank" rel="noopener" class="song-title">
          {{ track.songTitle }}
        </a>
        <div class="artist">{{ track.artist }}</div>
        <div class="album-name">// {{ track.albumName }}</div>

        <!-- Progress bar (only when playing or has progress) -->
        <div v-if="track.isPlaying || track.progressMs !== null" class="progress-wrap">
          <span class="time-label">{{ formatTime(displayProgress) }}</span>
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{ width: progressPercent + '%' }"
            />
            <div
              class="progress-head"
              :style="{ left: progressPercent + '%' }"
              :class="{ 'head-playing': track.isPlaying }"
            />
          </div>
          <span class="time-label">{{ formatTime(track.durationMs) }}</span>
        </div>

        <!-- Album link button -->
        <a
          :href="track.albumUrl"
          target="_blank"
          rel="noopener"
          class="album-btn"
        >
          [OPEN ALBUM ↗]
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface SpotifyTrack {
  isPlaying: boolean
  songTitle: string
  artist: string
  albumName: string
  albumArtUrl: string
  albumUrl: string
  songUrl: string
  progressMs: number | null
  durationMs: number
  fetchedAt: number
}

const props = defineProps<{ track: SpotifyTrack }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'refresh'): void }>()

// --- Smooth progress via rAF ---
const displayProgress = ref(props.track.progressMs ?? 0)
let rafId: number | null = null
let lastTs: number | null = null

function tick (ts: number) {
  if (!props.track.isPlaying) return
  if (lastTs !== null) {
    displayProgress.value = Math.min(
      displayProgress.value + (ts - lastTs),
      props.track.durationMs
    )
  }
  lastTs = ts
  rafId = requestAnimationFrame(tick)
}

function startTick () {
  stopTick()
  lastTs = null
  if (props.track.isPlaying) rafId = requestAnimationFrame(tick)
}

function stopTick () {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  lastTs = null
}

// Sync display progress whenever the track prop changes (after a poll)
watch(() => props.track, (t) => {
  displayProgress.value = t.progressMs ?? displayProgress.value
  startTick()
}, { deep: true })

onMounted(startTick)
onUnmounted(stopTick)

// --- Derived ---
const progressPercent = computed(() => {
  if (!props.track.durationMs) return 0
  return Math.min((displayProgress.value / props.track.durationMs) * 100, 100)
})

function formatTime (ms: number): string {
  if (!ms || isNaN(ms)) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<style scoped>
.spotify-card {
  font-family: 'Fira Code', 'Courier New', monospace;
  background: #0d0d0d;
  border: 1px solid #1db954;
  border-radius: 4px;
  padding: 0;
  width: 100%;
  max-width: 540px;
  overflow: hidden;
  box-shadow: 0 0 18px rgba(29, 185, 84, 0.15);
}

/* --- Header --- */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(29, 185, 84, 0.08);
  border-bottom: 1px solid rgba(29, 185, 84, 0.25);
}

.spotify-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: #1db954;
  font-weight: 600;
  text-transform: uppercase;
}

.spotify-icon {
  width: 14px;
  height: 14px;
  color: #1db954;
}

.close-btn {
  background: none;
  border: none;
  color: #b37700;
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.close-btn:hover { color: #ff4444; }

/* --- Body --- */
.card-body {
  display: flex;
  gap: 16px;
  padding: 14px;
  align-items: flex-start;
}

/* --- Album art --- */
.album-art-wrap {
  position: relative;
  flex-shrink: 0;
}

.album-art {
  width: 96px;
  height: 96px;
  object-fit: cover;
  display: block;
  border-radius: 2px;
  border: 1px solid rgba(29, 185, 84, 0.3);
  transition: box-shadow 0.3s;
}

.art-playing {
  box-shadow: 0 0 20px rgba(29, 185, 84, 0.4), 0 0 6px rgba(29, 185, 84, 0.2);
}

.art-glow {
  position: absolute;
  inset: -4px;
  border-radius: 4px;
  background: radial-gradient(ellipse at center, rgba(29,185,84,0.18) 0%, transparent 70%);
  pointer-events: none;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* --- Track info --- */
.track-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffb000;
  letter-spacing: 0.04em;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}
.song-title:hover { color: #ffd24d; }

.artist {
  font-size: 0.72rem;
  color: #00d2ff;
  letter-spacing: 0.06em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-name {
  font-size: 0.65rem;
  color: #b37700;
  opacity: 0.8;
  letter-spacing: 0.06em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- Progress --- */
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.time-label {
  font-size: 0.6rem;
  color: #b37700;
  min-width: 28px;
  letter-spacing: 0.04em;
}

.progress-track {
  position: relative;
  flex: 1;
  height: 3px;
  background: rgba(255,176,0,0.15);
  border-radius: 2px;
  overflow: visible;
}

.progress-fill {
  height: 100%;
  background: #1db954;
  border-radius: 2px;
  transition: width 0.05s linear;
  box-shadow: 0 0 6px rgba(29, 185, 84, 0.5);
}

.progress-head {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1db954;
  box-shadow: 0 0 8px rgba(29, 185, 84, 0.8);
  transition: left 0.05s linear;
}

.head-playing {
  animation: head-pulse 1.5s ease-in-out infinite;
}

@keyframes head-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(29, 185, 84, 0.8); }
  50% { box-shadow: 0 0 14px rgba(29, 185, 84, 1), 0 0 4px #fff; }
}

/* --- Album button --- */
.album-btn {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: #1db954;
  text-decoration: none;
  border: 1px solid rgba(29, 185, 84, 0.4);
  padding: 3px 8px;
  border-radius: 2px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  align-self: flex-start;
}
.album-btn:hover {
  background: rgba(29, 185, 84, 0.12);
  color: #39e770;
  border-color: #1db954;
}
</style>
