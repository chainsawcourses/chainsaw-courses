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
 * Dictionary lives in stt-scan-lib.ts.  See the design rules there before
 * adding entries (no ordinary English words as variants, etc.).
 */

import { pool } from "@workspace/db";
import * as readline from "readline";
import {
  PRECISION_FIXTURES,
  scanSegment,
  applyCorrections,
  runPrecisionFixtures,
  scanAllTranscripts,
} from "./stt-scan-lib.js";
import type { Segment, Flag } from "./stt-scan-lib.js";

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
  let moduleFilter: number | undefined;
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
      "    Fix the dictionary in stt-scan-lib.ts before running with --fix or --interactive.\n"
    );
    if (autoFix || interactive) {
      await pool.end();
      process.exit(1);
    }
    console.warn("    Continuing in report-only mode despite fixture failures.\n");
  } else {
    console.log(`✅  All ${PRECISION_FIXTURES.length} fixtures passed.\n`);
  }

  const allFlags = await scanAllTranscripts(moduleFilter);

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

  // Count transcripts scanned (reuse the query from scanAllTranscripts via a
  // simple count query so we can show "X transcripts scanned" in the summary).
  const countQuery =
    moduleFilter !== undefined
      ? `SELECT COUNT(*) FROM video_transcripts WHERE module_order = $1`
      : `SELECT COUNT(*) FROM video_transcripts`;
  const countValues = moduleFilter !== undefined ? [moduleFilter] : [];
  const countResult = await pool.query<{ count: string }>(countQuery, countValues);
  const transcriptCount = parseInt(countResult.rows[0].count, 10);

  console.log(
    `Scanning ${transcriptCount} transcript(s)...\n${"─".repeat(72)}`
  );

  // Pre-load segment arrays for modules that have flags so we can apply fixes
  const pendingFixes = new Map<
    number,
    { segments: Segment[]; dirty: boolean }
  >();
  // Fetch segments for flagged modules only
  const flaggedModules = [...byModule.keys()];
  if (flaggedModules.length > 0) {
    const placeholders = flaggedModules.map((_, i) => `$${i + 1}`).join(", ");
    const segRows = await pool.query<{
      module_order: number;
      segments: string;
    }>(
      `SELECT module_order, segments FROM video_transcripts WHERE module_order IN (${placeholders})`,
      flaggedModules
    );
    for (const row of segRows.rows) {
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
  console.log(`  Transcripts scanned : ${transcriptCount}`);
  console.log(`  Flags raised        : ${allFlags.length}`);
  console.log(`  Modules updated     : ${fixedCount}${noWriteHint}`);
  console.log();

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
