import { pool } from "@workspace/db";

async function main() {
  // ── 1. Read current state ──────────────────────────────────────────────────
  const current = await pool.query(
    "SELECT id, title, description, learning_outcome, assessment_criteria FROM modules WHERE id IN (9, 13)"
  );
  for (const row of current.rows) {
    console.log(`\n=== Module ${row.id}: ${row.title} ===`);
    console.log("description:", row.description);
    console.log("learningOutcome:", row.learning_outcome);
    console.log("assessmentCriteria:", row.assessment_criteria);
  }

  // ── 2. Update Module 13: Law & Legislation ────────────────────────────────
  // Add MHOR 1992, and add year dates to PUWER, HSWA, COSHH
  const lawDescription =
    "Understand the key UK health and safety legislation that governs chainsaw operations. " +
    "This module covers the Health and Safety at Work Act 1974 (HSWA), the Provision and Use of Work Equipment Regulations 1998 (PUWER), " +
    "the Control of Substances Hazardous to Health Regulations 2002 (COSHH), and the Manual Handling Operations Regulations 1992 (MHOR). " +
    "You will also learn about the role of the HSE and industry guidance bodies such as FISA, AFAG, and the Forestry Commission.";

  const lawAC =
    "AC 1.1: Identify the primary obligations of employers and employees under the Health and Safety at Work Act 1974 (HSWA 1974). " +
    "AC 1.2: Explain the operational parameters mandated by the Provision and Use of Work Equipment Regulations 1998 (PUWER 1998) regarding tool maintenance and operator competence. " +
    "AC 1.3: Summarise the requirements of the Control of Substances Hazardous to Health Regulations 2002 (COSHH 2002) when handling fuels, lubricants and hazardous materials. " +
    "AC 1.5: Describe the requirements of the Manual Handling Operations Regulations 1992 (MHOR 1992) and explain how they apply to log handling, lifting, and timber stacking during chainsaw operations.";

  await pool.query(
    "UPDATE modules SET description = $1, assessment_criteria = $2 WHERE id = 13",
    [lawDescription, lawAC]
  );
  console.log("\n✓ Updated Module 13 (Law & Legislation)");

  // ── 3. Update Module 9: PPE & First Aid ──────────────────────────────────
  // Add EN 381 / EN ISO 11393 standard references
  const ppeDescription =
    "Understand the personal protective equipment (PPE) required for safe chainsaw operation. " +
    "This module covers all mandatory PPE items including safety helmets (EN 397/EN 12492), " +
    "chainsaw protective trousers and chaps (EN ISO 11393-2 / EN 381), chainsaw boots (EN ISO 17249), " +
    "chainsaw gloves (EN ISO 11393-4), hearing protection (BS EN 352-3), and eye/face protection (EN ISO 16321 / EN 1731). " +
    "You will also learn how to identify Type A versus Type C trouser protection classes and the correct UKCA/CE standard class markings, " +
    "as well as basic chainsaw first aid for cuts and trauma response.";

  const ppeAC =
    "AC 1.4: Detail the correct European (CE/UKCA) standard class markings required for safety helmets, visual shields, hearing protection, gloves, and Type A versus Type C protective trousers, " +
    "referencing the relevant EN/ISO standards (EN ISO 11393 series / EN 381 for chainsaw PPE, EN 397 for helmets, EN ISO 17249 for boots, BS EN 352-3 for hearing protection).";

  await pool.query(
    "UPDATE modules SET description = $1, assessment_criteria = $2 WHERE id = 9",
    [ppeDescription, ppeAC]
  );
  console.log("✓ Updated Module 9 (PPE & First Aid)");

  // ── 4. Add MHOR 1992 quiz questions to Module 13 ─────────────────────────
  // Check what's already there
  const existing = await pool.query(
    `SELECT id, "order" FROM quiz_questions WHERE module_id = 13 ORDER BY "order"`
  );
  console.log(`\nModule 13 currently has ${existing.rows.length} quiz questions`);
  const maxOrder = existing.rows.reduce((max: number, r: any) => Math.max(max, r.order), 0);

  const newQuestions = [
    {
      moduleId: 13,
      order: maxOrder + 1,
      question: "What do the Manual Handling Operations Regulations 1992 (MHOR 1992) require employers to do?",
      options: [
        "Provide chainsaw operators with manual handling certificates",
        "Avoid hazardous manual handling where reasonably practicable, assess risks that cannot be avoided, and reduce the risk of injury",
        "Ensure all manual handling is carried out by two people at all times",
        "Ban all manual handling of logs over 10 kg",
      ],
      correctOption: 1,
    },
    {
      moduleId: 13,
      order: maxOrder + 2,
      question: "Under MHOR 1992, when applying manual handling principles to log handling, which practice is correct?",
      options: [
        "Always drag logs along the ground rather than lifting them to avoid MHOR obligations",
        "Manual handling risk only applies indoors — outdoor forestry is exempt",
        "Assess the load weight, shape, and ground conditions before lifting; use mechanical aids (log jacks, winches) where possible",
        "Logs under 20 kg do not require any manual handling assessment",
      ],
      correctOption: 2,
    },
  ];

  for (const q of newQuestions) {
    await pool.query(
      `INSERT INTO quiz_questions (module_id, question, options, correct_option, "order")
       VALUES ($1, $2, $3, $4, $5)`,
      [q.moduleId, q.question, JSON.stringify(q.options), q.correctOption, q.order]
    );
    console.log(`✓ Inserted quiz question (order ${q.order}): ${q.question.substring(0, 60)}...`);
  }

  // ── 5. Verify ──────────────────────────────────────────────────────────────
  const updated = await pool.query(
    "SELECT id, title, description, learning_outcome, assessment_criteria FROM modules WHERE id IN (9, 13)"
  );
  console.log("\n── Verification ──");
  for (const row of updated.rows) {
    console.log(`\nModule ${row.id} (${row.title}):`);
    console.log("  description:", row.description.substring(0, 120) + "...");
    console.log("  assessment_criteria:", (row.assessment_criteria ?? "").substring(0, 120) + "...");
  }

  const quizRows = await pool.query(
    "SELECT id, \"order\", question FROM quiz_questions WHERE module_id = 13 ORDER BY \"order\""
  );
  console.log(`\nModule 13 now has ${quizRows.rows.length} quiz questions:`);
  for (const r of quizRows.rows) {
    console.log(`  [${r.order}] ${r.question.substring(0, 80)}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
