/**
 * stt-scan-lib.ts
 * Shared STT-scan logic used by scan-transcripts.ts and the generate-pdfs.ts
 * pre-flight check.  No side-effects at import time; callers decide what to
 * do with the results.
 */

import { pool } from "@workspace/db";

// ---------------------------------------------------------------------------
// Known-terms dictionary
//
// Each key is the CORRECT term; the array lists confirmed STT misreadings.
// Matching is whole-word, case-insensitive.
// IMPORTANT: see the dictionary design rules in scan-transcripts.ts before
// editing (no ordinary English words as variants, unambiguous in context, etc.)
// ---------------------------------------------------------------------------
export const TERM_CORRECTIONS: Record<string, string[]> = {
  // Regulations confirmed via real transcripts or obvious phonetic confusion
  // "pure" is the confirmed real-world STT error for PUWER (task description).
  PUWER: ["pure", "puer", "pewter"],
  // "cosh" is phonetically similar; uncommon in chainsaw-safety text.
  COSHH: ["cosh"],
  // "lola", "loller" — proper-noun misreadings, not ordinary words.
  LOLER: ["lola", "loller"],
  // Very specific phonetic distortions of RIDDOR.
  RIDDOR: ["ridor", "ridder"],

  // Forestry Industry Safety Accord — phonetic variants of the acronym.
  FISA: ["feser", "fiser", "fizer", "fyser"],

  // Chainsaw manufacturer — confirmed phonetic distortions of proper noun.
  Husqvarna: ["huskvarna", "husquarna", "huskvana"],

  // Multi-word technical phrases — safe because the whole phrase is specific.
  "chain brake": ["chain break"],
  "anti-vibration": ["anti vibrations"],
  "kickback zone": ["kickback zoned"],
  "chainsaw chaps": ["chainsaw chops"],
  "personal protective equipment": ["personal protection equipment"],
  "risk assessment": ["risk assesment", "risk assessement"],
  "manual handling": ["manual handeling", "manuel handling"],
  "working at height": ["working at hight", "working at heigh"],
  "competent person": ["competant person", "compentent person"],
  "felling cut": ["filling cut", "feling cut"],
  "bore cut": ["bored cut", "borr cut"],
  "plunge cut": ["plundge cut"],
  "spring pole": ["spring poll"],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Segment {
  timecodeStart: string;
  timecodeEnd: string;
  text: string;
}

export interface Flag {
  moduleOrder: number;
  moduleTitle: string;
  segmentIndex: number;
  timecodeStart: string;
  timecodeEnd: string;
  originalText: string;
  correctedText: string;
  matches: Array<{ wrong: string; correct: string }>;
}

export interface Fixture {
  input: string;
  expectFlag: boolean;
  description: string;
}

// ---------------------------------------------------------------------------
// Test fixtures: verify precision before allowing --fix
// ---------------------------------------------------------------------------
export const PRECISION_FIXTURES: Fixture[] = [
  // True positives
  { input: "The regulations known as pure apply here", expectFlag: true, description: "PUWER / pure (confirmed real case)" },
  { input: "huskvarna chainsaws require specialist training", expectFlag: true, description: "Husqvarna / huskvarna" },
  { input: "always engage the chain break before moving", expectFlag: true, description: "chain brake / chain break" },
  { input: "this falls under cosh regulations", expectFlag: true, description: "COSHH / cosh" },
  { input: "covered by ridor reporting requirements", expectFlag: true, description: "RIDDOR / ridor" },
  { input: "lola covers lifting operations", expectFlag: true, description: "LOLER / lola" },
  { input: "the feser guidelines set out safe working practices", expectFlag: true, description: "FISA / feser" },
  // False-positive guards — these must NOT be flagged
  { input: "power tools must be maintained correctly", expectFlag: false, description: "No false flag on 'power'" },
  { input: "the costs of PPE are covered by the employer", expectFlag: false, description: "No false flag on 'costs'" },
  { input: "lower branches should be removed first", expectFlag: false, description: "No false flag on 'lower'" },
  { input: "the tree is still standing after the back cut", expectFlag: false, description: "No false flag on 'still'" },
  { input: "a steel-toed boot is recommended", expectFlag: false, description: "No false flag on 'steel'" },
  { input: "the organ of corti is unrelated to chainsaws", expectFlag: false, description: "No false flag on 'organ'" },
];

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function scanSegment(
  text: string
): Array<{ wrong: string; correct: string }> | null {
  const matches: Array<{ wrong: string; correct: string }> = [];

  for (const [correct, variants] of Object.entries(TERM_CORRECTIONS)) {
    for (const variant of variants) {
      const pattern = new RegExp(
        `(?<![a-zA-Z])${escapeRegex(variant)}(?![a-zA-Z])`,
        "gi"
      );
      if (pattern.test(text)) {
        if (!matches.some((m) => m.correct === correct)) {
          matches.push({ wrong: variant, correct });
        }
        break;
      }
    }
  }

  return matches.length > 0 ? matches : null;
}

export function applyCorrections(
  text: string,
  matches: Array<{ wrong: string; correct: string }>
): string {
  let result = text;
  for (const { wrong, correct } of matches) {
    const pattern = new RegExp(
      `(?<![a-zA-Z])${escapeRegex(wrong)}(?![a-zA-Z])`,
      "gi"
    );
    result = result.replace(pattern, (m) => {
      if (m === m.toUpperCase()) return correct.toUpperCase();
      if (m[0] === m[0].toUpperCase()) {
        return correct[0].toUpperCase() + correct.slice(1);
      }
      return correct;
    });
  }
  return result;
}

export function runPrecisionFixtures(): boolean {
  let allPassed = true;
  for (const fixture of PRECISION_FIXTURES) {
    const matches = scanSegment(fixture.input);
    const flagged = matches !== null;
    if (flagged !== fixture.expectFlag) {
      const verdict = fixture.expectFlag
        ? "expected flag but got none"
        : "got unexpected flag";
      console.error(`❌ Fixture FAILED [${verdict}]: ${fixture.description}`);
      if (matches) {
        console.error(
          `   Matches: ${matches.map((m) => `"${m.wrong}" → "${m.correct}"`).join(", ")}`
        );
      }
      console.error(`   Input: "${fixture.input}"`);
      allPassed = false;
    }
  }
  return allPassed;
}

// ---------------------------------------------------------------------------
// Database scan
// Returns all flags found across transcripts (optionally filtered by module).
// The caller is responsible for opening/closing the pool.
// ---------------------------------------------------------------------------
export async function scanAllTranscripts(
  moduleFilter?: number
): Promise<Flag[]> {
  const queryText =
    moduleFilter !== undefined
      ? `SELECT module_order, module_title, segments FROM video_transcripts WHERE module_order = $1 ORDER BY module_order`
      : `SELECT module_order, module_title, segments FROM video_transcripts ORDER BY module_order`;
  const queryValues = moduleFilter !== undefined ? [moduleFilter] : [];

  const rows = await pool.query<{
    module_order: number;
    module_title: string;
    segments: string;
  }>(queryText, queryValues);

  const allFlags: Flag[] = [];

  for (const row of rows.rows) {
    const segments: Segment[] = JSON.parse(row.segments);
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const matches = scanSegment(seg.text);
      if (matches) {
        const correctedText = applyCorrections(seg.text, matches);
        allFlags.push({
          moduleOrder: row.module_order,
          moduleTitle: row.module_title,
          segmentIndex: i,
          timecodeStart: seg.timecodeStart,
          timecodeEnd: seg.timecodeEnd,
          originalText: seg.text,
          correctedText,
          matches,
        });
      }
    }
  }

  return allFlags;
}

