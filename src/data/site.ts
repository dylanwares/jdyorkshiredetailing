// Central business details. Values marked PLACEHOLDER must be replaced before launch.
export const site = {
  name: 'Jack Daniel’s Yorkshire Detailing Company',
  shortName: 'JD Yorkshire Detailing',
  url: 'https://jdyorkshiredetailingcompany.com',
  tagline: 'Mobile car detailing, brought to your door',
  serviceArea: 'Barnsley based · South Yorkshire coverage',
  instagramHandle: 'jackdydc',
  instagramUrl: 'https://www.instagram.com/jackdydc/',
  phone: '07000 000000', // PLACEHOLDER
  phoneHref: 'tel:+447000000000', // PLACEHOLDER
  email: 'hello@jdyorkshiredetailingcompany.com', // PLACEHOLDER
  hours: 'Mon–Sat, 8am–6pm', // PLACEHOLDER
  // Machine-readable version of `hours` for search engines. Keep the two in step. PLACEHOLDER
  openingHours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '08:00', closes: '18:00' },
  ],
  // Service-area business: no street address is published.
  locality: 'Barnsley',
  region: 'South Yorkshire',
  country: 'GB',
  areaServed: ['Barnsley', 'Sheffield', 'Rotherham', 'Doncaster'],
} as const;

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/prices', label: 'Prices' },
  { href: '/our-work', label: 'Our Work' },
  { href: '/contact', label: 'Contact' },
] as const;
