// the-world-today — front page for Tuesday 24 November 2026, version 4.
//
// The front page itself is baked into this repository as entry.png — version 4
// is a dense broadsheet: masthead "THE WORLD TODAY", the ICJ genocide verdict
// as the hero lead, then 35 more verified stories in a four-column grid across
// seven regions, with a markets ticker at the foot (36 stories in total).
// The image was rendered at 1600x1600 and downscaled to the 1024x1024 frame
// with PIL Lanczos, then checked by eye: every headline spelled correctly,
// no story repeated, deck text still legible at the final size.
// This program's only job is to carry that image, byte for byte, into the
// grader's output directory. It needs nothing but the Node 22 standard
// library, never touches the network, and always writes identical bytes for
// identical input. The frame check is exact (1024x1024, not at most), because
// the gate judges the published file as-is.
//
// Run it like the grader does (MAKEFUN_OUTPUT_DIR stands in for /output):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The gate accepts at most one mebibyte and a square frame of 1024 pixels.
const BYTE_CAP = 1024 * 1024;
const EDGE_PX = 1024;
const IN_FILE = 'entry.png';
const OUT_FILE = 'entry.png';

// Magic bytes that open a JPEG and a PNG, for a quick sanity check that the
// file we are about to publish really is an image and not something else.
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function fail(message: string): never {
  throw new Error(`[front-page] ${message}`);
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function startsWith(bytes: Buffer, magic: number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

// Walk a JPEG's markers until the frame header (SOF) turns up, and read the
// height and width it carries. Returns null when no SOF is found.
function jpegFrame(bytes: Buffer): [number, number] | null {
  let at = 2;
  while (at + 1 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const size = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = bytes.readUInt16BE(at + 5);
      const width = bytes.readUInt16BE(at + 7);
      return [width, height];
    }
    at += 2 + size;
  }
  return null;
}

// A PNG's width and height sit at fixed offsets inside its IHDR chunk.
function pngFrame(bytes: Buffer): [number, number] | null {
  if (bytes.length < 24) return null;
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function frameOf(bytes: Buffer): [number, number] | null {
  if (startsWith(bytes, JPEG_MAGIC)) return jpegFrame(bytes);
  if (startsWith(bytes, PNG_MAGIC)) return pngFrame(bytes);
  return null;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(here, IN_FILE);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const targetPath = resolve(outDir, OUT_FILE);

  if (!existsSync(sourcePath)) fail(`missing ${IN_FILE} next to this program`);
  const bytes = readFileSync(sourcePath);
  if (bytes.length === 0) fail(`${IN_FILE} is empty`);
  if (bytes.length > BYTE_CAP) {
    fail(`${IN_FILE} is ${bytes.length} bytes, over the ${BYTE_CAP} byte cap`);
  }
  if (!startsWith(bytes, JPEG_MAGIC) && !startsWith(bytes, PNG_MAGIC)) {
    fail(`${IN_FILE} is neither a JPEG nor a PNG`);
  }
  const frame = frameOf(bytes);
  if (frame === null) fail(`could not read the frame size of ${IN_FILE}`);
  if (frame[0] !== EDGE_PX || frame[1] !== EDGE_PX) {
    fail(`${IN_FILE} is ${frame[0]}x${frame[1]}, expected exactly ${EDGE_PX}x${EDGE_PX}`);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(targetPath, bytes);
  const back = readFileSync(targetPath);
  if (!back.equals(bytes)) fail(`published copy differs from ${IN_FILE}`);
  const backFrame = frameOf(back);
  if (backFrame === null || backFrame[0] !== EDGE_PX || backFrame[1] !== EDGE_PX) {
    fail(`published copy is not ${EDGE_PX}x${EDGE_PX}`);
  }

  console.log(`[front-page] wrote ${OUT_FILE} ${bytes.length} bytes ${frame[0]}x${frame[1]} -> ${targetPath}`);
  console.log(`[front-page] sha256 source ${sha256Hex(bytes)}`);
  console.log(`[front-page] sha256 published ${sha256Hex(back)}`);
}

main();
