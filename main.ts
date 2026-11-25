// news-image-20261124 — "THE WORLD TODAY", Tuesday 24 November 2026.
//
// Entrypoint for the make.fun daily news-image bounty. The front page is
// baked into this repository as entry.png — version 3 is a dense broadsheet:
// the ICJ verdict hero on top, 24 more verified stories in a three-column
// grid, and a markets ticker at the foot (25 stories, 7+ regions). This
// program's only job is to carry that image, byte for byte, into the
// grader's output directory. It needs nothing but the Node 22 standard
// library, never touches the network, and always writes identical bytes
// for identical input. The frame check is exact (1024x1024, not at most),
// because the gate judges the published file as-is.
//
// Run it like the grader does (MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The gate accepts at most one mebibyte and a square frame of 1024 pixels.
const MAX_BYTES = 1_048_576;
const FRAME = 1024;
const SOURCE_FILE = 'entry.png';
const TARGET_FILE = 'entry.png';

// Magic bytes that open a JPEG and a PNG, for a quick sanity check that the
// file we are about to publish really is an image and not something else.
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function fail(message: string): never {
  console.error(`[news-image-20261124] error: ${message}`);
  process.exit(1);
}

function startsWith(data: Buffer, prefix: number[]): boolean {
  return prefix.every((byte, i) => data[i] === byte);
}

function kindOf(data: Buffer): 'JPEG' | 'PNG' | null {
  if (startsWith(data, JPEG_MAGIC)) return 'JPEG';
  if (startsWith(data, PNG_MAGIC)) return 'PNG';
  return null;
}

// Walk a JPEG's segments until the frame header (SOF0/SOF2) gives the size.
// Returns null for anything that is not a baseline/progressive JPEG.
function jpegSize(data: Buffer): { width: number; height: number } | null {
  let pos = 2; // skip the SOI marker
  while (pos + 9 <= data.length) {
    if (data[pos] !== 0xff) return null;
    const marker = data[pos + 1];
    if (marker === 0xd8 || marker === 0x01) { pos += 2; continue; }
    const length = data.readUInt16BE(pos + 2);
    if (length < 2 || pos + 2 + length > data.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: data.readUInt16BE(pos + 5),
        width: data.readUInt16BE(pos + 7),
      };
    }
    pos += 2 + length;
  }
  return null;
}

// Read the width/height out of a PNG's IHDR chunk.
function pngSize(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function publishFrontPage(): void {
  const repoRoot = resolve(import.meta.dirname ?? '.');
  const sourcePath = join(repoRoot, SOURCE_FILE);
  if (!existsSync(sourcePath)) {
    fail(`source image ${SOURCE_FILE} is missing from ${repoRoot}`);
  }

  const image = readFileSync(sourcePath);
  if (image.length === 0) {
    fail(`${SOURCE_FILE} is empty`);
  }
  if (image.length > MAX_BYTES) {
    fail(`${SOURCE_FILE} is ${image.length} bytes, over the ${MAX_BYTES} byte limit`);
  }

  const format = kindOf(image);
  if (format === null) {
    fail(`${SOURCE_FILE} is neither a JPEG nor a PNG (bad magic bytes)`);
  }

  const size = format === 'JPEG' ? jpegSize(image) : pngSize(image);
  if (size === null) {
    fail(`could not read the dimensions of ${SOURCE_FILE}`);
  }
  if (size.width !== FRAME || size.height !== FRAME) {
    fail(`${SOURCE_FILE} is ${size.width}x${size.height}, expected ${FRAME}x${FRAME}`);
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const targetPath = join(outDir, TARGET_FILE);
  writeFileSync(targetPath, image);

  // Read the published copy back and prove it is byte-identical to the source.
  const published = readFileSync(targetPath);
  if (!published.equals(image)) {
    fail(`published copy at ${targetPath} differs from ${SOURCE_FILE}`);
  }

  const digest = sha256Hex(image);
  const publishedDigest = sha256Hex(published);
  console.log(`[news-image-20261124] wrote ${format} ${size.width}x${size.height} ${image.length} bytes -> ${targetPath}`);
  console.log(`[news-image-20261124] sha256 source ${digest}`);
  console.log(`[news-image-20261124] sha256 published ${publishedDigest}`);
}

publishFrontPage();
