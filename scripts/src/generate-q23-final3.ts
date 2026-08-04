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
const OUT   = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Course_Materials.pdf";
const OPTS  = ["A","B","C","D"];

const examQs: Array<{
  id: number; question: string; options: string;
  correct_option: number; learning_outcome: string; assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/prod_exam_qs.json","utf8"));

const mockQs: Array<{
  id: number; question: string; keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/prod_mock_simple.json","utf8"));

const appModules: Array<{
  id: number; title: string; order: number; category: string;
  sub_category: string | null; content_type: string;
  learning_outcome: string | null; assessment_criteria: string | null;
}> = JSON.parse(fs.readFileSync("/tmp/prod_modules.json","utf8"));

interface TranscriptSegment { timecodeStart: string; timecodeEnd: string; text: string; }
const transcripts: Array<{
  module_order: number; module_title: string;
  learning_outcome: string | null; assessment_criteria: string | null;
  segments: TranscriptSegment[];
}> = (() => {
  try {
    const raw: Array<{ module_order: number; module_title: string; learning_outcome: string | null; assessment_criteria: string | null; segments: string | TranscriptSegment[] }> =
      JSON.parse(fs.readFileSync("/tmp/prod_transcripts.json","utf8"));
    return raw.map(r => ({
      ...r,
      segments: typeof r.segments === "string" ? JSON.parse(r.segments) : r.segments,
    }));
  } catch { return []; }
})();

// Format HH:MM:SS:FF → M:SS (drop hours if zero, drop frames always)
const fmtTc = (tc: string): string => {
  const parts = tc.split(":");
  const hh = parseInt(parts[0] ?? "0", 10);
  const mm = parseInt(parts[1] ?? "0", 10);
  const ss = (parts[2] ?? "00").padStart(2, "0");
  return hh > 0 ? `${hh}:${String(mm).padStart(2,"0")}:${ss}` : `${mm}:${ss}`;
};

// ─── Layout ───────────────────────────────────────────────────────────────────
const ML = 50, MR = 50, MT = 48, MB = 48;
const doc = new PDFDocument({
  size: "A4",
  margins: { top: MT, bottom: MB, left: ML, right: MR },
  info: { Title: "Course Materials — Chainsaw Maintenance & Cross Cutting", Author: "Chainsaw Courses Ltd" },
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
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials", ML, doc.y,
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

// White header band
doc.rect(0, 0, PW, 96).fill(WHT);
// Thin orange accent line along the bottom of the header
doc.moveTo(0, 96).lineTo(PW, 96).strokeColor(OG).lineWidth(3).stroke();
doc.image(LOGO, ML, 10, { height: 70 });
doc.font("Helvetica-Bold").fontSize(21).fillColor(OGD)
  .text("CHAINSAW COURSES", ML + 78, 18, { lineBreak: false });
doc.font("Helvetica").fontSize(8.5).fillColor(MGY)
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 78, 46, { lineBreak: false });
doc.image(IIRSM, PW - MR - 54, 12, { height: 58 });
doc.font("Helvetica").fontSize(6.5).fillColor(MGY)
  .text("IIRSM Course Approval", PW - MR - 60, 74, { width: 66, align: "center", lineBreak: false });

doc.font("Helvetica-Bold").fontSize(22).fillColor(BLK)
  .text("Course Materials", ML, 112, { lineBreak: false });
doc.font("Helvetica").fontSize(12).fillColor(OG)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 140, { lineBreak: false });
doc.y = 168;
doc.moveTo(ML, 168).lineTo(ML + CW, 168).strokeColor(RUL).lineWidth(0.8).stroke();
doc.y = 178;

[
  ["Course",    "Chainsaw Maintenance & Cross Cutting"],
  ["Provider",  "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery",  "Fully Online — E-Learning (self-paced)"],
  ["Hours",     "4 hrs GLH  ·  2 hrs Assessment  ·  4 hrs Self-Study  ·  10 hrs TQT"],
  ["CPD",       "5 CPD Points (IIRSM)"],
  ["Threshold", "80% pass — randomised 45-question summative examination"],
  ["Purpose",   "Training presentation & delegate materials"],
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
  ["3", "Learning Outcome Framework — 3 Units · 6 LOs · 22 Assessment Criteria"],
  ["4", `Syllabus Mapping Table — ${appModules.length} Modules · LO & AC Alignment`],
  ["5", "Compliance Tools & Practical Worksheets"],
  ["6", `Video Transcripts — ${transcripts.length} Module${transcripts.length !== 1 ? "s" : ""}`],
  ["7", `Assessment Bank — ${examQs.length} Multiple-Choice Questions`],
  ["8", `Supplementary Oral & Practical Mock Questions (${mockQs.length})`],
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
sectionHead("2","A Note on the Training Manual","Published author  ·  File size & access options");

infoBox("Published Author",
  "Author of 'The Chainsaw Manual' (Version 1.1, July 2026) — currently sold as a standalone physical learning aid to various colleges and training providers across the UK. The manual underpins the theoretical content of this eLearning course. The first edition was published in September 2024.");
sp(8);

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
  "3 Units  ·  6 Learning Outcomes  ·  22 Assessment Criteria");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The course is structured across three units and six formal learning outcomes, each broken into specific assessment criteria (ACs). All examination questions in Section 7 are tagged to their LO and AC. The modules listed under each outcome are the primary digital activities through which the content is delivered.", ML, doc.y, { width: CW });
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
      ["AC 1.1", "Identify employer and employee obligations under the Health and Safety at Work Act (HSWA)."],
      ["AC 1.2", "Explain PUWER operational parameters governing tool maintenance and operator competence."],
      ["AC 1.3", "Summarise COSHH control tracking required for hazardous fuels, battery cells, lubricants, and toxic flora species."],
      ["AC 1.4", "Detail CE/UKCA and global standard class markings for safety helmets, hearing protection, gloves, and Type A/C protective trousers."],
    ],
    modules: ["Equipment List", "PPE & First Aid", "Law & Regulations", "Hazards & Risks"],
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
      ["AC 3.2", "Compare the advantages and operational risks of battery-powered power units against internal combustion chainsaws."],
      ["AC 3.3", "Map and explain the mechanical function of the 10 core safety features across the front, centre, and rear chainsaw architecture."],
    ],
    modules: ["Chainsaw Safety Features", "Battery Chainsaws", "Chain Brake", "Fuel & Oil Filters"],
  },
  {
    lo: "LO4", unit: "Unit 2 — Power Unit Architecture, Mechanical Integrity, and Component Maintenance",
    title: "Diagnostic, Servicing & Maintenance Procedures",
    desc: "Describe the diagnostic, servicing, and maintenance procedures required to sustain the structural integrity of the chainsaw cutting assembly.",
    acs: [
      ["AC 4.1", "Detail air filter cleaning procedures and interpret spark plug electrode colour indicators (Brown / Black / White-Grey)."],
      ["AC 4.2", "Explain safe carburettor adjusting rules using factory Idle (LA/T), Low (L), and High (H) screw limit constraints. (Advanced Extension)"],
      ["AC 4.3", "Differentiate Rim and Spur drive sprockets and diagnose guidebar wear including burring, rail splaying, and thermal bluing."],
      ["AC 4.4", "Identify chain pitch, gauge, and tooth shapes (Full-Chisel vs. Semi-Chisel) and calculate correct filing profile configurations."],
    ],
    modules: [
      "Air Filter", "Spark Plug", "Cooling System", "Exhaust",
      "The Oiling System", "Recoil Starter", "Clutch Assembly", "Sprocket",
      "Guidebar", "Chain Basics", "Chain Tension", "How to identify a chainsaw chain",
      "Replacing The Chain", "Chain Sharpening",
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
    modules: ["Kickback", "Work Positioning", "Cutting Basics", "Tension & Compression", "Releasing A Trapped Chainsaw", "Bore Cutting", "Oversized & Tensioned Timber", "Stacking", "Additional Cuts"],
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
// SECTION 4 — SYLLABUS MAPPING TABLE
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("4", "Syllabus Mapping Table",
  `${appModules.length} Modules  ·  Learning Outcome & Assessment Criteria Alignment`);

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The table below maps every active app module to its corresponding Learning Outcome (LO) and Assessment Criteria (AC). This mirrors the alignment table at the back of the training manual. Modules categorised as Course Requirements are reference documents and do not carry a formal LO/AC assignment.", ML, doc.y, { width: CW });
sp(12);

// ── Column widths (total = CW = 495) ──────────────────────────────────────────
const C_NUM  = 22;
const C_TTL  = 145;
const C_TYP  = 36;
const C_CAT  = 90;
const C_LO   = 34;
const C_AC   = 110;
const C_PG   = 58;
// total = 22+145+36+90+34+110+58 = 495 ✓

const MAP_COLS = [
  { label: "#",                   w: C_NUM },
  { label: "Module Title",        w: C_TTL },
  { label: "Type",                w: C_TYP },
  { label: "Category",            w: C_CAT },
  { label: "LO",                  w: C_LO  },
  { label: "Assessment Criteria", w: C_AC  },
  { label: "Manual pp.",          w: C_PG  },
];

// Page references keyed by module order number — sourced from the manual Syllabus Mapping Matrix (pp.135–136)
const modulePageRefs: Record<number, string> = {
   1: "—",
   2: "pp.10–21",
   3: "pp.14–15",
   4: "pp.17–23",
   5: "p.16",
   6: "p.18",
   7: "pp.30–33",
   8: "pp.34–35",
   9: "pp.36–39",
  10: "pp.36–39",
  11: "pp.36–39",
  12: "pp.36–39",
  13: "pp.26–39",
  14: "pp.36–39",
  15: "pp.36–39",
  16: "pp.36–39",
  17: "pp.54–63",
  18: "pp.30–33",
  19: "pp.54–63",
  20: "pp.64–81",
  21: "pp.64–81",
  22: "pp.64–81",
  23: "pp.64–81",
  24: "pp.64–81",
  25: "pp.82–83",
  26: "pp.104–107",
  27: "pp.100–101",
  28: "pp.96–99",
  29: "pp.100–101",
  30: "pp.104–107",
  31: "pp.104–107",
  32: "p.104",
  33: "pp.110–111",
  34: "pp.108–121",
  35: "pp.108–121",
  36: "pp.108–121",
};

const categoryLabels: Record<string,string> = {
  "COURSE REQUIREMENTS": "Course Requirements — Reference Documents",
  "ASSESSMENT MODULES":  "Unit 1 — Occupational Standards, Health & Safety & Risk Evaluation",
  "CHAINSAW MAINTENANCE":"Unit 2 — Power Unit Architecture, Mechanical Integrity & Component Maintenance",
  "CROSS CUTTING":       "Unit 3 — System Startups, Operational Testing & Processing Techniques",
};

function drawMapHeader(): void {
  ensurePts(20);
  const hy = doc.y;
  doc.rect(ML, hy, CW, 18).fill(OG);
  let hx = ML;
  for (const col of MAP_COLS) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHT)
      .text(col.label, hx + 3, hy + 5, { width: col.w - 4, lineBreak: false });
    hx += col.w;
  }
  doc.y = hy + 18;
}

