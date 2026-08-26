/**
 * Q23 Course Materials Pack — clean, light, branded PDF
 * Target: ~28 pages, no blank pages, tight spacing
 */
import PDFDocument from "pdfkit";
import * as fs from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Brand ────────────────────────────────────────────────────────────────────
const OG   = "#E27226";   // chainsaw orange
const OG_D = "#B85A18";   // dark orange
const OG_L = "#FEF3E8";   // pale orange tint
const BLK  = "#1a1a1a";   // near-black
const DGY  = "#444444";   // body text
const MGY  = "#777777";   // secondary text
const LGY  = "#f4f4f4";   // row alt bg
const RUL  = "#e0e0e0";   // rule colour
const WHT  = "#ffffff";

const LOGO  = "/home/runner/workspace/artifacts/chainsaw-training/public/logo.png";
const IIRSM = "/home/runner/workspace/artifacts/chainsaw-training/public/iirsm-rosette-logo.png";
const OUT   = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Q23_Course_Materials_Pack.pdf";

// ─── Data ─────────────────────────────────────────────────────────────────────
const examQs: Array<{
  id: number; question: string; options: string;
  correct_option: number; learning_outcome: string; assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/prod_exam_qs.json", "utf8"));

const mockQs: Array<{
  id: number; sort_order: number; question: string; keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/prod_mock_simple.json", "utf8"));

const OPTS = ["A", "B", "C", "D"];

// ─── Doc setup ───────────────────────────────────────────────────────────────
const ML = 52, MR = 52, MT = 50, MB = 52;
const doc = new PDFDocument({
  size: "A4",
  margins: { top: MT, bottom: MB, left: ML, right: MR },
  info: {
    Title: "Course Materials Pack — Chainsaw Maintenance & Cross Cutting",
    Author: "Chainsaw Courses Ltd",
    Subject: "IIRSM Course Approval — Q23",
  },
});
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;   // 595
const PH = doc.page.height;  // 842
const CW = PW - ML - MR;     // 491

let pageNum = 0;
doc.on("pageAdded", () => { pageNum++; });

// ─── Low-level helpers ────────────────────────────────────────────────────────

/** Draw horizontal rule at y (defaults to doc.y). Does NOT move doc.y. */
function rule(y?: number, col = RUL, w = 0.5) {
  const yy = y ?? doc.y;
  doc.save().moveTo(ML, yy).lineTo(ML + CW, yy)
    .strokeColor(col).lineWidth(w).stroke().restore();
}

/** Advance doc.y by n points. */
function gap(n: number) { doc.y += n; }

/** Clamp: add a new page if fewer than `need` pts remain. */
function need(pts: number) {
  if (doc.y + pts > PH - MB - 4) {
    footer();
    doc.addPage();
  }
}

/** Running footer. Call before every addPage. */
function footer() {
  const fy = PH - MB + 6;
  doc.save()
    .moveTo(ML, fy - 4).lineTo(ML + CW, fy - 4)
    .strokeColor(OG).lineWidth(0.8).stroke()
    .font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials Pack", ML, fy, {
      width: CW - 40, align: "left",
    })
    .text(String(pageNum), ML, fy, { width: CW, align: "right" })
    .restore();
}

// ─── Section heading (inline — no page break) ─────────────────────────────────
function sectionHead(num: string, title: string, sub = "") {
  const h = sub ? 46 : 36;
  need(h + 20);
  const y0 = doc.y;
  // Orange left stripe
  doc.rect(ML, y0, 4, h).fill(OG);
  // Light orange background
  doc.rect(ML + 4, y0, CW - 4, h).fill(OG_L);
  // Section label
  doc.save()
    .font("Helvetica-Bold").fontSize(7).fillColor(OG)
    .text(`SECTION ${num}`, ML + 12, y0 + 6, { lineBreak: false })
    .restore();
  // Title
  doc.save()
    .font("Helvetica-Bold").fontSize(13).fillColor(BLK)
    .text(title, ML + 12, y0 + 17, { width: CW - 90, lineBreak: false })
    .restore();
  if (sub) {
    doc.save()
      .font("Helvetica").fontSize(8).fillColor(MGY)
      .text(sub, ML + 12, y0 + 33, { width: CW - 80, lineBreak: false })
      .restore();
  }
  doc.y = y0 + h + 10;
}

