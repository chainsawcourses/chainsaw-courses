import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_MANUAL_PAGE_WIDTH = 1000;
export const MAX_MANUAL_PAGE_HEIGHT = 1400;
export const MAX_MANUAL_PAGE_BYTES = 500 * 1024;

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("not a JPEG");
  }

  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("invalid JPEG marker");
    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      throw new Error("invalid JPEG segment");
    }
    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) throw new Error("invalid JPEG dimensions");
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }
    offset += segmentLength;
  }

  throw new Error("JPEG dimensions not found");
}

export async function inspectManualPages(directory) {
  const names = (await readdir(directory))
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort();

  return Promise.all(names.map(async (name) => {
    const contents = await readFile(path.join(directory, name));
    try {
      return { name, bytes: contents.length, ...readJpegDimensions(contents) };
    } catch (error) {
      return {
        name,
        bytes: contents.length,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));
}

export function findManualPageBudgetViolations(pages) {
  return pages.filter((page) =>
    page.error
    || page.width > MAX_MANUAL_PAGE_WIDTH
    || page.height > MAX_MANUAL_PAGE_HEIGHT
    || page.bytes > MAX_MANUAL_PAGE_BYTES
  );
}

export function formatViolation(page) {
  const measured = page.error
    ? `unreadable (${page.error}), ${page.bytes} bytes`
    : `${page.width}x${page.height}, ${page.bytes} bytes`;
  return `${page.name}: ${measured}`;
}

async function main() {
  const directory = fileURLToPath(
    new URL("../../api-server/src/data/manual-pages/", import.meta.url),
  );
  const pages = await inspectManualPages(directory);
  if (pages.length === 0) throw new Error(`No manual JPEGs found in ${directory}`);

  const violations = findManualPageBudgetViolations(pages);
  if (violations.length > 0) {
    console.error(
      `Manual page budget exceeded (maximum ${MAX_MANUAL_PAGE_WIDTH}x${MAX_MANUAL_PAGE_HEIGHT}, `
      + `${MAX_MANUAL_PAGE_BYTES} bytes):`,
    );
    for (const page of violations) console.error(`- ${formatViolation(page)}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Checked ${pages.length} manual JPEGs `
    + `(maximum ${MAX_MANUAL_PAGE_WIDTH}x${MAX_MANUAL_PAGE_HEIGHT}, ${MAX_MANUAL_PAGE_BYTES} bytes).`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  await main();
}