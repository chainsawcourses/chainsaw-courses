import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Shift all modules with order >= 8 up by 1
    const { rowCount } = await client.query(
      `UPDATE modules SET "order" = "order" + 1 WHERE "order" >= 8`
    );
    console.log(`Shifted ${rowCount} modules up by 1`);

    // 2. Insert "Battery Chainsaws" at order 8
    const { rows: [newMod] } = await client.query(
      `INSERT INTO modules (title, description, "order", duration, vimeo_id, is_high_risk, category, content_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        "Battery Chainsaws",
        "An introduction to battery-powered chainsaws: how they work, their advantages and limitations compared to petrol saws, and safe use, charging and storage practices.",
        8,
        10,
        "",
        false,
        "CHAINSAW COMPONENTS",
        "video",
      ]
    );
    console.log(`Inserted module id=${newMod.id} "Battery Chainsaws" at order 8`);

    // 3. Seed 4 quiz questions
    const questions = [
      {
        order: 1,
        question: "What is the primary advantage of a battery-powered chainsaw over a petrol chainsaw?",
        options: [
          "Greater cutting power for heavy timber",
          "Zero exhaust emissions and lower noise levels, making it suitable for indoor or urban environments",
          "Longer run time without stopping",
          "Cheaper to purchase initially",
        ],
        correctOption: 1,
      },
      {
        order: 2,
        question: "How should a lithium-ion chainsaw battery be stored when not in use for an extended period?",
        options: [
          "Fully discharged in a sealed plastic bag",
          "Fully charged in direct sunlight to maintain cell voltage",
          "At approximately 40–60% charge in a cool, dry place away from extreme temperatures",
          "Submerged in oil to prevent corrosion",
        ],
        correctOption: 2,
      },
      {
        order: 3,
        question: "Which of the following is a key limitation of battery-powered chainsaws compared to petrol models?",
        options: [
          "They cannot be fitted with a chain brake",
          "They require more PPE than petrol chainsaws",
          "Run time is limited by battery capacity, requiring charged spare batteries for prolonged use",
          "They are heavier due to the engine block",
        ],
        correctOption: 2,
      },
      {
        order: 4,
        question: "What safety check is unique to a battery-powered chainsaw before use?",
        options: [
          "Check the spark plug gap",
          "Verify the battery charge level and inspect the battery and terminals for damage before fitting",
          "Check the fuel-to-oil mix ratio",
          "Test the recoil starter mechanism",
        ],
        correctOption: 1,
      },
    ];

    for (const q of questions) {
      await client.query(
        `INSERT INTO quiz_questions (module_id, question, options, correct_option, "order")
         VALUES ($1, $2, $3, $4, $5)`,
        [newMod.id, q.question, JSON.stringify(q.options), q.correctOption, q.order]
      );
    }
    console.log(`Inserted 4 quiz questions for module ${newMod.id}`);

    await client.query("COMMIT");
    console.log("Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
