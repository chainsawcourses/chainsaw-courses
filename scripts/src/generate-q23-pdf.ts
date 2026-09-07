import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Data ────────────────────────────────────────────────────────────────────

const examQs: Array<{
  id: number;
  question: string;
  options: string;
  correct_option: number;
  learning_outcome: string;
  assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/exam_qs.json", "utf8"));

const mockQs: Array<{
  id: number;
  sort_order: number;
  question: string;
  keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/mock_simple.json", "utf8"));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BRAND_GREEN = "#2d6a2d";
const BRAND_DARK  = "#1a1a1a";
const MID_GREY    = "#555555";
const LIGHT_GREY  = "#f5f5f5";
const RULE_GREY   = "#cccccc";
const OPTION_LABELS = ["A", "B", "C", "D"];

const OUT = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Q23_Course_Materials_Pack.pdf";

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 55, bottom: 55, left: 60, right: 60 },
  info: {
    Title: "Course Materials Pack — Chainsaw Maintenance & Cross Cutting",
    Author: "Chainsaw Courses Ltd",
    Subject: "IIRSM Course Approval — Q23 Training Materials",
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;
const ML = doc.options.margins!.left as number;
const MR = doc.options.margins!.right as number;
const CONTENT_W = PW - ML - MR;

// ─── Page numbering ───────────────────────────────────────────────────────────
let pageNum = 0;
doc.on("pageAdded", () => {
  pageNum++;
});

function addFooter(label?: string) {
  const y = doc.page.height - 38;
  doc
    .save()
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MID_GREY)
    .text(
      "Chainsaw Maintenance & Cross Cutting — Course Materials Pack",
      ML,
      y,
      { width: CONTENT_W - 60, align: "left" }
    )
    .text(`${pageNum}`, ML, y, { width: CONTENT_W, align: "right" })
    .restore();
  if (label) {
    doc
      .save()
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(BRAND_GREEN)
      .text(label, ML, y - 12, { width: CONTENT_W, align: "center" })
      .restore();
  }
}

function hRule(yPos?: number) {
  const y = yPos ?? doc.y;
  doc
    .save()
    .moveTo(ML, y)
    .lineTo(ML + CONTENT_W, y)
    .strokeColor(RULE_GREY)
    .lineWidth(0.5)
    .stroke()
    .restore();
}

function ensureSpace(needed: number) {
  if (doc.y + needed > doc.page.height - 70) {
    addFooter();
    doc.addPage();
  }
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────
pageNum = 1;

// Green header band
doc
  .rect(0, 0, PW, 180)
  .fill(BRAND_GREEN);

doc
  .font("Helvetica-Bold")
  .fontSize(26)
  .fillColor("#ffffff")
  .text("Course Materials Pack", ML, 40, { width: CONTENT_W, align: "center" })
  .fontSize(18)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 82, { width: CONTENT_W, align: "center" })
  .fontSize(11)
  .font("Helvetica")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML, 116, { width: CONTENT_W, align: "center" })
  .fillColor("#d4edda")
  .text("Submitted in support of IIRSM Course Approval — Question 23", ML, 140, { width: CONTENT_W, align: "center" });

doc.y = 210;

// Summary table
const rows = [
  ["Course Title", "Chainsaw Maintenance & Cross Cutting (NPTC CS30/CS31 Aligned)"],
  ["Provider", "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery Mode", "Fully Online — E-Learning (self-paced)"],
  ["Guided Learning Hours", "4 hrs  |  Directed Assessment: 2 hrs  |  Self-Study: 4 hrs  |  TQT: 10 hrs"],
  ["CPD Value", "5 CPD Points (IIRSM)"],
  ["Qualification", "Verifiable Digital Certificate of Completion"],
  ["Pass Threshold", "80% on 45-question randomised summative examination"],
  ["Document Purpose", "Training presentation & delegate materials (Q23)"],
];

