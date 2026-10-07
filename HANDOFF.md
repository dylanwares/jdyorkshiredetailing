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
| 7 | Accessibility/performance pass, README, OWNER_GUIDE.md | On `main` (merged 2026-10-07). See the update below |
| 9 | Before/after slider on the home page | On `main` (PR #5). Tested against a real Drive pair (volvo-before/after) |
| 11a | Reviews: legacy reviews stored on the site (`/reviews` and 3 on home) | **Branch `step-11`, awaiting review.** Google reviews still to do, see §8 |

**Update (2026-10-07, step 7 session):** work has moved to a **Windows** PC (Git Bash + PowerShell, no Python, no ffmpeg, Edge but no Chrome). Node was upgraded there from 20.17 to 24.19 LTS via winget. There is no `.env` on that machine, so it runs on fallbacks only. `src/assets/gallery/` (the 177MB originals) is not on it; that folder is still only on the Mac. Step 7 results: Lighthouse (local dev server, mobile) Accessibility 100 and Best Practices 100 on all four pages; SEO 92 locally only because of the dev toolbar link. Performance still has to be measured on the Vercel preview. Scripted headless-Edge checks at 375px passed: no horizontal scroll, the call bar clears the footer, no console errors, the mobile menu (Esc, outside tap), the lightbox (open, arrows, wrap, Esc, focus return, scroll lock, backdrop) and the contact form (inline errors, focus, redirect, no-JS POST, honeypot). Not checked: real iOS Safari.

**Domain:** `jdyorkshiredetailingcompany.com` still serves the client's current site (Express behind Cloudflare). That is intentional: this site is not finished, and the DNS is only switched at step 14. Until then this site is live at `jdyorkshiredetailing.vercel.app`. Lighthouse mobile baseline there before step 7 (Perf/A11y/Best Practices/SEO): Home 98/100/96/100, Prices 100/100/96/100, Our Work **90**/100/96/100, Contact 100/100/96/100. Step 7 fixed the 96s (low-res header logo) and cut Our Work's image weight (LCP was 3.3s). After-scores still need measuring on the deployed site: preview deployments sit behind Vercel Deployment Protection, so Lighthouse can't reach them.

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
src/lib/before-after.ts     getBeforeAfterPairs(): photos in the "Before and After" subfolder of the Drive folder, paired by name
                            (`x-before` / `x-after`, logic in src/lib/pairing.ts). Unpaired photos are never shown. 30 min cache
src/components/BeforeAfter.astro  The slider (clipped before image; pointer-event dragging plus a hidden range input for a11y). Touch-fix history: a native range with a 1px thumb could not be grabbed on real phones. Used on the home page only
src/pages/api/gallery/[id].ts  Image proxy: only IDs in the current listing or in a complete before/after pair; fetches Drive's thumbnailLink at =s{w}
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
src/data/reviews.json       The client's 29 reviews from his old site (28 published; one is flagged `"published": false` because the old
                            export marked it "no"). src/lib/reviews.ts getReviews() is the single seam for adding Google reviews later
src/pages/                  index (SSR: gallery preview + JSON-LD), reviews (static), prices (SSR), our-work (SSR), contact (SSR),
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

The home page reviews are now real (see §8, step 11). The services cards on the home page still use `Placeholder` tiles instead of photos.

## 8. Next steps

Step 7 is merged. What's left before launch, in order. Each step gets its own `step-N` branch and a stop for review. The user asked for a before/after slider on the home page, so it is planned as step 9.

1. **Step 8: close out step 7.** Re-run Lighthouse (mobile) on `jdyorkshiredetailing.vercel.app` once the merge has deployed. The step 7 baseline is in the status section above. Target ≥ 95 in all four categories on all four pages. Our Work was the weak one (90), so check it first. Copy the user's `.env` to this machine if live data is needed. Gitignore `src/assets/gallery/` on the Mac.
2. **Step 9: before/after slider** (built on `step-9`, awaiting review; see `SPEC.md` §5b).
   - The client makes a "Before and After" subfolder in the Drive folder (**not created yet** when this was built, so the section is hidden on the live site until it exists) and uploads `<name>-before` / `<name>-after` pairs. Unpaired photos are not shown. The latest 4 pairs show on the home page, below the gallery preview.
   - Tested in headless Edge at 375px and desktop with stand-in photos: tap and drag at any height, touch drag, keyboard, focus ring, aria values, page still scrolls with a vertical swipe. The Drive lookup (folder and image queries) was checked against the real API and returns the expected empty result. **Not tested against a real pair in Drive**, so do that once the folder exists (tick the new §12 item).
   - Decision: **no bundled fallback pair.** A made-up pair would be misleading, so with no pairs the section is simply left out.
