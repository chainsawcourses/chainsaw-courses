import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test, { after } from "node:test";
import { build } from "esbuild";
import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdf-lib";

const fixtureDir = await mkdtemp(path.join(tmpdir(), "privacy-policy-pdf-test-"));
const fixturePath = path.join(fixtureDir, "generatePrivacyPolicyPdf.mjs");

await build({
  entryPoints: [path.resolve("src/lib/generatePrivacyPolicyPdf.ts")],
  outfile: fixturePath,
  bundle: true,
  platform: "node",
  format: "esm",
});

const { generatePrivacyPolicyPdf } = await import(pathToFileURL(fixturePath).href);

after(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

test("generated privacy policy PDF retains the approved contact details", async () => {
  const pdfBytes = await generatePrivacyPolicyPdf();
  const document = await PDFDocument.load(pdfBytes);

  assert.ok(document.getPageCount() >= 1, "privacy policy PDF must contain at least one page");

  const parser = new PDFParse({ data: pdfBytes });
  try {
    const { text } = await parser.getText();

    assert.match(text, /info@chainsawcourses\.com/);
    assert.match(text, /Postal address:\s*BR6 9RW/);
  } finally {
    await parser.destroy();
  }
});