rows.forEach(([label, value]) => {
  ensureSpace(26);
  doc
    .font("Helvetica-Bold").fontSize(9).fillColor(BRAND_DARK)
    .text(label + ":", ML, doc.y, { width: 180, continued: false });
  const prevY = doc.y;
  doc
    .font("Helvetica").fontSize(9).fillColor(MID_GREY)
    .text(value, ML + 190, prevY - 11, { width: CONTENT_W - 190 });
  hRule(doc.y + 3);
  doc.y += 9;
});

doc.y += 20;

// Contents list
doc
  .font("Helvetica-Bold").fontSize(12).fillColor(BRAND_GREEN)
  .text("Contents", ML, doc.y);
doc.y += 8;
hRule();
doc.y += 10;

const contents = [
  ["1", "How to Access the Live App & Admin Panel", "…… 2"],
  ["2", "A Note on the Training Manual", "…… 3"],
  ["3", "Assessment Bank — 151 Multiple-Choice Questions", "…… 4"],
  ["4", "Supplementary Oral & Practical Mock Questions (79)", "…… 28"],
];

contents.forEach(([num, title, pg]) => {
  ensureSpace(20);
  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK)
    .text(`${num}.  ${title}`, ML + 10, doc.y, { width: CONTENT_W - 80, continued: false });
  const prevY = doc.y;
  doc
    .font("Helvetica").fontSize(10).fillColor(MID_GREY)
    .text(pg, ML, prevY - 12, { width: CONTENT_W, align: "right" });
  doc.y += 6;
});

addFooter();

// ─── SECTION 1: APP ACCESS ────────────────────────────────────────────────────
doc.addPage();

doc
  .rect(ML, doc.y, CONTENT_W, 36)
  .fill(BRAND_GREEN);
doc
  .font("Helvetica-Bold").fontSize(16).fillColor("#ffffff")
  .text("1.  How to Access the Live App & Admin Panel", ML + 12, doc.y - 27, { width: CONTENT_W - 24 });
doc.y += 18;

doc
  .font("Helvetica").fontSize(10).fillColor(MID_GREY)
  .text(
    "The course is delivered entirely online through a custom-built e-learning platform. IIRSM assessors are invited to review the live application in full — all videos, interactive quizzes, AI-assisted mock questions, exam, and certificate generation are unlocked via the routes below.",
    ML, doc.y, { width: CONTENT_W }
  );
doc.y += 18;

// Admin Panel
hRule();
doc.y += 12;
doc
  .font("Helvetica-Bold").fontSize(12).fillColor(BRAND_DARK)
  .text("Admin / Assessor Access (Unlocked)", ML, doc.y);
doc.y += 10;

const adminSteps = [
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted. Once approved, the admin dashboard will appear.",
  "The dashboard displays multiple tabs: Feedback, Backup, Storage, Policy Documents, and more. Please explore freely.",
  "All Export buttons are secured — data is sent directly to protected Google Drive storage and does not leave the secure environment.",
  "To view the working app in its entirety with all content unlocked, click 'APP PREVIEW' in the top-right corner of the dashboard.",
  "This will direct you into the app where all video modules and features are fully unlocked for assessor review.",
  "All certificates and IIRSM-referenced content are generated within the app and can be reviewed in full.",
];

adminSteps.forEach((step, i) => {
  ensureSpace(22);
  doc
    .rect(ML, doc.y, 20, 16).fill(BRAND_GREEN);
  doc
    .font("Helvetica-Bold").fontSize(9).fillColor("#fff")
    .text(`${i + 1}`, ML + 6, doc.y - 14);
  doc
    .font("Helvetica").fontSize(10).fillColor(BRAND_DARK)
    .text(step, ML + 28, doc.y - 18, { width: CONTENT_W - 28 });
  doc.y += 8;
});

doc.y += 16;
hRule();
doc.y += 12;

doc
  .font("Helvetica-Bold").fontSize(12).fillColor(BRAND_DARK)
  .text("New User / Learner Journey (Standard Access)", ML, doc.y);
