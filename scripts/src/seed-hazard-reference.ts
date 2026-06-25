import { db, hazardReferenceTable } from "@workspace/db";

const HAZARDS: { category: "site" | "chainsaw" | "job"; hazard: string; controlMeasure: string }[] = [
  // ── SITE HAZARDS ─────────────────────────────────────────────────────────────
  { category: "site", hazard: "Public or bystanders entering the work zone", controlMeasure: "Erect warning signs, establish a 15-meter exclusion zone, and use a Banks person / lookout." },
  { category: "site", hazard: "Overhead power lines or utilities", controlMeasure: "Maintain statutory safe clearance distances, conduct a pre-work site survey, and contact the utility company if work is nearby." },
  { category: "site", hazard: "Uneven or slippery terrain (slopes/mud)", controlMeasure: "Wear high-grip chainsaw safety boots, clear a path of retreat/escape route, and always work from the uphill side of logs." },
  { category: "site", hazard: "Deadwood or unstable \"widowmaker\" branches overhead", controlMeasure: "Perform a thorough look-up assessment before cutting, wear a safety helmet, and remove or avoid hazardous trees using appropriate machinery." },
  { category: "site", hazard: "Confined space or dense undergrowth", controlMeasure: "Clear access and egress routes before commencing cutting operations; maintain clear footing around the tree base." },
  { category: "site", hazard: "Extreme weather conditions (high winds or lightning)", controlMeasure: "Suspend tree felling and chainsaw work during high winds, heavy rain, or poor visibility." },
  { category: "site", hazard: "Tripping hazards (stumps, rocks, brambles)", controlMeasure: "Clear the work area of debris, mark prominent tripping hazards, and maintain good housekeeping on site." },
  { category: "site", hazard: "Night or poor lighting conditions", controlMeasure: "Ensure adequate artificial task lighting if work must be done, otherwise restrict chainsaw operations to daylight hours." },
  { category: "site", hazard: "Sharp thorns or brush causing puncture injuries", controlMeasure: "Wear durable protective clothing, including heavy-duty gloves and chainsaw jackets." },
  { category: "site", hazard: "Presence of vehicular traffic", controlMeasure: "Set up approved road-work signs, cones, and traffic management/flagging as required by local regulations." },
  { category: "site", hazard: "Hidden underground utilities (pipes/cables) near roots", controlMeasure: "Review site utility maps, perform hand digging if necessary, and use a cable avoidance tool (CAT)." },
  { category: "site", hazard: "Fences, walls, or property lines", controlMeasure: "Establish a clear felling direction away from structures, use guide ropes/winches, or dismantle trees in sections." },
  { category: "site", hazard: "Nearby water bodies (rivers/ponds)", controlMeasure: "Implement drowning risk controls, wear life jackets if working near deep water, and use environmental spill kits for fuel." },
  { category: "site", hazard: "Unstable structures or ruins nearby", controlMeasure: "Establish an exclusion zone around fragile walls, avoid felling trees towards structures, and seek structural advice if needed." },
  { category: "site", hazard: "Falling into holes, old wells, or trenches", controlMeasure: "Conduct a thorough ground walkover, mark and barricade any open holes, and stay on cleared paths." },
  { category: "site", hazard: "Steep rock faces or cliffs (fall risk)", controlMeasure: "Use fall arrest equipment, ropes, and harnesses when working near edge drops." },
  { category: "site", hazard: "Aggressive or territorial domestic animals (dogs, livestock)", controlMeasure: "Coordinate with landowners to secure animals before commencing work, and carry deterrents." },
  { category: "site", hazard: "Hidden metal, wire, or nails embedded in old fence trees", controlMeasure: "Use a metal detector on old felling lines/hedgerow trees; inspect bark thoroughly before cutting." },
  { category: "site", hazard: "High accumulation of dry tinder/leaves (wildfire risk)", controlMeasure: "Clear dry debris away from chainsaw operation zones, and keep a fire extinguisher readily available." },
  { category: "site", hazard: "Dust, spores, or pollen from surrounding vegetation", controlMeasure: "Wear appropriate respiratory protective equipment (RPE) or dust masks." },
  { category: "site", hazard: "Restricted escape routes due to physical barriers", controlMeasure: "Clear at least two distinct escape paths at a 45-degree angle behind the planned felling direction." },
  { category: "site", hazard: "Unstable soil, land slips, or erosion zones", controlMeasure: "Avoid parking heavy machinery on unstable edges, and use timber mats or avoid work during wet seasons." },
  { category: "site", hazard: "Overlap with other site contractors/machinery", controlMeasure: "Establish a clear communication protocol, use distinct high-vis colors, and coordinate exclusion zones." },
  { category: "site", hazard: "Dark forest canopy causing shadows and misjudged distances", controlMeasure: "Use high-powered headlamps or work during peak daylight hours." },
  { category: "site", hazard: "Public footpaths or right-of-way crossing the site", controlMeasure: "Temporarily close or divert footpaths with legal authorization; station sentries at entry points." },
  { category: "site", hazard: "Bees, wasps or stinging insect nests", controlMeasure: "Avoid working near any nests." },
  { category: "site", hazard: "Cattle, sheep or livestock animals", controlMeasure: "Avoid working within the same vicinity or area." },

  // ── CHAINSAW HAZARDS ─────────────────────────────────────────────────────────
  { category: "chainsaw", hazard: "Kickback (sudden upward/backward motion of guide bar)", controlMeasure: "Maintain a firm two-handed grip, never cut with the nose or tip of the bar, ensure the chain brake is functional, and use low-kickback chains." },
  { category: "chainsaw", hazard: "Hand-Arm Vibration (HAVS / White Finger)", controlMeasure: "Limit continuous operation time, use chainsaws with anti-vibration features, wear vibration-damping gloves, and keep hands warm." },
  { category: "chainsaw", hazard: "High noise levels (hearing damage)", controlMeasure: "Wear appropriate ear defenders (minimum SNR rating as specified by risk assessment) and limit daily exposure duration." },
  { category: "chainsaw", hazard: "Cuts from the moving chain", controlMeasure: "Wear full personal protective equipment (PPE) including chainsaw trousers, safety boots, and gloves; engage the chain brake when moving." },
  { category: "chainsaw", hazard: "Flying debris and sawdust (eye injuries)", controlMeasure: "Wear a mesh or polycarbonate face shield along with safety glasses underneath to protect against fine particles." },
  { category: "chainsaw", hazard: "Exhaust fumes and carbon monoxide poisoning", controlMeasure: "Never operate a petrol chainsaw indoors or in poorly ventilated areas; ensure the saw is properly tuned." },
  { category: "chainsaw", hazard: "Accidental starting of the chainsaw", controlMeasure: "Always start the chainsaw on the ground or firmly supported; never \"drop-start\" the chainsaw; keep fingers off the throttle trigger during start." },
  { category: "chainsaw", hazard: "Fire or fuel spills during refueling", controlMeasure: "Allow the engine to cool before refueling, use a fuel container with a spill-proof spout, refuel on bare ground away from sources of ignition, and move 3m away before starting." },
  { category: "chainsaw", hazard: "Chain breakage or derailment", controlMeasure: "Inspect chain tension regularly, check for damaged links, ensure the chain catcher is intact, and replace worn sprockets." },
  { category: "chainsaw", hazard: "Burns from hot engine parts (muffler)", controlMeasure: "Avoid contact with the exhaust muffler, let the chainsaw cool down before servicing or refueling, and handle with gloves." },
  { category: "chainsaw", hazard: "Blunts or poorly sharpened chain causing extra physical strain", controlMeasure: "Sharpen the chain regularly, check depth gauges, and replace dull or damaged chains immediately." },
  { category: "chainsaw", hazard: "Entanglement of clothing or hair in moving parts", controlMeasure: "Avoid wearing loose clothing, jewelry, or unsecured long hair; keep clothing securely fastened." },
  { category: "chainsaw", hazard: "Inoperable chain brake system", controlMeasure: "Conduct a pre-start check of the chain brake mechanism; do not use the saw if the brake fails to engage or stop the chain instantly." },
  { category: "chainsaw", hazard: "Throttle trigger sticking or failing to return", controlMeasure: "Inspect throttle linkage before use; ensure the throttle lock mechanism works correctly; clean debris from the trigger assembly." },
  { category: "chainsaw", hazard: "Leaking fuel or chain oil caps", controlMeasure: "Inspect caps and O-rings for cracks, tighten caps securely before starting, and wipe down any spilled fluids." },
  { category: "chainsaw", hazard: "Guide bar damage or warping", controlMeasure: "Inspect the bar for straightness, burrs, or cracked rails; file down burrs and rotate the bar periodically for even wear." },
  { category: "chainsaw", hazard: "Incorrect chain tension (too loose or too tight)", controlMeasure: "Check tension frequently (especially with new chains); ensure the chain can be pulled smoothly around the bar by hand with gloves on." },
  { category: "chainsaw", hazard: "Loose or missing nuts, bolts, or casings", controlMeasure: "Inspect the entire chassis before starting work; tighten all screws and replace missing components before use." },
  { category: "chainsaw", hazard: "Broken or damaged hand guards", controlMeasure: "Do not operate a chainsaw with a broken front or rear hand guard; replace damaged structural components immediately." },
  { category: "chainsaw", hazard: "Missing or worn out chain catcher", controlMeasure: "Ensure the metal or plastic chain catcher is present underneath the clutch cover and replace if worn out." },
  { category: "chainsaw", hazard: "Electrical shock or shorts (electric/battery saws)", controlMeasure: "Inspect power cords or battery terminals for damage; never use corded or battery chainsaws in wet conditions." },
  { category: "chainsaw", hazard: "Sudden battery failure or thermal runaway (battery saws)", controlMeasure: "Use manufacturer-approved batteries, store them away from extreme heat, and inspect for swelling or leakage." },
  { category: "chainsaw", hazard: "Flying sparks from chain hitting stones or metal", controlMeasure: "Avoid cutting into the ground; wear flame-retardant PPE if working in high-fire-risk conditions." },
  { category: "chainsaw", hazard: "Kickback during boring or plunge cuts", controlMeasure: "Ensure advanced training is held before attempting plunge cuts; enter the wood using the lower section of the nose first." },
  { category: "chainsaw", hazard: "Improperly mixed 2-stroke fuel causing engine seizure", controlMeasure: "Use exact fuel-to-oil ratios recommended by the manufacturer and fresh fuel mix." },

  // ── JOB HAZARDS ──────────────────────────────────────────────────────────────
  { category: "job", hazard: "Operator fatigue and loss of concentration", controlMeasure: "Take regular mandatory breaks, rotate tasks among team members, and ensure adequate hydration." },
  { category: "job", hazard: "Working in isolation / Lone working", controlMeasure: "Implement a strict check-in protocol, carry a reliable communication device (radio/satellite/cell), and utilize GPS personal locator beacons." },
  { category: "job", hazard: "Manual handling of heavy timber or logs", controlMeasure: "Use mechanical aids (winches, log jacks, forwarders), practice correct lifting techniques, and employ team lifting where necessary." },
  { category: "job", hazard: "Inadequate training or lack of competence", controlMeasure: "Ensure all operators hold valid certifications (e.g., NPTC/Lantra), receive proper supervision, and attend refresher courses." },
  { category: "job", hazard: "Incorrect cutting techniques causing trapped bars or barber-chairing", controlMeasure: "Assess tension and compression forces in the timber, use felling wedges, and follow standard felling techniques (notch and back-cut)." },
  { category: "job", hazard: "Communication breakdown in noisy environment", controlMeasure: "Establish clear hand signals before starting work, wear high-visibility clothing, and use radio-integrated helmets." },
  { category: "job", hazard: "Struck by rolling or shifting logs", controlMeasure: "Assess the slope, block or chock logs before cross-cutting, and stand on the uphill side of the material." },
  { category: "job", hazard: "Biological hazards (stinging insects, ticks, poisonous plants)", controlMeasure: "Inspect the tree and surrounding area for insect nests or hazardous plants before starting; use insect repellent; keep a first-aid kit nearby." },
  { category: "job", hazard: "Dehydration or heat/cold stress", controlMeasure: "Provide access to shelter, wear climate-appropriate undergarments beneath PPE, and ensure plenty of drinking water is available." },
  { category: "job", hazard: "Inadequate first aid response for severe bleeding", controlMeasure: "Ensure a specialized trauma first aid kit (including tourniquets and haemostatic dressings) is on-site, and at least one worker is trained in first aid." },
  { category: "job", hazard: "Working at heights (climbing or using platforms)", controlMeasure: "Use specialized climbing harnesses, ropes, and anchoring systems; comply with work-at-height regulations." },
  { category: "job", hazard: "Struck by falling timber/branches (by colleagues)", controlMeasure: "Establish clear communication before felling or cross-cutting; enforce strict exclusion zones for ground workers." },
  { category: "job", hazard: "Slipping while carrying a running chainsaw", controlMeasure: "Always engage the chain brake when walking or changing positions, even for short distances; shut off the engine if moving further than 3 meters." },
  { category: "job", hazard: "Tree hung up in adjacent trees during felling", controlMeasure: "Never walk under a hung-up tree; use a winch, cable, or specialized machinery to pull it down safely; mark the area as dangerous." },
  { category: "job", hazard: "Root plate rebound after felling or windthrow cutting", controlMeasure: "Assess the root plate weight, sever the root ball carefully from a safe angle, and avoid standing directly behind the root plate." },
  { category: "job", hazard: "Splitting or snapping of timber under tension (kick-back of logs)", controlMeasure: "Make relief cuts on the compression side before cutting the tension side; stand clear of the path of release." },
  { category: "job", hazard: "Inadequate pre-work planning / Risk assessment", controlMeasure: "Complete a formal site specific risk assessment and tool-box talk with all personnel before starting work." },
  { category: "job", hazard: "Psychological pressure / rushing to meet deadlines", controlMeasure: "Prioritize safety over speed; empower workers to halt work if unsafe conditions arise; maintain realistic scheduling." },
  { category: "job", hazard: "Allergic reactions to sap, wood dust, or molds", controlMeasure: "Wear long sleeves, use gloves, and apply barrier creams; provide eye wash and allergy medication in the first-aid kit." },
  { category: "job", hazard: "Ineffective supervision of apprentice or junior operators", controlMeasure: "Maintain a low supervisor-to-learner ratio; provide clear, direct guidance and constant line-of-sight monitoring." },
  { category: "job", hazard: "Improper use or fit of personal protective equipment (PPE)", controlMeasure: "Ensure PPE is correctly sized, fits comfortably, is inspected daily for damage, and is replaced if cut or compromised." },
  { category: "job", hazard: "Working near moving site machinery (excavators, chippers)", controlMeasure: "Maintain a clear safety distance from machinery (typically two tree lengths or as specified by the operator); establish eye contact before approaching." },
  { category: "job", hazard: "Distractions from personal devices (mobile phones)", controlMeasure: "Ban the use of personal mobile phones or devices while operating or ground-managing a chainsaw." },
  { category: "job", hazard: "Misjudging the center of gravity or lean of a tree", controlMeasure: "Use plumb lines or visual checks from multiple angles; use mechanical assistance (winches, wedges) to overcome lean." },
  { category: "job", hazard: "Slips/trips while fueling or servicing on site", controlMeasure: "Establish a designated clean, flat, well-organized service and fueling area away from the main cutting zone." },
];

async function main() {
  console.log("Seeding hazard reference data…");

  // Clear existing data
  await db.delete(hazardReferenceTable);

  // Insert all hazards with order index
  const siteHazards = HAZARDS.filter((h) => h.category === "site");
  const chainsawHazards = HAZARDS.filter((h) => h.category === "chainsaw");
  const jobHazards = HAZARDS.filter((h) => h.category === "job");

  const rows = [
    ...siteHazards.map((h, i) => ({ ...h, orderIdx: i + 1 })),
    ...chainsawHazards.map((h, i) => ({ ...h, orderIdx: i + 1 })),
    ...jobHazards.map((h, i) => ({ ...h, orderIdx: i + 1 })),
  ];

  await db.insert(hazardReferenceTable).values(rows);

  console.log(`✓ Inserted ${siteHazards.length} site hazards`);
  console.log(`✓ Inserted ${chainsawHazards.length} chainsaw hazards`);
  console.log(`✓ Inserted ${jobHazards.length} job hazards`);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
