/**
 * Regenerates every derived brand asset from the one supplied original,
 * `public/logo.jfif`.
 *
 *     npm run brand:icons
 *
 * Outputs:
 *   public/logo.png       crest on transparent, used in-app and in the PDFs
 *   src/app/icon.png      favicon (Next `app/icon` convention)
 *   src/app/apple-icon.png  iOS home-screen icon
 *   src/app/favicon.ico   16/32/48 fallback for /favicon.ico requests
 *
 * The crest ships as a JPEG: a maroon shield on a white ground, with white
 * *inside* the shield too. A blanket "make white transparent" would therefore
 * punch holes through the artwork, so the outer ground is removed by flooding
 * inwards from the border and only clearing the white that is connected to the
 * edge. Everything enclosed by the shield's black outline survives.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "logo.jfif");

/** A pixel counts as ground if it is near-white. JPEG ringing needs the slack. */
const WHITE_THRESHOLD = 236;

/** Clears the white background connected to the image border. */
async function cutOutGround(input) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const isGround = (i) =>
    data[i] >= WHITE_THRESHOLD &&
    data[i + 1] >= WHITE_THRESHOLD &&
    data[i + 2] >= WHITE_THRESHOLD;

  // Iterative flood fill — a recursive one blows the stack on a 200×200 field.
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) {
    stack.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push([0, y], [width - 1, y]);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const p = y * width + x;
    if (seen[p]) continue;
    seen[p] = 1;

    const i = p * channels;
    if (!isGround(i)) continue;

    data[i + 3] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/** Trims the now-transparent margin and re-centres the crest in a square. */
async function squareCrest(cutout, size, padding) {
  const trimmed = await sharp(cutout).trim({ threshold: 1 }).png().toBuffer();
  const inner = Math.round(size * (1 - padding * 2));

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp(trimmed)
          .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Lays the crest on a white tile. The crest is maroon outlined in black, so it
 * needs a light ground to stay legible against a dark browser tab strip or a
 * dark home screen. `radius` of 0 gives the square ground iOS expects — it
 * applies its own mask and would otherwise show black corners.
 */
async function tile(crest, size, radius) {
  const ground =
    radius > 0
      ? await sharp(
          Buffer.from(
            `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
          ),
        )
          .png()
          .toBuffer()
      : await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          },
        })
          .png()
          .toBuffer();

  return sharp(ground)
    .composite([{ input: await sharp(crest).resize(size, size).toBuffer() }])
    .png()
    .toBuffer();
}

/**
 * Wraps PNGs in an ICO container. Windows and every current browser accept
 * PNG-compressed ICO entries, so the bitmaps do not need converting to BMP.
 */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = [];

  for (const { size, png } of entries) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    directory.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...directory, ...entries.map((e) => e.png)]);
}

async function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(`Missing ${path.relative(ROOT, SOURCE)} — the crest original.`);
  }

  const cutout = await cutOutGround(SOURCE);

  // Generous padding on the app assets; the shield already reads as a solid
  // block, and letting it touch the edge makes it look cropped at 16px.
  const crest = await squareCrest(cutout, 512, 0.04);
  const favicon = await squareCrest(cutout, 512, 0.1);

  const write = (relative, buffer, label) => {
    writeFileSync(path.join(ROOT, relative), buffer);
    console.log(`  ${relative}  ${label}  ${(buffer.length / 1024).toFixed(1)} kB`);
  };

  console.log(`Regenerating brand assets from ${path.relative(ROOT, SOURCE)}:`);

  write("public/logo.png", await sharp(crest).resize(256, 256).png().toBuffer(), "256×256");
  write("src/app/icon.png", await tile(favicon, 256, 56), "256×256");
  write("src/app/apple-icon.png", await tile(favicon, 180, 0), "180×180");
  write(
    "src/app/favicon.ico",
    ico(
      await Promise.all(
        [16, 32, 48].map(async (size) => ({
          size,
          png: await tile(favicon, size, Math.round(size * 0.22)),
        })),
      ),
    ),
    "16/32/48",
  );
}

await main();
