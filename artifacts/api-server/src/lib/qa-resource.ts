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
 * Find the Q&A entry that best matches a given exam question text.
 * Uses simple word-overlap scoring.
 */
export function findQaForQuestion(questionText: string): QaEntry | undefined {
  if (!QA_RESOURCE || QA_RESOURCE.length === 0) return undefined;
  const lowerQ = questionText.toLowerCase();
  const qWords = lowerQ.split(/\s+/).filter((w) => w.length > 3);

  let best: QaEntry | undefined;
  let bestScore = -1;

  for (const entry of QA_RESOURCE) {
    const lowerEntry = entry.question.toLowerCase();
    let score = 0;
    for (const word of qWords) {
      if (lowerEntry.includes(word)) score++;
    }
    const modelLower = entry.modelAnswer.toLowerCase();
    for (const word of qWords) {
      if (modelLower.includes(word)) score += 0.5;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : undefined;
}

export { type QaEntry } from "../data/qa-content";
