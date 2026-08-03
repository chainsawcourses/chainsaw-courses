import { pool } from "@workspace/db";
import * as fs from "fs";

async function main() {
  const r = await pool.query(
    `SELECT id, title, "order", category, sub_category, content_type, learning_outcome, assessment_criteria
     FROM modules WHERE is_active = true ORDER BY "order"`
  );
  fs.writeFileSync("/tmp/prod_modules.json", JSON.stringify(r.rows));
  console.log(`modules: ${r.rows.length}`);
  await pool.end();
}
main();