// MAP_SAFE: content must end above this — footer line draws at SAFE-20
const MAP_SAFE = SAFE - 22;

function drawCatBar(label: string): void {
  if (doc.y + 18 > MAP_SAFE) {
    footer();
    doc.addPage();
    drawMapHeader();
  }
  const cy = doc.y;
  doc.rect(ML, cy, CW, 16).fill("#2b2b2b");
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(OG)
    .text(label.toUpperCase(), ML + 6, cy + 4, { width: CW - 10, lineBreak: false });
  doc.y = cy + 16;
}

drawMapHeader();

let mapRowAlt = false;
let lastCat = "";

for (const mod of appModules) {
  if (mod.category !== lastCat) {
    sp(4);
    drawCatBar(categoryLabels[mod.category] ?? mod.category);
    lastCat = mod.category;
    mapRowAlt = false;
  }

  const hasLo = !!mod.learning_outcome;
  const loText = mod.learning_outcome ?? "—";
  const acText = mod.assessment_criteria ?? "—";

  // Measure the two columns that can wrap, pick the tallest
  const loH = doc.font("Helvetica-Bold").fontSize(7.5).heightOfString(loText, { width: C_LO - 6 });
  const acH = doc.font("Helvetica").fontSize(7.5).heightOfString(acText, { width: C_AC - 8 });
  const rowH = Math.max(16, loH + 7, acH + 7);

  if (doc.y + rowH > MAP_SAFE) {
    footer();
    doc.addPage();
    drawMapHeader();
    mapRowAlt = false;
  }

  const ry = doc.y;
  doc.rect(ML, ry, CW, rowH).fill(mapRowAlt ? "#F5F0EB" : WHT);

  let bx = ML;
  for (const col of MAP_COLS) {
    doc.rect(bx, ry, col.w, rowH).strokeColor("#DDDDDD").lineWidth(0.4).stroke();
    bx += col.w;
  }

  let cx = ML;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(OGD)
    .text(String(mod.order), cx + 3, ry + 4, { width: C_NUM - 4, align: "center", lineBreak: false });
  cx += C_NUM;
  doc.font("Helvetica").fontSize(7.5).fillColor(BLK)
    .text(mod.title, cx + 3, ry + 4, { width: C_TTL - 6, lineBreak: false });
  cx += C_TTL;
  const isAppOnly = mod.order === 1 || mod.order === 4;
  const typeLabel = mod.content_type === "video" ? "Video" : isAppOnly ? "App" : "PDF";
  const typeCol   = mod.content_type === "video" ? OGD : isAppOnly ? "#2e7d60" : "#4a6da7";
  doc.font("Helvetica-Bold").fontSize(7).fillColor(typeCol)
    .text(typeLabel, cx + 3, ry + 4, { width: C_TYP - 6, lineBreak: false });
  cx += C_TYP;
  const shortCat: Record<string,string> = {
    "COURSE REQUIREMENTS": "Course Req.",
    "ASSESSMENT MODULES":  "Assessment",
    "CHAINSAW MAINTENANCE":"Maintenance",
    "CROSS CUTTING":       "Cross Cutting",
  };
  doc.font("Helvetica").fontSize(7).fillColor(DGY)
    .text(shortCat[mod.category] ?? mod.category, cx + 3, ry + 4, { width: C_CAT - 6, lineBreak: false });
  cx += C_CAT;
  // LO and AC columns may wrap — no lineBreak: false
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(hasLo ? OG : MGY)
    .text(loText, cx + 3, ry + 4, { width: C_LO - 6 });
  cx += C_LO;
  doc.font("Helvetica").fontSize(7.5).fillColor(hasLo ? DGY : MGY)
    .text(acText, cx + 3, ry + 4, { width: C_AC - 8 });
  cx += C_AC;
  const pgRef = modulePageRefs[mod.order] ?? "—";
  doc.font("Helvetica").fontSize(7.5).fillColor(hasLo ? DGY : MGY)
    .text(pgRef, cx + 3, ry + 4, { width: C_PG - 6, lineBreak: false });

  doc.y = ry + rowH;
  mapRowAlt = !mapRowAlt;
}

