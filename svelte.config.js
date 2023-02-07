import preprocess from 'svelte-preprocess'
import adapter from '@sveltejs/adapter-static'
import pkg from './package.json' assert { type: "json" }

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: preprocess({
    postcss: true,
  }),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    paths: {
      base: process.env.NODE_ENV === 'production'
        ? `/${pkg.name}`
        : '',
    },
  },
}

export default config
