import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY } from 'astro:env/server';
import { getCache, getStale, setCache } from './cache';
import { FETCH_TIMEOUT_MS, IMAGE_QUERY, type GalleryImage } from './gallery';
import { pairBeforeAfter, type FilePair } from './pairing';

export type BeforeAfterPair = FilePair<GalleryImage>;

const CACHE_KEY = 'before-after';
const CACHE_TTL_MS = 30 * 60 * 1000;
// After a failed refresh, wait this long before trying Drive again.
const RETRY_TTL_MS = 60 * 1000;

// The client creates this folder inside the gallery folder. Matches "Before and After",
// "before & after", etc.
const FOLDER_NAME = /^before\s*(and|&)\s*after$/i;

async function driveList(params: Record<string, string>, apiKey: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ ...params, key: apiKey })}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Drive API responded ${response.status}`);
  return (await response.json()) as { files?: { id: string; name: string; thumbnailLink?: string }[] };
}

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
  const files: GalleryImage[] = (images.files ?? []).map((f) => ({ source: 'drive', id: f.id, name: f.name, thumbnail: f.thumbnailLink }));
  return pairBeforeAfter(files);
}

/**
 * Before/after photo pairs from the "Before and After" subfolder of the gallery folder, newest
 * first. A photo without its partner is left out. There are no bundled fallback photos (a fake
 * pair would be misleading), so with no pairs the home page simply leaves the section out.
 * Cached for 30 minutes; if Drive fails, the last good list is kept.
 */
export async function getBeforeAfterPairs(): Promise<BeforeAfterPair[]> {
  if (!GOOGLE_DRIVE_KEY || !GOOGLE_DRIVE_FOLDER_ID) return [];

  const cached = getCache<BeforeAfterPair[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const pairs = await listPairs(GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_KEY);
    setCache(CACHE_KEY, pairs, CACHE_TTL_MS);
    return pairs;
  } catch (error) {
    // Never log the request URL: it contains the API key.
    console.error('[before-after] could not load Drive folder:', error instanceof Error ? error.message : error);
    const pairs = getStale<BeforeAfterPair[]>(CACHE_KEY) ?? [];
    setCache(CACHE_KEY, pairs, RETRY_TTL_MS);
    return pairs;
  }
}
