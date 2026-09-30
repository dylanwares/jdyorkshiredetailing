// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://jdyorkshiredetailingcompany.com',

  // Pages are static by default; pages that use live data (prices, gallery)
  // opt out with `export const prerender = false`.
  output: 'static',
  adapter: vercel(),

  integrations: [sitemap()],

  // Server-only settings. All optional so the site builds and runs with no env vars set.
  env: {
    schema: {
      PRICES_CSV_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },

  image: {
    // Allow Astro <Image /> to optimise remote gallery images from Behold / Instagram.
    remotePatterns: [
      { protocol: 'https', hostname: 'behold.pictures' },
      { protocol: 'https', hostname: '**.behold.pictures' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
    ],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
