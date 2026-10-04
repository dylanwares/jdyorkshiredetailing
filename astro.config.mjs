// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://jdyorkshiredetailingcompany.com',
  // One URL form everywhere (/prices, not /prices/): canonicals, links and sitemap agree.
  trailingSlash: 'never',

  // Pages are static by default; pages that use live data (prices, gallery)
  // opt out with `export const prerender = false`.
  output: 'static',
  adapter: vercel(),

  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],

  // Server-only settings. All optional so the site builds and runs with no env vars set.
  env: {
    schema: {
      PRICES_CSV_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_DRIVE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_DRIVE_FOLDER_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TELEGRAM_BOT_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      TELEGRAM_CHAT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Public: the Turnstile widget needs the site key in the browser.
      TURNSTILE_SITE_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
