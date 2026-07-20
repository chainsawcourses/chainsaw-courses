import { pool } from "@workspace/db";

// Maps each module ID to its Learning Outcome + Assessment Criteria per the
// manual's "Learning Outcomes (LO) & Assessment Criteria (AC)" matrix.
const TAGS: Record<number, { lo: string; ac: string }> = {
  8: { lo: "", ac: "" }, // Equipment List — administrative, not LO-mapped
  9: { lo: "LO1", ac: "AC 1.4" }, // PPE & First Aid
  10: { lo: "LO2", ac: "AC 2.1" }, // 5 Steps To Risk Assessment
  11: { lo: "LO1", ac: "AC 1.3" }, // Hazards & Risks (COSHH / hazardous materials)
  12: { lo: "LO2", ac: "AC 2.2" }, // Emergency Planning Information
  13: { lo: "LO1", ac: "AC 1.1, AC 1.2" }, // Law & Legislation
  14: { lo: "LO3", ac: "AC 3.3" }, // Chainsaw Safety Features
  40: { lo: "LO3", ac: "AC 3.2" }, // Battery Chainsaws
  15: { lo: "LO4", ac: "AC 4.1" }, // Air Filter
  16: { lo: "LO4", ac: "AC 4.1" }, // Spark Plug
  17: { lo: "LO4", ac: "AC 4.1" }, // Cooling System
  18: { lo: "LO4", ac: "AC 4.1" }, // Exhaust
  19: { lo: "LO4", ac: "AC 4.1, AC 3.1" }, // Fuel & Oil Filters (also 2-stroke ratio)
  41: { lo: "LO4", ac: "AC 4.1" }, // The Oiling System
  20: { lo: "LO4", ac: "AC 4.1" }, // Recoil Starter
  21: { lo: "LO4", ac: "AC 4.1" }, // Clutch Assembly
  22: { lo: "LO4", ac: "AC 4.3" }, // Sprocket
  23: { lo: "LO3", ac: "AC 3.3" }, // Chain Brake (safety feature)
  24: { lo: "LO4", ac: "AC 4.3" }, // Guidebar
  25: { lo: "LO4", ac: "AC 4.4" }, // Chain Basics
  26: { lo: "LO4", ac: "AC 4.4" }, // Chain Tension
  27: { lo: "LO4", ac: "AC 4.4" }, // How to identify a chainsaw chain
  28: { lo: "LO4", ac: "AC 4.4" }, // Replacing The Chain
  29: { lo: "LO4", ac: "AC 4.4" }, // Chain Sharpening
  42: { lo: "LO6", ac: "AC 6.3" }, // Kickback
  31: { lo: "LO6", ac: "AC 6.1" }, // Work Positioning
  32: { lo: "LO5", ac: "AC 5.2" }, // Pre-Start Checks
  33: { lo: "LO5", ac: "AC 5.1" }, // Starting The Chainsaw
  34: { lo: "LO5", ac: "AC 5.2" }, // Pre-Use Checks
  35: { lo: "LO6", ac: "AC 6.1" }, // Cutting Basics
  36: { lo: "LO6", ac: "AC 6.1, AC 6.2" }, // Tension & Compression
  37: { lo: "LO6", ac: "AC 6.2" }, // Releasing A Trapped Chainsaw
  38: { lo: "LO6", ac: "AC 6.3" }, // Bore Cutting
  39: { lo: "LO6", ac: "AC 6.4" }, // Oversized & Tensioned Timber
  30: { lo: "LO6", ac: "AC 6.4" }, // Stacking
  43: { lo: "LO6", ac: "AC 6.4, AC 6.5" }, // Additional Cuts
};

for (const [id, { lo, ac }] of Object.entries(TAGS)) {
  await pool.query(
    `UPDATE modules SET learning_outcome = $1, assessment_criteria = $2 WHERE id = $3`,
    [lo || null, ac || null, Number(id)]
  );
}

console.log(`Tagged ${Object.keys(TAGS).length} modules with LO/AC.`);
process.exit(0);
