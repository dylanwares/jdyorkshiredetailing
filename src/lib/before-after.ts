import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { cachedLoad } from './cache';
import { IMAGE_QUERY, driveList, toDriveImage } from './drive';
import { pairBeforeAfter, type FilePair } from './pairing';
import type { GalleryImage } from './gallery';

export type BeforeAfterPair = FilePair<GalleryImage>;

const CACHE_TTL_MS = 30 * 60 * 1000;
// After a failed refresh, wait this long before trying Drive again.
const RETRY_TTL_MS = 60 * 1000;

// The client creates this folder inside the gallery folder. Matches "Before and After",
// "before & after", etc.
const FOLDER_NAME = /^before\s*(and|&)\s*after$/i;

async function listPairs(parentId: string, apiKey: string): Promise<BeforeAfterPair[]> {
  const folders = await driveList(
    {
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: '100',
    },
    apiKey,
  );
  const folder = folders.files?.find((f) => FOLDER_NAME.test(f.name.trim()));
  if (!folder) return [];

  const images = await driveList(
    {
      q: `'${folder.id}' in parents and ${IMAGE_QUERY} and trashed=false`,
      orderBy: 'createdTime desc',
      pageSize: '200',
      fields: 'files(id,name,thumbnailLink)',
    },
    apiKey,
  );
  return pairBeforeAfter((images.files ?? []).map(toDriveImage));
}

/**
 * Before/after photo pairs from the "Before and After" subfolder of the gallery folder, newest
 * first. A photo without its partner is left out. There are no bundled fallback photos (a fake
 * pair would be misleading), so with no pairs the home page simply leaves the section out.
 * Cached for 30 minutes; if Drive fails, the last good list is kept.
 */
export async function getBeforeAfterPairs(): Promise<BeforeAfterPair[]> {
  const [apiKey, folderId] = [GOOGLE_DRIVE_KEY, GOOGLE_DRIVE_FOLDER_ID];
  if (!apiKey || !folderId) return [];

  return cachedLoad<BeforeAfterPair[]>({
    key: 'before-after',
    ttlMs: CACHE_TTL_MS,
    retryMs: RETRY_TTL_MS,
    load: () => listPairs(folderId, apiKey),
    fallback: [],
    onError: (error) => console.error('[before-after] could not load Drive folder:', error instanceof Error ? error.message : error),
  });
}
