// Generate the PWA icons from the iOS app icon (the 1024px master in the iOS asset catalog).
// Usage: node scripts/gen-icons.mjs "<path to AppIcon-1024.png>"
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const [source] = process.argv.slice(2);
if (!source) {
  console.error('usage: node scripts/gen-icons.mjs <AppIcon-1024.png>');
  process.exit(1);
}
const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const plain = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of plain) {
  await sharp(source).resize(size, size).png().toFile(join(outDir, name));
}

// Maskable: the artwork sits inside the 80% safe zone on a solid background sampled from the
// icon's top-left pixel, so launchers that crop to a circle never clip the mark.
const { data } = await sharp(source).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
const background = { r: data[0], g: data[1], b: data[2] };
const inner = Math.round(512 * 0.8);
const art = await sharp(source).resize(inner, inner).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { ...background, alpha: 1 } },
})
  .composite([{ input: art, gravity: 'centre' }])
  .png()
  .toFile(join(outDir, 'icon-512-maskable.png'));

console.log(`wrote ${plain.length + 1} icons to public/icons/`);
