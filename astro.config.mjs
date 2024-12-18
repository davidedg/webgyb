import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [svelte(), tailwind()],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  })
}); 