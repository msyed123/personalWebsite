<template>
  <div class="draft-root text-terminal-amber">
    <div v-if="loading" role="status" class="draft-panel p-5 text-sm text-terminal-blue">Loading teams…</div>
    <div v-else-if="loadError" class="draft-panel p-5">
      <p role="alert" class="text-sm">The roster couldn’t be loaded.</p>
      <button class="draft-action mt-4" type="button" @click="getDudes">Try again</button>
    </div>
    <p v-else-if="!dudes.length" class="draft-panel p-5 text-sm">No teams are available to draw.</p>

    <div v-else class="draft-workspace" :class="{ 'draft-is-complete': done }">
      <section v-if="!done" class="draft-panel draft-draw" aria-labelledby="draw-title">
        <div class="panel-bar">
          <h2 id="draw-title">{{ finalKnown ? 'Final reveal' : 'Draw console' }}</h2>
          <span>{{ currentTeamIndex + 1 }} left</span>
        </div>
        <div v-if="!finalKnown" class="draft-wheel">
          <Wheel v-show="!showingReveal" ref="wheel" :items="wheelLabels" :size="600" :durationMs="2800" :minTurns="5" :maxTurns="7"
            @ready="wheelReady = true" @spin-start="spinning = true" @spin-end="handleSpinEnd" />
          <figure v-if="showingReveal && latestTeam" class="featured-reveal">
            <DraftPortrait :src="latestTeam.data.picture?.url" :name="latestTeam.data.name?.[0]?.text" eager />
            <figcaption>
              <span>Pick {{ pickNumber(0) }}</span>
              <strong>{{ latestTeam.data.name?.[0]?.text || 'Unknown' }}</strong>
            </figcaption>
          </figure>
        </div>
        <div v-else class="final-callout">
          <span aria-hidden="true">01</span>
          <p>One team left. Reveal who picks first.</p>
        </div>
        <div class="draft-controls">
          <p class="text-xs text-terminal-amber-dim">{{ finalKnown ? 'Final pick' : 'Draws run from last pick to first.' }}</p>
          <button v-if="!finalKnown" type="button" class="draft-action"
            :disabled="isBusy || currentTeamIndex < 0 || !wheelReady" @click="spinAndReveal">
            {{ spinning ? 'Drawing…' : 'Reveal pick ' + (currentTeamIndex + 1) }}
          </button>
          <button v-else type="button" class="draft-action" :disabled="isBusy" @click="revealFinal">
            Reveal first overall
          </button>
        </div>
      </section>

      <section class="draft-panel draft-results" aria-labelledby="results-title">
        <div class="panel-bar">
          <h2 id="results-title">Pick order</h2>
          <span>{{ revealedTeams.length }} / {{ dudes.length }} revealed</span>
        </div>
        <p v-if="!revealedTeams.length" class="draft-empty">Revealed picks will appear here.</p>
        <p class="sr-only" role="status" aria-live="polite">
          {{ done ? 'Draft order complete.' : revealedTeams.length
            ? 'Pick ' + pickNumber(0) + ': ' + revealedTeams[0].data.name?.[0]?.text : '' }}
        </p>
        <TransitionGroup tag="ol" name="slide" class="m-0 list-none p-0" aria-label="Revealed picks">
          <li v-for="(dude, index) in revealedTeams" :key="dude._key" class="draft-pick"
            :class="{ 'first-pick': pickNumber(index) === 1 }" :data-pick="pickNumber(index)">
            <div class="pick-number"><span class="sr-only">Pick </span>{{ String(pickNumber(index)).padStart(2, '0') }}</div>
            <DraftPortrait :src="dude.data.picture?.url" :name="dude.data.name?.[0]?.text"
              :eager="index === 0" />
            <div class="min-w-0">
              <h3 class="break-words font-bold text-terminal-amber">{{ dude.data.name?.[0]?.text || 'Unknown' }}</h3>
              <p v-if="dude.data.previousteamname?.[0]?.text" class="mt-1 break-words text-xs text-terminal-amber-dim">{{ dude.data.previousteamname[0].text }}</p>
              <p v-if="dude.data.standing || dude.data.previousrecord?.[0]?.text" class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-terminal-amber-dim">
                <span v-if="dude.data.standing">Place: {{ dude.data.standing }}</span>
                <span v-if="dude.data.previousrecord?.[0]?.text">Record: {{ dude.data.previousrecord[0].text }}</span>
              </p>
            </div>
          </li>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>

