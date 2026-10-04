import { defineConfig, passthroughImageService } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [svelte()],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [tailwindcss()]
  },
  // The app does not use astro:assets: avoid server-side image processing (sharp)
  image: {
    service: passthroughImageService()
  },
  security: {
    checkOrigin: true
  }
});
