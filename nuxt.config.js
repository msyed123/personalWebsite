import pkg from './package'

export default {
  /*
  ** Headers of the page
  */
  head: {
    title: "Mamoon Syed",
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: pkg.description }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  /*
  ** Customize the progress-bar color
  */
  loading: { color: '#fff' },

  /*
  ** Global CSS
  */
  css: [
  ],

  /*
  ** Plugins to load before mounting the App
  */
  plugins: [
    '~/plugins/bootstrap-vue',
    '~/plugins/prismic-vue',
    {src: '~/plugins/vue-navigation-bar', mode: "client"},
  ],

  /*
  ** Nuxt.js modules
  */
  modules: [
    '@nuxtjs/pwa',
    [
      'nuxt-fontawesome', {
        imports: [
         {
           set: '@fortawesome/free-solid-svg-icons',
           icons: ['fas']
         },
         {
           set:'@fortawesome/free-brands-svg-icons',
           icons: ['fab']
         }
       ]
      }
    ]
  ],

  router:{
  },
  
  env:{
    PRISMIC_ENDPOINT: process.env.PRISMIC_ENPOINT || "https://msyed.cdn.prismic.io/api/v2",
    PRISMIC_TOKEN: process.env.PRISMIC_TOKEN || "null",
  },

  /*
  ** Build configuration
  */
  build: {
    /*
    ** You can extend webpack config here
    */
    extend(config, ctx) {
    }
  }
}
