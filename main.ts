// news-image-20261124 — "THE WORLD TODAY", Tuesday 24 November 2026.
//
// This is the entrypoint for the make.fun daily news-image bounty. The
// front page lives in this repo as entry.png; this program's only job is
// to publish that image to the grader's output directory, byte for byte.
// It runs with Node 22 and the standard library only, and it never
// touches the network, so running it twice always writes identical bytes.
//
// Usage outside the grader (MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LIMIT_BYTES = 1_048_576; // the gate accepts at most 1 MiB
const SOURCE_NAME = 'entry.png';
const TARGET_NAME = 'entry.png';

// First bytes of a JPEG and of a PNG, for a quick sanity check that the
// file we are about to publish really is an image.
const JPEG_PREFIX = [0xff, 0xd8, 0xff];
const PNG_PREFIX = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function die(reason: string): never {
  console.error(`[news-image-20261124] error: ${reason}`);
  process.exit(1);
}

function detectFormat(data: Buffer): string | null {
  const startsWith = (prefix: number[]) =>
    prefix.every((byte, index) => data[index] === byte);
  if (startsWith(JPEG_PREFIX)) return 'JPEG';
  if (startsWith(PNG_PREFIX)) return 'PNG';
  return null;
}

function digest(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// The gate also caps the image at 1024 by 1024 pixels, so read the
// dimensions out of the file header instead of trusting the filename.
// JPEG: walk the markers until a start-of-frame segment gives width and
// height. PNG: width and height sit in the IHDR chunk, big-endian.
function dimensions(data: Buffer, format: string): { width: number; height: number } | null {
  if (format === 'PNG') {
    if (data.length < 24) return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  let offset = 2; // skip the SOI marker
  while (offset + 9 <= data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    const segmentLength = data.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc2) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function publish(): void {
  const repoRoot = resolve(import.meta.dirname);
  const source = join(repoRoot, SOURCE_NAME);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const target = join(outDir, TARGET_NAME);

  if (!existsSync(source)) die(`source image missing: ${source}`);

  const image = readFileSync(source);
  if (image.length === 0) die('source image is empty');
  if (image.length > LIMIT_BYTES) {
    die(`source image is ${image.length} bytes, over the 1 MiB limit`);
  }

  const format = detectFormat(image);
  if (format === null) {
    die('source image is neither JPEG nor PNG (unexpected leading bytes)');
  }

  const size = dimensions(image, format);
  if (size === null) {
    die('could not read the image dimensions from its header');
  }
  if (size.width > 1024 || size.height > 1024) {
    die(`image is ${size.width}x${size.height}, over the 1024x1024 limit`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(target, image);

  // Read the published copy back and confirm it matches the source
  // exactly; a mismatch here would mean the entry is not reproducible.
  const published = readFileSync(target);
  if (!published.equals(image)) {
    die(`published file differs from source: ${target}`);
  }

  console.log(`[news-image-20261124] wrote ${format} ${size.width}x${size.height} ${image.length} bytes -> ${target}`);
  console.log(`[news-image-20261124] sha256 ${digest(published)}`);
}

publish();
