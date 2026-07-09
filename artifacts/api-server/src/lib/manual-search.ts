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
 * Search the manual for passages relevant to a query.
 * Returns the top-N most relevant chunks.
 */
export function searchManual(query: string, topN = 3, minScore = 2): string[] {
  const chunks = getChunks();
  if (chunks.length === 0) return [];

  const queryWords = extractKeywords(query);
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
    return (
      "I don't have a specific answer for that in the training manual. " +
      "Try rephrasing your question using keywords like: risk assessment, kickback, chain brake, PPE, or maintenance."
    );
  }

  const cleaned = passages.map((p) =>
    p
      // Replace any remaining tabs with a space
      .replace(/\t/g, " ")
      // Fix multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );

  const joined = cleaned
    .map((p, i) => `\n\n${i + 1}. ${p}`)
    .join("");

  return (
    `Here is what the training manual says on that topic:${joined}\n\n` +
    "Let me know if you'd like me to dig deeper into any specific area."
  );
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
