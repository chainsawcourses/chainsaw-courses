import { pool } from "@workspace/db";

async function main() {
  // Module 43 previously tagged AC 6.4, AC 6.5 — AC 6.5 is now Extension content
  // Strip AC 6.5; keep only AC 6.4
  await pool.query(
    `UPDATE modules
     SET assessment_criteria = 'AC 6.4'
     WHERE id = 43`
  );
  const res = await pool.query(
    `SELECT id, title, learning_outcome, assessment_criteria FROM modules WHERE id = 43`
  );
  console.log("Updated:", res.rows[0]);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