sp(14);
ensurePts(60);
hrule(OGL, 0.6);
sp(8);
doc.font("Helvetica-Bold").fontSize(8).fillColor(BLK).text("Key", ML, doc.y, { lineBreak: false });
sp(12);
const legendItems = [
  ["LO1–LO6", "Learning Outcomes 1–6 across three units of the qualification"],
  ["AC x.x",  "Assessment Criteria — each LO has 2–6 specific criteria"],
  ["—",        "Course Requirements modules are prerequisite reference docs; no formal LO/AC assigned"],
  ["Video",    "Interactive video module with embedded quiz (sequentially gated)"],
  ["App",      "Content embedded in the app interface (e.g. main page, risk assessment page) — not a separate file"],
  ["PDF",      "Read-only reference document (does not gate progression)"],
];
for (const [term, def] of legendItems) {
  const ly = doc.y;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(OGD)
    .text(term, ML + 4, ly, { width: 50, lineBreak: false });
  doc.y = ly;
  doc.font("Helvetica").fontSize(7.5).fillColor(DGY)
    .text(def, ML + 58, doc.y, { width: CW - 62 });
}

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 5 — COMPLIANCE TOOLS IN THE APP
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("5", "Compliance Tools & Practical Worksheets",
  "Available within the course app  \xb7  PPE Verification  \xb7  Risk Assessment  \xb7  Emergency Action Plan  \xb7  Bio-Security  \xb7  CPD News");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("All practical compliance worksheets are embedded directly within the course app and are completed digitally by the learner. This approach ensures records are date-stamped, stored securely, and immediately exportable as a PDF or plain-text report for portfolio submission or regulatory inspection.", ML, doc.y, { width: CW });
