import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Brand ───────────────────────────────────────────────────────────────────
const ORANGE      = "#E27226";
const ORANGE_DARK = "#B85A18";
const ORANGE_PALE = "#FFF5EC";
const NEAR_BLACK  = "#1a1a1a";
const DARK_GREY   = "#2e2e2e";
const MID_GREY    = "#6b6b6b";
const LIGHT_GREY  = "#f7f7f7";
const RULE_GREY   = "#e0e0e0";
const WHITE       = "#ffffff";

const LOGO  = "/home/runner/workspace/artifacts/chainsaw-training/public/logo.png";
const IIRSM = "/home/runner/workspace/artifacts/chainsaw-training/public/iirsm-rosette-logo.png";
const OUT   = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Q23_Course_Materials_Pack.pdf";

// ─── Data ────────────────────────────────────────────────────────────────────
const examQs: Array<{
  id: number; question: string; options: string;
  correct_option: number; learning_outcome: string; assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/prod_exam_qs.json", "utf8"));

const mockQs: Array<{
  id: number; sort_order: number; question: string; keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/prod_mock_simple.json", "utf8"));

const OPTION_LABELS = ["A", "B", "C", "D"];

// ─── Document ─────────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 55, bottom: 60, left: 58, right: 58 },
  info: {
    Title:   "Course Materials Pack — Chainsaw Maintenance & Cross Cutting",
    Author:  "Chainsaw Courses Ltd",
    Subject: "IIRSM Course Approval — Q23 Training Materials",
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;
const PH = doc.page.height;
const ML = 58, MR = 58, MT = 55, MB = 60;
const CW = PW - ML - MR;

// ─── Page counter ─────────────────────────────────────────────────────────────
let pageNum = 0;
doc.on("pageAdded", () => { pageNum++; });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hRule(y?: number, colour = RULE_GREY, thickness = 0.5) {
  const yy = y ?? doc.y;
  doc.save().moveTo(ML, yy).lineTo(ML + CW, yy)
    .strokeColor(colour).lineWidth(thickness).stroke().restore();
}

function ensureSpace(needed: number) {
  if (doc.y + needed > PH - MB - 10) {
    addRunningFooter();
    doc.addPage();
  }
}

function addRunningFooter(sectionLabel = "") {
  const fy = PH - 38;
  // Orange rule
  doc.save().moveTo(ML, fy - 6).lineTo(ML + CW, fy - 6)
    .strokeColor(ORANGE).lineWidth(1).stroke().restore();
  doc.save()
    .font("Helvetica").fontSize(8).fillColor(MID_GREY)
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials Pack", ML, fy, { width: CW - 50, align: "left" })
    .text(`${pageNum}`, ML, fy, { width: CW, align: "right" })
    .restore();
  if (sectionLabel) {
    doc.save().font("Helvetica-Oblique").fontSize(7.5).fillColor(ORANGE)
      .text(sectionLabel, ML, fy - 14, { width: CW, align: "center" }).restore();
  }
}

function sectionBanner(num: string, title: string, subtitle = "") {
  // Dark band
  doc.rect(0, doc.y, PW, subtitle ? 54 : 44).fill(NEAR_BLACK);
  // Orange left stripe
  doc.rect(0, doc.y - (subtitle ? 54 : 44), 6, subtitle ? 54 : 44).fill(ORANGE);
  const bannerTop = doc.y - (subtitle ? 50 : 40);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(ORANGE)
    .text(`SECTION ${num}`, ML + 6, bannerTop, { width: CW });
  doc.font("Helvetica-Bold").fontSize(15).fillColor(WHITE)
    .text(title, ML + 6, bannerTop + 11, { width: CW });
  if (subtitle) {
    doc.font("Helvetica").fontSize(9).fillColor("#cccccc")
      .text(subtitle, ML + 6, bannerTop + 30, { width: CW });
  }
  doc.y += 16;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════════
pageNum = 1;

// Full dark background
doc.rect(0, 0, PW, PH).fill(NEAR_BLACK);

// Orange diagonal accent band across top-right
doc.save()
  .polygon([PW * 0.55, 0], [PW, 0], [PW, PH * 0.38], [PW * 0.3, 0])
  .fill(ORANGE_DARK)
  .opacity(0.18)
  .restore();

// Logo (top-left, on dark bg — logo has black background)
doc.image(LOGO, ML, 38, { width: 80 });

// Brand name
doc.font("Helvetica-Bold").fontSize(22).fillColor(ORANGE)
  .text("CHAINSAW COURSES", ML + 88, 52, { width: CW - 88 });
doc.font("Helvetica").fontSize(9).fillColor("#aaaaaa")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 88, 78, { width: CW - 88 });

// Orange rule
doc.save().moveTo(ML, 110).lineTo(ML + CW, 110)
  .strokeColor(ORANGE).lineWidth(1.5).stroke().restore();

// Course title block
doc.font("Helvetica-Bold").fontSize(28).fillColor(WHITE)
  .text("Course Materials Pack", ML, 128, { width: CW });
doc.font("Helvetica").fontSize(14).fillColor("#cccccc")
  .text("Chainsaw Maintenance & Cross Cutting", ML, 164, { width: CW });

// IIRSM credential badge (bottom of dark area)
doc.image(IIRSM, PW - 120, 150, { width: 62 });
doc.font("Helvetica").fontSize(7.5).fillColor("#aaaaaa")
  .text("IIRSM Course Approval\nSubmission — Q23", PW - 128, 217, { width: 76, align: "center" });

// Divider
doc.save().moveTo(ML, 215).lineTo(ML + CW, 215)
  .strokeColor(DARK_GREY).lineWidth(0.5).stroke().restore();

// Summary table — on dark background
const summaryRows = [
  ["Course Title",     "Chainsaw Maintenance & Cross Cutting (NPTC CS30/CS31 Aligned)"],
  ["Provider",         "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery Mode",    "Fully Online — E-Learning (self-paced)"],
  ["Learning Hours",   "4 hrs GLH  |  2 hrs Assessment  |  4 hrs Self-Study  |  10 hrs TQT"],
  ["CPD Value",        "5 CPD Points (IIRSM)"],
  ["Pass Threshold",   "80% — randomised 45-question summative examination"],
  ["Document Purpose", "Training presentation & delegate materials (Q23)"],
];

let sy = 232;
summaryRows.forEach(([label, value], i) => {
  if (i % 2 === 0) doc.rect(ML, sy - 2, CW, 18).fill("#252525");
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ORANGE)
    .text(label, ML + 8, sy, { width: 145, continued: false });
  doc.font("Helvetica").fontSize(8.5).fillColor("#dddddd")
    .text(value, ML + 160, sy - 11, { width: CW - 168 });
  sy += 18;
});

// Contents box
const contentsY = sy + 16;
doc.rect(ML, contentsY, CW, 132).fill("#222222");
doc.rect(ML, contentsY, 4, 132).fill(ORANGE);

doc.font("Helvetica-Bold").fontSize(11).fillColor(ORANGE)
  .text("CONTENTS", ML + 16, contentsY + 12, { width: CW - 20 });

const contents = [
  ["1", "How to Access the Live App & Admin Panel"],
  ["2", "A Note on the Training Manual"],
  ["3", "Assessment Bank — 156 Multiple-Choice Questions"],
  ["4", "Supplementary Oral & Practical Mock Questions (80)"],
];

contents.forEach(([num, title], i) => {
  const cy = contentsY + 38 + i * 22;
  doc.rect(ML + 16, cy - 2, 18, 16).fill(ORANGE);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NEAR_BLACK)
    .text(num, ML + 16, cy, { width: 18, align: "center" });
  doc.font("Helvetica").fontSize(9.5).fillColor(WHITE)
    .text(title, ML + 40, cy, { width: CW - 50 });
});

// Bottom bar
doc.rect(0, PH - 38, PW, 38).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(9).fillColor(WHITE)
  .text("IIRSM COURSE APPROVAL  ·  Q23 TRAINING MATERIALS SUBMISSION  ·  © 2026 CHAINSAW COURSES LTD",
    ML, PH - 25, { width: CW, align: "center" });

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — APP ACCESS
// ═══════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionBanner("1", "How to Access the Live App & Admin Panel",
  "Live platform access for IIRSM assessors — all content unlocked");

