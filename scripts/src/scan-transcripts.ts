/**
 * Scans all video transcript segments for common speech-to-text errors
 * in technical chainsaw/safety terminology, and optionally corrects them
 * in the database.
 *
 * Usage:
 *   # Report only (no DB changes)
 *   pnpm exec tsx scripts/src/scan-transcripts.ts
 *
 *   # Interactive mode — prompts to accept each correction
 *   pnpm exec tsx scripts/src/scan-transcripts.ts --interactive
 *
 *   # Auto-fix mode — applies all corrections without prompting
 *   pnpm exec tsx scripts/src/scan-transcripts.ts --fix
 *
 *   # Limit to a specific module
 *   pnpm exec tsx scripts/src/scan-transcripts.ts --module 12
 *
 * Dictionary design rules (do NOT add entries that break these):
 *   1. Variants must not be ordinary English words (e.g. "power", "costs",
 *      "lower", "still", "steel", "organ" are all banned as variants).
 *   2. Variants must be unambiguously wrong in any chainsaw-training context.
 *   3. No self-mappings (variant === correct term, same casing aside).
 *   4. Prefer multi-word or proper-noun misreadings; treat single-word homophones
 *      with extreme caution and only include confirmed real-world STT errors.
 */

import { pool } from "@workspace/db";
import * as readline from "readline";

