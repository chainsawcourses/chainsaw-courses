import { MANUAL_TEXT } from "../data/manual-content";
import { logger } from "./logger";

export function loadManual(): string {
  logger.info({ chars: MANUAL_TEXT.length }, "Chainsaw manual loaded for AI reference");
  return MANUAL_TEXT;
}

export function getManualText(): string {
  return MANUAL_TEXT;
}
