import { pool } from "@workspace/db";

async function main() {
  // Module 13 = Law & Legislation — add AC 2.3 (bio-security) alongside existing AC 1.1, 1.2
  await pool.query(
    `UPDATE modules
     SET learning_outcome   = 'LO1, LO2',
         assessment_criteria = 'AC 1.1, AC 1.2, AC 2.3'
     WHERE id = 13`
  );
  const res = await pool.query(
    `SELECT id, title, learning_outcome, assessment_criteria FROM modules WHERE id = 13`
  );
  console.log("Updated:", res.rows[0]);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
