import { pool } from "@workspace/db";
import { VOCAL_EXAM_QUESTIONS } from "../../artifacts/chainsaw-training/src/data/vocalExamQuestions";

const existing = await pool.query(`SELECT count(*)::int as c FROM mock_questions`);
if (existing.rows[0].c > 0) {
  console.log(`mock_questions already seeded (${existing.rows[0].c} rows). Skipping.`);
  process.exit(0);
}

let order = 0;
for (const q of VOCAL_EXAM_QUESTIONS) {
  await pool.query(
    `INSERT INTO mock_questions (question, prompts, image, sort_order, is_active)
     VALUES ($1, $2, $3, $4, true)`,
    [q.question, JSON.stringify(q.prompts), q.image ?? null, order++]
  );
}

console.log(`Seeded ${VOCAL_EXAM_QUESTIONS.length} mock questions.`);
process.exit(0);
