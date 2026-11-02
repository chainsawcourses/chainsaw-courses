/**
 * Clean and verify the retailer directory supplied as a tab-separated file.
 *
 * The cleaning part is deliberately deterministic. Network verification is
 * best-effort (and can be disabled with --no-network), so a checked-in seed
 * can be regenerated with a fixed --checked-at value without changing its
 * timestamps.
 *
 * Usage:
 *   pnpm exec tsx scripts/src/clean-retailer-directory.ts
 *   pnpm exec tsx scripts/src/clean-retailer-directory.ts --no-network
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultInput = path.join(
  repositoryRoot,
  "attached_assets/Pasted-Company-Name-Web-Address-Physical-Address-Email-Phone-C_1789474329980.txt",
);
const defaultOutput = path.join(repositoryRoot, "artifacts/api-server/src/data/retailerDirectorySeed.json");
const defaultCheckedAt = "2026-09-15T00:00:00.000Z";

const evidenceTerms =
  /\b(?:buy|shop|sale|price|product|cart|order|husqvarna|stihl|echo|makita|dolmar|efco|jonsered|oleo)\b/i;
const chainsawTerms = /\bchainsaw(?:s|ing)?\b|\bchain saws?\b/i;
const postcodePattern = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const emailPattern = /^[^\s@/:]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type RetailerSeed = {
  name: string;
  address: string;
  postcode: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  verificationStatus:
    | "verified"
    | "reachable-no-evidence"
    | "unreachable"
    | "missing-postcode"
    | "missing-website"
    | "invalid-website";
  evidenceUrl: string | null;
  lastCheckedAt: string;
  active: boolean;
};

type SourceRow = {
  name: string;
  webAddress: string;
  address: string;
  email: string;
  phone: string;
  rowNumber: number;
};

type NormalizedRow = Omit<
  RetailerSeed,
  "verificationStatus" | "evidenceUrl" | "lastCheckedAt" | "active"
> & {
  sourceRow: number;
  dedupeKey: string;
};

type Verification = {
  reachable: boolean;
  evidenceUrl: string | null;
};

function argumentValue(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function resolvePath(value: string, baseDirectory = process.cwd()): string {
  if (path.isAbsolute(value)) return value;
  if (value.startsWith("attached_assets/") || value.startsWith("artifacts/")) {
    return path.resolve(repositoryRoot, value);
  }
  return path.resolve(baseDirectory, value);
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeName(value: string): string {
  return collapse(value);
}

function normalizeAddress(value: string): string {
  return collapse(value);
}

function normalizeEmail(value: string): string | null {
  const email = collapse(value).toLowerCase();
  return emailPattern.test(email) ? email : null;
}

function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;
  if (compact.startsWith("+44")) {
    const national = `0${compact.slice(3)}`;
    return /^0\d{9,10}$/.test(national) ? national : null;
  }
  return /^0\d{9,10}$/.test(compact) ? compact : null;
}

function normalizePostcode(address: string): string | null {
  const match = address.match(postcodePattern);
  if (!match) return null;
  const compact = match[1].replace(/\s+/g, "").toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

function normalizeWebsite(value: string): string | null {
  const raw = collapse(value);
  if (!raw || /^https?:\/\/(?:www\.)?google\./i.test(raw)) return null;
  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".") || url.protocol === "javascript:") return null;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return `https://${hostname}`;
  } catch {
    return null;
  }
}

function websiteHost(value: string): string {
  return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
}

function dedupeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseSource(input: string): SourceRow[] {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The retailer TSV has no data rows.");
  const header = lines[0].split("\t").map((part) => part.trim().toLowerCase());
  if (
    header.length < 5 ||
    header[0] !== "company name" ||
    header[1] !== "web address" ||
    header[2] !== "physical address"
  ) {
    throw new Error("Unexpected retailer TSV header; expected Company Name, Web Address, Physical Address, Email, Phone.");
  }

  return lines.slice(1).map((line, index) => {
    const fields = line.split("\t");
    if (fields.length !== 5) {
      throw new Error(`Row ${index + 2} has ${fields.length} columns; expected 5.`);
    }
    return {
      name: fields[0],
      webAddress: fields[1],
      address: fields[2],
      email: fields[3],
      phone: fields[4],
      rowNumber: index + 2,
    };
  });
}

function normalizeRows(rows: SourceRow[]): { rows: NormalizedRow[]; duplicateCount: number } {
  const seen = new Set<string>();
  const normalized: NormalizedRow[] = [];
  let duplicateCount = 0;

  for (const row of rows) {
    const website = normalizeWebsite(row.webAddress);
    const address = normalizeAddress(row.address);
    const postcode = normalizePostcode(address);
    const phone = normalizePhone(row.phone);
    const email = normalizeEmail(row.email);
    // A website and postcode identify a branch. The phone is included to
    // avoid collapsing legitimate same-postcode branches. When no postcode
    // exists, retain distinct addresses (including service-area entries).
    const branchIdentity = postcode
      ? `${website ?? ""}|${postcode}|${phone ?? ""}`
      : `${website ?? ""}|${dedupeText(address)}|${phone ?? ""}`;
    if (seen.has(branchIdentity)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(branchIdentity);
    normalized.push({
      name: normalizeName(row.name),
      address,
      postcode,
      email,
      phone,
      website,
      sourceRow: row.rowNumber,
      dedupeKey: branchIdentity,
    });
  }
  return { rows: normalized, duplicateCount };
}

function stripMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ");
}

function hasChainsawSaleEvidence(html: string): boolean {
  const text = stripMarkup(html);
  if (!chainsawTerms.test(text) || !evidenceTerms.test(text)) return false;
  // Require sale language close to the chainsaw mention. This avoids treating
  // an unrelated retailer footer or a generic service statement as proof.
  return (
    /(?:chainsaw(?:s|ing)?|chain saws?).{0,240}(?:buy|shop|sale|price|product|cart|order|husqvarna|stihl|echo|makita|dolmar|efco|jonsered|oleo)/i.test(
      text,
    ) ||
    /(?:buy|shop|sale|price|product|cart|order|husqvarna|stihl|echo|makita|dolmar|efco|jonsered|oleo).{0,240}(?:chainsaw(?:s|ing)?|chain saws?)/i.test(
      text,
    )
  );
}

function sameRetailerHost(candidate: string, expectedHost: string): boolean {
  try {
    return websiteHost(candidate) === expectedHost;
  } catch {
    return false;
  }
}

function cleanUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.toString().replace(/\/$/, "") || url.toString();
}

function candidateLinks(html: string, baseUrl: string): string[] {
  const expectedHost = websiteHost(baseUrl);
  const links: string[] = [];
  for (const match of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = cleanUrl(new URL(match[1], baseUrl).toString());
      if (!/^https?:$/i.test(new URL(url).protocol) || !sameRetailerHost(url, expectedHost)) continue;
      if (!/(chain\s*saw|chainsaw|shop|product|machine|garden)/i.test(url)) continue;
      if (!links.includes(url)) links.push(url);
    } catch {
      // Ignore malformed links emitted by a retailer's CMS.
    }
  }
  return links.slice(0, 8);
}

async function fetchPage(url: string, timeoutMs: number): Promise<{ url: string; body: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = await response.text();
    return { url: cleanUrl(response.url || url), body };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyWebsite(website: string, timeoutMs: number): Promise<Verification> {
  const origin = website.replace(/\/$/, "");
  const expectedHost = websiteHost(origin);
  const candidateUrls = [
    origin,
    `${origin}/search?q=chainsaw`,
    `${origin}/search?type=product&q=chainsaw`,
    `${origin}/collections/chainsaws`,
    `${origin}/chainsaws`,
    `${origin}/chainsaw`,
    `${origin}/shop/chainsaws`,
  ];
  let reachable = false;
  const checked = new Set<string>();
  const pages: Array<{ url: string; body: string }> = [];

  for (const url of candidateUrls) {
    const page = await fetchPage(url, timeoutMs);
    if (!page || !sameRetailerHost(page.url, expectedHost)) continue;
    reachable = true;
    if (checked.has(page.url)) continue;
    checked.add(page.url);
    pages.push(page);
    if (hasChainsawSaleEvidence(page.body)) {
      return { reachable: true, evidenceUrl: page.url };
    }
    // Links are collected only from the retailer-owned homepage.
    if (url === origin) {
      for (const linkedUrl of candidateLinks(page.body, origin)) {
        if (!checked.has(linkedUrl)) candidateUrls.push(linkedUrl);
      }
    }
  }
  return { reachable, evidenceUrl: null };
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      output[index] = await fn(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return output;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = resolvePath(argumentValue(args, "--input", defaultInput));
  const outputPath = resolvePath(argumentValue(args, "--output", defaultOutput));
  const checkedAt = argumentValue(args, "--checked-at", defaultCheckedAt);
  if (Number.isNaN(Date.parse(checkedAt))) throw new Error(`Invalid --checked-at timestamp: ${checkedAt}`);
  const network = !args.includes("--no-network");
  const concurrency = Math.max(1, Number(argumentValue(args, "--concurrency", "8")) || 8);
  const timeoutMs = Math.max(1000, Number(argumentValue(args, "--timeout-ms", "8000")) || 8000);

  const sourceRows = parseSource(await readFile(inputPath, "utf8"));
  const { rows, duplicateCount } = normalizeRows(sourceRows);
  const verifications = network
    ? await mapConcurrent(rows, concurrency, (row) =>
        row.website ? verifyWebsite(row.website, timeoutMs) : Promise.resolve({ reachable: false, evidenceUrl: null }),
      )
    : rows.map(() => ({ reachable: false, evidenceUrl: null }));

  const seed: RetailerSeed[] = rows.map((row, index) => {
    const verification = verifications[index];
    let verificationStatus: RetailerSeed["verificationStatus"];
    if (!row.website) verificationStatus = "missing-website";
    else if (!row.postcode) verificationStatus = "missing-postcode";
    else if (!network || !verification.reachable) verificationStatus = network ? "unreachable" : "unreachable";
    else if (!verification.evidenceUrl) verificationStatus = "reachable-no-evidence";
    else verificationStatus = "verified";
    return {
      name: row.name,
      address: row.address,
      postcode: row.postcode,
      email: row.email,
      phone: row.phone,
      website: row.website,
      verificationStatus,
      evidenceUrl: verification.evidenceUrl,
      lastCheckedAt: checkedAt,
      active: verificationStatus === "verified" && Boolean(row.postcode && verification.evidenceUrl),
    };
  });

  await writeFile(outputPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  const active = seed.filter((row) => row.active).length;
  const statusCounts = Object.fromEntries(
    [...new Set(seed.map((row) => row.verificationStatus))].map((status) => [
      status,
      seed.filter((row) => row.verificationStatus === status).length,
    ]),
  );
  console.log(
    JSON.stringify(
      {
        inputRows: sourceRows.length,
        outputRows: seed.length,
        removedTrueDuplicates: duplicateCount,
        active,
        statusCounts,
        outputPath,
        network,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});