import { QA_RESOURCE, type QaEntry } from "../data/qa-content";
import { logger } from "./logger";

export function loadQaResource(): QaEntry[] {
  logger.info({ count: QA_RESOURCE.length }, "Q&A resource loaded for AI reference");
  return QA_RESOURCE;
}

export function getQaResource(): QaEntry[] {
  return QA_RESOURCE;
}

/**
 * Acronym / synonym expansion map.
 * Expands short abbreviations into constituent words so that questions
 * phrased with acronyms ("What does MHOR require?") score against entries
 * whose text uses the full term ("manual handling operations regulations").
 */
const EXPANSION_MAP: Record<string, string[]> = {
  mhor: ["manual", "handling", "operations", "regulations"],
  puwer: ["provision", "work", "equipment", "regulations"],
  coshh: ["control", "substances", "hazardous", "health"],
  hswa: ["health", "safety", "work", "act"],
  riddor: ["reporting", "injuries", "diseases", "dangerous", "occurrences"],
  hse: ["health", "safety", "executive"],
  ppe: ["personal", "protective", "equipment"],
  havs: ["hand", "arm", "vibration", "syndrome"],
  fisa: ["forest", "industry", "safety", "accord"],
  afag: ["arboricultural", "forestry", "advisory", "group"],
  mhswr: ["management", "health", "safety", "work", "regulations"],
};

/**
 * Find the Q&A entry that best matches a given exam question text.
 *
 * Improvements over the original simple scorer:
 * 1. Minimum word length lowered to 3 (catches "PPE", "HSE", "bar", etc.)
 * 2. Acronym expansion so "MHOR", "PUWER" etc. match full-text entries.
 * 3. Scores against sampleAnswers and category in addition to question + modelAnswer.
 * 4. Minimum score threshold raised to 1.5 to avoid spurious single-word matches.
 */
export function findQaForQuestion(questionText: string): QaEntry | undefined {
  if (!QA_RESOURCE || QA_RESOURCE.length === 0) return undefined;

  const lowerQ = questionText.toLowerCase().replace(/[^\w\s]/g, " ");
  const rawWords = lowerQ.split(/\s+/).filter((w) => w.length >= 3);

  // Expand acronyms into their constituent words (deduped via Set)
  const qWords = new Set<string>(rawWords);
  for (const w of rawWords) {
    const expanded = EXPANSION_MAP[w];
    if (expanded) expanded.forEach((e) => qWords.add(e));
  }
  const qWordsArray = Array.from(qWords);

  let best: QaEntry | undefined;
  let bestScore = -1;

  for (const entry of QA_RESOURCE) {
    const lowerEntry = entry.question.toLowerCase().replace(/[^\w\s]/g, " ");
    const lowerModel = entry.modelAnswer.toLowerCase();
    const lowerSamples = entry.sampleAnswers.join(" ").toLowerCase();
    const lowerCategory = (entry.category ?? "").toLowerCase();

    let score = 0;
    for (const word of qWordsArray) {
      if (lowerEntry.includes(word)) score += 1.0;
      else if (lowerModel.includes(word)) score += 0.5;
      else if (lowerSamples.includes(word)) score += 0.3;
      else if (lowerCategory.includes(word)) score += 0.2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  // Require a meaningful match (≥1.5 points) to avoid returning a spurious
  // result when only one incidental word overlaps.
  return bestScore >= 1.5 ? best : undefined;
}

export { type QaEntry } from "../data/qa-content";
