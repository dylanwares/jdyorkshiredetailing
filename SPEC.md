# Build Spec — Mobile Detailing Website

## 1. Overview

A fast, mobile-first marketing website for a mobile car detailing business. The owner is non-technical and must be able to update **prices** and **"Our Work" photos** himself, without a custom admin dashboard and without ever managing API keys.

- **Prices** are managed in a Google Sheet.
- **Gallery** is pulled from a shared Google Drive folder the client uploads photos to.
- **Enquiries** come in through a contact form that emails the business.


### Business information
| Information | Value |
|---|---|
| Business name | Jack Daniels Yorkshire Detailing Company |
| Domain | jdyorkshiredetailingcompany.com |
| Service Area | Barnsley based, South Yorkshire coverage | 
| Instagram Handle | @jackdydc |
| Brand Colour | #3BB3F9 |

Logo is placed at assets/logo.JPG


## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Astro (latest stable), TypeScript |
| Rendering | Hybrid: static by default, server-rendered for pages using live data |
| Styling | Tailwind CSS |
| Hosting | Vercel (`@astrojs/vercel` adapter) |
| Prices source | Google Sheet published to web as CSV |
| Gallery source | Google Drive folder (images only), read via the Drive API |
| Contact notifications | Resend email + Telegram bot push (via Astro API route) |
| Spam protection | Honeypot field + Cloudflare Turnstile |
| Images | Astro `<Image />` for local assets; gallery images are fetched from Drive server-side and served resized through a site route (the API key never reaches the browser) |

No database. No authentication. No admin UI.

## 3. Pages

1. **Home (`/`)**
   - Hero: headline, service area, primary CTA ("Get a quote") and phone click-to-call, dark video background
   - Short services overview (links to Prices)
   - Gallery preview (latest 6 photos)
   - Before/after slider (see §5b), only shown when the Drive folder has at least one complete pair
   - Trust section: why choose us, and 3 customer reviews with a link to all of them (see §5c)
   - CTA band → contact
2. **Prices (`/prices`)** — full price list rendered from the Google Sheet (see §4)
3. **Our Work (`/our-work`)** — gallery grid from Google Drive (see §5)
4. **Contact (`/contact`)** — enquiry form (see §6), phone, email, service area
5. **Reviews (`/reviews`)** — every customer review, newest first (see §5c)
6. **404** — branded, links home

Global: sticky header with nav + "Call now" button on mobile, footer with contact details, Instagram link, copyright.

## 4. Prices — Google Sheet

### Sheet structure (tab name: `Prices`)

| Column | Type | Example | Notes |
|---|---|---|---|
| `category` | text | `Valets` | Groups services into sections |
| `service` | text | `Mini Valet` | |
| `description` | text | `Exterior wash, interior hoover…` | Optional |
| `price` | number | `35` | One price per service, shown exactly as entered (as `£35`); blank = "Contact for quote" |
| `active` | TRUE/FALSE | `TRUE` | FALSE hides the row |
| `order` | number | `1` | Sort order within category |

The sheet is published via *File → Share → Publish to web → `Prices` tab → CSV*. Store the URL in env var `PRICES_CSV_URL`.

### Implementation

- `src/lib/prices.ts`
  - Fetch CSV server-side, parse with `papaparse`.
  - Validate each row with `zod`: skip rows with missing `service`, a non-numeric `price`, or `active !== TRUE`. Log skipped rows, never crash.
  - Group by `category`, sort by `order`.
  - **In-memory cache for 10 minutes.**
  - **Fallback:** if fetch/parse fails or returns zero valid rows, use `src/data/prices.fallback.json` (same shape). Page must never render empty.
- `/prices` is server-rendered (`export const prerender = false`) and sets `Cache-Control: s-maxage=600, stale-while-revalidate=3600`.
- Display: one section per category, a responsive list with the service name and description on the left and a single price on the right. Blank price → "Contact for quote". Prices formatted as `£35`, exactly as in the sheet (no "From"). Include a note: "Prices are a guide — final quote depends on vehicle condition."

## 5. Gallery — Google Drive folder

The client uploads photos to a Google Drive folder (shared as "anyone with the link can view"). Every image in that folder appears on the site, newest first. Images only (JPEG, PNG or WebP) — videos and other file types are ignored. HEIC photos aren't supported, so iPhone users should upload JPEGs (or set the camera to "Most Compatible"). The price sheet (§4) can live in the same folder; it is a Google Sheet, so it is ignored by the image filter.