<script>
import Wheel from "~/components/Wheel.vue";
import DraftPortrait from "~/components/DraftPortrait.vue";

export default {
  name: "Draft",
  components: { Wheel, DraftPortrait },
  data() {
    return {
      loading: true,
      loadError: false,
      dudes: [],
      revealedTeams: [],
      currentTeamIndex: null,
      spinning: false,
      showingReveal: false,
      wheelReady: false,
      done: false,
    };
  },
  computed: {
    latestTeam() { return this.revealedTeams[0]; },
    isBusy() { return this.spinning; },
    wheelLabels() {
      if (this.currentTeamIndex == null) return [];
      const remaining = this.dudes.slice(0, this.currentTeamIndex + 1);
      const names = remaining.map(d => d.data.name?.[0]?.text || "Unknown");
      const firstNames = names.map(name => this.firstName(name));
      return names.map((name, i) => {
        const first = firstNames[i];
        if (firstNames.filter(label => label === first).length === 1) return first;
        const surname = name.trim().split(/\s+/).at(-1);
        return surname && surname !== first ? first + " " + surname[0] + "." : first;
      });
    },
    finalKnown() { return this.currentTeamIndex === 0; },
  },
  methods: {
    firstName(full) {
      const cleaned = (full || "").replace(/['"“”‘’]/g, " ").trim();
      const parts = cleaned.split(/\s+/);
      return parts.length ? parts[0] : full;
    },
    pickNumber(index) { return this.dudes.length - this.revealedTeams.length + index + 1; },

    async getDudes() {
      const { $prismic } = useNuxtApp();
      this.loading = true;
      this.loadError = false;
      try {
        const response = await $prismic.client.getAllByType("dude");
        this.dudes = response.map(result => ({ ...result, _key: result.id || Math.random().toString() }));
        // Keep the existing Fisher–Yates draw order.
        let i = this.dudes.length;
        while (i) {
          const j = Math.floor(Math.random() * i--);
          [this.dudes[i], this.dudes[j]] = [this.dudes[j], this.dudes[i]];
        }
        this.currentTeamIndex = this.dudes.length - 1;
      } catch {
        this.loadError = true;
      } finally {
        this.loading = false;
      }
    },

    handleSpinEnd() { this.spinning = false; },

    async spinAndReveal() {
      if (this.isBusy || this.currentTeamIndex < 0) return;
      if (this.currentTeamIndex === 0) return;

      const wheel = this.$refs.wheel;

      if (!wheel || typeof wheel.spinTo !== "function") {
         this.revealViaInsertOnly(this.currentTeamIndex);
         return;
      }

      // The remaining array is in wheel order. Using its position also makes
      // the pointer settle on the correct segment when two names match.
      this.showingReveal = false;
      await wheel.spinTo(this.currentTeamIndex);
      this.revealViaInsertOnly(this.currentTeamIndex);
    },

    revealViaInsertOnly(idx) {
      const raw = this.dudes[idx];
      this.revealedTeams.unshift(raw);
      this.currentTeamIndex--;
      this.showingReveal = true;
    },

    async revealFinal() {
      if (this.isBusy) return;
      if (this.currentTeamIndex === 0) {
        this.revealViaInsertOnly(this.currentTeamIndex);
        this.currentTeamIndex = -1;
        this.done = true;
      }
    },
  },
  mounted() { this.getDudes(); }
};
</script>


<style scoped>
.draft-root {
  --panel-bg: #0a0a0a;
  --bar-bg: #141008;
  --bar-text: #ffca64;
  --line: rgb(179 119 0 / 50%);
  --muted: #b37700;
  --accent: #00d2ff;
  --highlight: #ffb000;
  --highlight-wash: rgb(255 176 0 / 9%);
  --avatar-bg: #1a1510;
}
:global(body.light-theme .draft-root) {
  --panel-bg: #f8f8f8;
  --bar-bg: #eceef0;
  --bar-text: #414b54;
  --line: #c2c8cd;
  --muted: #59616a;
  --accent: #005bb5;
  --highlight: #874d00;
  --highlight-wash: #f7edda;
  --avatar-bg: #eceef0;
}
.draft-workspace { display: grid; gap: 1rem; align-items: start; }
.draft-panel { min-width: 0; border: 1px solid var(--line); background: var(--panel-bg); }
.panel-bar {
  display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap;
  gap: .3rem .75rem; padding: .75rem 1rem; border-bottom: 1px solid var(--line);
  background: var(--bar-bg); color: var(--bar-text); font-size: .72rem; letter-spacing: .05em;
}
.panel-bar h2 { font-size: .82rem; font-weight: 700; }
.panel-bar span { color: var(--accent); font-variant-numeric: tabular-nums; }
.draft-wheel { padding: 1rem 1rem .5rem; }
.draft-controls { display: grid; gap: .5rem; padding: .85rem 1rem 1rem; text-align: center; }
.draft-action {
  min-height: 44px; padding: .65rem 1rem; border: 1px solid var(--accent);
  background: rgb(0 210 255 / 10%); color: var(--accent); font-size: .85rem; font-weight: 700;
}
.draft-action:hover:not(:disabled) { background: var(--accent); color: var(--panel-bg); }
.draft-action:focus-visible { outline: 2px solid var(--highlight); outline-offset: 3px; }
.draft-action:disabled { opacity: .45; cursor: default; }
.draft-empty { padding: 1.2rem 1rem; font-size: .8rem; color: var(--muted); }
.final-callout { display: grid; gap: .4rem; padding: 1.25rem 1rem; text-align: center; }
.final-callout span { color: var(--highlight); font-size: 2.5rem; font-weight: 700; line-height: 1; }
.final-callout p { font-size: .8rem; }
.draft-pick {
  --portrait-size: min(5.25rem, 27vw);
  display: grid; grid-template-columns: 2ch var(--portrait-size) minmax(0, 1fr);
  align-items: center; gap: .75rem; padding: .8rem 1rem;
  border-bottom: 1px solid var(--line);
}
.draft-pick:last-child { border-bottom: 0; }
.pick-number { color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; }
.first-pick { background: var(--highlight-wash); box-shadow: inset 2px 0 var(--highlight); }
.first-pick .pick-number { color: var(--highlight); }
.draft-is-complete .first-pick { --portrait-size: min(7rem, 36vw); }
.featured-reveal {
  width: min(100%, 22.5rem, 48svh);
  aspect-ratio: 1;
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  place-content: center;
  justify-items: center;
  gap: .65rem;
  text-align: center;
}
.featured-reveal .draft-portrait {
  width: min(12rem, 48vw, 27svh);
  border-color: var(--accent);
  box-shadow: 0 0 1rem rgb(0 210 255 / 12%);
}
.featured-reveal figcaption { max-width: 100%; overflow-wrap: anywhere; }
.featured-reveal figcaption span {
  display: block;
  color: var(--accent);
  font-size: .78rem;
  text-transform: uppercase;
  letter-spacing: .1em;
}
.featured-reveal figcaption strong { font-size: clamp(.95rem, 2.5vw, 1.2rem); }
.slide-enter-active, .slide-move { transition: transform .22s ease, opacity .22s ease; }
.slide-enter-from { opacity: 0; transform: translateY(-.3rem); }
@media (max-width: 639px) {
  .draft-controls { display: flex; flex-direction: column-reverse; }
  .draft-wheel { padding-top: .75rem; }
}
@media (min-width: 800px) {
  .draft-workspace { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.25rem; }
  .draft-is-complete { grid-template-columns: minmax(0, 1fr); }
  .draft-pick { --portrait-size: 6.75rem; }
  .draft-is-complete .first-pick { --portrait-size: 9.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .slide-enter-active, .slide-move { transition: none; }
}
</style>
