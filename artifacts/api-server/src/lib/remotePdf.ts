const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 20_000;

const EXACT_TRUSTED_HOSTS = new Set([
  "drive.google.com",
  "drive.usercontent.google.com",
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "dropbox.com",
  "chainsawcourses.com",
  "www.chainsawcourses.com",
]);

const TRUSTED_HOST_SUFFIXES = [
  ".dropbox.com",
  ".dropboxusercontent.com",
];

export function isTrustedPdfHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return EXACT_TRUSTED_HOSTS.has(normalized)
    || TRUSTED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export function normalizePublicPdfUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS PDF URLs are supported");
  }
  if (url.username || url.password || (url.port && url.port !== "443") || !isTrustedPdfHost(url.hostname)) {
    throw new Error("PDF URL is not allowed");
  }

  const driveMatch = url.hostname === "drive.google.com"
    ? url.pathname.match(/^\/file\/d\/([^/]+)/)
    : null;
  if (driveMatch) {
    return new URL(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveMatch[1])}&export=download&confirm=t`);
  }

  if (url.hostname === "www.dropbox.com" || url.hostname === "dropbox.com") {
    url.searchParams.set("dl", "1");
  }

  return url;
}

async function readLimitedBody(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES) {
    throw new Error("PDF is larger than 30 MB");
  }
  if (!response.body) throw new Error("PDF response had no body");

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PDF_BYTES) {
      await reader.cancel();
      throw new Error("PDF is larger than 30 MB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export async function fetchPublicPdf(rawUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
  let url = normalizePublicPdfUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/pdf,application/octet-stream;q=0.9" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("Too many PDF redirects");
      url = normalizePublicPdfUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Remote PDF returned HTTP ${response.status}`);

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
    const disposition = response.headers.get("content-disposition")?.toLowerCase() || "";
    if (contentType !== "application/pdf"
      && contentType !== "application/octet-stream"
      && !disposition.includes(".pdf")) {
      throw new Error("Remote URL did not return a PDF");
    }

    const bytes = await readLimitedBody(response);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Remote file is not a valid PDF");
    }
    return { bytes, contentType: "application/pdf" };
  }

  throw new Error("Could not fetch remote PDF");
}