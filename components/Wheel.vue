<template>
    <div class="wheel-wrap" ref="wrap">
      <div class="wheel-stage" :style="{ width: size + 'px', height: size + 'px' }" ref="stage">
        <canvas ref="canvas" />
        <!-- pointer at top — triangle points DOWN -->
        <div class="pointer top"></div>
      </div>
    </div>
  </template>
  
  <script>
  export default {
    name: "Wheel",
    props: {
      items: { type: Array, required: true },      // first names
      size: { type: Number, default: 720 },
      durationMs: { type: Number, default: 2800 },
      minTurns: { type: Number, default: 5 },
      maxTurns: { type: Number, default: 7 },
      font: { type: String, default: "18px monospace" },
    },
    data() {
      return { ctx: null, radius: 0, rotation: 0, spinning: false };
    },
    mounted() {
      const canvas = this.$refs.canvas;
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext("2d");
  
      canvas.style.width  = "100%";
      canvas.style.height = "auto";
      canvas.style.maxWidth = this.size + "px";
      canvas.style.aspectRatio = "1 / 1";
      canvas.width  = Math.floor(this.size * dpr);
      canvas.height = Math.floor(this.size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
      this.ctx = ctx;
      this.radius = (this.size / 2) - 12;
      this.draw();
      this.$emit("ready");
    },
    watch: { items() { this.draw(); } },
    methods: {
      colorAt(i, n) {
        const hue = (i * (360 / Math.max(1, n))) % 360;
        return `hsl(${hue}, 60%, 65%)`;
      },
      draw() {
        if (!this.ctx) return;
        const { ctx, size, radius } = this;
        const n = Math.max(1, this.items.length);
        const arc = (2 * Math.PI) / n;
  
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(this.rotation);
  
        for (let i = 0; i < n; i++) {
          const start = i * arc;
          const end = start + arc;
  
          // slice
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius, start, end, false);
          ctx.closePath();
          ctx.fillStyle = this.colorAt(i, n);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#fff";
          ctx.stroke();
  
          // radial label
          const mid = start + arc / 2;
          ctx.save();
          ctx.rotate(mid);
          ctx.fillStyle = "#222";
          ctx.font = this.font;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelR = radius * 0.72;
          const txt = (this.items[i] ?? "") + "";
          const clipped = txt.length > 18 ? txt.slice(0, 16) + "…" : txt;
          ctx.fillText(clipped, labelR, 0);
          ctx.restore();
        }
  
        // hub
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.1, 0, 2 * Math.PI);
        ctx.fillStyle = "#eee";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#999";
        ctx.stroke();
  
        ctx.restore();
      },
  
      // where the red tip is, for chip animation
      getPointerTip() {
        const r = this.$refs.stage?.getBoundingClientRect?.();
        return r ? { x: r.left + r.width / 2, y: r.top + 26 } : { x: 0, y: 0 };
      },
  
      async spinTo(labelOrIndex = null) {
        if (!this.items.length || this.spinning) return null;
        const n = this.items.length;
        const arc = (2 * Math.PI) / n;
  
        let targetIndex = -1;
        if (typeof labelOrIndex === "number") targetIndex = Math.min(n - 1, Math.max(0, labelOrIndex));
        else if (typeof labelOrIndex === "string") targetIndex = this.items.findIndex(s => (s + "") === labelOrIndex);
        if (targetIndex < 0) targetIndex = Math.floor(Math.random() * n);
  
        const mid = targetIndex * arc + arc / 2;
        const pointerAngle = -Math.PI / 2;                 // triangle points DOWN
        const baseTarget   = pointerAngle - mid;
  
        const cur = this.rotation;
        const minDelta = this.minTurns * 2 * Math.PI;
        const kMin = Math.ceil((cur + minDelta - baseTarget) / (2 * Math.PI));
        const kExtra = (this.maxTurns > this.minTurns) ? Math.floor(Math.random() * 2) : 0;
        const k = Math.max(kMin, 0) + kExtra;
  
        await this.spinToRotation(baseTarget + k * 2 * Math.PI);
  
        const tip = this.getPointerTip();
        const selected = { index: targetIndex, label: this.items[targetIndex], pointer: tip };
        this.$emit("spin-end", selected);
        return selected;
      },
  
      spinToRotation(targetRotation) {
        this.spinning = true;
        this.$emit("spin-start");
  
        const start = this.rotation;
        const delta = targetRotation - start;
        const dur   = this.durationMs;
        const t0    = performance.now();
  
        return new Promise(resolve => {
          const step = (now) => {
            const t = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
            this.rotation = start + delta * eased;
            this.draw();
            if (t < 1) requestAnimationFrame(step);
            else { this.rotation = start + delta; this.draw(); this.spinning = false; resolve(true); }
          };
          requestAnimationFrame(step);
        });
      },
    }
  };
  </script>
  
  <style scoped>
  .wheel-wrap { display:flex; flex-direction:column; align-items:center; gap:12px; }
  .wheel-stage { position:relative; transition: transform .18s ease; }
  .wheel-stage:hover { transform: scale(1.012); cursor: pointer; }
  .wheel-stage canvas { display:block; }
  
  /* POINTER at top — ▼ points DOWN */
  .pointer{
    position:absolute; left:50%; transform:translateX(-50%);
    width:0; height:0; filter:drop-shadow(0 1px 1px rgba(0,0,0,.3));
    transition: transform .18s ease;
  }
  .pointer.top{
    top:-12px;
    border-left:16px solid transparent;
    border-right:16px solid transparent;
    border-top:26px solid #e3342f; /* ▼ */
  }
  .wheel-stage:hover .pointer { transform: translateX(-50%) scale(1.05); }
  </style>
  