sp(10);

infoBox("PPE Verification Checklist",
  "Accessible from the app Inspection Checklist. The learner confirms each item of PPE — helmet, hearing protection, gloves, trousers, boots, hi-vis, and first aid kit — against its UK/international standard (EN 397, EN 352, EN ISO 11393, EN ISO 17249, EN ISO 20471, BS 8599-1). Mapped to LO1 / AC 1.4 and LO2 / AC 2.2.");
sp(4);

infoBox("Pre-Start & Pre-Use Chainsaw Inspection",
  "Also within the app Inspection Checklist. Covers chain tension, sharpness, brake function, bar condition, oiler, fuel mix, air filter, handguards, chain catcher, exhaust, anti-vibration mounts, and controls. A 4-point dynamic check confirms brake engagement, oil spray, chain creep at idle, and off-switch cut. Mapped to LO5 / AC 5.2.");
sp(4);

infoBox("Risk Assessment, Emergency Action Plan & Bio-Security Log",
  "A 5-step site risk assessment template, Emergency Action Plan (site grid reference, nearest A&E, first aider, muster point), and bio-security cleaning log are available via the app dashboard. Each record is retained and can be exported for IIRSM portfolio use. Mapped to LO2 / AC 2.1, 2.2, and 2.3.");
sp(4);

