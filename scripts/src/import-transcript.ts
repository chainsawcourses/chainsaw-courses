/**
 * Parses a subtitle/transcript .txt file (timecode + text blocks) and
 * upserts it into the video_transcripts table.
 *
 * Usage:
 *   pnpm exec tsx scripts/src/import-transcript.ts \
 *     --file attached_assets/PPE&FirstAid_1785771895713.txt \
 *     --order 2 \
 *     --title "PPE & First Aid" \
 *     --lo LO1 \
 *     --ac "AC 1.4"
 */
import { pool } from "@workspace/db";
import * as fs from "fs";

interface Segment {
  timecodeStart: string;
  timecodeEnd: string;
  text: string;
}

function parseTranscriptFile(content: string): Segment[] {
  const segments: Segment[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Timecode line: HH:MM:SS:FF - HH:MM:SS:FF
    const tcMatch = line.match(
      /^(\d{2}:\d{2}:\d{2}:\d{2})\s+-\s+(\d{2}:\d{2}:\d{2}:\d{2})$/
    );
    if (tcMatch) {
      const timecodeStart = tcMatch[1];
      const timecodeEnd = tcMatch[2];
      i++;

      // Skip speaker label (e.g. "Unknown") or blank
      if (i < lines.length) i++;

      // Collect text lines until blank line or next timecode
      const textLines: string[] = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (tl === "") { i++; break; }
        // Stop if next line looks like a timecode
        if (/^\d{2}:\d{2}:\d{2}:\d{2}/.test(tl)) break;
        textLines.push(tl);
        i++;
      }

      const text = textLines.join(" ").trim();
      if (text) {
        segments.push({ timecodeStart, timecodeEnd, text });
      }
    } else {
      i++;
    }
  }

  return segments;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };

  const filePath      = get("--file");
  const moduleOrder   = parseInt(get("--order") ?? "", 10);
  const moduleTitle   = get("--title");
  const learningOutcome   = get("--lo") ?? null;
  const assessmentCriteria = get("--ac") ?? null;

  if (!filePath || isNaN(moduleOrder) || !moduleTitle) {
    console.error("Usage: tsx import-transcript.ts --file <path> --order <n> --title <title> [--lo LO1] [--ac 'AC 1.4']");
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const segments = parseTranscriptFile(content);

  console.log(`Parsed ${segments.length} segments from ${filePath}`);

  await pool.query(
    `INSERT INTO video_transcripts (module_order, module_title, learning_outcome, assessment_criteria, segments, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (module_order) DO UPDATE
       SET module_title = EXCLUDED.module_title,
           learning_outcome = EXCLUDED.learning_outcome,
           assessment_criteria = EXCLUDED.assessment_criteria,
           segments = EXCLUDED.segments,
           updated_at = NOW()`,
    [moduleOrder, moduleTitle, learningOutcome, assessmentCriteria, JSON.stringify(segments)]
  );

  console.log(`✅  Upserted transcript for Module ${moduleOrder}: ${moduleTitle}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
