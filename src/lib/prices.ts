import Papa from 'papaparse';
import { z } from 'zod';
import { PRICES_CSV_URL } from 'astro:env/server';
import fallbackData from '../data/prices.fallback.json';
import { getCache, getStale, setCache } from './cache';

export interface PriceService {
  service: string;
  description: string;
  small: number | null;
  medium: number | null;
  large: number | null;
  order: number;
}

export interface PriceCategory {
  category: string;
  services: PriceService[];
}

const CACHE_KEY = 'prices';
const CACHE_TTL_MS = 10 * 60 * 1000;
// After a failed refresh, wait this long before trying the sheet again.
const RETRY_TTL_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

const fallback = fallbackData as PriceCategory[];

// "£35", "35" and " 35 " are all fine; blank means "not offered".
const priceCell = z
  .string()
  .default('')
  .transform((value, ctx) => {
    const cleaned = value.trim().replace(/^£/, '').replace(/,/g, '');
    if (cleaned === '') return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: `invalid price "${value}"` });
      return z.NEVER;
    }
    return n;
  });

const rowSchema = z.object({
  category: z.string().default('').transform((v) => v.trim() || 'Other'),
  service: z.string().default('').transform((v) => v.trim()).pipe(z.string().min(1, 'missing service')),
  description: z.string().default('').transform((v) => v.trim()),
  small: priceCell,
  medium: priceCell,
  large: priceCell,
  active: z.string().default('').transform((v) => v.trim().toUpperCase() === 'TRUE'),
  order: z
    .string()
    .default('')
    .transform((v) => {
      const n = Number(v.trim());
      return v.trim() !== '' && Number.isFinite(n) ? n : 9999;
    }),
});

/** Parse and validate the sheet's CSV. Bad rows are skipped and logged, never thrown. */
export function parsePricesCsv(csv: string): PriceCategory[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const groups = new Map<string, PriceService[]>();

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for the header row, +1 for 1-based numbering
    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      console.warn(`[prices] skipped row ${rowNumber}: ${result.error.issues.map((i) => i.message).join(', ')}`);
      return;
    }
    const { category, active, ...service } = result.data;
    if (!active) return;
    groups.set(category, [...(groups.get(category) ?? []), service]);
  });

  return [...groups].map(([category, services]) => ({
    category,
    services: services.sort((a, b) => a.order - b.order),
  }));
}

async function loadFromSheet(url: string): Promise<PriceCategory[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`sheet responded ${response.status}`);
  const categories = parsePricesCsv(await response.text());
  if (categories.length === 0) throw new Error('sheet contained no valid rows');
  return categories;
}

/**
 * Prices for the site: the published Google Sheet, cached for 10 minutes.
 * If the sheet is unset, unreachable or empty, serves the last good data, or the bundled fallback.
 */
export async function getPrices(): Promise<PriceCategory[]> {
  if (!PRICES_CSV_URL) return fallback;

  const cached = getCache<PriceCategory[]>(CACHE_KEY);
  if (cached) return cached;

  try {
    const prices = await loadFromSheet(PRICES_CSV_URL);
    setCache(CACHE_KEY, prices, CACHE_TTL_MS);
    return prices;
  } catch (error) {
    console.error('[prices] could not load sheet, using fallback:', error);
    const prices = getStale<PriceCategory[]>(CACHE_KEY) ?? fallback;
    setCache(CACHE_KEY, prices, RETRY_TTL_MS);
    return prices;
  }
}
