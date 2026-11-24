<template>
  <div class="wheel-stage" :style="{ '--wheel-size': size + 'px' }" ref="stage">
    <canvas ref="canvas" role="img" :aria-label="'Draw wheel: ' + items.join(', ')" />
    <span class="wheel-pointer" aria-hidden="true"></span>
    <span class="wheel-hub" aria-hidden="true"></span>
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
      font: { type: String, default: 'bold 24px "JetBrains Mono", monospace' },
    },
    data() {
      return { ctx: null, radius: 0, rotation: 0, spinning: false };
    },
    mounted() {
      const canvas = this.$refs.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
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
        // Restrained terminal palette; alternate values to keep adjacent
        // segments distinct, including the seam with an odd roster.
        if (n % 2 && i === n - 1) return "#173142";
        return i % 2 ? "#142630" : "#30200d";
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
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius - 13, start, end);
          ctx.closePath();
          ctx.fillStyle = this.colorAt(i, n);
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#69502c";
          ctx.stroke();

          const mid = start + arc / 2;
          ctx.save();
          ctx.rotate(mid);
          ctx.fillStyle = i % 2 ? "#bcf3ff" : "#ffdc9c";
          ctx.font = this.font;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const txt = String(this.items[i] ?? "");
          const clipped = txt.length > 15 ? txt.slice(0, 13) + "…" : txt;
          const labelX = radius * (Math.cos(mid + this.rotation) < 0 ? -0.64 : 0.64);
          if (labelX < 0) ctx.rotate(Math.PI);
          ctx.fillText(clipped, labelX, 0, radius * 0.55);
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "#ad7b37";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.17, 0, 2 * Math.PI);
        ctx.fillStyle = "#0a0a0a";
        ctx.fill();
        ctx.strokeStyle = "#00d2ff";
        ctx.stroke();
        ctx.restore();
      },
      // Tip at the top of the wheel
      getPointerTip() {
        const r = this.$refs.stage?.getBoundingClientRect?.();
        return r ? { x: r.left + r.width / 2, y: r.top + 20 } : { x: 0, y: 0 };
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
        const dur = matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 150 : this.durationMs;
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
.wheel-stage { position: relative; width: min(100%, var(--wheel-size), 22.5rem, 48svh); aspect-ratio: 1; margin-inline: auto; }
.wheel-stage canvas { display: block; }
.wheel-pointer {
  position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: 1.25rem; height: .9rem; clip-path: polygon(0 0,100% 0,50% 100%);
  background: #ffb000;
}
.wheel-hub {
  position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%);
  width: .75rem; height: .75rem; border: 1px solid #00d2ff; background: #12323b;
  rotate: 45deg;
}
</style>
