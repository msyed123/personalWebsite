<template>
  <div class="draft-root font-mono text-terminal-amber min-h-full">
    <div v-if="loading" class="border border-terminal-blue bg-terminal-black flex flex-col items-center justify-center p-12 w-full text-terminal-blue tracking-widest uppercase font-bold text-center">
      Loading Databanks...
      <Loading class="mt-8 mx-auto" />
    </div>

    <div v-else :class="['w-full grid gap-8 items-start transition-all duration-300 max-w-[1600px] mx-auto', (finalKnown || done) ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2']">
      
      <!-- LEFT: wheel + controls -->
      <section v-if="!finalKnown && !done" class="flex flex-col flex-1 items-center justify-center min-h-[640px] gap-6 w-full max-w-[720px] mx-auto overflow-hidden">
        <Wheel
          ref="wheel"
          :items="wheelLabels"
          :size="720"
          :durationMs="2800"
          :minTurns="5"
          :maxTurns="7"
          @ready="wheelReady = true"
          @spin-start="spinning = true"
          @spin-end="handleSpinEnd"
          class="max-w-full scale-100 md:scale-100"
        />
        <div class="w-full relative z-10 mt-4 px-4 xl:px-8 max-w-[400px]">
          <button
            class="w-full bg-terminal-blue text-terminal-black font-bold uppercase tracking-widest py-4 md:py-6 border-2 border-terminal-blue hover:bg-black hover:text-terminal-blue transition-colors disabled:opacity-50 text-base md:text-lg"
            :disabled="isBusy || currentTeamIndex < 0 || !wheelReady"
            @click="spinAndReveal"
            v-show="currentTeamIndex >= 0">
            Reveal Pick {{ currentTeamIndex + 1 }}
          </button>
        </div>
      </section>

      <!-- RIGHT: revealed list -->
      <section class="flex-1 w-full max-w-4xl mx-auto xl:mx-0 pr-2 pb-16 min-h-[640px]">
        <div v-if="finalKnown && !done" class="sticky top-0 z-50 py-4 mb-4 text-center bg-black/80 backdrop-blur-md">
          <button
            class="min-w-[280px] w-full max-w-md mx-auto bg-amber-400 text-black font-bold uppercase tracking-widest py-6 px-8 border-2 border-amber-400 hover:bg-black hover:text-amber-400 transition-colors disabled:opacity-50 text-lg md:text-xl"
            :disabled="isBusy || currentTeamIndex < 0"
            @click="revealFinal">
            Reveal FIRST OVERALL
          </button>
        </div>

        <h4 v-if="revealedTeams.length" class="text-center font-bold mb-6 text-xl tracking-widest uppercase text-terminal-amber">Pick Order</h4>

        <TransitionGroup tag="ul" name="slide" class="space-y-4">
          <li
            v-for="(dude, index) in revealedTeams"
            :key="dude._key || index"
          >
            <div class="relative mx-auto border bg-black/50 flex flex-col md:flex-row items-center p-4 md:p-6 gap-6 transition-all duration-300" :class="cardClasses(index, dude)">
              <div class="w-32 h-32 md:w-40 md:h-40 shrink-0 border border-terminal-amber-dim bg-black p-1 shadow-inner">
                <img v-if="dude.data.picture?.url" :src="dude.data.picture.url" class="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-300" />
              </div>
              <div class="flex-1 text-left w-full">
                <div class="bg-terminal-blue text-terminal-black px-4 py-1.5 font-bold inline-block mb-4 select-none text-sm tracking-widest uppercase shadow-sm">> Pick {{ pickNumber(index) }}</div>
                <div class="text-3xl md:text-4xl text-terminal-amber font-bold tracking-wide uppercase mb-3 drop-shadow-md">{{ dude.data.name[0]?.text || 'UNKNOWN' }}</div>
                <ul class="space-y-1.5 text-sm md:text-base text-terminal-amber-dim tracking-wider font-mono list-none p-0">
                  <li><span class="opacity-50 select-none">[Stnd]:</span> {{ dude.data.standing }}</li>
                  <li><span class="opacity-50 select-none">[Rec] :</span> {{ dude.data.previousrecord[0]?.text }}</li>
                  <li><span class="opacity-50 select-none">[Team]:</span> {{ dude.data.previousteamname[0]?.text }}</li>
                </ul>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>

<script>
import Loading from "~/components/Loading.vue";
import Wheel from "~/components/Wheel.vue";

export default {
  name: "Draft",
  components: { Loading, Wheel },
  data() {
    return {
      loading: true,
      dudes: [],
      revealedTeams: [],
      currentTeamIndex: null,
      spinning: false,
      flying: false,
      wheelReady: false,
      done: false,
    };
  },
  computed: {
    isBusy() { return this.spinning || this.flying; },
    wheelLabels() {
      if (this.currentTeamIndex == null) return [];
      const remaining = this.dudes.slice(0, this.currentTeamIndex + 1);
      return remaining.map(d => this.firstName(d?.data?.name?.[0]?.text || ""));
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

    cardClasses(index, dude) {
      const pickNum = this.pickNumber(index);
      return {
        'border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.3)] bg-gradient-to-br from-black/80 to-amber-900/20': pickNum === 1,
        'border-terminal-blue shadow-[0_0_15px_rgba(45,212,191,0.15)]': pickNum !== 1,
      };
    },

    async getDudes() {
      const { $prismic } = useNuxtApp();
      const response = await $prismic.client.getAllByType("dude");
      this.dudes = response.map(result => ({ ...result, _key: result.id || Math.random().toString() }));

      // Fisher–Yates shuffle
      let i = this.dudes.length;
      while (i) { const j = Math.floor(Math.random() * i--); [this.dudes[i], this.dudes[j]] = [this.dudes[j], this.dudes[i]]; }
      this.loading = false;
      this.currentTeamIndex = this.dudes.length - 1;
    },

    handleSpinEnd() { this.spinning = false; },

    async spinAndReveal() {
      if (this.isBusy || this.currentTeamIndex < 0) return;
      if (this.currentTeamIndex === 0) return;

      const wheel = this.$refs.wheel;
      const fullName = this.dudes[this.currentTeamIndex]?.data?.name?.[0]?.text || "";
      const first = this.firstName(fullName);

      if (!wheel || typeof wheel.spinTo !== "function") {
         this.revealViaInsertOnly(this.currentTeamIndex);
         return;
      }

      await wheel.spinTo(first);
      
      const raw = this.dudes[this.currentTeamIndex];
      this.revealedTeams.unshift(raw);
      this.currentTeamIndex--;
    },

    revealViaInsertOnly(idx) {
      const raw = this.dudes[idx];
      this.revealedTeams.unshift(raw);
      this.currentTeamIndex--;
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
  created() { this.getDudes(); }
};
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.5s cubic-bezier(.55,0,.1,1); }
.slide-enter-from { opacity: 0; transform: translateX(50px) scale(0.95); }
.slide-leave-to { opacity: 0; transform: translateY(30px) scale(0.95); }
</style>
