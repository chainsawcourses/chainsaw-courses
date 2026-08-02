/**
 * Q23 Course Materials Pack — final version
 *
 * Root cause of previous 100+ page output:
 *   Using explicit y0-based coordinates (y0+3, y0+4, y0+18) after pdfkit
 *   auto-paginates mid-badge, which sets those coordinates to positions past
 *   the NEW page's bottom, cascading into 2-3 blank pages per question.
 *
 * Fix: before every badge-based element, enforce a minimum space check so
 *   that y0 is always safe. Never pass y0+offset to text() — advance doc.y
 *   explicitly THEN call text() with the current doc.y.
 *   No doc.save()/restore() around text() calls — restore() can undo y state.
 */
import PDFDocument from "pdfkit";
import * as fs from "fs";

const OG  = "#E27226";
const OGD = "#B85A18";
const OGL = "#FEF3E8";
const BLK = "#1a1a1a";
const DGY = "#444444";
const MGY = "#888888";
const LGY = "#f5f5f5";
const RUL = "#dedede";
const WHT = "#ffffff";

const LOGO  = "/home/runner/workspace/artifacts/chainsaw-training/public/logo.png";
const IIRSM = "/home/runner/workspace/artifacts/chainsaw-training/public/iirsm-logo.png";
const OUT   = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Q23_Course_Materials_Pack.pdf";
const OPTS  = ["A","B","C","D"];

const examQs: Array<{
  id: number; question: string; options: string;
  correct_option: number; learning_outcome: string; assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/prod_exam_qs.json","utf8"));

const mockQs: Array<{
  id: number; question: string; keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/prod_mock_simple.json","utf8"));

// ─── Layout ───────────────────────────────────────────────────────────────────
const ML = 50, MR = 50, MT = 48, MB = 48;
const doc = new PDFDocument({
  size: "A4",
  margins: { top: MT, bottom: MB, left: ML, right: MR },
  info: { Title: "Course Materials Pack — Chainsaw Maintenance & Cross Cutting", Author: "Chainsaw Courses Ltd" },
  autoFirstPage: true,
});
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;   // 595.28
const PH = doc.page.height;  // 841.89
const CW = PW - ML - MR;     // 495.28

// Page bottom safe limit — text must not start below this
const SAFE = PH - MB;        // 793.89

let pageNum = 0;
doc.on("pageAdded", () => { pageNum++; });

// ─── Core helpers — never move doc.y backward ─────────────────────────────────

function sp(n: number) { doc.y += n; }

function hrule(col = RUL, w = 0.5) {
  doc.moveTo(ML, doc.y).lineTo(ML + CW, doc.y)
    .strokeColor(col).lineWidth(w).stroke();
}

function footer() {
  // CRITICAL: render within SAFE (PH - MB = 793pt) to avoid pdfkit auto-pagination.
  // Using SAFE - 20 = 773pt keeps both the rule and text well inside the page.
  const fy = SAFE - 20;
  doc.moveTo(ML, fy).lineTo(ML + CW, fy).strokeColor(OG).lineWidth(0.8).stroke();
  doc.y = fy + 4;
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials Pack", ML, doc.y,
      { width: CW - 30, align: "left", lineBreak: false });
  doc.y = fy + 4;
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(String(pageNum), ML, doc.y, { width: CW, align: "right", lineBreak: false });
}

/**
 * Guarantee at least `pts` of space remain on the current page.
 * If not, add a page NOW so that subsequent absolute positioning is safe.
 */
function ensurePts(pts: number) {
  if (doc.y + pts > SAFE) {
    footer();
    doc.addPage();
  }
}

// ─── Section header (inline, no forced page break) ────────────────────────────
function sectionHead(n: string, title: string, sub = "") {
  const h = sub ? 44 : 34;
  ensurePts(h + 20); // guarantee room for the header itself
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  // Label (6.5pt) at y+5 — advance doc.y past badge first
  doc.y = y + 5;
  doc.font("Helvetica-Bold").fontSize(6.5).fillColor(OGD)
    .text(`SECTION ${n}`, ML + 12, doc.y, { lineBreak: false });
  // Title (13pt) at y+14
  doc.y = y + 14;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(BLK)
    .text(title, ML + 12, doc.y, { width: CW - 80, lineBreak: false });
  if (sub) {
    doc.y = y + 30;
    doc.font("Helvetica").fontSize(8).fillColor(MGY)
      .text(sub, ML + 12, doc.y, { width: CW - 14, lineBreak: false });
  }
  doc.y = y + h + 10;
}

// ─── Info box ─────────────────────────────────────────────────────────────────
function infoBox(heading: string, body: string) {
  const estBodyLines = Math.ceil(body.length / 90) + 1;
  const h = 24 + estBodyLines * 13 + 8;
  ensurePts(h + 8);
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  // Heading at y+7
  doc.y = y + 7;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(OGD)
    .text(heading, ML + 12, doc.y, { width: CW - 20, lineBreak: false });
  // Body at y+21 — natural flow
  doc.y = y + 21;
  doc.font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, doc.y, { width: CW - 20 });
  // Advance past box (use max of actual position and estimated bottom)
  doc.y = Math.max(doc.y, y + h) + 8;
}

