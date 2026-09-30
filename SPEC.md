# Build Spec — Mobile Detailing Website

## 1. Overview

A fast, mobile-first marketing website for a mobile car detailing business. The owner is non-technical and must be able to update **prices** and **"Our Work" photos** himself, without a custom admin dashboard and without ever managing API keys.

- **Prices** are managed in a Google Sheet.
- **Gallery** is pulled from the business's Instagram via Behold's JSON feed.
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
| Gallery source | Behold JSON feed (Instagram) |
| Contact email | Resend (via Astro API route) |
| Spam protection | Honeypot field + Cloudflare Turnstile |
| Images | Astro `<Image />` for local assets; remote gallery images allowed via `image.domains` config |

No database. No authentication. No admin UI.

## 3. Pages

1. **Home (`/`)**
   - Hero: headline, service area, primary CTA ("Get a quote") and phone click-to-call, dark video background
   - Short services overview (links to Prices)
   - Gallery preview (latest 6 posts)
   - Trust section: why choose us, reviews placeholder
   - CTA band → contact
2. **Prices (`/prices`)** — full price list rendered from the Google Sheet (see §4)
3. **Our Work (`/our-work`)** — gallery grid from Behold (see §5)
4. **Contact (`/contact`)** — enquiry form (see §6), phone, email, service area
5. **404** — branded, links home

Global: sticky header with nav + "Call now" button on mobile, footer with contact details, Instagram link, copyright.

## 4. Prices — Google Sheet

### Sheet structure (tab name: `Prices`)

| Column | Type | Example | Notes |
|---|---|---|---|
| `category` | text | `Valets` | Groups services into sections |
| `service` | text | `Mini Valet` | |
| `description` | text | `Exterior wash, interior hoover…` | Optional |
| `small` | number | `35` | Price for small cars; blank = not offered |
| `medium` | number | `40` | |
| `large` | number | `50` | Vans / 4x4s |
| `active` | TRUE/FALSE | `TRUE` | FALSE hides the row |
| `order` | number | `1` | Sort order within category |

The sheet is published via *File → Share → Publish to web → `Prices` tab → CSV*. Store the URL in env var `PRICES_CSV_URL`.

### Implementation

- `src/lib/prices.ts`
  - Fetch CSV server-side, parse with `papaparse`.
  - Validate each row with `zod`: skip rows with missing `service`, non-numeric prices, or `active !== TRUE`. Log skipped rows, never crash.
  - Group by `category`, sort by `order`.
  - **In-memory cache for 10 minutes.**
  - **Fallback:** if fetch/parse fails or returns zero valid rows, use `src/data/prices.fallback.json` (same shape). Page must never render empty.
- `/prices` is server-rendered (`export const prerender = false`) and sets `Cache-Control: s-maxage=600, stale-while-revalidate=3600`.
- Display: one section per category, responsive table/cards showing Small / Medium / Large columns. Blank price → "—". Prices formatted as `£35`. Include a note: "Prices are a guide — final quote depends on vehicle condition."

## 5. Gallery — Behold (Instagram)

- Env var `BEHOLD_FEED_URL` (Behold JSON feed URL).
- `src/lib/gallery.ts`
  - Fetch JSON server-side, map to `{ id, imageUrl, caption, permalink, timestamp }`.
  - Include `IMAGE` and `CAROUSEL_ALBUM` (first image); for `VIDEO`, use the thumbnail.
  - Optional filter: if env var `GALLERY_HASHTAG` is set (e.g. `#website`), only include posts whose caption contains it.
  - Limit: 18 on `/our-work`, 6 on home.
  - Cache 30 minutes; on failure use `src/data/gallery.fallback.json` pointing at local images in `src/assets/gallery/`.
- Display: responsive masonry/grid, lazy-loaded, rounded corners, click opens a simple lightbox (no heavy library — a small custom component or `<dialog>`). Each item links to the Instagram post. "Follow us on Instagram" button beneath.
- Add the Behold/Instagram CDN domains to Astro's allowed remote image domains.

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
- Server validates with `zod`, checks honeypot and Turnstile token, then sends an email via Resend to `CONTACT_TO_EMAIL` with a clear subject: `New enquiry — {service} — {postcode}`, and `reply-to` set to the customer's email if provided.
- Shows inline success/error states; the form stays usable without JS (progressive enhancement with a normal form POST fallback and a redirect to `/contact?sent=1`).
- Basic rate limiting per IP (simple in-memory limiter is acceptable).

## 7. Environment Variables

```
PRICES_CSV_URL=
BEHOLD_FEED_URL=
GALLERY_HASHTAG=          # optional
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL=       # verified Resend sender on jdyorkshiredetailing.com
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

- Unique `<title>` and meta description per page; Open Graph image.
- `LocalBusiness` (`AutoWash` subtype) JSON-LD with name, phone, service area, opening hours placeholder, and `priceRange`.
- `sitemap.xml` via `@astrojs/sitemap`, `robots.txt`.
- Prices rendered in server HTML (not client-side) so they are indexable.

## 10. Project Structure

```
src/
  components/   Header, Footer, Hero, PriceTable, GalleryGrid, Lightbox, ContactForm, CTA
  layouts/      BaseLayout.astro
  lib/          prices.ts, gallery.ts, cache.ts, validation.ts
  data/         prices.fallback.json, gallery.fallback.json
  assets/       logo, hero image, gallery fallbacks
  pages/        index, prices, our-work, contact, 404, api/contact.ts
```

## 11. Owner Documentation

Create `OWNER_GUIDE.md`: a plain-English, one-page guide for the business owner covering:
- How to change a price, hide a service, and add a new one in the Google Sheet (and what not to change: the header row and the tab name)
- That changes appear on the site within ~10 minutes
- That new Instagram posts appear in the gallery automatically (and the hashtag rule, if used)
- Who to contact if something looks wrong

## 12. Acceptance Criteria

- [ ] Editing a price in the sheet appears on `/prices` within 10 minutes without a redeploy
- [ ] Setting `active` to FALSE hides that service
- [ ] A malformed row is skipped; the rest of the page still renders
- [ ] With the sheet URL broken, `/prices` shows fallback prices
- [ ] New Instagram posts appear on `/our-work` within 30 minutes
- [ ] With the Behold URL broken, the gallery shows fallback images
- [ ] Contact form sends an email to the business; spam submissions (honeypot filled) are silently dropped
- [ ] Site works well on a 375px-wide screen
- [ ] Lighthouse scores ≥ 95 on mobile
- [ ] `npm run build` passes with no type errors; the site runs locally with no env vars set

## 13. Build Order

1. Scaffold Astro + Tailwind + Vercel adapter, base layout, header/footer
2. Static pages with placeholder content and design system
3. Prices: fallback JSON → CSV fetch + validation + cache
4. Gallery: fallback JSON → Behold fetch + cache + lightbox
5. Contact form + API route + Resend + Turnstile
6. SEO, JSON-LD, sitemap
7. Accessibility/performance pass, `OWNER_GUIDE.md`, README with deploy steps
