/**
 * seed-iirsm-framework.ts
 * Upserts the IIRSM Risk Management and Leadership Competence Framework
 * into the app_config table for use as reference material.
 * Run: pnpm tsx scripts/src/seed-iirsm-framework.ts
 */
import { db, appConfigTable } from "@workspace/db";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE = path.resolve(
  __dirname,
  "../../attached_assets/Pasted-IIRSM-s-Risk-Management-and-Leadership-Competence-Frame_1785695369295.txt"
);

const raw = fs.readFileSync(SOURCE, "utf-8");

// Clean up the extracted text: collapse runs of blank lines, trim page headers
const cleaned = raw
  .replace(/IIRSM's risk management and leadership competence framework\s*\n\s*\d+\s*\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

await db
  .insert(appConfigTable)
  .values({
    key: "iirsm_competence_framework",
    value: cleaned,
    updatedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: appConfigTable.key,
    set: { value: cleaned, updatedAt: new Date() },
  });

console.log(`✓  Stored IIRSM Competence Framework (${cleaned.length} chars) in app_config`);
console.log(`   key: iirsm_competence_framework`);

process.exit(0);
