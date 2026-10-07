import type { ImageMetadata } from 'astro';
import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { getCache, getStale, setCache } from './cache';

/** A photo in the shared Google Drive folder, served through /api/gallery/[id]. */
export interface DriveImage {
  source: 'drive';
  id: string;
  name: string;
  /** Drive's thumbnail URL (ends in "=s220"); resize by changing the number. Optional. */
  thumbnail?: string;
}

/** A bundled photo from src/assets/gallery-fallback, used when Drive is unavailable. */
export interface LocalImage {
  source: 'local';
  name: string;
  src: ImageMetadata;
}

export type GalleryImage = DriveImage | LocalImage;

const CACHE_KEY = 'gallery';
const CACHE_TTL_MS = 30 * 60 * 1000;
// After a failed refresh, wait this long before trying Drive again.
const RETRY_TTL_MS = 60 * 1000;
export const FETCH_TIMEOUT_MS = 8000;

// sharp can't decode HEIC, so only formats it handles are listed.
export const IMAGE_QUERY = "(mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp')";

const localModules = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery-fallback/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

const fallback: LocalImage[] = Object.entries(localModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, module]) => ({ source: 'local', name: path.split('/').pop() ?? path, src: module.default }));

async function listDriveImages(folderId: string, apiKey: string): Promise<DriveImage[]> {
  const images: DriveImage[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and ${IMAGE_QUERY} and trashed=false`,
      orderBy: 'createdTime desc',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,thumbnailLink)',
      key: apiKey,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Drive API responded ${response.status}`);

    const data = (await response.json()) as { nextPageToken?: string; files?: { id: string; name: string; thumbnailLink?: string }[] };
    for (const file of data.files ?? []) images.push({ source: 'drive', id: file.id, name: file.name, thumbnail: file.thumbnailLink });
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (images.length === 0) throw new Error('Drive folder contains no images');
  return images;
}

/**
 * Gallery photos, newest first: every image in the shared Drive folder, cached for 30 minutes.
 * If Drive is unset, unreachable or empty, serves the last good list, or the bundled fallback photos.
 */
export async function getGalleryImages(): Promise<GalleryImage[]> {
  if (!GOOGLE_DRIVE_KEY || !GOOGLE_DRIVE_FOLDER_ID) return fallback;

  const cached = getCache<GalleryImage[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const images = await listDriveImages(GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY);
    setCache(CACHE_KEY, images, CACHE_TTL_MS);
    return images;
  } catch (error) {
    // Never log the request URL: it contains the API key.
    console.error('[gallery] could not load Drive folder, using fallback:', error instanceof Error ? error.message : error);
    const images = getStale<GalleryImage[]>(CACHE_KEY) ?? fallback;
    setCache(CACHE_KEY, images, RETRY_TTL_MS);
    return images;
  }
}
