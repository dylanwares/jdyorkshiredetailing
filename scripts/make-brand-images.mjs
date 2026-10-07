// Generates the social preview image, favicons and the WebP hero poster from the logo and hero footage.
// Re-run after changing the logo:  node scripts/make-brand-images.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const INK = '#0a0e14';
const logo = 'src/assets/logo.png'; // full logo, transparent background
const mark = 'src/assets/logo-mark.png'; // car + sparkles only
const poster = 'public/videos/hero-poster.jpg';

// The page uses a WebP copy of the poster (about 60% of the JPEG's size); the JPEG stays as the source for the images below.
await sharp(poster).webp({ quality: 80, effort: 6 }).toFile('public/videos/hero-poster.webp');

// 1200x630 Open Graph image: darkened hero frame with the logo centred.
const background = await sharp(poster).resize(1200, 630, { fit: 'cover' }).toBuffer();
const shade = Buffer.from(
  `<svg width="1200" height="630"><defs><radialGradient id="g" cx="50%" cy="50%" r="70%">
     <stop offset="0" stop-color="${INK}" stop-opacity="0.72"/><stop offset="1" stop-color="${INK}" stop-opacity="0.95"/>
   </radialGradient></defs><rect width="1200" height="630" fill="url(#g)"/>
   <rect x="0" y="618" width="1200" height="12" fill="#3bb3f9"/></svg>`,
);
const logoImage = await sharp(logo).resize({ height: 470 }).toBuffer();
const { width: logoWidth = 0 } = await sharp(logoImage).metadata();
await sharp(background)
  .composite([
    { input: shade },
    { input: logoImage, left: Math.round((1200 - logoWidth) / 2), top: 70 },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile('public/og-image.jpg');

// Square icon: the car mark on the site's dark background.
const icon = async (size) => {
  const inner = Math.round(size * 0.84);
  const car = await sharp(mark).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: car, gravity: 'centre' }])
    .png()
    .toBuffer();
};

await writeFile('public/apple-touch-icon.png', await icon(180));
await writeFile('public/icon-192.png', await icon(192));
await writeFile('public/icon-512.png', await icon(512));

// favicon.ico holding a single 32px PNG (supported by every current browser).
const png32 = await icon(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png32.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
await writeFile('public/favicon.ico', Buffer.concat([header, png32]));

console.log('Wrote public/videos/hero-poster.webp, public/og-image.jpg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png');
