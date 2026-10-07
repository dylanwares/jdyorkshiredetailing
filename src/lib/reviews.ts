import legacyData from '../data/reviews.json';

export interface Review {
  /** Where the review came from. Google reviews will be added here later. */
  source: 'legacy' | 'google';
  author: string;
  /** 1 to 5 */
  rating: number;
  text: string;
  /** ISO date, e.g. 2026-05-03T14:14 */
  date: string;
  /** Preferred for the short list on the home page. */
  featured?: boolean;
}

interface LegacyReview extends Omit<Review, 'source'> {
  /** false hides a review without deleting it. */
  published?: boolean;
}

const legacy: Review[] = (legacyData as LegacyReview[])
  .filter((r) => r.published !== false)
  .map(({ published, ...review }) => ({ ...review, source: 'legacy' as const }));

/**
 * Every review to show, newest first. Today that is the reviews carried over from the old
 * site (src/data/reviews.json); Google reviews will be merged in here, above the legacy ones.
 */
export async function getReviews(): Promise<Review[]> {
  return [...legacy].sort((a, b) => b.date.localeCompare(a.date));
}

/** The short list for the home page: Google reviews first, then featured ones, then the newest. */
export function homeReviews(reviews: Review[], count = 3): Review[] {
  const rank = (r: Review) => (r.source === 'google' ? 0 : r.featured ? 1 : 2);
  return [...reviews].sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date)).slice(0, count);
}

export function reviewSummary(reviews: Review[]) {
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  return { count, average };
}

/** "May 2026" */
export const reviewMonth = (date: string) =>
  new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
