import { pool } from "@workspace/db";
import * as fs from "fs";

async function main() {
  const examQs = await pool.query(
    `SELECT id, question, options, correct_option, learning_outcome, assessment_criteria
     FROM exam_questions WHERE is_active = true ORDER BY "order"`
  );
  fs.writeFileSync("/tmp/prod_exam_qs.json", JSON.stringify(examQs.rows));

  const mockQs = await pool.query(
    `SELECT id, question, prompts FROM mock_questions WHERE is_active = true ORDER BY sort_order`
  );
  const simple = mockQs.rows.map((r: any) => ({
    id: r.id, question: r.question,
    keyPoints: Array.isArray(r.prompts) ? r.prompts
      : typeof r.prompts === "string" ? JSON.parse(r.prompts)
      : [],
  }));
  fs.writeFileSync("/tmp/prod_mock_simple.json", JSON.stringify(simple));

  const modules = await pool.query(
    `SELECT id, title, "order", category, sub_category, content_type, learning_outcome, assessment_criteria
     FROM modules WHERE is_active = true ORDER BY "order"`
  );
  fs.writeFileSync("/tmp/prod_modules.json", JSON.stringify(modules.rows));

  console.log(`exam: ${examQs.rows.length}  mock: ${mockQs.rows.length}  modules: ${modules.rows.length}`);
  await pool.end();
}
main();