// ─── Step row ─────────────────────────────────────────────────────────────────
function step(n: number, text: string, col = OG) {
  ensurePts(26); // enough for badge + 1 line minimum
  const y = doc.y;
  // Badge rect
  doc.rect(ML, y, 22, 16).fill(col);
  // Badge number — set y explicitly, then text at current doc.y
  doc.y = y + 3;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(String(n), ML, doc.y, { width: 22, align: "center", lineBreak: false });
  // Step text starts at y+2 (vertically centred with badge)
  // doc.y after lineBreak:false is still ≈ y+3+lineH. Clamp to y+2.
  doc.y = y + 2;
  doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(text, ML + 28, doc.y, { width: CW - 30 });
  // Ensure we're past the badge row
  if (doc.y < y + 18) doc.y = y + 18;
  sp(4);
}

// ─── Option box ───────────────────────────────────────────────────────────────
function optionBox(label: string, body: string) {
  const estLines = Math.ceil(body.length / 90) + 1;
  const h = 24 + estLines * 13 + 8;
  ensurePts(h + 8);
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(LGY);
  doc.y = y + 7;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(label, ML + 12, doc.y, { width: CW - 20, lineBreak: false });
  doc.y = y + 21;
  doc.font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, doc.y, { width: CW - 20 });
  doc.y = Math.max(doc.y, y + h) + 8;
}

// ════════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ════════════════════════════════════════════════════════════════════════════════
pageNum = 1;

doc.rect(0, 0, PW, 96).fill(OG);
doc.image(LOGO, ML, 10, { height: 70 });
doc.font("Helvetica-Bold").fontSize(21).fillColor(WHT)
  .text("CHAINSAW COURSES", ML + 78, 18, { lineBreak: false });
doc.font("Helvetica").fontSize(8.5).fillColor("#FFE0C0")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 78, 46, { lineBreak: false });
doc.image(IIRSM, PW - MR - 54, 12, { height: 58 });
doc.font("Helvetica").fontSize(6.5).fillColor("#FFE0C0")
  .text("IIRSM Course Approval", PW - MR - 60, 74, { width: 66, align: "center", lineBreak: false });

doc.font("Helvetica-Bold").fontSize(22).fillColor(BLK)
  .text("Course Materials Pack", ML, 112, { lineBreak: false });
doc.font("Helvetica").fontSize(12).fillColor(DGY)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 140, { lineBreak: false });
doc.font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Submitted in support of IIRSM Course Approval — Question 23", ML, 158, { lineBreak: false });

doc.y = 176;
doc.moveTo(ML, 176).lineTo(ML + CW, 176).strokeColor(OG).lineWidth(1.2).stroke();
doc.y = 186;

[
  ["Course",    "Chainsaw Maintenance & Cross Cutting"],
  ["Provider",  "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery",  "Fully Online — E-Learning (self-paced)"],
  ["Hours",     "4 hrs GLH  ·  2 hrs Assessment  ·  4 hrs Self-Study  ·  10 hrs TQT"],
  ["CPD",       "5 CPD Points (IIRSM)"],
  ["Threshold", "80% pass — randomised 45-question summative examination"],
  ["Purpose",   "Training presentation & delegate materials (Q23)"],
].forEach(([label, value], i) => {
  const y = doc.y;
  if (i % 2 === 0) doc.rect(ML, y, CW, 16).fill(LGY);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(OGD)
    .text(label, ML + 6, y + 4, { width: 68, lineBreak: false });
  doc.font("Helvetica").fontSize(8.5).fillColor(DGY)
    .text(value, ML + 80, y + 4, { width: CW - 84, lineBreak: false });
  doc.y = y + 16;
});