infoBox("News & CPD Updates",
  "Industry news is published regularly through the app and tagged to its relevant Learning Outcome and AC. Engaging with updates directly supports the IIRSM RM&CF Ongoing Competence Assurance pillar. Accessible via the Admin Dashboard under the Updates tab.");

// ─── Local helpers (table / form row) scoped to this section — kept for alignment map ──
const subHead4 = (title: string) => {
  ensurePts(36); sp(4);
  const sy = doc.y;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(OGD).text(title, ML, sy, { width: CW });
  doc.moveTo(ML, doc.y).lineTo(ML + CW, doc.y).strokeColor(OG).lineWidth(0.6).stroke();
  sp(10);
};
const tblHead4 = (y: number, cols: {label: string; w: number}[]): number => {
  const rowH = 18; const totalW = cols.reduce((s, c) => s + c.w, 0);
  doc.rect(ML, y, totalW, rowH).fill(OG);
  let cx = ML;
  cols.forEach(col => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHT)
      .text(col.label, cx + 4, y + 5, { width: col.w - 6, lineBreak: false });
    cx += col.w;
  });
  return y + rowH;
};
const tblRow4 = (y: number, cols: {text?: string; w: number}[], rowH: number, alt: boolean): number => {
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  doc.rect(ML, y, totalW, rowH).fill(alt ? "#F5F0EB" : WHT);
  let cx = ML;
  cols.forEach(col => {
    doc.rect(cx, y, col.w, rowH).stroke("#CCCCCC");
    if (col.text) {
      doc.font("Helvetica").fontSize(7.5).fillColor(DGY)
        .text(col.text, cx + 4, y + 5, { width: col.w - 8, lineBreak: false });
    }
    cx += col.w;
  });
  return y + rowH;
};
sp(10);


footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 6 — VIDEO TRANSCRIPTS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("6", "Video Transcripts",
  `${transcripts.length} Module${transcripts.length !== 1 ? "s" : ""}  ·  LO & AC Aligned  ·  Timecoded`);

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The transcripts below correspond to each video module in the course. They are provided for assessor and IIRSM review purposes only and are not accessible to learners within the platform. Each transcript is mapped to its Learning Outcome (LO) and Assessment Criteria (AC) and includes timecodes from the original recording.", ML, doc.y, { width: CW });
sp(10);

