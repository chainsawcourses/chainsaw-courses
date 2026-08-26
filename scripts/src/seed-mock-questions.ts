import { pool } from "@workspace/db";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

type MockQuestion = {
  question: string;
  prompts: unknown[];
  image?: string;
};

const questionsPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../artifacts/api-server/src/data/mockQuestionsSeed.json",
);
const questions = JSON.parse(readFileSync(questionsPath, "utf8")) as MockQuestion[];

const existing = await pool.query(`SELECT count(*)::int as c FROM mock_questions`);
if (existing.rows[0].c > 0) {
  console.log(`mock_questions already seeded (${existing.rows[0].c} rows). Skipping.`);
  process.exit(0);
}

let order = 0;
for (const q of questions) {
  await pool.query(
    `INSERT INTO mock_questions (question, prompts, image, sort_order, is_active)
     VALUES ($1, $2, $3, $4, true)`,
    [q.question, JSON.stringify(q.prompts), q.image ?? null, order++]
  );
}

console.log(`Seeded ${questions.length} mock questions.`);
process.exit(0);
