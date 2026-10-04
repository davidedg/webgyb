import { defineConfig, passthroughImageService } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import { readFileSync } from 'node:fs';

// Version shown in the UI: set APP_VERSION at build time (release tag),
// otherwise fall back to the version in package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const appVersion = process.env.APP_VERSION || pkg.version;

export default defineConfig({
  integrations: [svelte()],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion)
    }
  },
  // The app does not use astro:assets: avoid server-side image processing (sharp)
  image: {
    service: passthroughImageService()
  },
  security: {
    checkOrigin: true
  }
});