// ─── Info / warning box ───────────────────────────────────────────────────────
function infoBox(heading: string, body: string, accent = OG, h = 0) {
  // Estimate height if not given
  if (!h) {
    const bodyLines = Math.ceil(body.length / 88) + 1;
    h = 28 + bodyLines * 13;
  }
  need(h + 8);
  const y0 = doc.y;
  doc.rect(ML, y0, 4, h).fill(accent);
  doc.rect(ML + 4, y0, CW - 4, h).fill(OG_L);
  doc.save()
    .font("Helvetica-Bold").fontSize(9.5).fillColor(OG_D)
    .text(heading, ML + 12, y0 + 7, { width: CW - 20, lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y0 + 21, { width: CW - 20 })
    .restore();
  doc.y = y0 + h + 8;
}

// ─── Numbered step ────────────────────────────────────────────────────────────
function step(n: number, text: string, badgeCol = OG, textCol = BLK) {
  need(22);
  const y0 = doc.y;
  // Badge
  doc.rect(ML, y0, 22, 16).fill(badgeCol);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(String(n), ML, y0 + 4, { width: 22, align: "center", lineBreak: false })
    .restore();
  // Text — may wrap
  const before = doc.y;
  doc.save()
    .font("Helvetica").fontSize(9.5).fillColor(textCol)
    .text(text, ML + 28, y0 + 3, { width: CW - 30 })
    .restore();
  const textH = Math.max(doc.y - before, 16);
  doc.y = y0 + textH + 6;
}

// ─── Option block ─────────────────────────────────────────────────────────────
function optionBlock(label: string, text: string, correct: boolean) {
  const prefix = `${label}.  `;
  const fullText = prefix + text + (correct ? "  ✓" : "");
  const lines = Math.ceil((fullText.length) / 90) + 1;
  const h = lines * 12 + 2;
  need(h);
  const y0 = doc.y;
  if (correct) {
    doc.rect(ML + 8, y0 - 1, CW - 10, h).fill(OG_L);
  }
  doc.save()
    .font(correct ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9)
    .fillColor(correct ? OG : MGY)
    .text(fullText, ML + 14, y0 + 1, { width: CW - 20 })
    .restore();
  doc.y = y0 + h;
}

// ════════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ════════════════════════════════════════════════════════════════════════════════
pageNum = 1;

// Top orange header band
doc.rect(0, 0, PW, 110).fill(OG);

// Logo on orange
doc.image(LOGO, ML, 12, { width: 72 });

// Wordmark
doc.save()
  .font("Helvetica-Bold").fontSize(24).fillColor(WHT)
  .text("CHAINSAW COURSES", ML + 80, 24, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(9).fillColor("#ffe0c0")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 80, 54, { lineBreak: false })
  .restore();

// IIRSM badge on orange (top right)
doc.image(IIRSM, PW - 86, 12, { width: 56 });
doc.save()
  .font("Helvetica").fontSize(7).fillColor("#ffe0c0")
  .text("IIRSM Course Approval", PW - 94, 72, { width: 72, align: "center", lineBreak: false })
  .restore();

// Title block below orange band
doc.y = 126;
doc.save()
  .font("Helvetica-Bold").fontSize(22).fillColor(BLK)
  .text("Course Materials Pack", ML, 126, { width: CW })
  .restore();
doc.save()
  .font("Helvetica").fontSize(12).fillColor(DGY)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 155, { width: CW })
  .restore();