// ---------------------------------------------------------------------------
// Known-terms dictionary
//
// Each key is the CORRECT term; the array lists confirmed STT misreadings.
// Matching is whole-word, case-insensitive.
// IMPORTANT: see the dictionary design rules in the file header before editing.
// ---------------------------------------------------------------------------
const TERM_CORRECTIONS: Record<string, string[]> = {
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
  // "huskvarna" is the single documented variant; broader guesses removed.
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
// Test fixtures: verify precision before allowing --fix
// These checks run automatically before any DB writes.
// ---------------------------------------------------------------------------
interface Fixture {
  input: string;
  expectFlag: boolean;       // true = should be flagged; false = must NOT be flagged
  description: string;
}

const PRECISION_FIXTURES: Fixture[] = [
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

function runPrecisionFixtures(): boolean {
  let allPassed = true;
  for (const fixture of PRECISION_FIXTURES) {
    const matches = scanSegment(fixture.input);
    const flagged = matches !== null;
    if (flagged !== fixture.expectFlag) {
      const verdict = fixture.expectFlag ? "expected flag but got none" : "got unexpected flag";
      console.error(`❌ Fixture FAILED [${verdict}]: ${fixture.description}`);
      if (matches) {
        console.error(`   Matches: ${matches.map(m => `"${m.wrong}" → "${m.correct}"`).join(", ")}`);
      }
      console.error(`   Input: "${fixture.input}"`);
      allPassed = false;
    }
  }
  return allPassed;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Segment {
  timecodeStart: string;
  timecodeEnd: string;
  text: string;
}

interface Flag {
  moduleOrder: number;
  moduleTitle: string;
  segmentIndex: number;
  timecodeStart: string;
  timecodeEnd: string;
  originalText: string;
  correctedText: string;
  matches: Array<{ wrong: string; correct: string }>;
}

// ---------------------------------------------------------------------------
// Scan logic
// ---------------------------------------------------------------------------
function scanSegment(
  text: string
): Array<{ wrong: string; correct: string }> | null {
  const matches: Array<{ wrong: string; correct: string }> = [];

  for (const [correct, variants] of Object.entries(TERM_CORRECTIONS)) {
    for (const variant of variants) {
      // Whole-word, case-insensitive match
      const pattern = new RegExp(
        `(?<![a-zA-Z])${escapeRegex(variant)}(?![a-zA-Z])`,
        "gi"
      );
      if (pattern.test(text)) {
        // One entry per correct term (avoids duplicates when multiple variants hit)
        if (!matches.some((m) => m.correct === correct)) {
          matches.push({ wrong: variant, correct });
        }
        break;
      }
    }
  }

  return matches.length > 0 ? matches : null;
}

function applyCorrections(
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
      // Preserve original capitalisation style
      if (m === m.toUpperCase()) return correct.toUpperCase();
      if (m[0] === m[0].toUpperCase()) {
        return correct[0].toUpperCase() + correct.slice(1);
      }
      return correct;
    });
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------
async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const interactive = args.includes("--interactive");
  const autoFix = args.includes("--fix");

  // Validate --module argument strictly
  let moduleFilter: number | null = null;
  const moduleIdx = args.indexOf("--module");
  if (moduleIdx !== -1) {
    const raw = args[moduleIdx + 1];
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || String(parsed) !== raw || parsed < 1) {
      console.error(`--module must be a positive integer, got: ${raw}`);
      process.exit(1);
    }
    moduleFilter = parsed;
  }

  // Always run precision fixtures first.
  // Any write path (--fix or --interactive) is blocked when fixtures fail.
  console.log("Running precision fixtures...");
  const fixturesPassed = runPrecisionFixtures();
  if (!fixturesPassed) {
    console.error(
      "\n⛔  Precision fixtures failed — the dictionary has false-positive entries.\n" +
      "    Fix the dictionary before running with --fix or --interactive.\n"
    );
    if (autoFix || interactive) {
      await pool.end();
      process.exit(1);
    }
    console.warn("    Continuing in report-only mode despite fixture failures.\n");
  } else {
    console.log(`✅  All ${PRECISION_FIXTURES.length} fixtures passed.\n`);
  }

  // Parameterised query — no string interpolation of user input
  const queryText =
    moduleFilter !== null
      ? `SELECT module_order, module_title, segments FROM video_transcripts WHERE module_order = $1 ORDER BY module_order`
      : `SELECT module_order, module_title, segments FROM video_transcripts ORDER BY module_order`;
  const queryValues = moduleFilter !== null ? [moduleFilter] : [];

  const rows = await pool.query<{
    module_order: number;
    module_title: string;
    segments: string;
  }>(queryText, queryValues);

  if (rows.rows.length === 0) {
    console.log("No transcripts found.");
    await pool.end();
    return;
  }

  console.log(
    `Scanning ${rows.rows.length} transcript(s)...\n${"─".repeat(72)}`
  );

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

  if (allFlags.length === 0) {
    console.log("✅  No suspicious terms found.\n");
    await pool.end();
    return;
  }

  // Group flags by module for display
  const byModule = new Map<number, Flag[]>();
  for (const flag of allFlags) {
    if (!byModule.has(flag.moduleOrder)) byModule.set(flag.moduleOrder, []);
    byModule.get(flag.moduleOrder)!.push(flag);
  }

  // Pre-load segment arrays for modules that have flags
  const pendingFixes = new Map<
    number,
    { segments: Segment[]; dirty: boolean }
  >();
  for (const row of rows.rows) {
    if (byModule.has(row.module_order)) {
      pendingFixes.set(row.module_order, {
        segments: JSON.parse(row.segments),
        dirty: false,
      });
    }
  }

  for (const [moduleOrder, flags] of byModule) {
    const title = flags[0].moduleTitle;
    console.log(`\n📋  Module ${moduleOrder}: ${title}`);
    console.log(`    ${flags.length} flag(s) found\n`);

    for (const flag of flags) {
      const termList = flag.matches
        .map((m) => `"${m.wrong}" → "${m.correct}"`)
        .join(", ");
      console.log(`  [${flag.timecodeStart} – ${flag.timecodeEnd}]`);
      console.log(`  ❌  ${flag.originalText}`);
      console.log(`  ✅  ${flag.correctedText}`);
      console.log(`  💡  ${termList}`);
      console.log();

      let shouldFix = autoFix;

      if (interactive && !autoFix) {
        const answer = await prompt("  Apply this correction? [y/N/q] ");
        if (answer.toLowerCase() === "q") {
          console.log("\nAborted.\n");
          await pool.end();
          return;
        }
        shouldFix = answer.toLowerCase() === "y";
      }

      if (shouldFix) {
        const entry = pendingFixes.get(moduleOrder)!;
        entry.segments[flag.segmentIndex].text = flag.correctedText;
        entry.dirty = true;
        if (!interactive) console.log("  → queued for update");
      }
    }
  }

  // Write corrections back to DB
  let fixedCount = 0;
  for (const [moduleOrder, entry] of pendingFixes) {
    if (!entry.dirty) continue;
    await pool.query(
      `UPDATE video_transcripts SET segments = $1, updated_at = NOW() WHERE module_order = $2`,
      [JSON.stringify(entry.segments), moduleOrder]
    );
    fixedCount++;
    console.log(`💾  Updated Module ${moduleOrder} in database.`);
  }

  const noWriteHint =
    fixedCount === 0 && !interactive && !autoFix
      ? " (run with --interactive or --fix to apply corrections)"
      : "";

  console.log(`\n${"─".repeat(72)}`);
  console.log(`Summary:`);
  console.log(`  Transcripts scanned : ${rows.rows.length}`);
  console.log(`  Flags raised        : ${allFlags.length}`);
  console.log(`  Modules updated     : ${fixedCount}${noWriteHint}`);
  console.log();

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
