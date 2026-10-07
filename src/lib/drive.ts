import type { DriveImage } from './gallery';

export const FETCH_TIMEOUT_MS = 8000;

// sharp can't decode HEIC, so only formats it handles are listed.
export const IMAGE_QUERY = "(mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp')";

export interface DriveFile {
  id: string;
  name: string;
  thumbnailLink?: string;
}

/** One Drive files.list call. Errors never include the request URL: it contains the API key. */
export async function driveList(params: Record<string, string>, apiKey: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${new URLSearchParams({ ...params, key: apiKey })}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Drive API responded ${response.status}`);
  return (await response.json()) as { nextPageToken?: string; files?: DriveFile[] };
}

export const toDriveImage = (file: DriveFile): DriveImage => ({ source: 'drive', id: file.id, name: file.name, thumbnail: file.thumbnailLink });