sp(12);
hrule();
sp(10);

doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
  .text("Contents", ML, doc.y, { lineBreak: false });
sp(10);

[
  ["1", "How to Access the Live App & Admin Panel"],
  ["2", "A Note on the Training Manual"],
  ["3", `Assessment Bank — ${examQs.length} Multiple-Choice Questions`],
  ["4", `Supplementary Oral & Practical Mock Questions (${mockQs.length})`],
].forEach(([n, title]) => {
  const y = doc.y;
  doc.rect(ML, y, 20, 16).fill(OG);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(n, ML, y + 4, { width: 20, align: "center", lineBreak: false });
  doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(title, ML + 26, y + 4, { lineBreak: false });
  doc.y = y + 20;
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// PAGE 2 — SECTIONS 1 & 2
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("1","How to Access the Live App & Admin Panel",
  "All content unlocked for IIRSM assessors");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The course is delivered through a custom-built e-learning platform. All video modules, quizzes, AI-assisted mock practice, summative examination, and certificate generation are accessible via the two routes below.", ML, doc.y, { width: CW });
sp(12);

doc.font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("Admin / Assessor Access — All Content Unlocked", ML, doc.y, { lineBreak: false });
sp(8);
[
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted — Password: CHAIN26 — the full admin dashboard will appear.",
  "Explore the dashboard tabs: Feedback, Backup, Storage, Policy Documents and more.",
  "All Export buttons send data directly to protected Google Drive storage.",
  "Click 'APP PREVIEW' in the top-right corner of the dashboard to enter the fully unlocked app.",
  "All videos, features, certificates, and IIRSM-referenced content are fully accessible for review.",
].forEach((s, i) => step(i + 1, s));

sp(12); hrule(); sp(12);
doc.font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("New Learner Journey — Standard Access Route", ML, doc.y, { lineBreak: false });
sp(16);
doc.font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Experience the app exactly as a learner — sequential locking, quiz flow, and liability waiver. The app is under internal testing and has not been publicly released.", ML, doc.y, { width: CW });
sp(10);
[
  "Log out of the admin panel (or open an incognito browser window).",
  "Go to  app.chainsawcourses.com  and enter login code:  CHAIN",
  "Enter a name and email address of your choice.",
  "You will be directed to the Liability Waiver — accept to enter the course.",
  "Each module is locked until the previous video is fully watched and the quiz completed.",
  "On completion, the 45-question exam unlocks. 80% pass auto-generates the IIRSM certificate.",
].forEach((s, i) => step(i + 1, s, BLK));

sp(14); hrule(); sp(12);
sectionHead("2","A Note on the Training Manual","File size & access options");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource. It is a richly illustrated 138-page document covering all Learning Outcomes and Assessment Criteria, including Advanced Workshop Extension modules.", ML, doc.y, { width: CW });
sp(12);

infoBox("File Size Notice",
  "The manual PDF is approximately 71 MB due to high-resolution diagrams and photographs. This exceeds most standard upload limits and cannot be attached directly to this IIRSM submission.");

doc.font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("How to obtain the manual:", ML, doc.y, { lineBreak: false });
sp(10);
optionBox("Option A — Request a Digital Copy via WeTransfer (Recommended)",
  "Email info@chainsawcourses.com to request a digital copy. A download link will be sent via WeTransfer or a similar large-file transfer service.");
optionBox("Option B — View within the App",
  "The full manual is embedded within the course platform. After logging in via the Admin Access route in Section 1, click APP PREVIEW. The manual is viewable within the app at any point during the course. All supporting policy documents are also accessible via the Admin Dashboard.");
optionBox("Option C — Request a Physical Copy",
  "A physical copy of the manual can be requested by contacting David Daniel at chainsawcourses.com.");

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — LEARNING OUTCOME FRAMEWORK
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("3", "Learning Outcome Framework",
  "3 Units  ·  6 Learning Outcomes  ·  23 Assessment Criteria");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The course is structured across three units and six formal learning outcomes, each broken into specific assessment criteria (ACs). All examination questions in Section 4 are tagged to their LO and AC. The modules listed under each outcome are the primary digital activities through which the content is delivered.", ML, doc.y, { width: CW });
sp(14);

type LoEntry = {
  lo: string; unit: string; title: string; desc: string;
  acs: [string, string][]; modules: string[];
};
const loFramework: LoEntry[] = [
  {
    lo: "LO1", unit: "Unit 1 — Occupational Standards, Health & Safety, and Risk Evaluation",
    title: "Legal Framework & Personal Safety",
    desc: "Describe the statutory legal framework and personal safety requirements governing chainsaw operations.",
    acs: [
      ["AC 1.1", "Identify employer and employee obligations under the Health and Safety at Work Act (HSWA) and global equivalents."],
      ["AC 1.2", "Explain PUWER operational parameters governing tool maintenance and operator competence."],
      ["AC 1.3", "Summarise COSHH control tracking required for hazardous fuels, battery cells, lubricants, and toxic flora species."],
      ["AC 1.4", "Detail CE/UKCA and global standard class markings for safety helmets, hearing protection, gloves, and Type A/C protective trousers."],
    ],
    modules: ["Equipment List", "PPE & First Aid", "Law & Legislation"],
  },
  {
    lo: "LO2", unit: "Unit 1 — Occupational Standards, Health & Safety, and Risk Evaluation",
    title: "Hazard Evaluation & Emergency Protocols",
    desc: "Evaluate environmental hazards, risk metrics, and implement emergency protocols for chainsaw site operations.",
    acs: [
      ["AC 2.1", "Execute a 5-step site-specific risk assessment documenting ground hazards, pedestrian proximity, and structural vulnerabilities."],
      ["AC 2.2", "Formulate an emergency communication and extraction map with grid references, postcodes, access limitations, and trauma kit deployments."],
      ["AC 2.3", "Identify bio-security cleaning controls necessary to stop the spread of invasive arboreal pathogens and pests."],
    ],
    modules: ["5 Steps To Risk Assessment", "Hazards & Risks", "Emergency Planning Information"],
  },
  {
    lo: "LO3", unit: "Unit 2 — Power Unit Architecture, Mechanical Integrity, and Component Maintenance",
    title: "Chainsaw Architecture & Safety Features",
    desc: "Analyse the mechanical differences, design attributes, and safety features of internal combustion and battery-powered chainsaws.",
    acs: [
      ["AC 3.1", "Describe the 2-stroke combustion cycle and determine fuel-to-oil lubrication ratios at a standard 50:1 mix."],
      ["AC 3.2", "Compare advantages and operational risks (including charging thermal runaway) of battery-powered vs. IC platforms."],
      ["AC 3.3", "Map and explain the mechanical function of the 10 core safety features across the front, centre, and rear chainsaw architecture."],
    ],
    modules: ["Chainsaw Safety Features", "Battery Chainsaws"],
  },
  {
    lo: "LO4", unit: "Unit 2 — Power Unit Architecture, Mechanical Integrity, and Component Maintenance",
    title: "Diagnostic, Servicing & Maintenance Procedures",
    desc: "Describe the diagnostic, servicing, and maintenance procedures required to sustain the structural integrity of the chainsaw cutting assembly.",
    acs: [
      ["AC 4.1", "Detail air filter cleaning procedures and interpret spark plug electrode colour indicators (Brown / Black / White-Grey)."],
      ["AC 4.2", "Explain safe carburettor adjusting rules using factory Idle (LA/T), Low (L), and High (H) screw limit constraints. (Advanced)"],
      ["AC 4.3", "Differentiate Rim and Spur drive sprockets and diagnose guidebar wear including burring, rail splaying, and thermal bluing."],
      ["AC 4.4", "Identify chain pitch, gauge, and tooth shapes (Full-Chisel vs. Semi-Chisel) and calculate correct filing profile configurations."],
    ],
    modules: [
      "Air Filter", "Spark Plug", "Cooling System", "Exhaust", "Fuel & Oil Filters",
      "The Oiling System", "Recoil Starter", "Clutch Assembly", "Sprocket", "Chain Brake",
      "Guidebar", "Chain Basics", "Chain Tension", "How to identify a chainsaw chain",
      "Replacing The Chain", "Chain Sharpening", "Kickback",
    ],
  },
  {
    lo: "LO5", unit: "Unit 3 — System Startups, Operational Testing, and Processing Techniques",
    title: "Pre-Use Verification & Startup Methodologies",
    desc: "Implement safe pre-use verification protocols and startup methodologies for safe chainsaw deployment.",
    acs: [
      ["AC 5.1", "Differentiate between safe cold start floor-anchor and upright knee-clamp warm start methods for Husqvarna and Stihl platforms."],
      ["AC 5.2", "Perform a 4-point dynamic check assessing chain brake engagement, oil dispersion flow, chain creep at tick-over, and off-switch motor cut."],
    ],
    modules: ["Pre-Start Checks", "Starting The Chainsaw", "Pre-Use Checks"],
  },
  {
    lo: "LO6", unit: "Unit 3 — System Startups, Operational Testing, and Processing Techniques",
    title: "Cutting Mechanics: Tension & Compression",
    desc: "Apply mechanical principles to resolve tension and compression forces during timber cross-cutting operations.",
    acs: [
      ["AC 6.1", "Analyse a log setup to determine where tension and compression forces reside."],
      ["AC 6.2", "Explain the physics behind pulling chains versus pushing chains during cross-cutting."],
      ["AC 6.3", "Define the bar tip kickback zone and explain how to execute precise plunge bore entries safely."],
      ["AC 6.4", "Differentiate cut sequences for standard logs, oversized timber, and timber under extreme tension (Toast Rack / reduction sink)."],
      ["AC 6.5", "Evaluate specialised branch removal, snedding, and de-limbing sequences along a felled stem. (Advanced Extension)"],
      ["AC 6.6", "Identify site threats with windblown windfalls, establishing escape routes and managing root plate movements. (Advanced Extension)"],
    ],
    modules: ["Work Positioning", "Cutting Basics", "Tension & Compression", "Releasing A Trapped Chainsaw", "Bore Cutting", "Oversized & Tensioned Timber", "Stacking", "Additional Cuts"],
  },
];

for (const entry of loFramework) {
  // Rough height estimate to keep card together: header(28) + unit(13) + desc(26) + gap(13) + ACs + modules + gaps
  const acEstH = entry.acs.length * 14;
  const modEstH = Math.ceil(entry.modules.join("  .  ").length / 85) * 12 + 14;
  const cardEstH = 28 + 13 + 26 + 12 + acEstH + modEstH + 16;
  ensurePts(Math.min(cardEstH + 10, 220));

  const y0 = doc.y;

  // ── Header bar ───────────────────────────────────────────────────────────────
  doc.rect(ML, y0, CW, 26).fill("#2b2b2b");
  doc.rect(ML, y0, 44, 26).fill(OG);
  // LO badge text
  doc.font("Helvetica-Bold").fontSize(9).fillColor(WHT)
    .text(entry.lo, ML, y0 + 9, { width: 44, align: "center", lineBreak: false });
  // Title
  doc.y = y0 + 8;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(WHT)
    .text(entry.title, ML + 50, doc.y, { width: CW - 54, lineBreak: false });

  // ── Unit label ───────────────────────────────────────────────────────────────
  doc.y = y0 + 34;
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(entry.unit, ML + 4, doc.y, { width: CW - 6 });
  sp(6);

  // ── Description ──────────────────────────────────────────────────────────────
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(DGY)
    .text(entry.desc, ML + 4, doc.y, { width: CW - 8 });
  sp(8);

  // ── Assessment Criteria ───────────────────────────────────────────────────────
  for (const [ref, text] of entry.acs) {
    const acY = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(OG)
      .text(ref, ML + 4, acY, { width: 36, lineBreak: false });
    doc.y = acY;
    doc.font("Helvetica").fontSize(8).fillColor(DGY)
      .text(text, ML + 44, doc.y, { width: CW - 48 });
  }
  sp(8);

  // ── Activities / Modules ─────────────────────────────────────────────────────
  const modY = doc.y;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(OGD)
    .text("Activities:", ML + 4, modY, { lineBreak: false });
  doc.y = modY;
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555")
    .text(entry.modules.join("   \xb7   "), ML + 52, doc.y, { width: CW - 56 });
  sp(14);
  hrule(OGL, 0.6);
  sp(8);
}

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — ASSESSMENT BANK
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("4","Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  ·  Summative Examination Pool`);
infoBox("How the exam works",
  `The summative examination draws a randomised 45 questions from this ${examQs.length}-question bank. Questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must achieve 80% or above to pass. Correct answers are highlighted in orange with ✓.`);

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);

  // ── CRITICAL: ensure at least 80pt before setting y0 ──────────────────────
  // This guarantees y0+3, y0+4, y0+18 are all within the current page.
  // pdfkit never auto-paginates on a rect() call, only on text() calls.
  ensurePts(80);
  const y0 = doc.y;

  // Alternating row tint
  if (i % 2 === 0) {
    // Estimate block height for row bg (generous: 16 badge + 3 lines question + 4 options 1 line each)
    const bgH = 16 + 45 + 4 * 13 + 12;
    doc.rect(ML, y0, CW, bgH).fill(LGY);
  }

  // Orange badge rect
  doc.rect(ML, y0, 30, 16).fill(OG);

  // Badge number — advance to y0+3 first, then text (no save/restore, no y0+offset-in-arg)
  doc.y = y0 + 3;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(`Q${i + 1}`, ML, doc.y, { width: 30, align: "center", lineBreak: false });

  // AC tag — advance to y0+4 first
  doc.y = y0 + 4;
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`,
      ML + 32, doc.y, { width: CW - 34, align: "right", lineBreak: false });

  // Advance past badge row
  doc.y = y0 + 20;

  // Question text — natural flow
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  sp(2);

  // Options — natural flow
  options.forEach((opt, oi) => {
    const isCorrect = oi === q.correct_option;
    if (isCorrect) {
      // Pale highlight — estimate height, draw behind text
      const estLines = Math.ceil((opt.length + 8) / 80) + 1;
      doc.rect(ML + 6, doc.y - 1, CW - 8, estLines * 12 + 2).fill(OGL);
    }
    doc.font(isCorrect ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9).fillColor(isCorrect ? OG : MGY)
      .text(`${OPTS[oi]}.  ${opt}${isCorrect ? "  ✓" : ""}`,
        ML + 14, doc.y, { width: CW - 20 });
  });

  sp(5);
  hrule(RUL, 0.4);
  sp(4);
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MOCK QUESTIONS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("5","Supplementary Oral & Practical Mock Questions",
  `${mockQs.length} Questions  ·  Formative Practice Only — Not Formally Assessed`);
infoBox("Important — these questions do not contribute to the pass/fail outcome",
  `These ${mockQs.length} questions are oral and practical preparation aids. They do NOT form part of the summative examination, do NOT appear on the certificate, and are NOT formally assessed. Within the app, learners practise them via an AI-assisted voice or text feature that provides formative feedback.`);

mockQs.forEach((q, i) => {
  ensurePts(80);
  const y0 = doc.y;

  if (i % 2 === 0) {
    const bgH = 16 + 45 + (q.keyPoints.length ? q.keyPoints.length * 13 + 14 : 0) + 12;
    doc.rect(ML, y0, CW, bgH).fill(LGY);
  }

  doc.rect(ML, y0, 30, 16).fill(BLK);

  doc.y = y0 + 3;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(OG)
    .text(`M${i + 1}`, ML, doc.y, { width: 30, align: "center", lineBreak: false });

  doc.y = y0 + 4;
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Oral / Practical  ·  Formative Only",
      ML + 32, doc.y, { width: CW - 34, align: "right", lineBreak: false });

  doc.y = y0 + 20;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  sp(2);

  if (q.keyPoints.length > 0) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(OG)
      .text("Key points:", ML + 14, doc.y, { lineBreak: false });
    sp(11);
    q.keyPoints.forEach(kp => {
      doc.font("Helvetica").fontSize(8.5).fillColor(DGY)
        .text(`•  ${kp}`, ML + 18, doc.y, { width: CW - 26 });
    });
  }

  sp(5);
  hrule(RUL, 0.4);
  sp(4);
});

// End bar
ensurePts(36);
sp(10);
doc.rect(ML, doc.y, CW, 26).fill(OG);
doc.y += 10;
doc.font("Helvetica-Bold").fontSize(9).fillColor(WHT)
  .text("End of Course Materials Pack  ·  chainsawcourses.com  ·  © 2026 Chainsaw Courses Ltd",
    ML, doc.y, { width: CW, align: "center", lineBreak: false });
doc.y += 26;

footer();

doc.end();
stream.on("finish", () => {
  const { size } = fs.statSync(OUT);
  console.log(`✅  ${Math.round(size / 1024)} KB`);
});