if (transcripts.length === 0) {
  infoBox("No transcripts loaded",
    "Transcripts have not yet been imported. Run: pnpm exec tsx scripts/src/import-transcript.ts --file <path> --order <n> --title <title> --lo LO1 --ac 'AC 1.4'");
} else {
  const C_TC = 88;
  const C_TX = CW - C_TC;

  for (const t of transcripts) {
    const segs = t.segments.filter(s => s.text?.trim());
    if (segs.length === 0) continue;

    // ── Module sub-header ─────────────────────────────────────────────────────
    ensurePts(54);
    sp(8);
    const mhy = doc.y;
    doc.rect(ML, mhy, CW, 22).fill(OGD);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(WHT)
      .text(`Module ${t.module_order}: ${t.module_title}`, ML + 6, mhy + 6, { width: CW - 110, lineBreak: false });
    if (t.learning_outcome || t.assessment_criteria) {
      doc.font("Helvetica").fontSize(8).fillColor(OGL)
        .text([t.learning_outcome, t.assessment_criteria].filter(Boolean).join("  ·  "),
          ML + CW - 104, mhy + 7, { width: 100, align: "right", lineBreak: false });
    }
    doc.y = mhy + 22;

    // ── Table header ─────────────────────────────────────────────────────────
    const thy = doc.y;
    doc.rect(ML, thy, CW, 16).fill(OG);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHT)
      .text("Timecode", ML + 4, thy + 4, { width: C_TC - 8, lineBreak: false });
    doc.rect(ML + C_TC, thy, 0.5, 16).fill(WHT);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WHT)
      .text("Transcript", ML + C_TC + 6, thy + 4, { width: C_TX - 10, lineBreak: false });
    doc.y = thy + 16;

    // ── Segment rows ─────────────────────────────────────────────────────────
    let rowAlt = false;
    for (const seg of segs) {
      const text = seg.text.trim();
      const lineH = doc.font("Helvetica").fontSize(8).heightOfString(text, { width: C_TX - 14 });
      const rowH = Math.max(18, lineH + 8);
      ensurePts(rowH + 2);
      const ry = doc.y;
      doc.rect(ML, ry, CW, rowH).fill(rowAlt ? "#F5F0EB" : WHT);
      doc.rect(ML, ry, CW, rowH).strokeColor("#DDDDDD").lineWidth(0.4).stroke();
      // Timecode cell
      const tc = `${fmtTc(seg.timecodeStart)} – ${fmtTc(seg.timecodeEnd)}`;
      doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
        .text(tc, ML + 5, ry + 5, { width: C_TC - 8, lineBreak: false });
      // Column divider
      doc.moveTo(ML + C_TC, ry).lineTo(ML + C_TC, ry + rowH).strokeColor("#DDDDDD").lineWidth(0.4).stroke();
      // Text cell
      doc.font("Helvetica").fontSize(8).fillColor(DGY)
        .text(text, ML + C_TC + 6, ry + 4, { width: C_TX - 14 });
      doc.y = ry + rowH;
      rowAlt = !rowAlt;
    }
    sp(4);
  }
}

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 7 — ASSESSMENT BANK
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("7","Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  \xb7  Summative Examination Pool`);
infoBox("How the exam works",
  `The summative examination draws a randomised 45 questions from this ${examQs.length}-question bank. Questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must achieve 80% or above to pass. Correct answers are highlighted in orange with ✓.`);

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);

  // ── CRITICAL: ensure at least 80pt before setting y0 ──────────────────────
  // This guarantees y0+3, y0+4, y0+18 are all within the current page.
  // pdfkit never auto-paginates on a rect() call, only on text() calls.
  ensurePts(80);
  const y0 = doc.y;

  if (i % 2 === 0) {
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
// SECTION 8 — MOCK QUESTIONS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("8","Supplementary Oral & Practical Mock Questions",
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

footer();

// End bar
ensurePts(36);
sp(10);
doc.rect(ML, doc.y, CW, 26).fill(OG);
doc.y += 10;
doc.font("Helvetica-Bold").fontSize(9).fillColor(WHT)
  .text("End of Course Materials  ·  chainsawcourses.com  ·  © 2026 Chainsaw Courses Ltd",
    ML, doc.y, { width: CW, align: "center", lineBreak: false });
doc.y += 26;

footer();

doc.end();
stream.on("finish", () => {
  const { size } = fs.statSync(OUT);
  console.log(`✅  ${Math.round(size / 1024)} KB`);
});
