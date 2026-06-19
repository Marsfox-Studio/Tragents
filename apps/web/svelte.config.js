import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
    alias: {
      '@tragents/shared': '../../packages/shared/src/index.ts',
      '@tragents/core': '../../packages/core/src/index.ts',
      '@tragents/ui': '../../packages/ui/src/index.ts',
    },
  },
};

export default config;
