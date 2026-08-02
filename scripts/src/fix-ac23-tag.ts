import { pool } from "@workspace/db";

async function main() {
  // Remove AC 2.3 from module 13 (Law & Regulations) — revert to original tags
  await pool.query(
    `UPDATE modules
     SET learning_outcome    = 'LO1',
         assessment_criteria = 'AC 1.1, AC 1.2'
     WHERE id = 13`
  );

  // Add AC 2.3 to module 11 (Hazards & Risks) — where page 17 content lives
  await pool.query(
    `UPDATE modules
     SET learning_outcome    = 'LO1, LO2',
         assessment_criteria = 'AC 1.3, AC 2.3'
     WHERE id = 11`
  );

  const res = await pool.query(
    `SELECT id, title, learning_outcome, assessment_criteria
     FROM modules WHERE id IN (11, 13) ORDER BY id`
  );
  console.log("Updated:", res.rows);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