doc.y += 10;
doc
  .font("Helvetica").fontSize(10).fillColor(MID_GREY)
  .text(
    "To experience the app as a learner would — including the waiver, login, sequential video locking, and quiz flow — follow the steps below. The app is currently under internal testing and has not been released to the public.",
    ML, doc.y, { width: CONTENT_W }
  );
doc.y += 14;

const userSteps = [
  "Log out of the admin panel (or open an incognito / private browser window).",
  "Go to  app.chainsawcourses.com",
  "Enter login code:  CHAIN  — then enter a name and email address of your choice.",
  "You will be directed to the Liability Waiver page. Review and accept to proceed into the course.",
  "From there you will enter the app. Each video module is locked until the previous video has been watched in full and the associated quiz completed.",
  "Progress through the modules at your own pace. On completion, a 45-question randomised exam is available.",
  "An 80% pass triggers automatic generation of a verifiable, IIRSM-referenced certificate of completion.",
];

userSteps.forEach((step, i) => {
  ensureSpace(22);
  doc
    .rect(ML, doc.y, 20, 16).fill("#5a9e5a");
  doc
    .font("Helvetica-Bold").fontSize(9).fillColor("#fff")
    .text(`${i + 1}`, ML + 6, doc.y - 14);
  doc
    .font("Helvetica").fontSize(10).fillColor(BRAND_DARK)
    .text(step, ML + 28, doc.y - 18, { width: CONTENT_W - 28 });
  doc.y += 8;
});

addFooter("Section 1 — App Access");

// ─── SECTION 2: MANUAL NOTE ───────────────────────────────────────────────────
doc.addPage();

doc
  .rect(ML, doc.y, CONTENT_W, 36)
  .fill(BRAND_GREEN);
doc
  .font("Helvetica-Bold").fontSize(16).fillColor("#ffffff")
  .text("2.  A Note on the Training Manual", ML + 12, doc.y - 27, { width: CONTENT_W - 24 });
doc.y += 20;

doc
  .font("Helvetica").fontSize(11).fillColor(BRAND_DARK)
  .text(
    "The accompanying training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource for this course. It is a richly illustrated, 135-page technical document that covers all Learning Outcomes and Assessment Criteria in full, including the Advanced Workshop Extension modules.",
    ML, doc.y, { width: CONTENT_W }
  );
doc.y += 18;

// Large file notice box
doc
  .rect(ML, doc.y, CONTENT_W, 70)
  .fill("#fff8e1")
  .strokeColor("#f0c040")
  .lineWidth(1)
  .stroke();
doc
  .font("Helvetica-Bold").fontSize(11).fillColor("#7a5f00")
  .text("⚠  File Size Notice", ML + 12, doc.y - 62, { width: CONTENT_W - 24 });
doc
  .font("Helvetica").fontSize(10).fillColor("#5a4400")
  .text(
    "The manual PDF is approximately 71 MB due to the volume of high-resolution diagrams, photographs, and instructional figures it contains. This exceeds most standard upload limits and therefore cannot be attached directly to this submission.",
    ML + 12, doc.y - 44, { width: CONTENT_W - 24 }
  );
doc.y += 18;

doc.y += 10;

doc
  .font("Helvetica-Bold").fontSize(12).fillColor(BRAND_DARK)
  .text("How to obtain the manual:", ML, doc.y);
doc.y += 12;

const manualOptions = [
  {
    heading: "Option A — View within the App (Recommended)",
    body: "The full manual is embedded and accessible directly within the course platform. After logging in via the Admin Access route described in Section 1, click 'APP PREVIEW' and navigate to any module. The manual is available as a downloadable reference throughout the course.",
  },
  {
    heading: "Option B — WeTransfer / Secure File Share",
    body: "A copy of the manual can be provided on request via WeTransfer or a similar secure large-file transfer service. Please contact David Daniel at chainsawcourses.com to request the file and it will be sent within one working day.",
  },
  {
    heading: "Option C — Policy Documents & Supporting PDFs",
    body: "All supporting policy documents (Data Protection, Complaints Procedure, Terms & Conditions, Competency Framework Mapping, Appeals Policy, Assessment Policy, etc.) are accessible via the Admin Dashboard within the app and do not require separate download.",
  },
];

