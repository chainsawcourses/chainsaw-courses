/**
 * Seed the modules table with all course modules.
 * Uses explicit IDs that match the quiz seed (seed-quiz-questions.ts) and
 * the tag-modules-lo-ac.ts script. Resets the sequence after insert.
 *
 * Run: pnpm --filter @workspace/scripts run seed-modules
 */
import { pool } from "@workspace/db";

const modules: {
  id: number;
  title: string;
  description: string;
  order: number;
  duration: number;
  vimeoId: string;
  isHighRisk: boolean;
  category: string;
  subCategory: string | null;
  contentType: string;
}[] = [
  // ── COURSE REQUIREMENTS ──────────────────────────────────────────────────────
  {
    id: 8,  order: 1,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "Equipment List",
    description: "An overview of all tools, equipment and documentation you will need to complete this course, including PPE requirements and assessment paperwork.",
    duration: 5, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 9,  order: 2,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "PPE & First Aid",
    description: "Chainsaw PPE standards (BS EN 381), correct selection and inspection of protective clothing, helmets, gloves and footwear, plus first-aid priorities for a chainsaw injury.",
    duration: 10, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 10, order: 3,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "5 Steps To Risk Assessment",
    description: "How to apply the HSE 5-step risk assessment process on-site: identify hazards, who might be harmed, evaluate and control risks, record findings and review.",
    duration: 10, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 11, order: 4,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "Hazards & Risks",
    description: "Common hazards encountered during chainsaw operations — biological, chemical, physical and environmental — and the hierarchy of control measures to mitigate them.",
    duration: 10, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 12, order: 5,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "Emergency Planning Information",
    description: "How to compile an emergency action card, establish site communications, set up a lone-worker check-in system and coordinate first-responder contact before starting work.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 13, order: 6,  category: "COURSE REQUIREMENTS", subCategory: null,
    title: "Law & Regulations",
    description: "Key UK legislation governing chainsaw work: HSWA 1974, PUWER 1998, LOLER 1998, Manual Handling Regulations, COSHH and the role of the HSE as enforcing authority.",
    duration: 12, vimeoId: "", isHighRisk: false, contentType: "video",
  },

  // ── CHAINSAW COMPONENTS ──────────────────────────────────────────────────────
  {
    id: 14, order: 7,  category: "CHAINSAW COMPONENTS", subCategory: null,
    title: "Chainsaw Safety Features",
    description: "How the chain brake, front hand guard, throttle lock-out, rear hand guard, anti-vibration system and chain catcher work together to protect the operator.",
    duration: 10, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 40, order: 8,  category: "CHAINSAW COMPONENTS", subCategory: null,
    title: "Battery Chainsaws",
    description: "An introduction to battery-powered chainsaws: how they work, their advantages and limitations compared to petrol saws, and safe use, charging and storage practices.",
    duration: 10, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 15, order: 9,  category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Air Filter",
    description: "How the air filter prevents dust and debris from entering the carburettor, how to inspect, clean and replace it, and the consequences of running with a blocked filter.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 16, order: 10, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Spark Plug",
    description: "The role of the spark plug in ignition, how to inspect the electrode condition to diagnose running problems, correct gap setting and safe replacement procedure.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 17, order: 11, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Cooling System",
    description: "How the air-cooled engine, cooling fins and shroud work together; the risks of overheating through blocked fins or running without the cover; correct cleaning procedure.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 18, order: 12, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Exhaust",
    description: "The function of the muffler and spark arrester, how to inspect for carbon build-up and damage, and the fire risk associated with a damaged or blocked exhaust.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 19, order: 13, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Fuel & Oil Filters",
    description: "Two-stroke fuel mix ratios, how to identify and replace the fuel filter and bar-oil filter, and best practice for safe fuel storage and handling on-site.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 41, order: 14, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "The Oiling System",
    description: "How the automatic chain oiling system works, how to check oil flow, adjust the oiler on models that allow it, and the consequences of running dry.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 20, order: 15, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Recoil Starter",
    description: "How the recoil starter mechanism functions, how to inspect the rope and pawls, and the safe starting procedure to avoid strain or injury.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 21, order: 16, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Clutch Assembly",
    description: "The centrifugal clutch's role in engaging and disengaging the chain, how to recognise wear, and why the chain must stop when the throttle is released.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 22, order: 17, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Sprocket",
    description: "How the drive sprocket transfers power to the chain, types of sprocket (spur and rim), inspection for wear and correct replacement intervals.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 23, order: 18, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Chain Brake",
    description: "How inertia and manual activation trigger the chain brake, how to test it correctly before each use, and what to do if it fails to activate.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 24, order: 19, category: "CHAINSAW COMPONENTS", subCategory: "COMPONENTS & MAINTENANCE",
    title: "Guidebar",
    description: "Guidebar types, gauge and length selection, how to inspect the nose, rails and oil hole for wear, how to rotate the bar to distribute wear evenly.",
    duration: 7, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 25, order: 20, category: "CHAINSAW COMPONENTS", subCategory: "CHAIN",
    title: "Chain Basics",
    description: "Drive link, cutter and tie-strap anatomy, how to identify left and right cutters, cutter types and the importance of matching chain to bar and sprocket.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 26, order: 21, category: "CHAINSAW COMPONENTS", subCategory: "CHAIN",
    title: "Chain Tension",
    description: "How to correctly tension a chain — the sag test — why over-tight and over-loose chains are dangerous, and how to tension safely with the engine off.",
    duration: 7, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 27, order: 22, category: "CHAINSAW COMPONENTS", subCategory: "CHAIN",
    title: "How to Identify a Chainsaw Chain",
    description: "How to read pitch, gauge and drive-link count to correctly match a replacement chain to bar and sprocket using the manufacturer's reference system.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 28, order: 23, category: "CHAINSAW COMPONENTS", subCategory: "CHAIN",
    title: "Replacing The Chain",
    description: "Step-by-step safe procedure for removing a worn chain, fitting a new chain, setting correct tension and re-checking after the first cut.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 29, order: 24, category: "CHAINSAW COMPONENTS", subCategory: "CHAIN",
    title: "Chain Sharpening",
    description: "How to sharpen cutters with a round file: correct file size, filing angle, depth-gauge setting, using a filing guide and recognising a correctly sharpened chain.",
    duration: 12, vimeoId: "", isHighRisk: false, contentType: "video",
  },

  // ── WORKING PRACTICES ────────────────────────────────────────────────────────
  {
    id: 42, order: 25, category: "WORKING PRACTICES", subCategory: null,
    title: "Kickback",
    description: "The mechanics of kickback — rotational and linear — the kickback zone, how a correctly functioning chain brake responds, and how to adopt a stance that minimises risk.",
    duration: 10, vimeoId: "", isHighRisk: true, contentType: "video",
  },
  {
    id: 31, order: 26, category: "WORKING PRACTICES", subCategory: null,
    title: "Work Positioning",
    description: "Safe body positioning relative to the cut: balanced stance, work-piece support, the importance of keeping feet clear of the bar plane and controlling the saw at all times.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 32, order: 27, category: "WORKING PRACTICES", subCategory: null,
    title: "Pre-Start Checks",
    description: "The full pre-start inspection sequence: bar, chain, chain brake, throttle interlock, chain catcher, oil level and fuel — completing the check before every session.",
    duration: 8, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 33, order: 28, category: "WORKING PRACTICES", subCategory: null,
    title: "Starting The Chainsaw",
    description: "Safe ground-start and drop-start techniques, the correct use of the choke and primer, and why the chain brake must be engaged during start-up.",
    duration: 7, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 34, order: 29, category: "WORKING PRACTICES", subCategory: null,
    title: "Pre-Use Checks",
    description: "Checks carried out after starting and before cutting: chain brake activation test, chain lubrication verification and idle-speed check.",
    duration: 6, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 35, order: 30, category: "WORKING PRACTICES", subCategory: null,
    title: "Cutting Basics",
    description: "The principles of safe cross-cutting: approach, stance, grip, the push-cut and pull-cut, moving through the cut and controlling the saw at break-through.",
    duration: 12, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 36, order: 31, category: "WORKING PRACTICES", subCategory: null,
    title: "Tension & Compression",
    description: "Identifying tension and compression in felled material, how to read a log before cutting, the top-cut and bottom-cut sequence and preventing the bar from pinching.",
    duration: 12, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 37, order: 32, category: "WORKING PRACTICES", subCategory: null,
    title: "Releasing A Trapped Chainsaw",
    description: "Safe methods for releasing a pinched bar without injury: using wedges, a second saw or a lever, and when to leave the saw and seek help.",
    duration: 8, vimeoId: "", isHighRisk: true, contentType: "video",
  },
  {
    id: 38, order: 33, category: "WORKING PRACTICES", subCategory: null,
    title: "Bore Cutting",
    description: "The bore (plunge) cut technique: why it is high-risk, the correct entry point on the lower half of the bar nose, trigger sequence and when to use it.",
    duration: 10, vimeoId: "", isHighRisk: true, contentType: "video",
  },
  {
    id: 39, order: 34, category: "WORKING PRACTICES", subCategory: null,
    title: "Oversized & Tensioned Timber",
    description: "Strategies for dealing with timber wider than the bar, heavily tensioned stems, and how to combine bore cuts and side cuts to safely section large material.",
    duration: 10, vimeoId: "", isHighRisk: true, contentType: "video",
  },
  {
    id: 30, order: 35, category: "WORKING PRACTICES", subCategory: null,
    title: "Stacking",
    description: "Safe techniques for stacking and handling cut timber: manual handling principles, team communication, avoiding unstable stacks and rolling timber risks.",
    duration: 7, vimeoId: "", isHighRisk: false, contentType: "video",
  },
  {
    id: 43, order: 36, category: "WORKING PRACTICES", subCategory: null,
    title: "Additional Cuts",
    description: "Supplementary cutting techniques including side cuts, step cuts and dealing with partially felled stems, with emphasis on maintaining situational awareness.",
    duration: 10, vimeoId: "", isHighRisk: true, contentType: "video",
  },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if modules already exist
    const { rows: existing } = await client.query(`SELECT COUNT(*) FROM modules`);
    if (Number(existing[0].count) > 0) {
      console.log(`Modules table already has ${existing[0].count} rows — skipping seed.`);
      await client.query("ROLLBACK");
      return;
    }

    for (const mod of modules) {
      await client.query(
        `INSERT INTO modules (id, title, description, "order", duration, vimeo_id, is_high_risk, category, sub_category, content_type, is_active)
         OVERRIDING SYSTEM VALUE
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
        [mod.id, mod.title, mod.description, mod.order, mod.duration, mod.vimeoId, mod.isHighRisk, mod.category, mod.subCategory, mod.contentType]
      );
    }

    // Reset the sequence to max id + 1 so future inserts don't collide
    await client.query(`SELECT setval(pg_get_serial_sequence('modules', 'id'), (SELECT MAX(id) FROM modules))`);

    await client.query("COMMIT");
    console.log(`Seeded ${modules.length} modules successfully.`);
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