// ---------------------------------------------------------------------------
// Pre-flight helper: run fixtures + DB scan; return { passed, flags }.
// Prints a compact summary to stdout/stderr as it goes.
// The caller decides whether to abort based on the result.
// ---------------------------------------------------------------------------
export async function runSttPreflight(): Promise<{
  fixturesPassed: boolean;
  flags: Flag[];
}> {
  console.log("🔍  STT pre-flight: running precision fixtures...");
  const fixturesPassed = runPrecisionFixtures();

  if (!fixturesPassed) {
    console.error(
      "\n⛔  Precision fixtures failed — the STT dictionary has false-positive entries.\n" +
        "    Fix the dictionary in stt-scan-lib.ts before regenerating PDFs.\n"
    );
    return { fixturesPassed: false, flags: [] };
  }

  console.log(`✅  All ${PRECISION_FIXTURES.length} fixtures passed.`);
  console.log("🔍  STT pre-flight: scanning transcripts...");

  const flags = await scanAllTranscripts();

  if (flags.length === 0) {
    console.log("✅  STT pre-flight: no suspicious terms found.\n");
  } else {
    console.error(
      `\n⚠️   STT pre-flight: ${flags.length} flag(s) found across transcripts.\n`
    );

    // Group by module for a compact report
    const byModule = new Map<number, Flag[]>();
    for (const flag of flags) {
      if (!byModule.has(flag.moduleOrder))
        byModule.set(flag.moduleOrder, []);
      byModule.get(flag.moduleOrder)!.push(flag);
    }

    for (const [moduleOrder, mFlags] of byModule) {
      console.error(`  Module ${moduleOrder}: ${mFlags[0].moduleTitle}`);
      for (const flag of mFlags) {
        const termList = flag.matches
          .map((m) => `"${m.wrong}" → "${m.correct}"`)
          .join(", ");
        console.error(
          `    [${flag.timecodeStart} – ${flag.timecodeEnd}]  ${termList}`
        );
        console.error(`    ❌  ${flag.originalText}`);
        console.error(`    ✅  ${flag.correctedText}`);
      }
      console.error("");
    }

    console.error(
      "    Run: pnpm exec tsx scripts/src/scan-transcripts.ts --interactive\n" +
        "    to review and fix these errors, then re-run generate-pdfs.\n" +
        "    To skip this check (all flags reviewed): pass --skip-stt-check\n"
    );
  }

  return { fixturesPassed: true, flags };
}