manualOptions.forEach(({ heading, body }) => {
  ensureSpace(70);
  doc
    .rect(ML, doc.y, 4, 50)
    .fill(BRAND_GREEN);
  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK)
    .text(heading, ML + 12, doc.y - 47, { width: CONTENT_W - 16 });
  doc
    .font("Helvetica").fontSize(10).fillColor(MID_GREY)
    .text(body, ML + 12, doc.y - 32, { width: CONTENT_W - 16 });
  doc.y += 16;
});

addFooter("Section 2 — Training Manual");

// ─── SECTION 3: ASSESSMENT BANK ───────────────────────────────────────────────
doc.addPage();

doc
  .rect(ML, doc.y, CONTENT_W, 46)
  .fill(BRAND_GREEN);
doc
  .font("Helvetica-Bold").fontSize(16).fillColor("#ffffff")
  .text("3.  Assessment Bank", ML + 12, doc.y - 40, { width: CONTENT_W - 24 });
doc
  .font("Helvetica").fontSize(11).fillColor("#d4edda")
  .text("151 Multiple-Choice Questions — Summative Examination Pool", ML + 12, doc.y - 23, { width: CONTENT_W - 24 });
doc.y += 14;

doc
  .font("Helvetica").fontSize(10).fillColor(MID_GREY)
  .text(
    "The summative examination draws a randomised set of 45 questions from the bank below. All 151 questions are mapped to Learning Outcomes (LO) and Assessment Criteria (AC). Learners must achieve 80% or above (36/45) to pass and generate their certificate. Questions are presented in a randomised order unique to each attempt. Correct answers are indicated in bold green.",
    ML, doc.y, { width: CONTENT_W }
  );
