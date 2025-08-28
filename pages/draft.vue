<template>
    <section
      ref="shell"
      class="draft-shell"
      :style="shellStyle"
    >
      <b-card
        header="AIB Draft"
        class="draft-card"
      >
        <Draft />
      </b-card>
    </section>
  </template>
  
  <script>
  import Draft from '~/components/Draft.vue'
  
  export default {
    components: { Draft },
    data() {
      return {
        padY: 16,           // vertical gap around the card (visible at bottom)
        padX: 20,           // side gutters
        availHeight: 0      // computed usable height for the card
      }
    },
    computed: {
      shellStyle() {
        return {
          '--pad-y': this.padY + 'px',
          '--pad-x': this.padX + 'px',
          '--avail-h': this.availHeight + 'px'
        }
      }
    },
    mounted() {
      this.measure()
      window.addEventListener('resize', this.measure)
      window.addEventListener('orientationchange', this.measure)
    },
    beforeDestroy() {
      window.removeEventListener('resize', this.measure)
      window.removeEventListener('orientationchange', this.measure)
    },
    methods: {
      measure() {
        this.$nextTick(() => {
          const el = this.$refs.shell
          if (!el) return
          // distance from top of viewport to top of the shell
          const top = el.getBoundingClientRect().top
          // window height minus everything above plus desired padding
          const h = window.innerHeight - top - (this.padY * 2)
          this.availHeight = Math.max(0, Math.floor(h))
        })
      }
    }
  }
  </script>
  
  <style scoped>
  /* Removed global html/body overflow hidden to restore site scroll */
  
  /* Shell: padding included in height so bottom gap is always visible */
  .draft-shell {
    padding: var(--pad-y) var(--pad-x);
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: stretch;
    background: #fff;
  }
  
  /* Card fills the measured space exactly; header auto, body flexes */
  .draft-card {
    width: 100%;
    max-width: 1800px;                 /* remove if you want true edge-to-edge */
    height: var(--avail-h);
    margin: 0;
    display: grid;
    grid-template-rows: auto 1fr;      /* header’s natural height + body remainder */
    overflow: hidden;                   /* card never overflows viewport */
    border-radius: 12px;
  }
  
  /* Only the body can scroll, and only when content exceeds available space */
  .draft-card .card-body {
    min-height: 0;                      /* crucial for grid children */
    overflow: auto;                     /* inner scroll when necessary */
    -webkit-overflow-scrolling: touch;
    padding: 24px;                      /* comfortable padding around the wheel */
    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
  }
  
  /* Clamp inner Draft layout to the card body, so no premature scrollbars */
  .draft-card .card-body .draft-root,
  .draft-card .card-body .draft-root .grid {
    height: 100% !important;
    min-height: 0 !important;
  }
  .draft-card .card-body .right {
    max-height: none !important;
    overflow: visible !important;
  }
  
  /* Remove hover reactivity from wheel + reveal buttons on this page only */
  .draft-card .card-body .wheel-stage,
  .draft-card .card-body .pointer { transition: none !important; }
  .draft-card .card-body .wheel-stage:hover { transform: none !important; cursor: default !important; }
  .draft-card .card-body .btn.btn-danger:hover,
  .draft-card .card-body .btn.btn-warning:hover {
    transform: none !important;
    box-shadow: none !important;
    filter: none !important;
  }
  
  /* Tidy defaults */
  h1, p { margin: 0; font-family: monaco, monospace; }
  </style>
  
