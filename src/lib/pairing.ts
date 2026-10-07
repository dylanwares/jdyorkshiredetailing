export interface PairableFile {
  name: string;
}

export interface FilePair<T extends PairableFile> {
  /** Shared part of the file names, as the client typed it (e.g. "Audi A3"). */
  label: string;
  before: T;
  after: T;
}

// "audi-a3-before.jpg", "Audi A3 - After.JPG" and "audi_a3_before.png" all work.
const NAME = /^(.*\S)[-_ ]+(before|after)$/i;

const stripExtension = (name: string) => name.replace(/\.(jpe?g|png|webp)$/i, '').trim();

/**
 * Pairs "<name>-before" with "<name>-after" files. Names match ignoring case and spacing.
 * A file without a partner is dropped, and so is any file that doesn't follow the naming.
 * `files` should be newest first: when a name appears twice, the newest file wins, and pairs
 * come out in the order of their newest file.
 */
export function pairBeforeAfter<T extends PairableFile>(files: T[]): FilePair<T>[] {
  const found = new Map<string, { label: string; first: number; before?: T; after?: T }>();

  files.forEach((file, index) => {
    const match = NAME.exec(stripExtension(file.name));
    if (!match) return;
    const label = match[1].replace(/[-_ ]+$/, '').trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[-_\s]+/g, ' ');
    const side = match[2].toLowerCase() as 'before' | 'after';

    const entry = found.get(key) ?? { label, first: index };
    entry[side] ??= file;
    found.set(key, entry);
  });

  return [...found.values()]
    .filter((entry): entry is { label: string; first: number; before: T; after: T } => !!entry.before && !!entry.after)
    .sort((a, b) => a.first - b.first)
    .map(({ label, before, after }) => ({ label, before, after }));
}
