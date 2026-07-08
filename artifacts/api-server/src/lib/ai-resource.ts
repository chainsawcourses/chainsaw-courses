import { loadManual, getManualText } from "./manual";
import { loadQaResource, getQaResource, findQaForQuestion, type QaEntry } from "./qa-resource";
import { logger } from "./logger";

/**
 * Pre-load all AI reference resources on server startup.
 * Both manual and Q&A are inlined as TS modules (no runtime file I/O).
 */
export function loadAllAiResources(): void {
  try {
    loadManual();
  } catch (err) {
    logger.warn({ err }, "Manual pre-load failed");
  }
  try {
    loadQaResource();
  } catch (err) {
    logger.warn({ err }, "Q&A pre-load failed");
  }
}

export { getManualText, getQaResource, findQaForQuestion, type QaEntry };
