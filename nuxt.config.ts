// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  nitro: {
    preset: 'node-server'
  },
  experimental: {
    asyncContext: true
  },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/prismic'
  ],
  prismic: {
    endpoint: process.env.PRISMIC_ENDPOINT || "msyed",
    clientConfig: {
      accessToken: process.env.PRISMIC_TOKEN
    }
  },
  tailwindcss: {
    config: {
      content: [
        "./components/**/*.{js,vue,ts}",
        "./layouts/**/*.vue",
        "./pages/**/*.vue",
        "./plugins/**/*.{js,ts}",
        "./app.vue",
        "./error.vue"
      ],
      theme: {
        extend: {
          colors: {
            'terminal-black': '#0a0a0a',
            'terminal-amber': '#ffb000',
            'terminal-amber-dim': '#b37700',
            'terminal-blue': '#00d2ff',
          },
          fontFamily: {
            'mono': ['"Fira Code"', '"Courier New"', 'Courier', 'monospace'],
          },
          animation: {
            'blink': 'blink 1s step-end infinite',
            'scanline': 'scanline 14s linear infinite',
          },
          keyframes: {
            blink: {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0 },
            },
            scanline: {
              '0%, 85%': { transform: 'translateY(-100%)', opacity: 0 },
              '86%': { transform: 'translateY(-100%)', opacity: 0.08 },
              '95%': { transform: 'translateY(100vh)', opacity: 0.08 },
              '96%, 100%': { transform: 'translateY(100vh)', opacity: 0 }
            }
          }
        }
      }
    }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Mamoon Syed',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  }
})
