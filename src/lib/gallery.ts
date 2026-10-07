import type { ImageMetadata } from 'astro';
import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { cachedLoad } from './cache';
import { IMAGE_QUERY, driveList, toDriveImage } from './drive';

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

const CACHE_TTL_MS = 30 * 60 * 1000;
// After a failed refresh, wait this long before trying Drive again.
const RETRY_TTL_MS = 60 * 1000;
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
    const params: Record<string, string> = {
      q: `'${folderId}' in parents and ${IMAGE_QUERY} and trashed=false`,
      orderBy: 'createdTime desc',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,name,thumbnailLink)',
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await driveList(params, apiKey);
    for (const file of data.files ?? []) images.push(toDriveImage(file));
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
  const [apiKey, folderId] = [GOOGLE_DRIVE_KEY, GOOGLE_DRIVE_FOLDER_ID];
  if (!apiKey || !folderId) return fallback;

  return cachedLoad<GalleryImage[]>({
    key: 'gallery',
    ttlMs: CACHE_TTL_MS,
    retryMs: RETRY_TTL_MS,
    load: () => listDriveImages(folderId, apiKey),
    fallback,
    onError: (error) => console.error('[gallery] could not load Drive folder, using fallback:', error instanceof Error ? error.message : error),
  });
}
