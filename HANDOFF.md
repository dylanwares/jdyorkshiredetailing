# Handoff notes — JD Yorkshire Detailing website

Written 2026-10-07 for the next Claude Code session. Read this, then `SPEC.md` (the build spec, kept up to date as decisions changed), then `AGENTS.md`.

## 1. What this is

A mobile-first marketing site for **Jack Daniel's Yorkshire Detailing Company**, a mobile car detailer based in Barnsley that covers South Yorkshire.

- Domain: jdyorkshiredetailingcompany.com
- Repo: github.com/dylanwares/jdyorkshiredetailing (remote `origin` uses SSH; HTTPS has no stored credentials)
- Hosting: Vercel, connected to the repo. Pushes to `main` deploy to production.
- The site's owner (the "client") is non-technical:
  - He edits **prices** in a published Google Sheet.
  - He uploads **gallery photos** to a shared Google Drive folder.
  - He receives **enquiries** by email, with an optional Telegram push.
  - There is no database, login or admin UI.
- The user you're working with (Dylan, GitHub `dylanwares`) is the developer building it for the client.

Stack: Astro 7 (TypeScript strict, static by default with per-page SSR), Tailwind 4 via the Vite plugin, `@astrojs/vercel`, `@astrojs/sitemap`, papaparse, zod 4, resend, sharp. Node ≥ 22.12.

## 2. Status

The spec's build order (SPEC.md §13) has 7 steps. Each step was built on its own `step-N` branch, pushed, reviewed by the user, then merged.

