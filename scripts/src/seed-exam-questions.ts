import { pool } from "@workspace/db";

// Seeds the exam_questions bank from the existing per-module quiz question
// bank, inheriting each question's Learning Outcome / Assessment Criteria
// from its parent module. The exam route randomly samples 45 questions from
// this bank per attempt, satisfying the randomized summative exam requirement.
const existing = await pool.query(`SELECT count(*)::int as c FROM exam_questions`);
if (existing.rows[0].c > 0) {
  console.log(`exam_questions already seeded (${existing.rows[0].c} rows). Skipping.`);
  process.exit(0);
}

const rows = await pool.query(`
  SELECT q.question, q.options, q.correct_option, m.learning_outcome, m.assessment_criteria
  FROM quiz_questions q
  JOIN modules m ON m.id = q.module_id
  ORDER BY q.id
`);

let order = 0;
for (const r of rows.rows) {
  await pool.query(
    `INSERT INTO exam_questions (question, options, correct_option, learning_outcome, assessment_criteria, "order", is_active)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [r.question, r.options, r.correct_option, r.learning_outcome, r.assessment_criteria, order++]
  );
}

console.log(`Seeded ${rows.rows.length} exam questions.`);
process.exit(0);
