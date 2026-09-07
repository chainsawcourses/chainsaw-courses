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
 * Synonym/alias groups: if any term in a group is detected in the query,
 * all terms in the group are injected into the query word set for scoring.
 */
const SYNONYM_GROUPS: string[][] = [
  // MHOR / Manual Handling Operations Regulations 1992
  [
    "mhor",
    "manual handling",
    "handling regulations",
    "handling regs",
    "1992",
    "manual handling operations",
    "lifting rules",
    "lifting regulations",
    "lifting regs",
    "handling operations regulations",
    "manual handling regulation",
  ],
  // TILE framework
  [
    "tile",
    "task individual load environment",
    "manual handling assessment",
    "handling risk assessment",
  ],
];

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
 * Expand query words by:
 * 1. Injecting acronym expansions from EXPANSION_MAP for any matching word.
 * 2. Injecting all terms from any SYNONYM_GROUP that has a phrase match in
 *    the query (phrase-level alias matching for MHOR, TILE, etc.).
 *
 * Returns a deduplicated array of words (length >= 3) ready for scoring.
 */
function expandQuery(lowerQuery: string): string[] {
  const sanitised = lowerQuery.replace(/[^\w\s]/g, " ");
  const rawWords = sanitised.split(/\s+/).filter((w) => w.length >= 3);

  const expanded = new Set<string>(rawWords);

  // 1. Acronym expansion (word-level)
  for (const w of rawWords) {
    const expansions = EXPANSION_MAP[w];
    if (expansions) expansions.forEach((e) => expanded.add(e));
  }

  // 2. Phrase-level synonym group injection
  for (const group of SYNONYM_GROUPS) {
    const matched = group.some((term) => lowerQuery.includes(term));
    if (matched) {
      for (const term of group) {
        for (const w of term.split(/\s+/)) {
          if (w.length >= 3) expanded.add(w);
        }
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Find the Q&A entry that best matches a given exam question text.
 *
 * Improvements over the original simple scorer:
 * 1. Minimum word length lowered to 3 (catches "PPE", "HSE", etc.).
 * 2. Acronym expansion so "MHOR", "PUWER" etc. match full-text entries.
 * 3. Phrase-level synonym groups so "manual handling regs", "lifting rules",
 *    "TILE framework" etc. reliably surface the correct MHOR 1992 entries.
 * 4. Scores against sampleAnswers and category in addition to question + modelAnswer.
 * 5. Minimum score threshold of 1.5 to avoid spurious single-word matches.
 */
export function findQaForQuestion(questionText: string): QaEntry | undefined {
  if (!QA_RESOURCE || QA_RESOURCE.length === 0) return undefined;

  const lowerQ = questionText.toLowerCase();
  const qWords = expandQuery(lowerQ);

  let best: QaEntry | undefined;
  let bestScore = -1;

  for (const entry of QA_RESOURCE) {
    const lowerEntry = entry.question.toLowerCase().replace(/[^\w\s]/g, " ");
    const lowerModel = entry.modelAnswer.toLowerCase();
    const lowerSamples = entry.sampleAnswers.join(" ").toLowerCase();
    const lowerCategory = (entry.category ?? "").toLowerCase();

    let score = 0;
    for (const word of qWords) {
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
