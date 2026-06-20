import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const defaultBase =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName && !repositoryName.endsWith('.github.io')
    ? `/${repositoryName}`
    : '';
const base = process.env.PUBLIC_BASE_PATH ?? defaultBase;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    paths: {
      base,
    },
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