doc.font("Helvetica").fontSize(10).fillColor(MID_GREY)
  .text(
    "The course is delivered entirely online through a custom-built e-learning platform. IIRSM assessors are invited to review the live application — all video modules, interactive quizzes, AI-assisted mock questions, summative examination, and certificate generation are accessible via the routes below.",
    ML, doc.y, { width: CW }
  );
doc.y += 18;

// Admin access block
doc.rect(ML, doc.y, 4, 200).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(11).fillColor(NEAR_BLACK)
  .text("Admin / Assessor Access  —  Full Content Unlocked", ML + 14, doc.y, { width: CW - 14 });
doc.y += 14;

const adminSteps = [
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted. Once approved, the full admin dashboard appears.",
  "The dashboard displays multiple tabs: Feedback, Backup, Storage, Policy Documents, and more. Please explore freely.",
  "All Export buttons are secured — data goes directly to protected Google Drive storage.",
  "To view the app with all content unlocked, click 'APP PREVIEW' in the top-right corner of the dashboard.",
  "All video modules, features, certificates, and IIRSM-referenced content are fully accessible for review.",
];

adminSteps.forEach((step, i) => {
  ensureSpace(24);
  const bx = ML + 14, by = doc.y;
  doc.rect(bx, by, 20, 16).fill(ORANGE);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE).text(`${i + 1}`, bx, by - 14, { width: 20, align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor(NEAR_BLACK).text(step, bx + 28, by - 16, { width: CW - 46 });
  doc.y += 6;
});

doc.y += 18;
hRule();
doc.y += 14;

// New user block
doc.rect(ML, doc.y, 4, 170).fill(ORANGE_DARK);
doc.font("Helvetica-Bold").fontSize(11).fillColor(NEAR_BLACK)
  .text("New Learner Journey  —  Standard Access Route", ML + 14, doc.y, { width: CW - 14 });
doc.y += 14;
doc.font("Helvetica").fontSize(9.5).fillColor(MID_GREY)
  .text("To experience the app exactly as a learner would — waiver, sequential locking, quiz flow — use the route below. The app is under internal testing and has not been publicly released.", ML + 14, doc.y, { width: CW - 18 });
doc.y += 14;

const userSteps = [
  "Log out of the admin panel (or open an incognito browser window).",
  ["Go to  ", "app.chainsawcourses.com", "  and enter login code:  ", "CHAIN"],
  "Enter a name and email address of your choice.",
  "You will be directed to the Liability Waiver page — review and accept to enter the course.",
  "Each video module is locked until the previous has been watched fully and the quiz completed.",
  "On completion, a 45-question randomised examination unlocks. 80% pass triggers automatic certificate generation.",
];

userSteps.forEach((step, i) => {
  ensureSpace(24);
  const bx = ML + 14, by = doc.y;
  doc.rect(bx, by, 20, 16).fill(DARK_GREY);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE).text(`${i + 1}`, bx, by - 14, { width: 20, align: "center" });
  const text = Array.isArray(step) ? step.join("") : step;
  doc.font("Helvetica").fontSize(10).fillColor(NEAR_BLACK).text(text, bx + 28, by - 16, { width: CW - 46 });
  doc.y += 6;
});