doc.save()
  .font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Submitted in support of IIRSM Course Approval — Question 23", ML, 174, { width: CW })
  .restore();

doc.y = 198;
rule(198, OG, 1.5);
doc.y = 210;

// Course summary table
const summaryRows = [
  ["Course",        "Chainsaw Maintenance & Cross Cutting (NPTC CS30/CS31 Aligned)"],
  ["Provider",      "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery",      "Fully Online — E-Learning (self-paced)"],
  ["Hours",         "4 hrs GLH  ·  2 hrs Assessment  ·  4 hrs Self-Study  ·  10 hrs TQT"],
  ["CPD",           "5 CPD Points (IIRSM)"],
  ["Threshold",     "80% pass — randomised 45-question summative examination"],
  ["Document",      "Training presentation & delegate materials (Q23)"],
];

summaryRows.forEach(([label, value], i) => {
  const y0 = doc.y;
  if (i % 2 === 1) doc.rect(ML, y0, CW, 17).fill(LGY);
  doc.save()
    .font("Helvetica-Bold").fontSize(9).fillColor(OG_D)
    .text(label, ML + 6, y0 + 4, { width: 75, lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9).fillColor(DGY)
    .text(value, ML + 86, y0 + 4, { width: CW - 90, lineBreak: false })
    .restore();
  doc.y = y0 + 17;
});

doc.y += 14;
rule(doc.y, RUL);
doc.y += 12;

// Contents
doc.save()
  .font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("Contents", ML, doc.y)
  .restore();
doc.y += 10;

const contents = [
  ["1", "How to Access the Live App & Admin Panel"],
  ["2", "A Note on the Training Manual"],
  ["3", `Assessment Bank — ${examQs.length} Multiple-Choice Questions`],
  ["4", `Supplementary Oral & Practical Mock Questions (${mockQs.length})`],
];
contents.forEach(([num, title]) => {
  const y0 = doc.y;
  doc.rect(ML, y0, 20, 16).fill(OG);
  doc.save()
    .font("Helvetica-Bold").fontSize(8.5).fillColor(WHT)
    .text(num, ML, y0 + 4, { width: 20, align: "center", lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(title, ML + 26, y0 + 4, { width: CW - 30, lineBreak: false })
    .restore();
  doc.y = y0 + 20;
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — APP ACCESS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("1", "How to Access the Live App & Admin Panel",
  "Live platform access for IIRSM assessors — all content unlocked");

doc.save()
  .font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text(
    "The course is delivered through a custom-built e-learning platform. IIRSM assessors are invited to review the live application in full — all video modules, quizzes, AI-assisted mock practice, examination, and certificate generation are accessible via the two routes below.",
    ML, doc.y, { width: CW }
  )
  .restore();
gap(12);

// Admin access
doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK).text("Admin / Assessor Access — All Content Unlocked", ML, doc.y).restore();
gap(8);
[
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted. Once approved the full dashboard appears.",
  "The dashboard has multiple tabs: Feedback, Backup, Storage, Policy Documents and more.",
  "All Export buttons send data directly to protected Google Drive storage.",
  "Click 'APP PREVIEW' in the top-right corner to enter the app with all content unlocked.",
  "All videos, features, certificates, and IIRSM-referenced content are available for review.",
].forEach((s, i) => step(i + 1, s));

gap(10);
rule(doc.y, RUL);
gap(12);

// Learner access
doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK).text("New Learner Journey — Standard Access Route", ML, doc.y).restore();
gap(6);
doc.save().font("Helvetica").fontSize(9).fillColor(MGY)
  .text("To experience the app as a learner — waiver, sequential module locking, quiz flow — use the steps below. The app is currently under internal testing and has not been publicly released.", ML, doc.y, { width: CW })
  .restore();
gap(10);
[
  "Log out of the admin panel (or open an incognito browser window).",
  "Go to  app.chainsawcourses.com  — enter login code:  CHAIN",
  "Enter a name and email address of your choice.",
  "You will be directed to the Liability Waiver page — accept to enter the course.",
  "Each video module is locked until the previous is watched fully and the quiz completed.",
  "On completion, the 45-question exam unlocks. An 80% pass auto-generates the IIRSM certificate.",
].forEach((s, i) => step(i + 1, s, BLK));

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MANUAL NOTE
// ════════════════════════════════════════════════════════════════════════════════
need(120);
gap(14);
rule(doc.y, RUL);
gap(12);

sectionHead("2", "A Note on the Training Manual", "File size & access options");

doc.save().font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text(
    "The accompanying training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource. It is a richly illustrated 138-page document covering all Learning Outcomes and Assessment Criteria in full, including the Advanced Workshop Extension modules.",
    ML, doc.y, { width: CW }
  ).restore();
gap(12);

infoBox(
  "File Size Notice",
  "The manual PDF is approximately 71 MB due to high-resolution diagrams, photographs, and instructional figures. This exceeds most standard upload limits and cannot be attached directly to this submission.",
  OG, 62
);

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK).text("How to obtain the manual:", ML, doc.y).restore();
gap(10);

[
  {
    label: "Option A — View within the App  (Recommended)",
    body: "The full manual is embedded within the course platform. After logging in via the Admin Access route (Section 1), click APP PREVIEW. The manual is available as a downloadable reference throughout the course. All supporting policy documents are also accessible via the Admin Dashboard.",
  },
  {
    label: "Option B — WeTransfer / Secure File Share",
    body: "A copy can be provided on request via WeTransfer or a similar large-file service. Contact David Daniel at chainsawcourses.com — the file will be sent within one working day.",
  },
].forEach(({ label, body }) => {
  const lines = Math.ceil(body.length / 88) + 1;
  const h = 26 + lines * 13;
  need(h + 8);
  const y0 = doc.y;
  doc.rect(ML, y0, 4, h).fill(OG);
  doc.rect(ML + 4, y0, CW - 4, h).fill(LGY);
  doc.save().font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(label, ML + 12, y0 + 7, { width: CW - 20, lineBreak: false }).restore();
  doc.save().font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y0 + 21, { width: CW - 20 }).restore();
  doc.y = y0 + h + 8;
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ASSESSMENT BANK
// ════════════════════════════════════════════════════════════════════════════════
need(80);
gap(14);
rule(doc.y, RUL);
gap(12);

sectionHead("3", "Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  ·  Summative Examination Pool`);

infoBox(
  "How the exam works",
  `The summative examination draws a randomised 45 questions from this ${examQs.length}-question bank. All questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must achieve 80% or above to pass and generate their IIRSM certificate. Correct answers are highlighted in orange below.`,
  OG, 66
);

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);

  // Estimate block height to avoid page orphans
  const qLines = Math.ceil(q.question.length / 78) + 1;
  const optLines = options.reduce((s, o, oi) => {
    const full = `${OPTS[oi]}.  ${o}${oi === q.correct_option ? "  ✓" : ""}`;
    return s + Math.ceil(full.length / 85) + 1;
  }, 0);
  const blockH = qLines * 13 + optLines * 12 + 28;
  need(blockH);

  const y0 = doc.y;
  // Alternate row bg
  if (i % 2 === 0) doc.rect(ML, y0, CW, blockH).fill(LGY);

  // Badge
  doc.rect(ML, y0, 30, 16).fill(OG);
  doc.save().font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(`Q${i + 1}`, ML, y0 + 4, { width: 30, align: "center", lineBreak: false }).restore();

  // AC tag (right)
  doc.save().font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`, ML + 32, y0 + 5, { width: CW - 34, align: "right", lineBreak: false }).restore();

  // Question
  doc.save().font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, y0 + 20, { width: CW - 10 }).restore();

  // Move past question text
  doc.y = y0 + 20 + qLines * 13;

  // Options
  options.forEach((opt, oi) => {
    const correct = oi === q.correct_option;
    const fullText = `${OPTS[oi]}.  ${opt}${correct ? "  ✓" : ""}`;
    const oLines = Math.ceil(fullText.length / 85) + 1;
    const oH = oLines * 12;
    const oy = doc.y;
    if (correct) doc.rect(ML + 6, oy - 1, CW - 8, oH).fill(OG_L);
    doc.save()
      .font(correct ? "Helvetica-Bold" : "Helvetica").fontSize(9)
      .fillColor(correct ? OG : MGY)
      .text(fullText, ML + 14, oy + 1, { width: CW - 20 })
      .restore();
    doc.y = oy + oH;
  });

  doc.y += 6;
  rule(doc.y, RUL, 0.4);
  doc.y += 4;
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MOCK QUESTIONS
// ════════════════════════════════════════════════════════════════════════════════
need(80);
gap(14);
rule(doc.y, RUL);
gap(12);

sectionHead("4", "Supplementary Oral & Practical Mock Questions",
  `${mockQs.length} Questions  ·  Formative Practice Only — Not Formally Assessed`);

infoBox(
  "Important — These questions do not contribute to the pass/fail outcome",
  `The ${mockQs.length} questions below are supplementary oral and practical preparation aids. They do NOT form part of the summative examination, do NOT appear on the certificate, and are NOT formally assessed. Within the app, learners can practise these using an AI-assisted voice or text response feature that provides formative feedback.`,
  OG, 72
);

mockQs.forEach((q, i) => {
  const hasKP = q.keyPoints.length > 0;
  const qLines = Math.ceil(q.question.length / 78) + 1;
  const kpLines = hasKP ? q.keyPoints.reduce((s, kp) => s + Math.ceil(kp.length / 80) + 1, 0) + 1 : 0;
  const blockH = qLines * 13 + kpLines * 12 + 24;
  need(blockH);

  const y0 = doc.y;
  if (i % 2 === 0) doc.rect(ML, y0, CW, blockH).fill(LGY);

  // Badge
  doc.rect(ML, y0, 30, 16).fill(BLK);
  doc.save().font("Helvetica-Bold").fontSize(8).fillColor(OG)
    .text(`M${i + 1}`, ML, y0 + 4, { width: 30, align: "center", lineBreak: false }).restore();

  // Label (right)
  doc.save().font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Oral / Practical  ·  Formative Only", ML + 32, y0 + 5, { width: CW - 34, align: "right", lineBreak: false }).restore();

  // Question
  doc.save().font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, y0 + 20, { width: CW - 10 }).restore();

  doc.y = y0 + 20 + qLines * 13;

  if (hasKP) {
    doc.save().font("Helvetica-Oblique").fontSize(8).fillColor(OG)
      .text("Key points:", ML + 14, doc.y, { lineBreak: false }).restore();
    doc.y += 12;
    q.keyPoints.forEach(kp => {
      const kLines = Math.ceil(kp.length / 80) + 1;
      doc.save().font("Helvetica").fontSize(8.5).fillColor(DGY)
        .text(`•  ${kp}`, ML + 18, doc.y, { width: CW - 24 }).restore();
      doc.y += kLines * 11;
    });
  }

  doc.y += 5;
  rule(doc.y, RUL, 0.4);
  doc.y += 4;
});

// End note
need(40);
gap(10);
doc.rect(ML, doc.y, CW, 32).fill(OG);
doc.save().font("Helvetica-Bold").fontSize(10).fillColor(WHT)
  .text(
    "End of Course Materials Pack  ·  chainsawcourses.com  ·  © 2026 Chainsaw Courses Ltd",
    ML, doc.y + 11, { width: CW, align: "center", lineBreak: false }
  ).restore();
doc.y += 42;

footer();

// ─── Finalise ─────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`✅  Done — ${kb} KB`);
});
