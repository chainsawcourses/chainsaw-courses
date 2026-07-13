import { getManualText } from "./manual";
import { logger } from "./logger";

interface Chunk {
  title: string;
  content: string;
  score: number;
}

let cachedChunks: Chunk[] | null = null;

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
      .replace(/\t/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (joined.length > 30) {
      chunks.push({ title: currentTitle, content: joined, score: 0 });
    }
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) { flushBuffer(); continue; }
    if (/^--\s*\d+\s*of\s*\d+\s*--$/.test(line)) { flushBuffer(); continue; }
    if (/^\d+\s+The Chainsaw Manual$/.test(line)) { flushBuffer(); continue; }
    if (line === "The Chainsaw Manual" || line === "CHAINSAW" || line === "MAINTENANCE &" || line === "CROSS CUTTING") { flushBuffer(); continue; }
    if (/^Published by/.test(line) || /^Copyright/.test(line) || /^First Edition:/.test(line) || /^Version /.test(line)) { flushBuffer(); continue; }
    if (/^\d{1,4}$/.test(line)) continue;

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

// ---------------------------------------------------------------------------
// Hardcoded troubleshooting answers for common questions.
// These fire BEFORE any manual search so natural-language phrasing always
// gets a correct, concise answer even when the AI is offline.
// ---------------------------------------------------------------------------

interface TroubleshootEntry {
  patterns: RegExp[];
  answer: string;
}

