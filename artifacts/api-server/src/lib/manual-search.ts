import { getManualText } from "./manual";
import { logger } from "./logger";

/**
 * Split manual into paragraphs and score each by keyword overlap.
 * Returns the top-N most relevant passages for a given query.
 */
export function searchManual(query: string, topN = 3, minScore = 1): string[] {
  const manual = getManualText();
  if (!manual || manual.length === 0) return [];

  const queryWords = extractKeywords(query);
  if (queryWords.length === 0) return [];

  // Split on double newlines (paragraphs) or numbered section headers
  const paragraphs = manual
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const scored = paragraphs.map((p) => {
    const lower = p.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      const matches = lower.match(regex);
      score += (matches ? matches.length : 0) * 3;
      // Also give partial credit for substring matches (e.g. "kickback" in "anti-kickback")
      if (lower.includes(word)) {
        score += 1;
      }
    }
    return { text: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score >= minScore).slice(0, topN);

  if (top.length === 0) {
    // Fallback: try looser search (any single keyword match)
    const loose = scored.filter((s) => s.score > 0).slice(0, 2);
    return loose.map((s) => s.text);
  }

  return top.map((s) => s.text);
}

/**
 * Build a friendly natural-language answer from manual passages.
 */
export function buildTutorAnswer(query: string, passages: string[]): string {
  if (passages.length === 0) {
    return (
      "I don't have a specific answer for that in the training manual. " +
      "Try rephrasing your question using keywords like: risk assessment, kickback, chain brake, PPE, or maintenance."
    );
  }

  const joined = passages
    .map((p, i) => `\n${i + 1}. ${p}`)
    .join("");

  return (
    `Here is what the training manual says on that topic:\n${joined}\n\n` +
    "Let me know if you'd like me to dig deeper into any specific area."
  );
}

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  // Remove punctuation and split
  const words = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOP_WORDS.has(w));
  // Expand with common stems (e.g. "maintain" → also check "mainten")
  const expanded = new Set<string>();
  for (const w of words) {
    expanded.add(w);
    const stem = getStem(w);
    if (stem !== w) expanded.add(stem);
  }
  return [...expanded];
}

/**
 * Simple stem helper: strip common suffixes so "maintain" matches "maintenance".
 */
function getStem(word: string): string {
  const suffixes = ["ing", "ed", "er", "est", "ly", "ion", "tion", "ation", "ance", "ence", "ment", "ness", "ity", "ies", "s"];
  for (const s of suffixes) {
    if (word.endsWith(s) && word.length - s.length > 2) {
      return word.slice(0, -s.length);
    }
  }
  return word;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was",
  "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now",
  "old", "see", "two", "way", "who", "boy", "did", "she", "use", "her", "him", "his", "how",
  "man", "men", "run", "she", "sun", "way", "what", "with", "have", "this", "will", "your",
  "from", "they", "know", "want", "been", "good", "much", "some", "time", "very", "when",
  "come", "here", "just", "like", "long", "make", "many", "over", "such", "take", "than",
  "them", "well", "were", "what", "that", "which", "their", "would", "there", "about",
  "after", "back", "other", "many", "then", "them", "these", "could", "should", "would",
  "could", "should", "would", "each", "into", "most", "only", "said", "some", "time",
  "very", "also", "first", "after", "being", "made", "more", "must", "need", "same",
  "such", "take", "than", "them", "well", "were",
  // Chainsaw-specific filter: "what is a chainsaw" should keep "chainsaw"
  "does", "isnt", "dont", "wont", "cant", "didnt", "wasnt", "werent", "wouldnt", "shouldnt",
  "hasnt", "havent", "hadnt",
]);