addRunningFooter("Section 1 — App Access");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MANUAL NOTE
// ═══════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionBanner("2", "A Note on the Training Manual", "File size & access options");

doc.font("Helvetica").fontSize(10.5).fillColor(NEAR_BLACK)
  .text(
    "The accompanying training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource. It is a richly illustrated 138-page technical document covering all Learning Outcomes and Assessment Criteria.",
    ML, doc.y, { width: CW }
  );
doc.y += 18;

// Warning box
doc.rect(ML, doc.y, CW, 72).fill(ORANGE_PALE)
  .rect(ML, doc.y, 4, 72).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(10.5).fillColor(ORANGE_DARK)
  .text("File Size Notice", ML + 14, doc.y - 64, { width: CW - 18 });
doc.font("Helvetica").fontSize(10).fillColor(NEAR_BLACK)
  .text(
    "The manual PDF is approximately 71 MB due to high-resolution diagrams, photographs, and instructional figures. This exceeds most standard upload limits and cannot be attached directly to this IIRSM submission.",
    ML + 14, doc.y - 46, { width: CW - 20 }
  );
doc.y += 20;

doc.font("Helvetica-Bold").fontSize(12).fillColor(NEAR_BLACK).text("How to obtain the manual:", ML, doc.y);
doc.y += 14;

