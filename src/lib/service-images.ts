import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { cachedLoad } from './cache';
import { listSubfolderImages, toDriveImage } from './drive';
import type { DriveImage } from './gallery';

const CACHE_TTL_MS = 30 * 60 * 1000;
// After a failed refresh, wait this long before trying Drive again.
const RETRY_TTL_MS = 60 * 1000;

// The subfolder of the gallery folder. Matches "Service Card Images", "Service Images", etc.
const FOLDER_NAME = /^service\s*(card\s*)?images?$/i;

// "Signature Detail", "signature-detail.jpg" and "Signature_Detail.PNG" all become "signature detail".
const matchKey = (name: string) =>
  name
    .replace(/\.(jpe?g|png|webp)$/i, '')
    .toLowerCase()
    .replace(/[-_\s]+/g, ' ')
    .trim();

/**
 * Photos from the "Service Card Images" subfolder of the gallery folder, newest first.
 * Cached for 30 minutes; if Drive fails, the last good list is kept.
 */
export async function getServiceImages(): Promise<DriveImage[]> {
  const [apiKey, folderId] = [GOOGLE_DRIVE_KEY, GOOGLE_DRIVE_FOLDER_ID];
  if (!apiKey || !folderId) return [];

  return cachedLoad<DriveImage[]>({
    key: 'service-images',
    ttlMs: CACHE_TTL_MS,
    retryMs: RETRY_TTL_MS,
    load: async () => (await listSubfolderImages(folderId, FOLDER_NAME, apiKey)).map(toDriveImage),
    fallback: [],
    onError: (error) => console.error('[service-images] could not load Drive folder:', error instanceof Error ? error.message : error),
  });
}

/** The photo named after the service (ignoring case, spaces, dashes and the extension). Newest wins. */
export function imageForService(images: DriveImage[], service: string): DriveImage | undefined {
  const key = matchKey(service);
  return images.find((image) => matchKey(image.name) === key);
}