| Step | What | State |
|---|---|---|
| 1 | Scaffold | On `main` |
| 2 | Static pages, design system, hero video | On `main` |
| 3 | Prices from Google Sheet | On `main` (PR #1) |
| 4 | Gallery from Google Drive | On `main` (pushed straight to main at user's request) |
| 5 | Contact form, Resend, Telegram | On `main` (PR #2) |
| 6 | SEO, JSON-LD, OG image, favicons, robots | On `main` (PR #4) |
| 7 | Accessibility/performance pass, README, OWNER_GUIDE.md | **Branch `step-7`, awaiting review.** See the update below |

**Update (2026-10-07, step 7 session):** work has moved to a **Windows** PC (Git Bash + PowerShell, no Python, no ffmpeg, Edge but no Chrome). Node was upgraded there from 20.17 to 24.19 LTS via winget. There is no `.env` on that machine, so it runs on fallbacks only. `src/assets/gallery/` (the 177MB originals) is not on it; that folder is still only on the Mac. Step 7 results: Lighthouse (local dev server, mobile) Accessibility 100 and Best Practices 100 on all four pages; SEO 92 locally only because of the dev toolbar link. Performance still has to be measured on the Vercel preview. Scripted headless-Edge checks at 375px passed: no horizontal scroll, the call bar clears the footer, no console errors, the mobile menu (Esc, outside tap), the lightbox (open, arrows, wrap, Esc, focus return, scroll lock, backdrop) and the contact form (inline errors, focus, redirect, no-JS POST, honeypot). Not checked: real iOS Safari.

## 3. How the user likes to work (important)

- **One step at a time, then stop for review.** At the start the user said: "after each step stop and I will review". Don't run ahead into the next step.
- **Plan before each step.** For steps 4 to 6 the user asked for a plan first, and plan mode was used. For step 5 they asked for alternatives to be laid out so they could choose before any code was written.
- **A new branch per step** (`step-7`), cut from an up-to-date `main`. Commit, push the branch, and report. The user usually merges through a GitHub PR themselves, and sometimes says "push straight to main". Only push to `main` when asked.
- The user sometimes commits or pushes small edits themselves (e.g. they removed the "Send another enquiry" button). Run `git fetch` and check the state before assuming.
- Commit messages end with the attribution trailer given in the session's system reminder.
- **Never print secrets.** To see which env vars are set, print names only, e.g. `grep -E '^[A-Z_]+=' .env | sed -E 's/=.+/=<set>/'`. Ask before sending real emails or messages through the user's accounts.
- Explain what you couldn't verify. The user tests in a browser. Most of my checks were `curl` and HTML-level checks, with no headless browser.

## 4. Local development gotchas

- **The user's dev server** runs in the background on port 4321 (`npx astro dev --background`; manage it with `npx astro dev status|stop|logs`). `astro` isn't on PATH, so use `npx astro`.
- **Astro reads `.env` only at startup.** After any `.env` change, restart the dev server. An enquiry "not sending" turned out to be exactly this.
- **For your own testing,** don't touch the user's server. Run a second one: `npx astro dev --port 4399 --ignore-lock`, and stop it afterwards with `pkill -f "astro dev --port 4399"`. You can override env vars per run, e.g. `PRICES_CSV_URL=http://localhost:8765/x.csv npx astro dev ...`.
- **Shell:** on the Mac it was zsh (no word-splitting of unquoted variables; use arrays). On Windows, use Git Bash or PowerShell; there is no `pkill`, so stop background servers through the tool that started them.
- **Astro's built-in `checkOrigin`** rejects form POSTs without a matching `Origin` header. Add `-H "Origin: http://localhost:4399"` when testing `/api/contact` with curl.
- **`trailingSlash: 'never'`:** in dev, `/prices/` returns 404. In production, Vercel's generated config 308-redirects `/prices/` to `/prices`. Check `.vercel/output/config.json` after a build to confirm.
- **ffmpeg is not installed.** The temporary ffmpeg-static copy from an earlier session is gone. `scripts/compress-hero-videos.sh` needs `FFMPEG=/path/to/ffmpeg` (or `brew install ffmpeg`, but Homebrew isn't installed either). sharp, which is installed, handles all image work.
- `npm run build` runs `astro check` first. It must pass with 0 errors.

## 5. Architecture map

```
src/data/site.ts            Business details (name, phone, email, hours, area, Instagram). PLACEHOLDERS — see §7
src/data/prices.fallback.json  Bundled prices used if the sheet fails (same shape as getPrices() output)
src/lib/cache.ts            In-memory TTL cache with getStale() for serve-stale-on-error
src/lib/prices.ts           getPrices(): published-sheet CSV → papaparse → zod rows → grouped by category, sorted by order.
                            10 min cache, 1 min retry after failure, last-good → fallback JSON
src/lib/gallery.ts          getGalleryImages(): Drive API files.list (JPEG/PNG/WebP, newest first), 30 min cache,
                            fallback = src/assets/gallery-fallback/*.jpg via import.meta.glob
src/pages/api/gallery/[id].ts  Image proxy: only IDs in the current listing; fetches Drive's thumbnailLink at =s{w}
                            (fast, ~0.5s), falls back to alt=media original; sharp → WebP; widths 480/960/1600;
                            long cache headers. The API key never reaches the browser
src/lib/validation.ts       zod enquiry schema (UK phone/postcode, length limits, newline stripping)
src/lib/notify.ts           notifyEnquiry(): Resend email + Telegram sendMessage in parallel; delivered if ≥1 succeeds;
                            dev with no channels → logs to terminal; prod with no channels → fails
src/lib/turnstile.ts        Optional Cloudflare Turnstile verification (only when TURNSTILE_SECRET_KEY is set)
src/lib/rate-limit.ts       In-memory per-IP limiter (5 valid submissions / 10 min; invalid ones don't count)
src/pages/api/contact.ts    POST handler: origin check → size → honeypot (`website`) → zod → rate limit → Turnstile
                            (if enabled) → notify. JSON for fetch, 303 redirect to /contact?sent=1 or ?error=… otherwise
src/lib/schema.ts           JSON-LD builders: businessSchema() (AutoWash), offerCatalog(), priceRange()
src/components/             Header (sticky + mobile menu + fixed mobile call bar), Footer, PageHeader, CTA,
                            PriceTable, GalleryGrid, Lightbox (<dialog>), ContactForm, JsonLd, Placeholder
src/layouts/BaseLayout.astro  Head: title "<title> | JD Yorkshire Detailing", description, canonical (no trailing slash),
                            OG/Twitter tags, favicons, `noindex` prop, `<slot name="head">` for JSON-LD
src/pages/                  index (SSR: gallery preview + JSON-LD), prices (SSR), our-work (SSR), contact (SSR),
                            404 (static, noindex), robots.txt.ts
scripts/make-brand-images.mjs  Regenerates public/og-image.jpg, favicon.ico, icon-192/512, apple-touch-icon from the logo
scripts/compress-hero-videos.sh  Re-encodes assets/hero bg*.mp4 → public/videos/hero-N(.mobile).mp4 + poster
public/videos/              hero-1..4.mp4 (~1.9MB, 1080p), hero-1..4-mobile.mp4 (~1MB, 720p), hero-poster.jpg
prices.csv.example          The exact sheet format: category,service,description,price,active,order
```

SSR pages send `Cache-Control: s-maxage=…, stale-while-revalidate=3600` (prices and contact 600s, home and our-work 1800s).

**Home hero** (`src/pages/index.astro` inline script):
- It cycles through the 4 clips with a 1s fade, preloading the next clip as a blob.
- It uses the mobile files below 768px.
- It shows only the poster for reduced-motion visitors, and loops the first clip only on save-data or 2g/3g connections.
- On mobile the video fills the top 55% of the hero and fades into the page.
- On scroll it moves at 40% of scroll speed (parallax) and fades out by about 85% of the hero height.
- The user signed all of this off. Don't change it without asking.

## 6. Decisions made (and why). Don't re-open without the user

- **Gallery source is Google Drive, not Behold/Instagram.** The client uploads to a folder shared "anyone with link can view". Every JPEG/PNG/WebP is shown, newest first by `createdTime`. There's no hashtag filter. HEIC is excluded because sharp can't decode it, so iPhone users must upload JPEG ("Most Compatible").
- **Prices: a single `price` column** instead of small/medium/large. A blank price shows **"Contact for quote"**. Prices show exactly as in the sheet (`£35`), never "From £35". The sheet is read through "Publish to web → CSV", with no API key.
- **Contact delivery: Resend email (main) plus a Telegram bot push (extra).** The user chose these over SMS, Apps Script, form services, WhatsApp-only and a database.
- **Turnstile is optional and currently off,** by the user's choice. Spam protection is the honeypot plus the rate limit. Turnstile switches on just by setting both keys.
- The "Send another enquiry" button was removed by the user to reduce spam.
- **Gallery fallback** is 12 resized copies (~4.5MB) in `src/assets/gallery-fallback/`. Bundling the user's 177MB of originals made a 189MB deployment, so they're excluded.
- **Brand:** colour `#3BB3F9` on a dark base (`ink #0a0e14`), Space Grotesk headings and Inter body text. The logo was cleaned to a transparent PNG (`src/assets/logo.png`, `logo-mark.png`). A vector logo would be better eventually.

## 7. Environment variables

Declared in `astro.config.mjs` → `env.schema`, all optional so the site builds with none. `.env.example` documents how to get each one.

| Var | Local `.env` (2026-10-07) | Notes |
|---|---|---|
| `PRICES_CSV_URL` | set (real sheet) | |
| `GOOGLE_DRIVE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | set (real folder) | |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | set | The user confirmed a real enquiry email arrived |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | not present | Code is written; the user will set up the bot later. Real-world send untested (only a fake-token 401 was tested) |
| `TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET_KEY` | empty | Off by choice |
| `BEHOLD_FEED_URL`, `GALLERY_HASHTAG` | empty | Obsolete leftovers in the user's `.env`. Safe for them to delete |

I don't know what is set in **Vercel**. Remind the user that every variable above must also be added there.

**Placeholders that must be real before launch.** They're in `src/data/site.ts` and repeated in the JSON-LD, which Google may show:
- phone `07000 000000` / `tel:+447000000000`
- email `hello@jdyorkshiredetailingcompany.com`
- hours `Mon–Sat, 8am–6pm` and the matching `openingHours`
- the `areaServed` towns (Barnsley, Sheffield, Rotherham, Doncaster), which were my guess

The home page reviews are placeholders ("Customer review placeholder"). The services cards on the home page use `Placeholder` tiles instead of photos.

## 8. Next steps

1. **Merge `step-6`** once the user approves it. Then check, on the deployed site: Google Rich Results Test, an OG preview (e.g. opengraph.xyz), the `/prices/` → `/prices` 308, and that preview deployments send `X-Robots-Tag: noindex`.
2. **Step 7 (plan it first, then stop for review afterwards):**
   - **Lighthouse ≥ 95 on mobile** for Performance, Accessibility, Best Practices and SEO (SPEC.md §8, §12). Likely areas:
     - LCP and weight of the hero video and poster.
     - Font loading (Fontsource variable fonts are imported in `global.css`).
     - Gallery image sizes and `sizes` attributes.
     - Colour contrast of muted text and of red error text on dark backgrounds.
     - Tap targets.
     - The lightbox `<dialog>` focus handling.
   - No Lighthouse run has been done yet.
   - **Browser checks that were never done:** the lightbox (open, previous/next, Esc, focus return, scroll lock), the contact form's fetch path with inline errors, and every page at 375px. The user has viewed pages, but there's no systematic pass.
   - **README.md** with setup and deploy steps: env vars, Vercel, `make-brand-images`, the video script.
   - **OWNER_GUIDE.md** (SPEC.md §11), one page in plain English for the client:
     - Editing prices: don't change the header row or the tab name `Prices`. `active` FALSE hides a row, and a blank price shows "Contact for quote". Changes show up in about 10 to 25 minutes, because of Google's publish lag plus the 10-minute server cache plus the edge cache.
     - Adding photos to Drive: JPEG not HEIC. They appear in about 30 minutes, and deleting from the folder removes them.
     - Where enquiries arrive (email, Telegram), and what to do if they stop.
     - Who to contact.
   - **The after-launch checklist** from SPEC.md §9: Search Console with the sitemap, a Google Business Profile, and the Rich Results Test.
3. **Optional ideas offered but not taken up:**
   - A protected price-refresh link (`/prices?refresh=<secret>`) to bust the caches.
   - A thousands separator for prices (shows `£1120`).
   - A two-video crossfade with no dark dip between hero clips.

## 9. Loose ends and risks

- **`src/assets/gallery/`** holds 39 original client photos (177MB). They're **untracked and not gitignored**. Never `git add -A` or `git add .` here; add paths explicitly. I asked the user whether to gitignore the folder and got no answer yet. Raise it again.
- `assets/hero bg.mp4` (5MB original) was committed in step 1. The other source clips and the 118MB GIF are gitignored.
- **Caches are per serverless instance.** The price, gallery and rate-limit state is in memory, so on Vercel each instance has its own copy. That's acceptable for this site, and the edge `s-maxage` does most of the work.
- **The image route** relies on Drive `thumbnailLink` URLs, which are unofficial and expire. That's why the listing refreshes every 30 minutes and the route falls back to the original. If gallery images ever 502, look here first.
- `npm install` reports audit warnings that were already there. Nothing has been looked into.
- Spec acceptance criteria (SPEC.md §12):
  - **Verified locally:** the prices behaviours, the gallery fallback, ignoring non-images, no key leak, the honeypot, a real Resend email, and the build passing.
  - **Not yet verified:** the 375px pass, Lighthouse, and the timing behaviour on Vercel.
