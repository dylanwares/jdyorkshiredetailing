import { site } from '../data/site';
import type { PriceCategory } from './prices';

/** "£20–£350" from the live prices, or undefined when no service has a price. */
export function priceRange(categories: PriceCategory[]): string | undefined {
  const prices = categories.flatMap((c) => c.services.map((s) => s.price)).filter((p): p is number => p !== null);
  if (prices.length === 0) return undefined;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `£${min}` : `£${min}–£${max}`;
}

/** schema.org AutoWash (a LocalBusiness) describing the business, for Google's local results. */
export function businessSchema(categories: PriceCategory[], extra: Record<string, unknown> = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoWash',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: site.url,
    logo: `${site.url}/icon-512.png`,
    image: `${site.url}/og-image.jpg`,
    description: `${site.tagline}. ${site.serviceArea}.`,
    telephone: site.phoneHref.replace(/^tel:/, ''),
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.locality,
      addressRegion: site.region,
      addressCountry: site.country,
    },
    areaServed: site.areaServed.map((name) => ({ '@type': 'City', name })),
    openingHoursSpecification: site.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: [site.instagramUrl],
    priceRange: priceRange(categories),
    ...extra,
  };
}

/** The price list as an OfferCatalog, one section per category. Services without a price are listed without one. */
export function offerCatalog(categories: PriceCategory[]) {
  return {
    '@type': 'OfferCatalog',
    name: 'Mobile car detailing services',
    itemListElement: categories.map((category) => ({
      '@type': 'OfferCatalog',
      name: category.category,
      itemListElement: category.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.service, ...(s.description && { description: s.description }) },
        ...(s.price !== null && { price: s.price, priceCurrency: 'GBP' }),
      })),
    })),
  };
}
