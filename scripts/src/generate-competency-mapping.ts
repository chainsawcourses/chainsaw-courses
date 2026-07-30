/**
 * Generates IIRSM_Competency_Framework_Mapping.pdf and writes it to
 * artifacts/chainsaw-training/public/pdfs/
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/generate-competency-mapping.ts
 *
 * Competency areas sourced from the official IIRSM Risk Management and
 * Leadership Competence Framework (three domains: Technical, Leadership
 * Behaviours, Business Competences; three levels: Operational/Associate,
 * Managerial/Member, Strategic/Fellow).
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
const DARK   = rgb(0.15,  0.15,  0.15);
const MID    = rgb(0.35,  0.35,  0.35);
const LIGHT  = rgb(0.85,  0.85,  0.85);
const WHITE  = rgb(1,     1,     1);
const PAGEBG = rgb(0.97,  0.97,  0.97);
const SHADE  = rgb(0.93,  0.93,  0.93);
const TEAL   = rgb(0.06,  0.44,  0.48);   // section colour for Leadership
const NAVY   = rgb(0.10,  0.18,  0.38);   // section colour for Business

const PAGE_W = 595;
const PAGE_H = 842;
const M      = 42;
const COL_W  = PAGE_W - M * 2;

async function generate() {
  const doc   = await PDFDocument.create();
  const fReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fItal = await doc.embedFont(StandardFonts.HelveticaOblique);

  type Page = ReturnType<typeof doc.addPage>;
  type State = { page: Page; y: number; idx: number };
  const states: State[] = [];

  function newPage(): State {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAGEBG });
    const s: State = { page, y: PAGE_H - M, idx: states.length };
    states.push(s);
    return s;
  }

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

  function drawText(s: State, text: string, opts: {
    font?: typeof fReg; size?: number; color?: ReturnType<typeof rgb>;
    x?: number; maxWidth?: number; lineHeight?: number;
  } = {}): number {
    const font  = opts.font ?? fReg;
    const size  = opts.size ?? 9;
    const color = opts.color ?? DARK;
    const x     = opts.x ?? M;
    const maxW  = opts.maxWidth ?? COL_W;
    const lh    = opts.lineHeight ?? size * 1.45;
    const lines = measureLines(text, font, size, maxW);
    for (const l of lines) {
      s.page.drawText(l, { x, y: s.y, size, font, color });
      s.y -= lh;
    }
    return lines.length;
  }

  function gap(s: State, h: number) { s.y -= h; }

  function sectionBanner(s: State, title: string, color = BRAND) {
    s.page.drawRectangle({ x: M, y: s.y - 2, width: COL_W, height: 16, color });
    s.page.drawText(title, { x: M + 6, y: s.y + 2, size: 8, font: fBold, color: WHITE });
    s.y -= 22;
  }

  function tableRow(s: State, label: string, value: string, shade: boolean, labelW = 155) {
    const x2 = M + labelW;
    const sz = 8; const lh = sz * 1.4;
    const vLines = measureLines(value, fReg,  sz, COL_W - labelW - 8);
    const lLines = measureLines(label, fBold, sz, labelW - 8);
    const rows   = Math.max(vLines.length, lLines.length);
    const rowH   = rows * lh + 8;
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: shade ? SHADE : WHITE });
    let ty = s.y;
    for (const l of lLines) { s.page.drawText(l, { x: M + 6, y: ty, size: sz, font: fBold, color: DARK }); ty -= lh; }
    ty = s.y;
    for (const l of vLines) { s.page.drawText(l, { x: x2 + 4, y: ty, size: sz, font: fReg, color: DARK }); ty -= lh; }
    s.page.drawRectangle({ x: x2, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: 0.5, color: LIGHT });
    s.y -= rowH;
  }

  // ── Mapping table row: 4 cols — Domain | Competency Area | Framework Statement | Modules ──

  const C1 = 72;   // domain
  const C2 = 120;  // competency area
  const C3 = 155;  // framework statement (what the framework says at Operational level)
  const C4 = COL_W - C1 - C2 - C3; // modules

  function mappingHeader(s: State) {
    const sz = 7;
    const x2 = M + C1; const x3 = x2 + C2; const x4 = x3 + C3;
    s.page.drawRectangle({ x: M, y: s.y - 14, width: COL_W, height: 18, color: DARK });
    for (const [x, label] of [[M + 3, "Domain"], [x2 + 3, "Competency Area"], [x3 + 3, "Framework Statement (Operational)"], [x4 + 3, "Modules Covered"]] as [number, string][]) {
      s.page.drawText(label, { x, y: s.y, size: sz, font: fBold, color: WHITE });
    }
    for (const x of [x2, x3, x4]) {
      s.page.drawRectangle({ x, y: s.y - 14, width: 0.5, height: 18, color: rgb(0.5, 0.5, 0.5) });
    }
    s.y -= 18;
  }

  function mappingRow(s: State, domain: string, domainColor: ReturnType<typeof rgb>,
    area: string, statement: string, modules: string, shade: boolean) {
    const sz = 7; const lh = sz * 1.38;
    const x2 = M + C1; const x3 = x2 + C2; const x4 = x3 + C3;
    const d = measureLines(domain,    fBold, sz, C1 - 6);
    const a = measureLines(area,      fBold, sz, C2 - 6);
    const st = measureLines(statement, fItal, sz - 0.3, C3 - 6);
    const m = measureLines(modules,   fReg,  sz, C4 - 6);
    const rows = Math.max(d.length, a.length, st.length, m.length);
    const rowH = rows * lh + 9;

    if (s.y - rowH < M + 24) {
      addPageFooter(s);
      const ns = newPage();
      mappingHeader(ns);
      s.page = ns.page; s.y = ns.y; s.idx = ns.idx;
    }

    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: shade ? SHADE : WHITE });

    let ty = s.y;
    for (const l of d)  { s.page.drawText(l, { x: M + 3,   y: ty, size: sz, font: fBold, color: domainColor }); ty -= lh; }
    ty = s.y;
    for (const l of a)  { s.page.drawText(l, { x: x2 + 3,  y: ty, size: sz, font: fBold, color: DARK }); ty -= lh; }
    ty = s.y;
    for (const l of st) { s.page.drawText(l, { x: x3 + 3,  y: ty, size: sz - 0.3, font: fItal, color: MID }); ty -= lh; }
    ty = s.y;
    for (const l of m)  { s.page.drawText(l, { x: x4 + 3,  y: ty, size: sz, font: fReg, color: DARK }); ty -= lh; }

    for (const x of [x2, x3, x4]) {
      s.page.drawRectangle({ x, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });
    }
    s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: 0.5, color: LIGHT });
    s.y -= rowH;
  }

  function addPageFooter(s: State) {
    const n = s.idx + 1;
    s.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 22, color: BRAND });
    s.page.drawText(
      "Chainsaw Cross-Cutting eLearning  ·  IIRSM Competency Framework Alignment",
      { x: M, y: 7, size: 6.5, font: fReg, color: WHITE }
    );
    s.page.drawText(`Page ${n}`, { x: PAGE_W - M - 24, y: 7, size: 6.5, font: fBold, color: WHITE });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Cover, positioning, course overview
  // ════════════════════════════════════════════════════════════════════════════
  const p1 = newPage();

  // Header bar
  p1.page.drawRectangle({ x: 0, y: PAGE_H - 88, width: PAGE_W, height: 88, color: BRAND });
  p1.page.drawText("IIRSM Course Approval", { x: M, y: PAGE_H - 34, size: 17, font: fBold, color: WHITE });
  p1.page.drawText("Risk Management & Leadership Competency Framework — Course Alignment", {
    x: M, y: PAGE_H - 52, size: 9.5, font: fReg, color: WHITE,
  });
  p1.page.drawText("Chainsaw Cross-Cutting — eLearning (no trainer)", {
    x: M, y: PAGE_H - 68, size: 8.5, font: fItal, color: rgb(1, 0.85, 0.75),
  });
  p1.y = PAGE_H - 88 - 16;

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  tableRow(p1, "Document Date",   today,                                    false, 145);
  tableRow(p1, "Version",         "1.0",                                    true,  145);
  tableRow(p1, "Course Format",   "eLearning (no trainer)",                 false, 145);
  tableRow(p1, "Application Type","New to IIRSM Course Approval",           true,  145);
  tableRow(p1, "Approval Sought", "Initial 18-month approval (1–5 courses)",false, 145);
  tableRow(p1, "Framework Source","IIRSM Risk Management and Leadership Competence Framework (official)", true, 145);

  gap(p1, 10);
  sectionBanner(p1, "1.  PURPOSE OF THIS DOCUMENT");
  drawText(p1,
    "This document maps the content of the Chainsaw Cross-Cutting eLearning course against the " +
    "IIRSM Risk Management and Leadership Competence Framework. It identifies, for each applicable " +
    "competency area, the specific framework statement at Operational (Associate) level that the " +
    "course addresses, together with the modules through which that competence is developed. " +
    "It is prepared to support the IIRSM Course Approval application submitted via SurveyMonkey.",
    { size: 9 }
  );

  gap(p1, 10);
  sectionBanner(p1, "2.  COURSE SCOPE AND POSITIONING");
  drawText(p1,
    "This eLearning course provides the theoretical knowledge and understanding required to support " +
    "candidates preparing for the NPTC Unit CS30 / CS31 practical chainsaw certification. It does " +
    "not constitute legal authorisation to operate a chainsaw and does not replace the mandatory " +
    "practical assessment conducted by a LANTRA or NPTC-approved assessor.",
    { size: 9, font: fBold }
  );
  gap(p1, 5);
  drawText(p1,
    "The course operates at the Operational level of the IIRSM framework — developing knowledge " +
    "and understanding with some application — consistent with the Associate membership grade. " +
    "No Managerial or Strategic competences are claimed.",
    { size: 9 }
  );

  gap(p1, 10);
  sectionBanner(p1, "3.  COURSE MODULES OVERVIEW");
  tableRow(p1, "COURSE REQUIREMENTS",    "Equipment List (M8)", false, 160);
  tableRow(p1, "STANDARDS & REGULATIONS",
    "PPE & First Aid (M9) · 5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · " +
    "Emergency Planning Information (M12) · Law & Regulations (M13) · Chainsaw Safety Features (M14)",
    true, 160);
  tableRow(p1, "CHAINSAW MAINTENANCE",
    "Battery Chainsaws (M40) · Air Filter (M15) · Spark Plug (M16) · Cooling System (M17) · " +
    "Exhaust (M18) · Fuel & Oil Filters (M19) · Oiling System (M41) · Recoil Starter (M20) · " +
    "Clutch Assembly (M21) · Sprocket (M22) · Chain Brake (M23) · Guidebar (M24) · " +
    "Chain Basics–Sharpening (M25–M29)",
    false, 160);
  tableRow(p1, "CROSS-CUTTING TECHNIQUES",
    "Kickback (M42) · Work Positioning (M31) · Pre-Start Checks (M32) · Starting The Chainsaw (M33) · " +
    "Pre-Use Checks (M34) · Cutting Basics (M35) · Tension & Compression (M36) · " +
    "Releasing A Trapped Chainsaw (M37) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39) · " +
    "Stacking (M30) · Additional Cuts (M43)",
    true, 160);

  addPageFooter(p1);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Mapping table
  // ════════════════════════════════════════════════════════════════════════════
  const p2 = newPage();

  p2.page.drawRectangle({ x: M, y: p2.y - 2, width: COL_W, height: 16, color: BRAND });
  p2.page.drawText("4.  COMPETENCY FRAMEWORK MAPPING  (Operational / Associate level throughout)",
    { x: M + 6, y: p2.y + 2, size: 8, font: fBold, color: WHITE });
  p2.y -= 22;

  drawText(p2,
    "Only competency areas genuinely addressed by this course are included. The three domains of the " +
    "IIRSM framework are: Technical Competences (orange), Leadership Behaviours (teal), and Business " +
    "Competences (navy). Framework statements are quoted or paraphrased directly from the IIRSM " +
    "Risk Management and Leadership Competence Framework at the Operational (Associate) level.",
    { size: 8, color: MID }
  );
  gap(p2, 6);

  mappingHeader(p2);

  // ── TECHNICAL COMPETENCES ─────────────────────────────────────────────────
  const TC = "Technical Competence";
  const LB = "Leadership Behaviour";
  const BC = "Business Competence";

  const rows: [string, ReturnType<typeof rgb>, string, string, string][] = [

    // Domain | colour | Area | Operational statement (from framework) | Modules
    [TC, BRAND,
      "The role of risk management",
      "Identifies, assesses and controls risks in day-to-day activities and within projects.",
      "5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · PPE & First Aid (M9) · " +
      "Chainsaw Safety Features (M14) · Kickback (M42) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
      "Tension & Compression (M36) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39)",
    ],
    [TC, BRAND,
      "Strategy, objectives, policy & procedures",
      "Supports others to work using established risk policies and procedures in day-to-day activities. Identifies and escalates opportunities to improve risk policies and procedures.",
      "Law & Regulations (M13) · PPE & First Aid (M9) · Pre-Start Checks (M32) · " +
      "Pre-Use Checks (M34) · Work Positioning (M31) · Chain Brake (M23)",
    ],
    [TC, BRAND,
      "Stakeholder engagement",
      "Provides technical advice to support collaborative working across different functions. Encourages stakeholders to adopt risk principles.",
      "Emergency Planning Information (M12) · PPE & First Aid (M9) · Hazards & Risks (M11)",
    ],
    [TC, BRAND,
      "Data management",
      "Collects and sorts data in accordance with company standards and legislation. Carries out preliminary analysis assessing the reliability of data.",
      "Pre-Start Checks (M32) · Pre-Use Checks (M34) · 5 Steps To Risk Assessment (M10) — " +
      "learners collect and record inspection and risk data as part of structured checklists.",
    ],

    // Leadership Behaviours
    [LB, TEAL,
      "Communicative",
      "Listens to instructions and asks questions if in doubt. Captures and presents information on operational performance in a way which is understood by others.",
      "Emergency Planning Information (M12) · Hazards & Risks (M11) · " +
      "Work Positioning (M31) · Stacking (M30)",
    ],
    [LB, TEAL,
      "Systematic",
      "Plans work, selecting appropriate methods to meet objectives and KPIs. Undertakes work in accordance with agreed work methods and procedures. Reviews activities regularly.",
      "5 Steps To Risk Assessment (M10) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
      "Starting The Chainsaw (M33) · Work Positioning (M31) · Chain Tension (M26) · " +
      "Chain Sharpening (M29) · Bore Cutting (M38) · Additional Cuts (M43)",
    ],
    [LB, TEAL,
      "Determined",
      "Delivers consistently and professionally and overcomes challenges, applying alternative methods when needed. Focuses on the delivery of work objectives without compromising values or behaviours.",
      "Releasing A Trapped Chainsaw (M37) · Oversized & Tensioned Timber (M39) · " +
      "Cutting Basics (M35) · Tension & Compression (M36) · Kickback (M42)",
    ],
    [LB, TEAL,
      "Ethical",
      "Demonstrates positive behaviours. Recognises inappropriate behaviours and raises concerns appropriately.",
      "Law & Regulations (M13) · PPE & First Aid (M9) · Chain Brake (M23) · " +
      "Work Positioning (M31) — course emphasises legal and safe conduct as non-negotiable.",
    ],
    [LB, TEAL,
      "Innovative",
      "Contributes to discussions on new ways of working to resolve challenges and suggests opportunities. Open to learning from others.",
      "Battery Chainsaws (M40) · Additional Cuts (M43) · Bore Cutting (M38) · " +
      "Releasing A Trapped Chainsaw (M37)",
    ],

    // Business Competences
    [BC, NAVY,
      "Compliance and legal responsibility",
      "Demonstrates an awareness of the key aspects of internal and external rules, regulations, and obligations that the organisation must comply with. Understands sources of change to legal, regulatory and contractual obligations.",
      "Law & Regulations (M13) · Chainsaw Safety Features (M14) · PPE & First Aid (M9) · " +
      "Chain Brake (M23) — covering HSWA 1974, PUWER 1998, MHOR 1992, COSHH 2002, PPE Regulations, " +
      "BS EN 381 series.",
    ],
    [BC, NAVY,
      "Governance and culture",
      "Understands their role and responsibilities in supporting effective governance. Acts as a role model for others and behaves ethically and with integrity.",
      "Law & Regulations (M13) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
      "PPE & First Aid (M9) · Equipment List (M8)",
    ],
  ];

  for (let i = 0; i < rows.length; i++) {
    const [domain, col, area, statement, modules] = rows[i];
    mappingRow(p2, domain, col, area, statement, modules, i % 2 === 0);
  }

  gap(p2, 10);

  // ── QA Section ─────────────────────────────────────────────────────────────
  if (p2.y < 180) {
    addPageFooter(p2);
    const np = newPage();
    p2.page = np.page; p2.y = np.y; p2.idx = np.idx;
  }

  sectionBanner(p2, "5.  QUALITY ASSURANCE — EVIDENCE FOR IIRSM");
  const qaRows: [string, string, boolean][] = [
    ["Delegate Feedback",
     "Module-level star ratings and written comments collected after each module. Course-level feedback collected on completion. All records are timestamped and stored in a tamper-evident database. Minimum 12-month retention. Exportable on request.",
     false],
    ["Feedback into Course Development",
     "Feedback is reviewed quarterly by the course developer. A dedicated admin dashboard provides exportable feedback reports. Course content is updated following patterns of negative feedback or any change to relevant legislation or HSE/FISA guidance.",
     true],
    ["Assessment Records",
     "All quiz attempts, scores, and pass/fail outcomes are stored per learner with full timestamps. Mock and final exam results are retained separately. All data is exportable via the Google Sheets backup system for external audit.",
     false],
    ["Learner Progress & Completion",
     "Platform tracks video watched status, quiz pass status, and timestamps for each of the 35 modules per learner. A completion certificate bearing the course title is issued only upon full course and final exam completion.",
     true],
    ["Platform Access for IIRSM Assessors",
     "IIRSM assessors will be granted: (a) a full learner account to experience the course as a delegate, and (b) a read-only admin account to review all learner data, feedback, quiz scores, and assessment records.",
     false],
  ];
  for (const [label, value, shade] of qaRows) {
    tableRow(p2, label, value, shade, 145);
    if (p2.y < M + 30) {
      addPageFooter(p2);
      const np = newPage();
      p2.page = np.page; p2.y = np.y; p2.idx = np.idx;
    }
  }

  gap(p2, 10);
  if (p2.y < 90) {
    addPageFooter(p2);
    const np = newPage();
    p2.page = np.page; p2.y = np.y; p2.idx = np.idx;
  }

  sectionBanner(p2, "6.  DECLARATION");
  drawText(p2,
    "I confirm that the information provided in this document and the accompanying IIRSM Course " +
    "Approval application is accurate and complete to the best of my knowledge. The course content " +
    "aligns to the IIRSM Risk Management and Leadership Competence Framework at the Operational " +
    "(Associate) level as mapped above. I undertake to notify IIRSM of any material changes to " +
    "course content or organisational policies during the period of approval.",
    { size: 9 }
  );
  gap(p2, 16);
  p2.page.drawRectangle({ x: M, y: p2.y, width: 160, height: 0.75, color: DARK });
  gap(p2, 3);
  drawText(p2, "Signature", { size: 8, color: MID });
  gap(p2, 10);
  p2.page.drawRectangle({ x: M, y: p2.y, width: 160, height: 0.75, color: DARK });
  gap(p2, 3);
  drawText(p2, `Date: ${today}`, { size: 8, color: MID });

  addPageFooter(p2);

  // Apply footer to all pages
  for (const s of states) {
    if (s.page !== p1.page && s.page !== p2.page) {
      addPageFooter(s);
    }
  }

  const bytes = await doc.save();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, bytes);
  console.log(`✓ Written ${Math.round(bytes.length / 1024)} KB  →  ${OUT}`);
  console.log(`  Pages: ${states.length}`);
  console.log(`  Mapping rows: ${rows.length}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
