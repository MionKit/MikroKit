export default defineNuxtConfig({
    // https://github.com/nuxt-themes/docus
    extends: '@nuxt-themes/docus',

    css: ['~/assets/css/mion.css'],

    app: {
        // baseURL: '/mion/', // working with github pages mionkit.github.io/mion/ - Remove when using mion.io
        buildAssetsDir: '_assets', // don't use "_" at the begining of the folder name to avoids nojkill conflict
    },

    modules: [
        // https://github.com/nuxt-modules/plausible
        '@nuxtjs/plausible',
        // https://github.com/nuxt/devtools
        '@nuxt/devtools',
    ],
});
