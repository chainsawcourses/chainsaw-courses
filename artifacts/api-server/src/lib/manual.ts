import { logger } from "./logger";

const MANUAL_PDF_URL =
  "https://firebasestorage.googleapis.com/v0/b/chainsaw-courses.firebasestorage.app/o/Chainsaw%20Maintenance%20%26%20Cross%20Cutting.pdf?alt=media&token=6a2f74b2-9402-483b-975c-0387b548784c";

let cachedManualText: string | null = null;
let manualLoadAttempted = false;

export async function loadManual(): Promise<string | null> {
  if (cachedManualText !== null) return cachedManualText;
  if (manualLoadAttempted) return null;
  manualLoadAttempted = true;

  try {
    const response = await fetch(MANUAL_PDF_URL);
    if (!response.ok) {
      logger.warn({ status: response.status }, "Failed to fetch manual PDF");
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    cachedManualText = textResult.text || null;
    if (cachedManualText) {
      logger.info(
        { chars: cachedManualText.length },
        "Chainsaw manual loaded for AI reference"
      );
    }
    return cachedManualText;
  } catch (err) {
    logger.error({ err }, "Error parsing manual PDF");
    return null;
  }
}

export function getManualText(): string | null {
  return cachedManualText;
}