const options = [
  {
    label: "Option A — View within the App  (Recommended)",
    body: "The full manual is embedded and accessible within the course platform. After logging in via the Admin Access route described in Section 1, click 'APP PREVIEW' — the manual is available as a downloadable reference throughout the course. All supporting policy documents are also accessible via the Admin Dashboard.",
    colour: ORANGE,
  },
  {
    label: "Option B — WeTransfer / Secure File Share",
    body: "A copy of the manual can be provided on request via WeTransfer or a similar secure large-file transfer service. Please contact David Daniel at chainsawcourses.com — the file will be sent within one working day.",
    colour: ORANGE_DARK,
  },
];

options.forEach(({ label, body, colour }) => {
  ensureSpace(80);
  const bh = 72;
  doc.rect(ML, doc.y, CW, bh).fill(LIGHT_GREY)
    .rect(ML, doc.y, 4, bh).fill(colour);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(NEAR_BLACK)
    .text(label, ML + 14, doc.y - bh + 8, { width: CW - 20 });
  doc.font("Helvetica").fontSize(9.5).fillColor(MID_GREY)
    .text(body, ML + 14, doc.y - bh + 26, { width: CW - 20 });
  doc.y += 14;
});

addRunningFooter("Section 2 — Training Manual");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ASSESSMENT BANK
// ═══════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionBanner("3", "Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  ·  Summative Examination Pool`);

// Intro
doc.rect(ML, doc.y, CW, 50).fill(ORANGE_PALE).rect(ML, doc.y, 4, 50).fill(ORANGE);
doc.font("Helvetica").fontSize(9.5).fillColor(NEAR_BLACK)
  .text(
    `The summative examination draws a randomised 45 questions from the ${examQs.length}-question bank below. All questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must achieve 80% or above to pass and generate their IIRSM certificate. Correct answers are marked in orange.`,
    ML + 14, doc.y - 42, { width: CW - 20 }
  );
doc.y += 18;
hRule(); doc.y += 10;

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);
  // rough height estimate
  const qLines = Math.ceil(q.question.length / 85);
  const optLines = options.reduce((acc, o) => acc + Math.ceil(o.length / 90), 0);
  const blockH = qLines * 14 + optLines * 13 + 42;
  ensureSpace(blockH);

  // Row background alternating
  const rowBg = i % 2 === 0 ? "#fafafa" : WHITE;
  doc.rect(ML, doc.y, CW, blockH - 6).fill(rowBg);

  // Orange number badge
  doc.rect(ML, doc.y, 32, 18).fill(ORANGE);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE)
    .text(`Q${i + 1}`, ML, doc.y - 14, { width: 32, align: "center" });

  // LO/AC tag (right-aligned)
  doc.font("Helvetica").fontSize(7.5).fillColor(MID_GREY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`, ML + 34, doc.y - 14, { width: CW - 34, align: "right" });

  doc.y += 5;

  // Question
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NEAR_BLACK)
    .text(q.question, ML + 8, doc.y, { width: CW - 12 });
  doc.y += 5;

  // Options
  options.forEach((opt, oi) => {
    const isCorrect = oi === q.correct_option;
    if (isCorrect) {
      doc.rect(ML + 8, doc.y - 1, CW - 10, 14).fill("#FFF0E6");
    }
    doc.font(isCorrect ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(isCorrect ? ORANGE : MID_GREY)
      .text(
        `${OPTION_LABELS[oi]}.  ${opt}${isCorrect ? "  ✓" : ""}`,
        ML + 14, doc.y, { width: CW - 20 }
      );
    doc.y += 2;
  });

  doc.y += 8;
  hRule(doc.y, RULE_GREY, 0.4);
  doc.y += 6;
});

addRunningFooter("Section 3 — Assessment Bank");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MOCK QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionBanner("4", "Supplementary Oral & Practical Mock Questions",
  `${mockQs.length} Questions  ·  Formative Practice Only — Not Formally Assessed`);

// Important notice
doc.rect(ML, doc.y, CW, 72).fill(ORANGE_PALE).rect(ML, doc.y, 4, 72).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(10.5).fillColor(ORANGE_DARK)
  .text("Important — Supplementary Resource Only", ML + 14, doc.y - 64, { width: CW - 20 });
doc.font("Helvetica").fontSize(9.5).fillColor(NEAR_BLACK)
  .text(
    `The ${mockQs.length} questions in this section are supplementary oral and practical preparation questions. They do NOT form part of the assessed examination, do NOT contribute to the pass/fail outcome, and do NOT appear on the certificate. They are provided as formative study aids within the app's AI-assisted practice feature.`,
    ML + 14, doc.y - 46, { width: CW - 20 }
  );