- Env vars: `GOOGLE_DRIVE_KEY` (Google Cloud API key with the Drive API enabled, read-only use) and `GOOGLE_DRIVE_FOLDER_ID` (the ID from the folder's URL). Both are server-side only.
- `src/lib/gallery.ts`
  - List the folder with the Drive API (`files.list`, restricted to JPEG/PNG/WebP, not trashed, ordered by `createdTime desc`, paginated) and map to `{ id, name, thumbnail }`.
  - No hashtag or caption filter: every image in the folder is shown.
  - Limit: all images on `/our-work`, latest 6 on home. Both pages are server-rendered with `Cache-Control: s-maxage=1800, stale-while-revalidate=3600`.
  - Cache the listing 30 minutes (in memory); on failure, or when the env vars are missing, serve the last good list, then the bundled fallback photos in `src/assets/gallery-fallback/` (resized copies, ~1600px wide, kept small because they ship with the deployment).
- Image route `src/pages/api/gallery/[id].ts`: fetches Drive's pre-sized thumbnail (about 0.5s) — or the original if the thumbnail is unavailable — converts it to WebP at 320, 480, 960 or 1600px wide (client photos are 4–6MB), and returns it with long `Cache-Control` headers. The API key is never exposed to the browser. Only IDs that appear in the current folder listing are served.
- Display: responsive masonry/grid, lazy-loaded, rounded corners, click opens a simple lightbox (no heavy library — a small custom component or `<dialog>`). "Follow us on Instagram" button beneath (the business still has an Instagram; it is just no longer the gallery source).

## 5b. Before/after slider

A comparison slider on the home page, just below the gallery preview. The client adds a subfolder called "Before and After" (any case; "Before & After" also works) inside the gallery folder and uploads pairs of photos named `<name>-before` and `<name>-after` (e.g. `audi-a3-before.jpg`, `audi-a3-after.jpg`).

- `src/lib/pairing.ts` pairs files by name, ignoring case, extension and "-", "_" or space separators. **A photo without its partner is never shown**, and neither is a file that doesn't follow the naming. If a name appears twice, the newest file is used. Pairs are ordered by their newest file.
- `src/lib/before-after.ts` finds the subfolder with the Drive API, lists its images, pairs them, and caches for 30 minutes (serving the last good list if Drive fails).
- The image route `/api/gallery/[id]` serves a photo only if it is in the gallery listing or in a complete pair.
- There are no bundled fallback photos (a made-up pair would be misleading). With no pairs, or with Drive unset or failing, the section is left out of the page.
- The latest 4 pairs are shown: one pair is centred and wide, two or more sit in two columns on desktop.
- `src/components/BeforeAfter.astro`: a 4:3 frame (no layout shift), the "before" photo clipped over the "after" one, "Before" and "After" labels, and a handle. Dragging uses pointer events on the whole photo (a native range input proved impossible to grab on phones). On touch, the slider moves only on a clearly horizontal drag or a tap, so a vertical swipe still scrolls the page and never nudges it (`touch-action: pan-y`). A visually hidden `<input type="range">` stays on top for keyboards (arrows move 5%, Home/End jump to the ends) and screen readers. No library. Photos are lazy-loaded.

## 5c. Reviews

- The reviews carried over from the client's old site live in `src/data/reviews.json` (author, rating, date, text, optional `featured` flag). They are the client's own reviews, kept word for word, with only the capitalisation of names tidied. `"published": false` hides one without deleting it.
- `src/lib/reviews.ts` is the single place the pages get reviews from (`getReviews()`), so other sources can be merged in later. Planned: Google reviews through the Places API, shown above the legacy ones with Google's attribution. The Places API only returns a few reviews (up to 5) chosen by Google, needs the Business Profile's Place ID and a billed Google Cloud key, and Google's terms limit how long review text may be stored, so those would be cached briefly rather than saved.
- The home page shows 3 reviews (Google ones first, then `featured` legacy ones, then the newest) and links to `/reviews`, which lists them all in a grid, newest first.
- No review or rating structured data (JSON-LD): Google ignores a business's own reviews of itself, and it risks a penalty.

## 6. Contact Form

Fields:
- Name (required)
- Phone (required)
- Email (optional)
- Postcode (required)
- Vehicle make/model (optional)
- Service interested in (select, options populated from the prices data)
- Preferred date (optional)
- Message (optional)
- Hidden honeypot field

Behaviour:
- Submits via `fetch` to `POST /api/contact`.
- Server (`src/pages/api/contact.ts`) validates with `zod` (`src/lib/validation.ts`), checks the honeypot and (if enabled) the Turnstile token, then delivers the enquiry through every configured channel (`src/lib/notify.ts`): an email via Resend to `CONTACT_TO_EMAIL` with a clear subject, `New enquiry — {service} — {postcode}`, and `reply-to` set to the customer's email if provided; and an instant push message through a Telegram bot to the client's phone. An enquiry counts as delivered if at least one channel succeeds; if all fail the customer is told to call instead, and the error is logged (without customer details).
- Shows inline success/error states; the form falls back to a normal form POST with a redirect to `/contact?sent=1` (or `/contact?error=…`) when JavaScript is off. Turnstile is optional and off until its keys are set; it needs JavaScript, so once enabled, visitors without JS are shown the phone number instead. The contact page is server-rendered so it can show the confirmation and list the live services from the price sheet.
- Basic rate limiting per IP: 5 valid submissions per 10 minutes (in-memory, best-effort on serverless). Invalid submissions don't count.
- Turnstile is optional: without its keys the honeypot and rate limit are the only spam checks. Telegram is optional too; email alone is enough to run.
- With no delivery channel configured, local development logs the enquiry to the terminal; in production the form refuses to pretend it sent.

## 7. Environment Variables

```
PRICES_CSV_URL=
GOOGLE_DRIVE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=       # verified Resend sender on jdyorkshiredetailingcompany.com
TELEGRAM_BOT_TOKEN=       # optional: instant push to the client's phone
TELEGRAM_CHAT_ID=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

Provide `.env.example` with all of the above. The app must build and run locally with only the fallbacks (no env vars set).

## 8. Design

- Mobile-first; most visitors arrive from a phone via Google or Instagram.
- Clean, premium, automotive feel: dark or deep neutral base, one strong accent colour (brand colour placeholder), generous whitespace, large imagery.
- Video background on hero of home. GIF file found at assets/hero bg.gif
- Persistent click-to-call on mobile.
- Accessible: semantic HTML, alt text, visible focus states, WCAG AA contrast.
- Target Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO.

### Design Reference
Reference: https://detailsociety.co.uk/ (screenshots in /design-references)

Borrow the feel, not the content:
- Dark, premium look with large full-width vehicle photography
- Bold uppercase headings, lots of whitespace
- Hero with big image + single strong CTA
- Services shown as image cards

Make it different:
- Use our brand colour instead of their red
- Different font pairing (e.g. Space Grotesk + Inter)
- Different section order: gallery higher up the home page
- Our own copy, logo and photos only

## 9. SEO & Local Business

- Unique `<title>` (service + location first, business name appended, under ~60 characters) and meta description per page. `noindex` on the 404.
- Open Graph and Twitter card tags with a 1200×630 `public/og-image.jpg`; favicons and an Apple touch icon made from the logo. All generated by `scripts/make-brand-images.mjs`.
- One URL form everywhere: `trailingSlash: 'never'`, so canonicals, links and the sitemap all use `/prices`, and Vercel 308-redirects `/prices/` to it.
- `LocalBusiness` (`AutoWash` subtype) JSON-LD on the home and prices pages (`src/lib/schema.ts`): name, phone, email, locality/region (no street address — service-area business), `areaServed` towns, opening hours, Instagram as `sameAs`, and `priceRange` computed from the live price sheet. The prices page adds an `OfferCatalog` of every active service. Business details live in `src/data/site.ts`.
- `sitemap.xml` via `@astrojs/sitemap` (excludes the 404); `robots.txt` (`src/pages/robots.txt.ts`) allows everything except `/api/` and links the sitemap.
- After launch (client / owner tasks): verify the domain in Google Search Console and submit `sitemap-index.xml`; set up a Google Business Profile as a service-area business (the biggest lever for local search); check the live site with Google's Rich Results Test.
- Prices rendered in server HTML (not client-side) so they are indexable.

## 10. Project Structure

```
src/
  components/   Header, Footer, Hero, PriceTable, GalleryGrid, Lightbox, ContactForm, CTA
  layouts/      BaseLayout.astro
  lib/          prices.ts, gallery.ts, before-after.ts, drive.ts, cache.ts, validation.ts, notify.ts, turnstile.ts, rate-limit.ts
  data/         prices.fallback.json
  assets/       logo, gallery-fallback/ (small resized photos)
  pages/        index, prices, our-work, contact, 404, api/contact.ts
```

## 11. Owner Documentation

Create `OWNER_GUIDE.md`: a plain-English, one-page guide for the business owner covering:
- How to change a price, hide a service, and add a new one in the Google Sheet (and what not to change: the header row and the tab name)
- That changes appear on the site within ~10 minutes
- How to add photos: upload them to the shared Google Drive folder; every image in the folder appears in the gallery within ~30 minutes (images only; to remove a photo, delete it from the folder)
- Who to contact if something looks wrong

## 12. Acceptance Criteria

- [ ] Editing a price in the sheet appears on `/prices` within 10 minutes without a redeploy
- [x] Setting `active` to FALSE hides that service
- [x] A malformed row is skipped; the rest of the page still renders
- [x] With the sheet URL broken, `/prices` shows fallback prices
- [ ] A photo uploaded to the Drive folder appears on `/our-work` within 30 minutes
- [x] Non-image files in the folder are ignored
- [x] With the Drive key or folder ID missing or broken, the gallery shows fallback images
- [x] The Drive API key never appears in page HTML, client JS or network requests from the browser
- [x] Contact form sends an email to the business; spam submissions (honeypot filled) are silently dropped
- [x] Site works well on a 375px-wide screen
- [ ] A complete before/after pair in the Drive subfolder appears as a slider on the home page within 30 minutes; a photo without its partner never appears
- [ ] Lighthouse scores ≥ 95 on mobile
- [x] `npm run build` passes with no type errors; the site runs locally with no env vars set

## 13. Build Order

1. Scaffold Astro + Tailwind + Vercel adapter, base layout, header/footer
2. Static pages with placeholder content and design system
3. Prices: fallback JSON → CSV fetch + validation + cache
4. Gallery: fallback JSON → Google Drive listing + resized image route + cache + lightbox
5. Contact form + API route + Resend + Turnstile
6. SEO, JSON-LD, sitemap
7. Accessibility/performance pass, `OWNER_GUIDE.md`, README with deploy steps
