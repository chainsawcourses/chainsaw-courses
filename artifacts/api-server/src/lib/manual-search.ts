import { getManualText } from "./manual";
import { logger } from "./logger";

interface Chunk {
  title: string;
  content: string;
  score: number;
}

let cachedChunks: Chunk[] | null = null;

/**
 * Pre-process the raw manual into clean, meaningful chunks.
 * Strips page markers/headers, groups fragmented lines into paragraphs,
 * and identifies section titles.
 */
function getChunks(): Chunk[] {
  if (cachedChunks) return cachedChunks;

  const manual = getManualText();
  if (!manual || manual.length === 0) return [];

  const lines = manual.split("\n");
  const chunks: Chunk[] = [];
  let currentTitle = "";
  let buffer: string[] = [];

  const flushBuffer = () => {
    const joined = buffer
      .join(" ")
      .replace(/\t/g, " ")   // tabs → spaces
      .replace(/\s+/g, " ")  // collapse whitespace
      .trim();
    if (joined.length > 30) {
      chunks.push({ title: currentTitle, content: joined, score: 0 });
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Skip empty lines, page markers, page headers, standalone title lines
    if (line.length === 0) {
      flushBuffer();
      continue;
    }
    if (/^--\s*\d+\s*of\s*\d+\s*--$/.test(line)) {
      flushBuffer();
      continue;
    }
    if (/^\d+\s+The Chainsaw Manual$/.test(line)) {
      flushBuffer();
      continue;
    }
    if (line === "The Chainsaw Manual" || line === "CHAINSAW" || line === "MAINTENANCE &" || line === "CROSS CUTTING") {
      flushBuffer();
      continue;
    }
    if (/^Published by/.test(line) || /^Copyright/.test(line) || /^First Edition:/.test(line) || /^Version /.test(line)) {
      flushBuffer();
      continue;
    }
    // Skip standalone page numbers that appear on their own line (e.g. "82", "76")
    if (/^\d{1,4}$/.test(line)) {
      continue;
    }
    // Skip "-- 1 of 138 --" style page markers embedded mid-paragraph
    if (/^--\s*\d+\s*of\s*\d+\s*--$/.test(line)) {
      continue;
    }

    // Section headers: numbered sections ("1. Title"), dash/en-dash items ("- Title" or "\u2013 Title"), all-caps headers
    const isSectionHeader =
      /^\d+\.\s+[A-Z]/.test(line) ||
      /^[-\u2022\u2013]\s+[A-Z]/.test(line) ||
      (/^[A-Z][A-Z\s&\-:]+$/.test(line) && line.length > 5 && line.length < 60);

    if (isSectionHeader) {
      flushBuffer();
      currentTitle = line.replace(/^[-\u2022\u2013]\s*/, "").trim();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  cachedChunks = chunks;
  logger.info({ chunks: chunks.length }, "Manual indexed for search");
  return chunks;
}

/**
 * Maps colloquial phrases to the technical terms they actually refer to.
 * Applied before keyword extraction so the search scores the right chunks.
 */
const PHRASE_INTENT: Array<{ pattern: RegExp; inject: string }> = [
  // Engine stalling / stopping
  { pattern: /\bcuts?\s+out\b/i,        inject: "engine stalls idle carburetor fuel" },
  { pattern: /\bdies?\b/i,              inject: "engine stalls idle carburetor fuel" },
  { pattern: /\bstalls?\b/i,            inject: "engine stalls idle carburetor fuel" },
  { pattern: /\bkeeps?\s+stopping\b/i,  inject: "engine stalls idle carburetor fuel" },
  // Starting problems
  { pattern: /\bwon'?t\s+start\b/i,     inject: "starting ignition spark plug choke fuel" },
  { pattern: /\bhard\s+to\s+start\b/i,  inject: "starting ignition spark plug choke" },
  { pattern: /\bnot\s+starting\b/i,     inject: "starting ignition spark plug fuel" },
  { pattern: /\bwon'?t\s+pull\b/i,      inject: "starter recoil starting" },
  // Overheating / smoke
  { pattern: /\bsmok(e|ing)\b/i,        inject: "oil lubrication overheating cooling" },
  { pattern: /\boverheating\b/i,        inject: "cooling air filter oil lubrication" },
  // Chain movement
  { pattern: /\bchain\s+not\s+moving\b/i, inject: "clutch chain brake drive" },
  { pattern: /\bchain\s+won'?t\s+move\b/i, inject: "clutch chain brake drive" },
  // Vibration
  { pattern: /\bvibrat/i,               inject: "anti-vibration mounts worn" },
];

function expandQuery(query: string): string {
  let extra = "";
  for (const { pattern, inject } of PHRASE_INTENT) {
    if (pattern.test(query)) extra += " " + inject;
  }
  return extra ? query + " " + extra : query;
}

/**
 * Search the manual for passages relevant to a query.
 * Returns the top-N most relevant chunks.
 */
export function searchManual(query: string, topN = 3, minScore = 2): string[] {
  const chunks = getChunks();
  if (chunks.length === 0) return [];

  const expanded = expandQuery(query);
  const queryWords = extractKeywords(expanded);
  if (queryWords.length === 0) return [];

  const scored = chunks.map((chunk) => {
    const lowerTitle = chunk.title.toLowerCase();
    const lowerContent = chunk.content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      // Title matches weighted heavily
      const titleMatches = lowerTitle.match(new RegExp(`\\b${word}\\b`, "g"));
      score += (titleMatches ? titleMatches.length : 0) * 8;
      if (lowerTitle.includes(word)) score += 3;

      // Content matches
      const contentMatches = lowerContent.match(new RegExp(`\\b${word}\\b`, "g"));
      score += (contentMatches ? contentMatches.length : 0) * 2;
      if (lowerContent.includes(word)) score += 1;
    }
    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score >= minScore).slice(0, topN);

  if (top.length === 0) {
    const loose = scored.filter((s) => s.score > 0).slice(0, 2);
    return loose.map((s) => formatChunk(s));
  }

  return top.map((s) => formatChunk(s));
}

function formatChunk(chunk: Chunk): string {
  const title = chunk.title.replace(/^\d+\.\s*/, "").replace(/^[-\u2022\u2013]\s*/, "").trim();
  if (title && chunk.content !== title) {
    return `**${title}**\n${chunk.content}`;
  }
  return chunk.content;
}

/**
 * Build a friendly natural-language answer from manual passages.
 */
export function buildTutorAnswer(query: string, passages: string[]): string {
  if (passages.length === 0) {
    return "That topic isn't covered in the training manual. Try asking about starting, carburetor, chain brake, PPE, kickback, or maintenance.";
  }

  // Take only the single best passage and trim it to ~300 chars to keep it short
  const best = passages[0]
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const trimmed = best.length > 350 ? best.slice(0, 347) + "…" : best;

  return trimmed;
}

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOP_WORDS.has(w));

  const expanded = new Set<string>();
  for (const w of words) {
    expanded.add(w);
    const stem = getStem(w);
    if (stem !== w) expanded.add(stem);
  }
  return [...expanded];
}

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
  "old", "see", "two", "way", "who", "boy", "did", "she", "use", "man", "men", "run", "sun",
  "what", "with", "have", "this", "will", "your", "from", "they", "know", "want", "been",
  "good", "much", "some", "time", "very", "when", "come", "here", "just", "like", "long",
  "make", "many", "over", "such", "take", "than", "them", "well", "were", "that", "which",
  "their", "would", "there", "about", "after", "back", "other", "then", "these", "could",
  "should", "each", "into", "most", "only", "said", "also", "first", "being", "made", "more",
  "must", "need", "same", "does", "isnt", "dont", "wont", "cant", "didnt", "wasnt", "werent",
  "wouldnt", "shouldnt", "hasnt", "havent", "hadnt",
]);