doc.y += 20;
hRule(); doc.y += 10;

mockQs.forEach((q, i) => {
  const hasKP = q.keyPoints && q.keyPoints.length > 0;
  const kpLines = hasKP ? q.keyPoints.reduce((acc, kp) => acc + Math.ceil(kp.length / 90), 0) : 0;
  const qLines = Math.ceil(q.question.length / 85);
  const blockH = qLines * 14 + kpLines * 13 + (hasKP ? 36 : 26);
  ensureSpace(blockH);

  const rowBg = i % 2 === 0 ? "#fafafa" : WHITE;
  doc.rect(ML, doc.y, CW, blockH - 4).fill(rowBg);

  // Dark number badge
  doc.rect(ML, doc.y, 32, 18).fill(DARK_GREY);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ORANGE)
    .text(`M${i + 1}`, ML, doc.y - 14, { width: 32, align: "center" });
  doc.font("Helvetica").fontSize(7.5).fillColor(MID_GREY)
    .text("Oral / Practical  ·  Formative Only", ML + 34, doc.y - 14, { width: CW - 34, align: "right" });

  doc.y += 5;

  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NEAR_BLACK)
    .text(q.question, ML + 8, doc.y, { width: CW - 12 });
  doc.y += 5;

  if (hasKP) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(ORANGE)
      .text("Key points a good answer should include:", ML + 14, doc.y, { width: CW - 18 });
    doc.y += 4;
    q.keyPoints.forEach(kp => {
      doc.font("Helvetica").fontSize(8.5).fillColor(MID_GREY)
        .text(`•  ${kp}`, ML + 20, doc.y, { width: CW - 26 });
      doc.y += 2;
    });
  }

  doc.y += 8;
  hRule(doc.y, RULE_GREY, 0.4);
  doc.y += 6;
});

// End block
ensureSpace(55);
doc.y += 10;
doc.rect(ML, doc.y, CW, 44).fill(NEAR_BLACK);
doc.rect(ML, doc.y, 4, 44).fill(ORANGE);
doc.font("Helvetica-Bold").fontSize(11).fillColor(WHITE)
  .text("End of Course Materials Pack", ML, doc.y - 36, { width: CW, align: "center" });
doc.font("Helvetica").fontSize(9).fillColor("#aaaaaa")
  .text(
    "For the full training manual and policy documents, see Sections 1–2 or contact David Daniel at chainsawcourses.com",
    ML + 14, doc.y - 20, { width: CW - 20, align: "center" }
  );
doc.y += 12;

addRunningFooter("Section 4 — Mock Questions");

// ─── Finish ───────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const size = fs.statSync(OUT).size;
  console.log("✅  PDF written to:", OUT);
  console.log("Size:", Math.round(size / 1024), "KB");
});
