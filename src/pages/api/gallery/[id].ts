import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { getGalleryImages } from '../../../lib/gallery';
import { getBeforeAfterPairs } from '../../../lib/before-after';

export const prerender = false;

const WIDTHS = [320, 480, 960, 1600];
const DEFAULT_WIDTH = 960;

// Resized WebP copies of Drive photos. Originals are 4-6MB phone photos, so visitors only ever
// receive these. The API key stays on the server.
export const GET: APIRoute = async ({ params, url }) => {
  const id = params.id;
  const requested = Number(url.searchParams.get('w'));
  const width = WIDTHS.includes(requested) ? requested : DEFAULT_WIDTH;

  // Only serve files that are in the current folder listing: gallery photos, or photos that are
  // part of a complete before/after pair.
  // Both lookups run together (and are cached), so a before/after photo doesn't wait for the gallery list first.
  const [images, pairs] = await Promise.all([getGalleryImages(), getBeforeAfterPairs()]);
  const image = [...images, ...pairs.flatMap((pair) => [pair.before, pair.after])].find(
    (candidate) => candidate.source === 'drive' && candidate.id === id,
  );
  if (!GOOGLE_DRIVE_KEY || image?.source !== 'drive') return new Response('Not found', { status: 404 });

  // Prefer Drive's pre-sized thumbnail (~0.5s, under 600KB). If it's missing or has expired,
  // fall back to downloading the multi-megabyte original.
  let source: Response | null = null;
  if (image.thumbnail) {
    source = await fetch(image.thumbnail.replace(/=s\d+$/, `=s${width}`), { signal: AbortSignal.timeout(10000) }).catch(() => null);
  }
  if (!source?.ok) {
    source = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(image.id)}?alt=media&key=${GOOGLE_DRIVE_KEY}`,
      { signal: AbortSignal.timeout(15000) },
    ).catch(() => null);
  }
  if (!source?.ok) return new Response('Image unavailable', { status: 502 });

  try {
    const body = await sharp(Buffer.from(await source.arrayBuffer()))
      .rotate() // apply the photo's EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400, immutable',
      },
    });
  } catch {
    return new Response('Image could not be processed', { status: 502 });
  }
};
