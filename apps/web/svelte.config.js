import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Fully static: no server, no SSR at runtime (ADR 0001 §1).
    // `404.html` rather than the ADR's `200.html`: GitHub Pages serves
    // 404.html for unknown paths, so that is what makes the SPA fallback (and
    // deep links into /practice/[exerciseId]) work there.
    adapter: adapter({ fallback: '404.html' }),
    // GitHub Pages serves the app under /piano-trainer/ — the deploy workflow
    // sets BASE_PATH. Always link through `base` from `$app/paths`.
    paths: { base: process.env.BASE_PATH ?? '' },
  },
};

export default config;
