/**
 * Generates IIRSM_Competency_Framework_Mapping.pdf and writes it to
 * artifacts/chainsaw-training/public/pdfs/
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/generate-competency-mapping.ts
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT = path.resolve(
  __dirname,
  "../../artifacts/chainsaw-training/public/pdfs/IIRSM_Competency_Framework_Mapping.pdf"
);

const BRAND  = rgb(0.918, 0.361, 0.047);
const BLACK  = rgb(0, 0, 0);
const DARK   = rgb(0.15, 0.15, 0.15);
const MID    = rgb(0.35, 0.35, 0.35);
const LIGHT  = rgb(0.85, 0.85, 0.85);
const WHITE  = rgb(1, 1, 1);
const PAGEBG = rgb(0.97, 0.97, 0.97);
const SHADE  = rgb(0.93, 0.93, 0.93);

const PAGE_W = 595;
const PAGE_H = 842;
const M      = 42;
const COL_W  = PAGE_W - M * 2;

async function generate() {
  const doc   = await PDFDocument.create();
  const fReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fItal = await doc.embedFont(StandardFonts.HelveticaOblique);

  type State = { page: ReturnType<typeof doc.addPage>; y: number };
  const states: State[] = [];

  function newPage(): State {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAGEBG });
    const s: State = { page, y: PAGE_H - M };
    states.push(s);
    return s;
  }

  /** Word-wrap text, return lines drawn */
  function drawText(
    s: State,
    text: string,
    opts: {
      font?: typeof fReg;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxWidth?: number;
      lineHeight?: number;
    } = {}
  ): number {
    const font       = opts.font ?? fReg;
    const size       = opts.size ?? 9;
    const color      = opts.color ?? DARK;
    const x          = opts.x ?? M;
    const maxWidth   = opts.maxWidth ?? COL_W;
    const lh         = opts.lineHeight ?? size * 1.45;
    const words      = text.split(" ");
    let line         = "";
    let drawn        = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        s.page.drawText(line, { x, y: s.y, size, font, color });
        s.y -= lh; drawn++;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) { s.page.drawText(line, { x, y: s.y, size, font, color }); s.y -= lh; drawn++; }
    return drawn;
  }

  function gap(s: State, h: number) { s.y -= h; }

  function hRule(s: State, color = LIGHT) {
    s.page.drawRectangle({ x: M, y: s.y, width: COL_W, height: 0.75, color });
    s.y -= 6;
  }

  function sectionHeading(s: State, title: string) {
    s.page.drawRectangle({ x: M, y: s.y - 2, width: COL_W, height: 16, color: BRAND });
    s.page.drawText(title, { x: M + 6, y: s.y + 2, size: 8, font: fBold, color: WHITE });
    s.y -= 20;
  }

  /** Measure wrapped lines without drawing */
  function measureLines(text: string, font: typeof fReg, size: number, maxW: number): string[] {
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line); line = w;
      } else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Two-column key/value row */
  function tableRow(s: State, label: string, value: string, shade: boolean, labelW = 155) {
    const valueX = M + labelW;
    const valueW = COL_W - labelW;
    const sz = 8; const lh = sz * 1.4;
    const vLines = measureLines(value, fReg,  sz, valueW - 8);
    const lLines = measureLines(label, fBold, sz, labelW - 8);
    const rows   = Math.max(vLines.length, lLines.length);
    const rowH   = rows * lh + 8;
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: shade ? SHADE : WHITE });
    let ty = s.y;
    for (const ll of lLines) { s.page.drawText(ll, { x: M + 6, y: ty, size: sz, font: fBold, color: DARK }); ty -= lh; }
    ty = s.y;
    for (const vl of vLines) { s.page.drawText(vl, { x: valueX + 4, y: ty, size: sz, font: fReg, color: DARK }); ty -= lh; }
    s.page.drawRectangle({ x: M + labelW, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: 0.5, color: LIGHT });
    s.y -= rowH;
  }

  /** Three-column mapping row: competency | modules | level */
  function mappingRow(
    s: State,
    competency: string,
    desc: string,
    modules: string,
    level: string,
    shade: boolean
  ) {
    const sz = 7.5; const lh = sz * 1.38;
    const C1W = 148; // competency area
    const C2W = 250; // modules
    const C3W = COL_W - C1W - C2W; // level
    const x2 = M + C1W; const x3 = x2 + C2W;

    const cLines = measureLines(competency, fBold, sz, C1W - 8);
    const dLines = desc ? measureLines(desc, fItal, sz - 0.5, C1W - 8) : [];
    const mLines = measureLines(modules, fReg, sz, C2W - 8);
    const lvLines = measureLines(level, fReg, sz, C3W - 6);

    const rows = Math.max(cLines.length + dLines.length, mLines.length, lvLines.length);
    const rowH = rows * lh + 10;

    if (s.y - rowH < M + 20) {
      // page break
      addPageNumber(s);
      const ns = newPage();
      addMappingHeader(ns);
      s.page = ns.page; s.y = ns.y;
    }

    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: shade ? SHADE : WHITE });

    // competency
    let ty = s.y;
    for (const l of cLines) { s.page.drawText(l, { x: M + 4, y: ty, size: sz, font: fBold, color: DARK }); ty -= lh; }
    for (const l of dLines) { s.page.drawText(l, { x: M + 4, y: ty, size: sz - 0.5, font: fItal, color: MID }); ty -= lh; }

    // modules
    ty = s.y;
    for (const l of mLines) { s.page.drawText(l, { x: x2 + 4, y: ty, size: sz, font: fReg, color: DARK }); ty -= lh; }

    // level badge
    ty = s.y;
    for (const l of lvLines) { s.page.drawText(l, { x: x3 + 4, y: ty, size: sz, font: fBold, color: BRAND }); ty -= lh; }

    // column dividers
    s.page.drawRectangle({ x: x2, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });
    s.page.drawRectangle({ x: x3, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: 0.5, color: LIGHT });

    s.y -= rowH;
  }

  function addMappingHeader(s: State) {
    const sz = 7.5;
    const C1W = 148; const C2W = 250; const C3W = COL_W - C1W - C2W;
    const x2 = M + C1W; const x3 = x2 + C2W;
    s.page.drawRectangle({ x: M, y: s.y - 14, width: COL_W, height: 18, color: DARK });
    s.page.drawText("IIRSM Competency Area",       { x: M + 4,   y: s.y,    size: sz, font: fBold, color: WHITE });
    s.page.drawText("Modules Covered",             { x: x2 + 4,  y: s.y,    size: sz, font: fBold, color: WHITE });
    s.page.drawText("Level",                       { x: x3 + 4,  y: s.y,    size: sz, font: fBold, color: WHITE });
    s.page.drawRectangle({ x: x2, y: s.y - 14, width: 0.5, height: 18, color: LIGHT });
    s.page.drawRectangle({ x: x3, y: s.y - 14, width: 0.5, height: 18, color: LIGHT });
    s.y -= 18;
  }

  function addPageNumber(s: State) {
    const n = states.indexOf(s) + 1;
    s.page.drawText(`Page ${n}`, { x: PAGE_W - M - 30, y: M - 14, size: 7, font: fReg, color: MID });
  }

  // ── PAGE 1: Cover + overview ──────────────────────────────────────────────

  const p1 = newPage();

  // Orange header bar
  p1.page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: BRAND });
  p1.page.drawText("IIRSM Course Approval", { x: M, y: PAGE_H - 36, size: 18, font: fBold, color: WHITE });
  p1.page.drawText("Risk Management & Leadership Competency Framework — Course Alignment", {
    x: M, y: PAGE_H - 56, size: 10, font: fReg, color: WHITE,
  });
  p1.page.drawText("Chainsaw Cross-Cutting — eLearning Course", {
    x: M, y: PAGE_H - 72, size: 9, font: fItal, color: rgb(1, 0.85, 0.75),
  });
  p1.y = PAGE_H - 90 - 18;

  // Document metadata row
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  tableRow(p1, "Document Date",     today,                             false, 155);
  tableRow(p1, "Version",           "1.0",                             true,  155);
  tableRow(p1, "Course Type",       "eLearning (no trainer)",          false, 155);
  tableRow(p1, "Applicant Type",    "New to IIRSM Course Approval",   true,  155);
  tableRow(p1, "Approval Sought",   "Initial 18-month approval",       false, 155);

  gap(p1, 10);
  sectionHeading(p1, "1. PURPOSE OF THIS DOCUMENT");
  drawText(p1,
    "This document maps the content of the Chainsaw Cross-Cutting eLearning course against the " +
    "IIRSM Risk Management and Leadership Competency Framework. It is prepared to support the " +
    "IIRSM Course Approval application and demonstrates how each module of the course aligns to " +
    "the competency areas and levels defined within the Framework.",
    { size: 9 }
  );
  gap(p1, 6);
  drawText(p1,
    "The course is designed to be assessed at the Operational level of the Framework, with " +
    "selected modules also addressing Managerial-level competences in risk assessment, legal " +
    "compliance, and emergency planning.",
    { size: 9 }
  );

  gap(p1, 12);
  sectionHeading(p1, "2. COURSE SCOPE AND POSITIONING");
  drawText(p1,
    "This eLearning course provides the theoretical knowledge and understanding required to support " +
    "candidates preparing for the NPTC Unit CS30/CS31 practical chainsaw certification. It does not " +
    "constitute legal authorisation to operate a chainsaw and does not replace the mandatory " +
    "practical assessment conducted by a LANTRA or NPTC-approved assessor.",
    { size: 9, font: fBold, color: DARK }
  );
  gap(p1, 6);
  drawText(p1,
    "The course covers four topic areas across 35 modules: Course Requirements, Standards & Regulations, " +
    "Chainsaw Maintenance, and Cross-Cutting Techniques. Each module comprises video content, structured " +
    "reading, and a knowledge-check quiz. Learner progress, quiz scores, and feedback are recorded " +
    "throughout and are available for review by IIRSM assessors via the platform.",
    { size: 9 }
  );

  gap(p1, 12);
  sectionHeading(p1, "3. COURSE MODULES OVERVIEW");

  const moduleGroups = [
    {
      group: "COURSE REQUIREMENTS",
      modules: "Equipment List (M8)",
    },
    {
      group: "STANDARDS & REGULATIONS",
      modules: "PPE & First Aid (M9) · 5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · Emergency Planning Information (M12) · Law & Regulations (M13) · Chainsaw Safety Features (M14)",
    },
    {
      group: "CHAINSAW MAINTENANCE",
      modules: "Battery Chainsaws (M40) · Air Filter (M15) · Spark Plug (M16) · Cooling System (M17) · Exhaust (M18) · Fuel & Oil Filters (M19) · Oiling System (M41) · Recoil Starter (M20) · Clutch Assembly (M21) · Sprocket (M22) · Chain Brake (M23) · Guidebar (M24) · Chain Basics (M25) · Chain Tension (M26) · Identifying Chain (M27) · Replacing Chain (M28) · Chain Sharpening (M29)",
    },
    {
      group: "CROSS-CUTTING TECHNIQUES",
      modules: "Kickback (M42) · Work Positioning (M31) · Pre-Start Checks (M32) · Starting The Chainsaw (M33) · Pre-Use Checks (M34) · Cutting Basics (M35) · Tension & Compression (M36) · Releasing A Trapped Chainsaw (M37) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39) · Stacking (M30) · Additional Cuts (M43)",
    },
  ];

  for (let i = 0; i < moduleGroups.length; i++) {
    const g = moduleGroups[i];
    tableRow(p1, g.group, g.modules, i % 2 === 0, 155);
    if (p1.y < M + 30) {
      addPageNumber(p1);
      const np = newPage();
      p1.page = np.page; p1.y = np.y;
    }
  }

  addPageNumber(p1);

  // ── PAGE 2+: Competency Mapping Table ────────────────────────────────────

  const p2 = newPage();

  p2.page.drawRectangle({ x: M, y: p2.y - 2, width: COL_W, height: 18, color: BRAND });
  p2.page.drawText("4. COMPETENCY FRAMEWORK MAPPING", {
    x: M + 6, y: p2.y + 2, size: 9, font: fBold, color: WHITE,
  });
  p2.y -= 22;

  drawText(p2,
    "The table below maps each IIRSM Risk Management and Leadership Competency Area to the " +
    "specific modules in this course. Competency levels are assigned as: Operational (O) — " +
    "knowledge and understanding with some application; Managerial (M) — clear application and " +
    "knowledge; Strategic (S) — reasoned advice and depth of complexity.",
    { size: 8.5 }
  );
  gap(p2, 8);

  addMappingHeader(p2);

  const mappings: {
    competency: string;
    desc: string;
    modules: string;
    level: string;
  }[] = [
    {
      competency: "1. Hazard Identification",
      desc: "Identifying sources of harm in the work environment",
      modules: "Hazards & Risks (M11) · Chainsaw Safety Features (M14) · Kickback (M42) · Tension & Compression (M36) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39)",
      level: "Operational",
    },
    {
      competency: "2. Risk Assessment",
      desc: "Evaluating likelihood, severity and overall risk rating",
      modules: "5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · PPE & First Aid (M9) · Work Positioning (M31)",
      level: "Operational / Managerial",
    },
    {
      competency: "3. Risk Control",
      desc: "Implementing the hierarchy of control and preventative measures",
      modules: "PPE & First Aid (M9) · Chain Brake (M23) · Work Positioning (M31) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · Kickback (M42) · Releasing A Trapped Chainsaw (M37) · Stacking (M30)",
      level: "Operational",
    },
    {
      competency: "4. Legal & Regulatory Compliance",
      desc: "Understanding and applying relevant legislation and standards",
      modules: "Law & Regulations (M13) · PPE & First Aid (M9) · Chainsaw Safety Features (M14) · Chain Brake (M23)",
      level: "Operational / Managerial",
    },
    {
      competency: "5. Emergency Planning & Response",
      desc: "Preparing for and responding to emergencies",
      modules: "Emergency Planning Information (M12) · PPE & First Aid (M9)",
      level: "Operational",
    },
    {
      competency: "6. Equipment Safety & Maintenance",
      desc: "Safe use, inspection and maintenance of work equipment (PUWER)",
      modules: "Equipment List (M8) · Air Filter (M15) · Spark Plug (M16) · Cooling System (M17) · Exhaust (M18) · Fuel & Oil Filters (M19) · Oiling System (M41) · Recoil Starter (M20) · Clutch Assembly (M21) · Sprocket (M22) · Chain Brake (M23) · Guidebar (M24) · Battery Chainsaws (M40) · Pre-Start Checks (M32) · Pre-Use Checks (M34)",
      level: "Operational",
    },
    {
      competency: "7. Safe Working Practices",
      desc: "Applying safe methods of work and task procedures",
      modules: "Starting The Chainsaw (M33) · Cutting Basics (M35) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39) · Additional Cuts (M43) · Work Positioning (M31) · Releasing A Trapped Chainsaw (M37) · Stacking (M30)",
      level: "Operational",
    },
    {
      competency: "8. Chain & Cutting Tool Management",
      desc: "Competence in chain selection, tensioning and maintenance",
      modules: "Chain Basics (M25) · Chain Tension (M26) · Identifying Chain (M27) · Replacing Chain (M28) · Chain Sharpening (M29) · Guidebar (M24)",
      level: "Operational",
    },
    {
      competency: "9. Communication of Risk",
      desc: "Communicating risk information clearly to relevant parties",
      modules: "Emergency Planning Information (M12) · 5 Steps To Risk Assessment (M10) · Hazards & Risks (M11)",
      level: "Operational",
    },
    {
      competency: "10. Health & Wellbeing",
      desc: "Managing occupational health risks including manual handling (MHOR)",
      modules: "PPE & First Aid (M9) · Stacking (M30) · Work Positioning (M31) · Chainsaw Safety Features (M14)",
      level: "Operational",
    },
  ];

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    mappingRow(p2, m.competency, m.desc, m.modules, m.level, i % 2 === 0);
  }

  gap(p2, 12);

  // QA Evidence section
  if (p2.y < 160) {
    addPageNumber(p2);
    const np = newPage();
    p2.page = np.page; p2.y = np.y;
  }

  sectionHeading(p2, "5. QUALITY ASSURANCE EVIDENCE");
  drawText(p2,
    "In accordance with IIRSM requirements, the following quality assurance mechanisms are in place:",
    { size: 9 }
  );
  gap(p2, 6);

  const qaRows = [
    ["Delegate Feedback", "Module-level star ratings and comments collected at end of each module. App-level feedback collected on course completion. All records retained in a tamper-evident database with timestamped entries. Minimum 12-month retention guaranteed."],
    ["Feedback into Development", "Feedback data is reviewed by the course developer at quarterly intervals. A dedicated admin dashboard provides exportable feedback reports. Course content is updated following any pattern of negative feedback or regulatory change."],
    ["Assessment Records", "All quiz attempts, scores, pass/fail outcomes, and timestamps are stored per learner. Mock exam and final exam results are similarly retained. Records are exportable via the Google Sheets backup system for external audit."],
    ["Learner Completion Data", "Progress tracking records video watched status, quiz pass status, and timestamps for each of the 35 modules per learner. A completion certificate is issued only on full course and exam completion."],
    ["Platform Access for Assessors", "IIRSM assessors can be granted a full-access learner account to experience the course as a delegate, plus a read-only admin account to review all learner data, feedback, and assessment records."],
  ];

  for (let i = 0; i < qaRows.length; i++) {
    tableRow(p2, qaRows[i][0], qaRows[i][1], i % 2 === 0, 145);
    if (p2.y < M + 30) {
      addPageNumber(p2);
      const np = newPage();
      p2.page = np.page; p2.y = np.y;
    }
  }

  gap(p2, 12);

  if (p2.y < 80) {
    addPageNumber(p2);
    const np = newPage();
    p2.page = np.page; p2.y = np.y;
  }

  sectionHeading(p2, "6. DECLARATION");
  drawText(p2,
    "I confirm that the information provided in this document and the accompanying IIRSM Course " +
    "Approval application is accurate and complete to the best of my knowledge. The course content " +
    "aligns to the IIRSM Risk Management and Leadership Competency Framework at the Operational " +
    "level as mapped above. I undertake to notify IIRSM of any material changes to course content, " +
    "trainers, or organisational policies during the period of approval.",
    { size: 9 }
  );

  gap(p2, 16);
  p2.page.drawRectangle({ x: M, y: p2.y, width: 160, height: 0.75, color: DARK });
  gap(p2, 3);
  drawText(p2, "Signature", { size: 8, color: MID });
  gap(p2, 8);
  p2.page.drawRectangle({ x: M, y: p2.y, width: 160, height: 0.75, color: DARK });
  gap(p2, 3);
  drawText(p2, `Date: ${today}`, { size: 8, color: MID });

  addPageNumber(p2);

  // Footer on all pages
  for (const s of states) {
    s.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 22, color: BRAND });
    s.page.drawText(
      "Chainsaw Cross-Cutting eLearning Course  ·  IIRSM Competency Framework Alignment",
      { x: M, y: 7, size: 6.5, font: fReg, color: WHITE }
    );
  }

  const bytes = await doc.save();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, bytes);
  console.log(`✓ Written ${Math.round(bytes.length / 1024)} KB → ${OUT}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