const TROUBLESHOOT: TroubleshootEntry[] = [
  {
    patterns: [
      /\b(cuts?\s+out|dies?|stalls?|keeps?\s+stopping|keeps?\s+cutting\s+out|stops?\s+running|runs?\s+then\s+stops?)\b/i,
      /\bstarts?\s+(and|but)\s+(then\s+)?(cuts?\s+out|dies?|stalls?|stops?)\b/i,
    ],
    answer:
      "This usually means a carburetor or fuel delivery issue. The most common causes are: a dirty air filter restricting airflow, a blocked fuel filter, stale or incorrectly mixed fuel, or the idle speed/mixture screws on the carburettor needing adjustment. Start by checking the air filter — if it's clean, check the fuel filter inside the tank.",
  },
  {
    patterns: [
      /\b(won'?t\s+start|not\s+starting|hard\s+to\s+start|difficult\s+to\s+start|can'?t\s+start|doesn'?t\s+start)\b/i,
      /\bstarting\s+(problem|issue|trouble|difficulty)\b/i,
    ],
    answer:
      "First check the chain brake is fully disengaged — the saw won't start if the front hand guard is in the braked position. Then check: fuel is the correct 50:1 mix and not stale, the choke is being used correctly (fully closed for a cold start), the spark plug is clean and gapped correctly, and the air filter is not blocked.",
  },
  {
    patterns: [
      /\b(chain\s+(not\s+moving|won'?t\s+move|not\s+spinning|won'?t\s+spin|not\s+turning))\b/i,
      /\b(won'?t\s+cut|not\s+cutting)\b/i,
    ],
    answer:
      "If the engine revs but the chain doesn't move, the chain brake may be engaged — push the front hand guard fully back towards the handlebar to release it. If the brake is released and the chain still doesn't move, the clutch pads or drive sprocket may be worn.",
  },
  {
    patterns: [
      /\b(smok(e|ing)|smoke\s+coming)\b/i,
    ],
    answer:
      "Smoke from the bar area usually means the chain oil isn't reaching the bar — check the oil reservoir is full and the oil feed hole on the bar is clear. Smoke from the engine area can indicate an air filter blockage causing the engine to run rich, or an exhaust/cooling system issue.",
  },
  {
    patterns: [
      /\b(overheating|too\s+hot|running\s+hot)\b/i,
    ],
    answer:
      "Overheating is usually caused by a blocked air filter or cooling fins clogged with sawdust. Remove and clean the air filter and use compressed air to clear the cooling fins around the cylinder. Also ensure bar oil is flowing correctly — running dry causes rapid heat build-up.",
  },
  {
    patterns: [
      /\b(kickback)\b/i,
    ],
    answer:
      "Kickback occurs when the nose of the guide bar contacts an object or is pinched. Always use the full length of the bar rather than the nose, maintain correct grip with thumbs wrapped around handles, keep the chain sharp, and ensure the chain brake is serviceable so it activates during kickback.",
  },
  {
    patterns: [
      /\b(chain\s+brake)\b/i,
    ],
    answer:
      "The chain brake stops the chain rotating within fractions of a second. It activates either manually (pushing the front hand guard forward with your wrist) or automatically via an inertia mechanism during kickback. Test it before each use: run the saw at idle, push the guard forward firmly — the chain should stop immediately.",
  },
  {
    patterns: [
      /\b(ppe|personal\s+protective|protective\s+equipment|what\s+(to\s+wear|should\s+i\s+wear)|chainsaw\s+trousers|chainsaw\s+boots|helmet)\b/i,
    ],
    answer:
      "Mandatory PPE for chainsaw work: chainsaw-protective trousers or chaps (Class 1 minimum), chainsaw boots (Class 2 chain cut protection), safety helmet with integrated visor and ear defenders, cut-resistant gloves, and hi-vis if working near others. The helmet visor must be down whenever the saw is running.",
  },
  {
    patterns: [
      /\b(fuel\s+mix|mixing\s+fuel|oil\s+ratio|petrol\s+mix|two.?stroke\s+mix|fuel\s+ratio)\b/i,
    ],
    answer:
      "The standard fuel mix for a two-stroke chainsaw is 50:1 — 50 parts unleaded petrol to 1 part two-stroke oil. Always mix in a proper fuel can (never in the saw's tank), use fresh unleaded (minimum 95 octane recommended), and use quality two-stroke oil designed for air-cooled engines. Stale fuel is a leading cause of starting and running problems.",
  },
  {
    patterns: [
      /\b(bar\s+oil|chain\s+oil|lubrication|oiling\s+the\s+(chain|bar))\b/i,
    ],
    answer:
      "The bar and chain must be continuously lubricated during use. Check the oil reservoir before every session and top up with proprietary bar and chain oil. To verify flow, hold the bar over pale ground at high revs — you should see a fine oil streak appear. Running without oil rapidly damages the bar groove and chain drive links.",
  },
  {
    patterns: [
      /\b(sharpen(ing)?|filing|file\s+the\s+chain|blunt\s+chain|dull\s+chain)\b/i,
    ],
    answer:
      "A sharp chain cuts with minimal downward pressure and produces chip-like shavings. A blunt chain produces dust and requires forcing. Use the correct round file size for your chain pitch (e.g. 4mm for 3/8\" pitch), maintain the correct top-plate filing angle (usually 30°), and keep all cutters the same length. File every cutter from the inside out in one direction only.",
  },
  {
    patterns: [
      /\b(tension|tensioning|tight(en)?|slack\s+chain|chain\s+tension)\b/i,
    ],
    answer:
      "Correct chain tension: with the engine off and bar level, the chain should just be snug against the underside of the bar — lift the middle of the top run and it should pull away by about 3–4mm. A chain that sags or rattles is too loose; one that's very stiff to pull by hand is too tight. Always tension with the bar nose lifted and re-tighten the bar nuts before running.",
  },
  {
    patterns: [
      /\b(spark\s+plug|plug)\b/i,
    ],
    answer:
      "Remove and inspect the spark plug regularly. A light tan/grey deposit is normal. Black sooty deposits mean the mixture is too rich (choke left on, dirty air filter). White/chalky deposits mean the mixture is too lean or overheating. Replace if the electrode is worn, cracked, or the gap is wrong. Standard gap is typically 0.5mm — check the manufacturer's spec.",
  },
  {
    patterns: [
      /\b(air\s+filter|airfilter)\b/i,
    ],
    answer:
      "The air filter should be checked before every use and cleaned regularly — a partially blocked filter causes rich running, poor power, and starting difficulty. Remove, tap gently to dislodge loose debris, then wash in warm soapy water, rinse, and allow to dry completely before refitting. Never use compressed air on a foam filter as it can damage it.",
  },
];

function matchTroubleshoot(query: string): string | null {
  for (const entry of TROUBLESHOOT) {
    for (const pattern of entry.patterns) {
      if (pattern.test(query)) return entry.answer;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Manual keyword search (used only when no hardcoded answer matches)
// ---------------------------------------------------------------------------

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
      const titleMatches = lowerTitle.match(new RegExp(`\\b${word}\\b`, "g"));
      score += (titleMatches ? titleMatches.length : 0) * 8;
      if (lowerTitle.includes(word)) score += 3;

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
 * Build a tutor answer from a query when AI is offline.
 * Tries hardcoded troubleshooting answers first; falls back to manual search.
 */
export function buildTutorAnswer(query: string, passages: string[]): string {
  const direct = matchTroubleshoot(query);
  if (direct) return direct;

  if (passages.length === 0) {
    return "The AI tutor is temporarily unavailable. Please try again in a few minutes.";
  }

  const best = passages[0]
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return best.length > 350 ? best.slice(0, 347) + "…" : best;
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