3. **Step 10: privacy and legal.** A `/privacy` page (the contact form collects name, phone and postcode), linked from the footer and the form. Company name and number in the footer if the business is a limited company. Analytics are optional (Vercel Web Analytics needs no cookie banner).
4. **Step 11: real content and reviews.**
   - **Done on `step-11`:** the old reviews are stored in `src/data/reviews.json` and shown on the home page (3) and `/reviews` (all). Kept verbatim (including typos and emoji), names capitalised consistently. Reviewers' full names are shown as supplied. Ask the client if he'd rather shorten to first name plus initial. One review ("A Fermie", Oct 2026, exported with "no" in the first column, which looks like "not approved") is hidden pending the client's OK. Lisa & Martin's review contains an odd "A⭐️⭐️⭐️" line, left as written.
   - **Decided, not built: Google reviews through the Places API,** merged above the legacy ones in `getReviews()`. Needs the Google Business Profile to exist first (for its Place ID), and a Google Cloud key with billing enabled and the Places API turned on. Returns at most about 5 reviews, chosen by Google, so show those plus a rating summary linking to the profile, with Google's attribution. Check Google's current terms on caching before building. `/reviews` is static today and will need to become server-rendered (with an edge cache) when this is added. Add a "Leave us a Google review" link (the profile's review link) to the footer and contact page.
   - **Still needs the client:** phone, email, hours, `areaServed` towns, the three service-card photos, and more before/after pairs. Fill in the user's contact details in `OWNER_GUIDE.md`. Optional: a thousands separator for prices (`£1120` → `£1,120`).
5. **Step 12: production setup and testing.** Add every variable from §7 in Vercel's Production environment. Verify the domain in Resend (DNS records in Cloudflare; this doesn't affect the current site). Optional Telegram bot. Send a real enquiry on production. Time a price edit (about 10 minutes) and a new photo (about 30 minutes). Test on a real iPhone and an Android phone. Check the Google Rich Results Test and an OG preview (e.g. opengraph.xyz).
6. **Step 13: protect the old site's search ranking.** List the old site's indexed URLs (Search Console or a `site:` search). Add 301 redirects to the matching new pages. Keep a copy of the old site.
7. **Step 14: switch the domain.** In Vercel, add `jdyorkshiredetailingcompany.com`. In Cloudflare, change only the web records (apex and `www`), set to "DNS only", and **leave the MX/email records untouched**. `www` should redirect to the bare domain. Then check every page, the form and the redirects.
8. **Step 15: after launch.** Search Console with `sitemap-index.xml`, update the Google Business Profile with the new site, check a WhatsApp/Facebook share preview, and watch enquiries closely for the first week.

**Optional ideas offered but not taken up:**
- A protected price-refresh link (`/prices?refresh=<secret>`) to bust the caches.
- A two-video crossfade with no dark dip between hero clips.
- A vector version of the logo.

## 9. Loose ends and risks

- **`src/assets/gallery/`** holds 39 original client photos (177MB). They're **untracked and not gitignored**. Never `git add -A` or `git add .` here; add paths explicitly. Step 8 includes gitignoring it.
- `assets/hero bg.mp4` (5MB original) was committed in step 1. The other source clips and the 118MB GIF are gitignored.
- **Caches are per serverless instance.** The price, gallery and rate-limit state is in memory, so on Vercel each instance has its own copy. That's acceptable for this site, and the edge `s-maxage` does most of the work.
- **The image route** relies on Drive `thumbnailLink` URLs, which are unofficial and expire. That's why the listing refreshes every 30 minutes and the route falls back to the original. If gallery images ever 502, look here first.
- `npm install` reports audit warnings that were already there. Nothing has been looked into.
- Spec acceptance criteria (SPEC.md §12):
  - **Verified locally:** the prices behaviours, the gallery fallback, ignoring non-images, no key leak, the honeypot, a real Resend email, and the build passing.
  - **Verified in step 7:** the 375px pass (headless Edge), the lightbox, the mobile menu and the form's fetch and no-JS paths.
  - **Not yet verified:** Lighthouse Performance after step 7 (only the pre-step-7 baseline exists), a real iPhone, and price/photo update timing on Vercel.