doc.y += 18;
hRule();
doc.y += 10;

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);
  const blockHeight = 16 + options.length * 16 + 24;
  ensureSpace(blockHeight + 20);

  // Question number bar
  doc
    .rect(ML, doc.y, CONTENT_W, 18)
    .fill(i % 2 === 0 ? "#f0f8f0" : LIGHT_GREY);

  doc
    .font("Helvetica-Bold").fontSize(9).fillColor(BRAND_GREEN)
    .text(`Q${i + 1}`, ML + 6, doc.y - 15, { width: 30 });
  doc
    .font("Helvetica").fontSize(8).fillColor(MID_GREY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`, ML + 38, doc.y - 15, { width: CONTENT_W - 44, align: "right" });
  doc.y += 4;

  // Question text
  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK)
    .text(q.question, ML + 6, doc.y, { width: CONTENT_W - 12 });
  doc.y += 6;

  // Options
  options.forEach((opt, oi) => {
    const isCorrect = oi === q.correct_option;
    doc
      .font(isCorrect ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(isCorrect ? BRAND_GREEN : MID_GREY)
      .text(
        `${OPTION_LABELS[oi]}.  ${opt}${isCorrect ? "  ✓" : ""}`,
        ML + 16, doc.y, { width: CONTENT_W - 20 }
      );
    doc.y += 2;
  });

  doc.y += 10;
  hRule();
  doc.y += 6;
});

addFooter("Section 3 — Assessment Bank");

// ─── SECTION 4: MOCK QUESTIONS ────────────────────────────────────────────────
doc.addPage();

doc
  .rect(ML, doc.y, CONTENT_W, 46)
  .fill(BRAND_GREEN);
doc
  .font("Helvetica-Bold").fontSize(16).fillColor("#ffffff")
  .text("4.  Supplementary Oral & Practical Mock Questions", ML + 12, doc.y - 40, { width: CONTENT_W - 24 });
doc
  .font("Helvetica").fontSize(11).fillColor("#d4edda")
  .text("79 Questions — Formative Practice Only", ML + 12, doc.y - 23, { width: CONTENT_W - 24 });
doc.y += 14;

// Important note box
doc
  .rect(ML, doc.y, CONTENT_W, 68)
  .fill("#e8f4e8")
  .strokeColor(BRAND_GREEN)
  .lineWidth(1)
  .stroke();
doc
  .font("Helvetica-Bold").fontSize(11).fillColor(BRAND_GREEN)
  .text("Important — Supplementary Resource Only", ML + 12, doc.y - 60, { width: CONTENT_W - 24 });
doc
  .font("Helvetica").fontSize(10).fillColor(BRAND_DARK)
  .text(
    "The mock questions in this section are supplementary oral and practical preparation questions designed to help learners consolidate their knowledge before the formal summative examination. They do NOT form part of the assessed examination, do NOT contribute to the learner's pass/fail outcome, and do NOT appear on the certificate.",
    ML + 12, doc.y - 43, { width: CONTENT_W - 24 }
  );
doc.y += 22;

doc
  .font("Helvetica").fontSize(10).fillColor(MID_GREY)
  .text(
    "Within the app, learners can attempt these questions using the AI-assisted voice or text response feature. The system provides formative feedback — identifying key points covered and missed — to support self-directed revision. This feature is entirely separate from the formal 45-question summative examination.",
    ML, doc.y, { width: CONTENT_W }
  );
doc.y += 16;
hRule();
doc.y += 10;

mockQs.forEach((q, i) => {
  const hasKeyPoints = q.keyPoints && q.keyPoints.length > 0;
  const blockHeight = 26 + (hasKeyPoints ? q.keyPoints.length * 14 + 18 : 0);
  ensureSpace(blockHeight + 16);

  doc
    .rect(ML, doc.y, CONTENT_W, 18)
    .fill(i % 2 === 0 ? "#f0f8f0" : LIGHT_GREY);

  doc
    .font("Helvetica-Bold").fontSize(9).fillColor(BRAND_GREEN)
    .text(`M${i + 1}`, ML + 6, doc.y - 15, { width: 30 });
  doc
    .font("Helvetica").fontSize(8).fillColor(MID_GREY)
    .text("Oral / Practical — Formative Only", ML + 38, doc.y - 15, { width: CONTENT_W - 44, align: "right" });
  doc.y += 4;

  doc
    .font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK)
    .text(q.question, ML + 6, doc.y, { width: CONTENT_W - 12 });
  doc.y += 6;

  if (hasKeyPoints) {
    doc
      .font("Helvetica-Oblique").fontSize(8).fillColor(BRAND_GREEN)
      .text("Key points a good answer should include:", ML + 16, doc.y, { width: CONTENT_W - 20 });
    doc.y += 4;
    q.keyPoints.forEach((kp) => {
      doc
        .font("Helvetica").fontSize(8.5).fillColor(MID_GREY)
        .text(`•  ${kp}`, ML + 22, doc.y, { width: CONTENT_W - 26 });
      doc.y += 2;
    });
  }

  doc.y += 10;
  hRule();
  doc.y += 6;
});

// Final note
ensureSpace(60);
doc.y += 10;
doc
  .rect(ML, doc.y, CONTENT_W, 50)
  .fill(LIGHT_GREY)
  .strokeColor(RULE_GREY)
  .lineWidth(0.5)
  .stroke();
doc
  .font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK)
  .text("End of Course Materials Pack", ML + 12, doc.y - 42, { width: CONTENT_W - 24, align: "center" });
doc
  .font("Helvetica").fontSize(9).fillColor(MID_GREY)
  .text(
    "For the full training manual, supporting policy documents, and the live course platform, please see Sections 1 and 2 of this document or contact David Daniel at chainsawcourses.com",
    ML + 12, doc.y - 26, { width: CONTENT_W - 24, align: "center" }
  );
doc.y += 20;

addFooter("Section 4 — Mock Questions");

// ─── Finalise ─────────────────────────────────────────────────────────────────
doc.end();

stream.on("finish", () => {
  console.log("✅  PDF written to:", OUT);
  const size = fs.statSync(OUT).size;
  console.log("Size:", Math.round(size / 1024), "KB");
});
