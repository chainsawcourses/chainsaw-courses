/**
 * fix-questions-migration.ts
 *
 * Applies the following corrections to the live database:
 *
 * 1. Module 43 Q1 — wrong correctOption (was 1 "under tension", should be 2 "bar too short")
 * 2. Module 35 Q1 — US spelling "toward" → UK "towards" in options text
 * 3. Module 13    — insert new MHOR 1992 question into quiz_questions + exam_questions
 * 4. Mock questions — insert new MHOR vocal question (id 78) into mock_questions
 *
 * Safe to re-run: each fix checks the current state before acting.
 */

import { pool } from "@workspace/db";

async function main() {

  // ── 1. Fix Module 43 Q1: correctOption 1 → 2 (step cut = bar too short) ────────

  const mod43Fix = await pool.query(`
    UPDATE quiz_questions
    SET correct_option = 2
    WHERE module_id = 43
      AND "order" = 1
      AND correct_option = 1
      AND question ILIKE '%step cut%'
    RETURNING id
  `);
  console.log(`[1a] quiz_questions Module 43 Q1 correctOption fix: ${mod43Fix.rowCount} row(s) updated`);

  const mod43ExamFix = await pool.query(`
    UPDATE exam_questions
    SET correct_option = 2
    WHERE correct_option = 1
      AND question ILIKE '%step cut%'
    RETURNING id
  `);
  console.log(`[1b] exam_questions Module 43 Q1 correctOption fix: ${mod43ExamFix.rowCount} row(s) updated`);


  // ── 2. Fix Module 35 Q1: "toward" → "towards" in options ────────────────────────

  const mod35Fix = await pool.query(`
    UPDATE quiz_questions
    SET options = REPLACE(options, 'toward the operator', 'towards the operator')
    WHERE module_id = 35
      AND "order" = 1
      AND options LIKE '%toward the operator%'
    RETURNING id
  `);
  console.log(`[2a] quiz_questions Module 35 Q1 spelling fix: ${mod35Fix.rowCount} row(s) updated`);

  const mod35ExamFix = await pool.query(`
    UPDATE exam_questions
    SET options = REPLACE(options, 'toward the operator', 'towards the operator')
    WHERE question ILIKE '%pushing chain%pulling chain%'
      AND options LIKE '%toward the operator%'
    RETURNING id
  `);
  console.log(`[2b] exam_questions Module 35 Q1 spelling fix: ${mod35ExamFix.rowCount} row(s) updated`);


  // ── 3a. Insert MHOR question into quiz_questions ────────────────────────────────

  const mhorExists = await pool.query(`
    SELECT id FROM quiz_questions WHERE module_id = 13 AND "order" = 5 LIMIT 1
  `);

  if (mhorExists.rows.length > 0) {
    console.log(`[3a] MHOR question already in quiz_questions (id ${mhorExists.rows[0].id}). Skipping.`);
  } else {
    await pool.query(`
      INSERT INTO quiz_questions (module_id, question, options, correct_option, "order")
      VALUES (
        13,
        'Under the Manual Handling Operations Regulations 1992 (MHOR), where manual handling involving a risk of injury cannot be avoided, what must an employer do?',
        '["Issue all workers with a manual handling certificate","Make a suitable assessment of the manual handling task and take appropriate steps to reduce the risk of injury","Prohibit manual handling activities entirely on site","Ensure a written permit to lift is issued before any log is moved"]',
        1,
        5
      )
    `);
    console.log(`[3a] MHOR question inserted into quiz_questions.`);
  }


  // ── 3b. Insert MHOR question into exam_questions ────────────────────────────────

  const mhorExamExists = await pool.query(`
    SELECT id FROM exam_questions WHERE question ILIKE '%Manual Handling Operations Regulations 1992%MHOR%' LIMIT 1
  `);

  if (mhorExamExists.rows.length > 0) {
    console.log(`[3b] MHOR question already in exam_questions (id ${mhorExamExists.rows[0].id}). Skipping.`);
  } else {
    // Fetch module 13 learning_outcome and assessment_criteria for the insert
    const mod13 = await pool.query(`SELECT learning_outcome, assessment_criteria FROM modules WHERE id = 13 LIMIT 1`);
    const lo = mod13.rows[0]?.learning_outcome ?? null;
    const ac = mod13.rows[0]?.assessment_criteria ?? null;

    // Get the current max order in exam_questions
    const maxOrder = await pool.query(`SELECT COALESCE(MAX("order"), 0) + 1 AS next_order FROM exam_questions`);
    const nextOrder = maxOrder.rows[0].next_order;

    await pool.query(`
      INSERT INTO exam_questions (question, options, correct_option, learning_outcome, assessment_criteria, "order", is_active)
      VALUES (
        'Under the Manual Handling Operations Regulations 1992 (MHOR), where manual handling involving a risk of injury cannot be avoided, what must an employer do?',
        '["Issue all workers with a manual handling certificate","Make a suitable assessment of the manual handling task and take appropriate steps to reduce the risk of injury","Prohibit manual handling activities entirely on site","Ensure a written permit to lift is issued before any log is moved"]',
        1,
        $1, $2, $3, true
      )
    `, [lo, ac, nextOrder]);
    console.log(`[3b] MHOR question inserted into exam_questions at order ${nextOrder}.`);
  }


  // ── 4. Insert MHOR vocal question into mock_questions ────────────────────────────

  const mhorMockExists = await pool.query(`
    SELECT id FROM mock_questions WHERE question ILIKE '%Manual Handling Operations Regulations%' LIMIT 1
  `);

  if (mhorMockExists.rows.length > 0) {
    console.log(`[4] MHOR mock question already in mock_questions (id ${mhorMockExists.rows[0].id}). Skipping.`);
  } else {
    const maxSortOrder = await pool.query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM mock_questions`);
    const nextSort = maxSortOrder.rows[0].next;

    const prompts = JSON.stringify([{
      prompt: "What do the Manual Handling Operations Regulations 1992 require you to do before manually moving heavy timber on site?",
      threshold: 2,
      keyPoints: [
        { label: "Avoid manual handling where reasonably practicable — use mechanical aids", keywords: ["avoid", "mechanical aid", "cant hook", "timber jack", "avoid manual handling", "use tools", "use equipment", "reasonably practicable", "avoid it if you can", "use mechanical aids", "dont lift by hand"] },
        { label: "Assess the load — weight, shape, distance to be moved", keywords: ["assess", "assessment", "assess the load", "assess weight", "weight", "shape", "distance", "assess the task", "assess the risk", "look at it first", "think about it"] },
        { label: "Reduce the risk of injury — correct posture, bend knees, back straight", keywords: ["reduce risk", "correct posture", "bend knees", "back straight", "knees bent", "posture", "reduce injury", "safe posture", "lift safely", "safe lifting", "back upright"] },
        { label: "Team lift if the load is too heavy for one person", keywords: ["team lift", "two person lift", "ask for help", "team", "two people", "get help", "dont lift alone", "lift together"] },
        { label: "Never twist — turn your feet instead", keywords: ["never twist", "dont twist", "turn feet", "feet not spine", "no twisting", "pivot your feet", "avoid twisting"] },
      ],
    }]);

    await pool.query(`
      INSERT INTO mock_questions (question, prompts, image, sort_order, is_active)
      VALUES ($1, $2, null, $3, true)
    `, [
      "What do the Manual Handling Operations Regulations 1992 (MHOR) require you to do before manually moving heavy timber on site?",
      prompts,
      nextSort
    ]);
    console.log(`[4] MHOR mock question inserted into mock_questions at sort_order ${nextSort}.`);
  }

  console.log("\nMigration complete.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
