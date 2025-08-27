<template>
    <div class="draft-root">
      <!-- Celebration overlay -->
      <div v-if="celebrating" class="celebration" ref="celebration">
        <canvas ref="confetti"></canvas>
        <div class="celebration-gold-vignette"></div>
      </div>
  
      <!-- FLY-IN overlay (hides wheel/list during flight) -->
      <div v-if="flyer.show" class="flyer-overlay">
        <div class="flyer-mask"></div>
        <div class="flyer-chip" :style="flyerStyle" ref="flyerChip">
          <img v-if="flyer.img" :src="flyer.img" alt="" />
          <span>{{ flyer.text }}</span>
        </div>
      </div>
  
      <div v-if="loading">
        <b-card no-body style="width: 100%"
          border-variant="primary" header-bg-variant="primary"
          header-text-variant="white" class="mx-auto" header="Loading...">
          <Loading />
        </b-card>
      </div>
  
      <div v-else :class="['grid', { final: finalKnown || done }]">
        <!-- LEFT: wheel + controls (hide after pick #2) -->
        <section class="left" v-if="!finalKnown && !done">
          <!-- NEW wrapper centers content vertically -->
          <div class="left-center">
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
            />
            <div class="controls">
              <b-button
                class="reveal-btn"
                :disabled="isBusy || currentTeamIndex < 0 || !wheelReady"
                @click="spinAndReveal"
                v-show="currentTeamIndex >= 0"
                block size="lg" variant="danger">
                Reveal Pick {{ currentTeamIndex + 1 }}
              </b-button>
            </div>
          </div>
        </section>
  
        <!-- RIGHT: revealed list -->
        <section class="right" ref="rightCol">
          <div v-if="finalKnown && !done" class="final-cta sticky-top">
            <b-button
              class="reveal-btn gold centered"
              :disabled="isBusy || currentTeamIndex < 0"
              @click="revealFinal"
              size="lg" variant="warning">
              Reveal FIRST OVERALL
            </b-button>
          </div>
  
          <h4 class="section-title" v-if="revealedTeams.length">Pick Order</h4>
  
          <TransitionGroup tag="ul" name="slide">
            <li
              v-for="(dude, index) in revealedTeams"
              :key="dude._key || dude.id || dude.uid || dude.data?.id || index"
              :class="{ 'seed-li': !!dude._seed }"
            >
              <b-card
                :ref="index === 0 ? 'newCard' : null"
                class="mx-auto reveal-card"
                :class="cardClasses(index, dude)"
                border-variant="primary"
                header-text-variant="dark"
                :img-src="dude.data.picture.url"
                img-left
              >
                <div class="landing-anchor" v-if="index === 0"></div>
                <b-card-text>
                  <b-alert show variant="primary" class="pick">Pick {{ pickNumber(index) }}</b-alert>
                  <div class="dude-name">{{ dude.data.name[0].text }}</div><br>
                  <div class="misc-text">2023 Final Standing: {{ dude.data.standing }}</div><br>
                  <div class="misc-text">2023 Record: {{ dude.data.previousrecord[0].text }}</div><br>
                  <div class="misc-text">2023 Team Name: {{ dude.data.previousteamname[0].text }}</div><br>
                </b-card-text>
              </b-card>
            </li>
          </TransitionGroup>
        </section>
      </div>
    </div>
  </template>
  
  <script>
  import Loading from "~/components/Loading.vue";
  import Prismic from "prismic-javascript";
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
  
        flyer: { show: false, animate: false, text: "", img: "", from: {x:0,y:0}, to: {x:0,y:0} },
  
        firstOverallPulse: false,
        celebrating: false,
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
      flyerStyle() {
        const p = this.flyer.animate ? this.flyer.to : this.flyer.from;
        return { '--x': p.x + 'px', '--y': p.y + 'px' };
      }
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
          'first-overall' : pickNum === 1,
          'first-animate' : pickNum === 1 && this.firstOverallPulse,
          'seed-hidden'   : !!dude._seed,
          'bubble-in'     : !!dude._bubble,
        };
      },
  
      async getDudes() {
        const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, { accessToken: process.env.PRISMIC_TOKEN });
        const response = await api.query(Prismic.Predicates.at("document.type", "dude"));
        this.dudes = response.results.map(result => ({ ...result, show: false }));
  
        // Fisher–Yates shuffle
        let i = this.dudes.length;
        while (i) { const j = Math.floor(Math.random() * i--); [this.dudes[i], this.dudes[j]] = [this.dudes[j], this.dudes[i]]; }
        this.loading = false;
        this.currentTeamIndex = this.dudes.length - 1;
      },
  
      handleSpinEnd() { this.spinning = false; },
  
      async spinAndReveal() {
        if (this.isBusy || this.currentTeamIndex < 0) return;
        if (this.currentTeamIndex === 0) return; // wheel hidden after #2
  
        const wheel = this.$refs.wheel;
        const fullName = this.dudes[this.currentTeamIndex]?.data?.name?.[0]?.text || "";
        const first = this.firstName(fullName);
  
        if (!wheel || typeof wheel.spinTo !== "function") {
          await this.revealViaInsertOnly(this.currentTeamIndex);
          return;
        }
  
        // 1) Spin to the winner
        await wheel.spinTo(first);
  
        // 2) Start point = pointer tip (viewport coords)
        const from = wheel.getPointerTip();
  
        // 3) Pre-insert hidden seed at the top to reserve layout
        const raw = this.dudes[this.currentTeamIndex];
        const seed = JSON.parse(JSON.stringify(raw));
        seed._key = raw.id || raw.uid || Math.random().toString(36).slice(2);
        seed._seed = true; seed._bubble = false;
        this.revealedTeams.unshift(seed);
        await this.$nextTick();
  
        // 4) Wait for images so the card height is final
        let cardComp = this.$refs.newCard;
        cardComp = Array.isArray(cardComp) ? cardComp[0] : cardComp;
        const cardEl = cardComp && (cardComp.$el || cardComp);
        await this.waitForImages(cardEl, 600);
  
        // 5) Measure landing anchor (exact center of card)
        const anchor = cardEl?.querySelector('.landing-anchor') || cardEl;
        const r = anchor?.getBoundingClientRect?.();
        const to = r ? { x: r.left + r.width/2, y: r.top + r.height/2 } : { x: from.x, y: from.y };
  
        // 6) Fly (mask is up)
        await this.flyToList(from, to, seed);
  
        // 7) Commit
        this.currentTeamIndex--;
      },
  
      async waitForImages(root, timeoutMs = 800) {
        if (!root) return;
        const imgs = Array.from(root.querySelectorAll('img'));
        if (!imgs.length) return;
        const waits = imgs.map(img => img.complete ? Promise.resolve() :
          new Promise(res => img.addEventListener('load', res, { once: true })));
        await Promise.race([Promise.all(waits), new Promise(res => setTimeout(res, timeoutMs))]);
      },
  
      async flyToList(fromPt, toPt, seedObj) {
        // Prepare flyer
        this.flyer.text = this.firstName(seedObj?.data?.name?.[0]?.text || "");
        this.flyer.img  = seedObj?.data?.picture?.url || "";
        this.flyer.from = { ...fromPt };
        this.flyer.to   = { ...toPt };
        this.flyer.show = true;
        this.flyer.animate = false;
        this.flying = true;
        await this.$nextTick();
  
        // Clamp ONLY the start (so chip never starts clipped)
        const chip = this.$refs.flyerChip;
        const chipW = chip?.offsetWidth  || 88;
        const chipH = chip?.offsetHeight || 64;
        const M = 8;
        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const minY = M + chipH/2, maxY = window.innerHeight - M - chipH/2;
        const minX = M + chipW/2, maxX = window.innerWidth  - M - chipW/2;
        this.flyer.from = {
          x: clamp(this.flyer.from.x, minX, maxX),
          y: clamp(this.flyer.from.y, minY, maxY)
        };
  
        await this.$nextTick();
  
        // Animate
        const waitForTransition = () => new Promise((resolve) => {
          const onEnd = (e) => { if (e.target === chip) { chip.removeEventListener('transitionend', onEnd); resolve(); } };
          chip.addEventListener('transitionend', onEnd);
        });
        requestAnimationFrame(() => { this.flyer.animate = true; });
        await waitForTransition();
  
        // Reveal card (bubble from landing point)
        seedObj._seed = false; seedObj._bubble = true;
        await this.$nextTick();
        setTimeout(() => { seedObj._bubble = false; }, 700);
  
        // Reset
        this.flyer.show = false;
        this.flyer.animate = false;
        this.flying = false;
      },
  
      async revealViaInsertOnly(idx) {
        const raw = this.dudes[idx];
        const seed = JSON.parse(JSON.stringify(raw));
        seed._seed = false; seed._bubble = true;
        this.revealedTeams.unshift(seed);
        this.currentTeamIndex--;
        setTimeout(() => { seed._bubble = false; }, 700);
      },
  
      async revealFinal() {
        if (this.isBusy) return;
        if (this.currentTeamIndex === 0) {
          await this.revealViaInsertOnly(this.currentTeamIndex);
          this.currentTeamIndex = -1;
          this.done = true;
          this.firstOverallPulse = false; await this.$nextTick(); this.firstOverallPulse = true;
          this.startCelebration(2200);
        }
      },
  
      startCelebration(ms = 2000) {
        if (this.celebrating) return;
        this.celebrating = true;
  
        this.$nextTick(() => {
          const canvas = this.$refs.confetti;
          const overlay = this.$refs.celebration;
          if (!canvas || !overlay) return;
  
          const ctx = canvas.getContext('2d');
          const DPR = window.devicePixelRatio || 1;
          const resize = () => {
            canvas.width  = Math.floor(window.innerWidth * DPR);
            canvas.height = Math.floor(window.innerHeight * DPR);
            canvas.style.width  = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
          };
          resize();
  
          const colors = ['#ffd54a', '#ffef9a', '#e9b93a', '#f6d24a', '#ffffff'];
          const pieces = [];
          const N = 130;
          for (let i = 0; i < N; i++) {
            pieces.push({
              x: Math.random() * window.innerWidth,
              y: -20 - Math.random() * 200,
              r: 2 + Math.random() * 4,
              w: 6 + Math.random() * 10,
              h: 8 + Math.random() * 14,
              vx: -1 + Math.random() * 2,
              vy: 2 + Math.random() * 3,
              rot: Math.random() * Math.PI,
              vr: (-0.2 + Math.random() * 0.4),
              color: colors[(Math.random() * colors.length) | 0],
              type: Math.random() < 0.35 ? 'circle' : 'rect'
            });
          }
  
          let alive = true;
          const gravity = 0.05, drag = 0.999, tEnd = performance.now() + ms;
  
          const tick = (now) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of pieces) {
              p.vx *= drag; p.vy = (p.vy + gravity) * drag;
              p.x += p.vx; p.y += p.vy; p.rot += p.vr;
              ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
              ctx.fillStyle = p.color;
              if (p.type === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
              else { ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); }
              ctx.restore();
            }
            if (now < tEnd && alive) requestAnimationFrame(tick);
            else { alive = false; overlay.classList.add('celebration-out'); setTimeout(() => { this.celebrating = false; }, 400); }
          };
  
          window.addEventListener('resize', resize, { once: true });
          requestAnimationFrame(tick);
        });
      },
    },
    created() { this.getDudes(); }
  };
  </script>
  
  <style>
  /* base */
  .draft-root { font-family: monaco, monospace; }
  
  /* layout */
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; transition:grid-template-columns 300ms ease; }
  .grid.final { grid-template-columns:1fr; }
  @media (max-width:1100px){ .grid{ grid-template-columns:1fr; } }
  
  /* Left column */
  .left { display:block; }
  .left-center{
    /* centers wheel + button vertically in the card/viewport area */
    min-height: clamp(640px, 78vh, 92vh);
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    gap:12px;
  }
  .controls { width:min(720px,100%); }
  .hint { margin-top:8px; text-align:center; font-size:.9rem; color:#666; }
  
  .right { padding-right:6px; overflow-x:hidden; }
  .section-title { margin:6px 0 12px; font-weight:700; text-align:center; }
  
  /* Sticky centered CTA */
  .final-cta.sticky-top { position:sticky; top:0; z-index:5; padding:8px 0 10px;
    background:linear-gradient(#fff, rgba(255,255,255,.85)); backdrop-filter:blur(4px);
    margin-bottom:8px; text-align:center; }
  .final-cta .reveal-btn.centered { display:inline-block; margin:0 auto; min-width:280px; }
  
  /* list + transitions */
  ul li { list-style:none; padding:10px; }
  .slide-enter-active, .slide-leave-active { transition: transform .5s cubic-bezier(.55,0,.1,1), opacity .5s cubic-bezier(.55,0,.1,1); }
  .slide-enter { opacity:0; transform:translateX(100%); }
  .slide-leave-active { position:absolute; width:100%; }
  .slide-leave-to { transform:translateY(100%); }
  
  /* prevent seed row from being translated by slide-enter */
  .seed-li,
  .seed-li.slide-enter,
  .seed-li.slide-enter-active,
  .seed-li.slide-enter-to {
    transform: none !important;
    opacity: 0 !important;
    transition: none !important;
  }
  
  /* pick cards */
  .reveal-card { position:relative; margin-bottom:10px; transition: transform .16s ease, box-shadow .2s ease, filter .2s ease; }
  .reveal-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.12); }
  .pick { font-size:1.25em }
  .dude-name { font-size:1.25em; padding-left:1.1em }
  .misc-text { padding-left:1.25em }
  
  /* landing anchor at card center */
  .landing-anchor { position:absolute; top:50%; left:50%; width:0; height:0; pointer-events:none; }
  
  /* seed: keep layout intact, no transforms (so center math is stable) */
  .seed-hidden { visibility:hidden; opacity:0; }
  .seed-hidden * { pointer-events:none; }
  .seed-hidden, .seed-hidden .card-body { transition:none !important; }
  
  /* bubble-in */
  .bubble-in { animation: bubble 700ms cubic-bezier(.22,.9,.2,1) 1; }
  @keyframes bubble { 0% { transform:scale(.6); opacity:0; } 60% { transform:scale(1.03); opacity:1; } 100% { transform:scale(1); opacity:1; } }
  
  /* first overall regal glow */
  .first-overall { position:relative; border-radius:16px; border:2px solid transparent !important;
    background: linear-gradient(#fff,#fff) padding-box, linear-gradient(135deg,#f6d24a,#fff1a8,#e9b93a) border-box;
    overflow:hidden; contain:paint; isolation:isolate; }
  .first-overall.first-animate { animation: breath 3.6s ease-in-out infinite;
    box-shadow:0 10px 26px rgba(246,210,74,.28), 0 0 36px rgba(246,210,74,.22); }
  .first-overall.first-animate::before { content:""; position:absolute; inset:0; border-radius:16px; pointer-events:none;
    background: radial-gradient(ellipse at 50% 50%, rgba(246,210,74,.20) 0%, rgba(246,210,74,.10) 45%, rgba(246,210,74,.04) 72%, transparent 85%);
    filter:blur(5px); animation:aura 3.6s ease-in-out infinite; z-index:0; }
  .first-overall.first-animate::after { content:""; position:absolute; inset:0; border-radius:16px; pointer-events:none;
    background: linear-gradient(75deg, rgba(255,255,255,0) 20%, rgba(255,255,255,.65) 35%, rgba(255,255,255,0) 50%);
    transform:translateX(-130%) rotate(.5deg); animation:sheen 4.8s cubic-bezier(.23,.7,.18,.99) infinite; mix-blend-mode:screen; z-index:1; }
  @keyframes breath { 0%{ box-shadow:0 8px 20px rgba(246,210,74,.22),0 0 26px rgba(246,210,74,.16);} 50%{ box-shadow:0 14px 34px rgba(255,223,107,.36),0 0 44px rgba(255,223,107,.30);} 100%{ box-shadow:0 8px 20px rgba(246,210,74,.22),0 0 26px rgba(246,210,74,.16);} }
  @keyframes aura { 0%{opacity:.06;filter:blur(5px);} 50%{opacity:.14;filter:blur(7px);} 100%{opacity:.06;filter:blur(5px);} }
  @keyframes sheen { 0%,15%{transform:translateX(-130%) rotate(.5deg);opacity:0;} 25%{opacity:.9;} 55%,100%{transform:translateX(130%) rotate(.5deg);opacity:0;} }
  
  /* celebration overlay */
  .celebration { position:fixed; inset:0; z-index:9998; pointer-events:none; overflow:hidden; }
  .celebration canvas { position:absolute; inset:0; }
  .celebration-gold-vignette { position:absolute; inset:0; pointer-events:none;
    background: radial-gradient(ellipse at center, rgba(255,220,120,.25) 0%, rgba(255,220,120,.12) 45%, rgba(255,220,120,.06) 65%, rgba(255,220,120,0) 78%),
                radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,.15) 100%);
    animation: vignetteFade 250ms ease-out 1; }
  @keyframes vignetteFade { from{opacity:0} to{opacity:1} }
  .celebration-out { animation: overlayOut 400ms ease-out forwards; }
  @keyframes overlayOut { to { opacity:0; } }
  
  /* flyer overlay */
  .flyer-overlay { position:fixed; inset:0; z-index:9997; pointer-events:none; overflow:hidden; }
  .flyer-mask { position:absolute; inset:0; background:rgba(255,255,255,.82); backdrop-filter:blur(1px); }
  .flyer-chip {
    position:absolute; top:0; left:0;
    transform: translate(var(--x), var(--y)) translate(-50%,-50%);
    transition: transform 900ms cubic-bezier(.21,.94,.26,.99);
    display:flex; align-items:center; gap:12px;
    background:#fff; border-radius:999px; padding:10px 16px;
    box-shadow:0 14px 40px rgba(0,0,0,.18); border:2px solid #e3342f22;
  }
  .flyer-chip img { width:48px; height:48px; border-radius:50%; object-fit:cover; }
  .flyer-chip span { font-weight:800; font-size:20px; letter-spacing:.2px; }
  
  /* buttons steady */
  .reveal-btn { transition:none !important; }
  </style>
  