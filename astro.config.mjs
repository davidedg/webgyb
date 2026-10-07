import { defineConfig, passthroughImageService } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import { readFileSync } from 'node:fs';

// Version shown in the UI: set APP_VERSION at build time (release tag),
// otherwise fall back to the version in package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const appVersion = process.env.APP_VERSION || pkg.version;

// Production builds bundle every dependency into dist/server, so the server
// runs without node_modules. Dev mode keeps them external: several are
// CommonJS packages that Vite's dev server cannot load as bundled modules.
/** @type {import('astro').AstroIntegration} */
const bundleDependencies = {
  name: 'bundle-dependencies',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command === 'build') {
        updateConfig({ vite: { ssr: { noExternal: true } } });
      }
    }
  }
};

export default defineConfig({
  integrations: [svelte(), bundleDependencies],
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
