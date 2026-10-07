# JD Yorkshire Detailing — website

Marketing site for Jack Daniel’s Yorkshire Detailing Company, a mobile car detailer in Barnsley covering South Yorkshire. Live at [jdyorkshiredetailingcompany.com](https://jdyorkshiredetailingcompany.com).

The owner updates the site without logging in anywhere:

- **Prices** come from a published Google Sheet.
- **Gallery photos** come from a shared Google Drive folder.
- **Enquiries** from the contact form arrive by email (Resend), with an optional Telegram push.

There is no database, no login and no admin UI. The plain-English guide for the owner is [OWNER_GUIDE.md](OWNER_GUIDE.md). The full build spec is [SPEC.md](SPEC.md).

## Stack

- Astro 7, TypeScript strict. Pages are static by default. Pages that use live data (home, prices, our-work, contact) are server-rendered.
- Tailwind CSS 4 via the Vite plugin.
- Fonts are self-hosted Fontsource variable fonts: Space Grotesk and Inter.
- Hosted on Vercel through `@astrojs/vercel`. The sitemap comes from `@astrojs/sitemap`.
- Other libraries: papaparse (price CSV), zod (validation), resend (email), sharp (image resizing).

## Getting started

You need **Node 22.12 or newer**, because Astro 7 won't run on Node 20.

```sh
npm ci
cp .env.example .env    # optional: every variable has a fallback
npm run dev             # http://localhost:4321
```

The site works with **no env vars set**:
- Prices come from `src/data/prices.fallback.json`.
- The gallery uses the photos in `src/assets/gallery-fallback/`.
- In development, enquiries are printed to the terminal instead of being sent.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server. `npx astro dev --background` runs it in the background; then use `npx astro dev status\|logs\|stop`. |
| `npm run build` | Runs `astro check` (must report 0 errors), then builds for Vercel into `.vercel/output`. |
| `npm run check` | Type-checks only. |

Astro reads `.env` only at startup, so **restart the dev server after changing it**.

## Environment variables

They're all declared in `astro.config.mjs` (`env.schema`) and all optional. [.env.example](.env.example) explains how to get each one.

| Variable | Used for |
|---|---|
| `PRICES_CSV_URL` | The Google Sheet `Prices` tab, published to the web as CSV (*File → Share → Publish to web*). [prices.csv.example](prices.csv.example) shows the columns. |
| `GOOGLE_DRIVE_KEY` | A Google Cloud API key with the Drive API enabled. Used server-side only. |
| `GOOGLE_DRIVE_FOLDER_ID` | The ID of the gallery folder, which is shared as "anyone with the link can view". |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | Email delivery of enquiries. The sender must be on the domain verified in Resend. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional instant push to the owner's phone. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional Cloudflare Turnstile. Set both keys to turn it on. With neither set, spam protection is the honeypot plus a rate limit. |

An enquiry counts as delivered if at least one channel (email or Telegram) succeeds. In production with no channel configured, the form shows an error rather than pretending it sent.

## Deploying

The repo is connected to Vercel:
- A push to **`main` deploys to production**.
- Any other branch gets a preview URL. Vercel should send `X-Robots-Tag: noindex` on previews so search engines don't index them. That hasn't been checked yet.

**Every variable above also has to be added in Vercel** (Project → Settings → Environment Variables). A local `.env` isn't deployed.

After a production deploy, check:

- `/prices/` redirects (308) to `/prices`. This comes from `trailingSlash: 'never'`.
- The JSON-LD passes [Google's Rich Results Test](https://search.google.com/test/rich-results).
- The social preview looks right, e.g. on [opengraph.xyz](https://www.opengraph.xyz).

## How it works

```
src/data/site.ts              Business details: name, phone, email, hours, towns covered. Also used in the JSON-LD
src/lib/prices.ts             getPrices(): sheet CSV → papaparse → zod → grouped by category.
                              10-minute cache; on failure serves the last good copy, then the fallback JSON
src/lib/gallery.ts            getGalleryImages(): Drive files.list (JPEG/PNG/WebP, newest first).
                              30-minute cache; fallback photos in src/assets/gallery-fallback/
src/pages/api/gallery/[id].ts Image proxy: resizes Drive photos to WebP at 480/960/1600px.
                              Serves only IDs in the current listing; the API key never reaches the browser
src/pages/api/contact.ts      Enquiry POST: origin check → honeypot → zod → rate limit → Turnstile (if on) → notify
src/lib/notify.ts             Resend email and Telegram message, sent in parallel
src/lib/schema.ts             LocalBusiness (AutoWash) and OfferCatalog JSON-LD
src/layouts/BaseLayout.astro  <head>: title, description, canonical, Open Graph and Twitter tags, favicons
```

The server-rendered pages set `Cache-Control: s-maxage=…, stale-while-revalidate=3600`, so Vercel's edge serves most requests:
- Prices and contact: 600s.
- Home and our-work: 1800s.

The in-memory caches and the rate limiter are per serverless instance. That's acceptable at this site's traffic.

The Drive image route relies on Drive's `thumbnailLink` URLs, which are fast but undocumented and expire. If gallery images start failing, look there first. The route falls back to the original file.

## Scripts

- **`node scripts/make-brand-images.mjs`** regenerates the following from `src/assets/logo.png`, `logo-mark.png` and the hero poster:
  - `public/og-image.jpg` (1200×630)
  - `favicon.ico`
  - `icon-192.png` and `icon-512.png`
  - `apple-touch-icon.png`

  Re-run it after changing the logo.
- **`scripts/compress-hero-videos.sh [desktop_MB] [mobile_MB]`** re-encodes the source clips (`assets/hero bg*.mp4`) into the following:
  - `public/videos/hero-N.mp4` (1080p, about 2MB)
  - `public/videos/hero-N-mobile.mp4` (720p, about 1MB)
  - The poster image

  It needs bash and ffmpeg. Point it at ffmpeg with `FFMPEG=/path/to/ffmpeg` if ffmpeg isn't on your PATH. Only the first source clip is in git; the others are gitignored.

## Notes

- Don't commit original client photos. They're 4–6MB each. The 12 resized copies in `src/assets/gallery-fallback/` are what ships with the site.
- To test the contact API with curl, send an `Origin` header that matches the server, e.g. `-H "Origin: http://localhost:4321"`. Without it, Astro's `checkOrigin` rejects the POST.
- In dev, `/prices/` with a trailing slash returns 404. Only the production build redirects it.
