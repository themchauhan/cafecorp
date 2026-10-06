// One-off script to regenerate favicon.ico and the app icons from
// public/logo-mark.svg. Not part of the build — run manually with
// `node scripts/lib/generate-icons.mjs` whenever the logo changes.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SVG_PATH = 'public/logo-mark.svg';

async function pngBuffer(size) {
  return sharp(SVG_PATH).resize(size, size).png().toBuffer();
}

// Minimal ICO writer: a header + one directory entry per image, each
// holding a plain PNG blob (the modern/widely-supported ICO variant —
// every current browser and OS accepts PNG-encoded ICO entries).
function buildIco(pngs) {
  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  const entries = [];
  for (const { size, buffer } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    header.set(entry, 6 + entries.length * 16);
    entries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...pngs.map((p) => p.buffer)]);
}

const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map(async (size) => ({ size, buffer: await pngBuffer(size) })),
);
await writeFile('src/app/favicon.ico', buildIco(pngs));

await sharp(SVG_PATH).resize(180, 180).png().toFile('src/app/apple-icon.png');
await sharp(SVG_PATH).resize(512, 512).png().toFile('public/logo-512.png');

console.log(
  'Wrote src/app/favicon.ico, src/app/apple-icon.png, public/logo-512.png',
);
