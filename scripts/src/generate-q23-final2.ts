/**
 * Q23 Course Materials Pack — clean branded PDF
 * Strategy: natural pdfkit flow for ALL content pages.
 *   No estimated heights, no manual doc.y = after text calls.
 *   doc.y is only ever moved FORWARD, never backward.
 *   Page breaks triggered manually only for section starts.
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

// ─── Layout constants ─────────────────────────────────────────────────────────
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

let pageNum = 0;
doc.on("pageAdded", () => { pageNum++; });

// ─── Helpers — all move doc.y FORWARD only ────────────────────────────────────

function sp(n: number) { doc.y += n; }

function hrule(colour = RUL, w = 0.5) {
  doc.save()
    .moveTo(ML, doc.y).lineTo(ML + CW, doc.y)
    .strokeColor(colour).lineWidth(w).stroke()
    .restore();
}

/** Footer — call just before doc.addPage() */
function footer() {
  const fy = PH - 30;
  doc.save()
    .moveTo(ML, fy - 4).lineTo(ML + CW, fy - 4)
    .strokeColor(OG).lineWidth(0.8).stroke()
    .font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials Pack", ML, fy,
      { width: CW - 30, align: "left", lineBreak: false })
    .text(String(pageNum), ML, fy, { width: CW, align: "right", lineBreak: false })
    .restore();
}

/**
 * Section heading: orange left stripe + pale tint band.
 * Drawn at current doc.y, advances doc.y past it.
 */
function sectionHead(n: string, title: string, sub = "") {
  const h = sub ? 44 : 34;
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  // Section label (small caps)
  doc.save()
    .font("Helvetica-Bold").fontSize(6.5).fillColor(OGD)
    .text(`SECTION ${n}`, ML + 12, y + 5, { lineBreak: false })
    .restore();
  // Title
  doc.save()
    .font("Helvetica-Bold").fontSize(13).fillColor(BLK)
    .text(title, ML + 12, y + 14, { width: CW - 80, lineBreak: false })
    .restore();
  if (sub) {
    doc.save()
      .font("Helvetica").fontSize(8).fillColor(MGY)
      .text(sub, ML + 12, y + 30, { width: CW - 14, lineBreak: false })
      .restore();
  }
  doc.y = y + h + 10;
}

/**
 * Info box: pale orange tint.
 * Uses natural text flow; advances doc.y correctly.
 */
function infoBox(heading: string, body: string) {
  const y = doc.y;
  // Draw a tall-enough background — we'll render text inside, pdfkit will overflow safely
  // Use a fixed generous height: heading (20) + 6 lines body max (78) + padding (16) = 114
  // If body is longer pdfkit overflows into white; box visually clips but text is readable
  const estLines = Math.ceil(body.length / 86) + 1;
  const h = 24 + estLines * 13 + 8;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  // Heading (lineBreak:false — no y advance from pdfkit)
  doc.save()
    .font("Helvetica-Bold").fontSize(9.5).fillColor(OGD)
    .text(heading, ML + 12, y + 7, { width: CW - 20, lineBreak: false })
    .restore();
  // Body — natural flow, track actual bottom
  doc.font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y + 21, { width: CW - 20 });
  // Move past the box — max of where pdfkit left us vs estimated bottom
  doc.y = Math.max(doc.y, y + h) + 8;
}

/** Numbered step — always flowing */
function step(n: number, text: string, col = OG) {
  const y = doc.y;
  doc.rect(ML, y, 22, 16).fill(col);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(String(n), ML, y + 3, { width: 22, align: "center", lineBreak: false })
    .restore();
  // Render text — flows naturally, may be multi-line
  doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(text, ML + 28, y + 2, { width: CW - 30 });
  // doc.y is now past the text. Ensure it's at least past the badge.
  if (doc.y < y + 18) doc.y = y + 18;
  sp(4);
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE 1 — COVER
// ════════════════════════════════════════════════════════════════════════════════
pageNum = 1;

// Orange top band
doc.rect(0, 0, PW, 96).fill(OG);
doc.image(LOGO, ML, 10, { height: 70 });
doc.save()
  .font("Helvetica-Bold").fontSize(21).fillColor(WHT)
  .text("CHAINSAW COURSES", ML + 78, 18, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(8.5).fillColor("#FFE0C0")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 78, 46, { lineBreak: false })
  .restore();
doc.image(IIRSM, PW - MR - 54, 12, { height: 58 });
doc.save()
  .font("Helvetica").fontSize(6.5).fillColor("#FFE0C0")
  .text("IIRSM Course Approval", PW - MR - 60, 74, { width: 66, align: "center", lineBreak: false })
  .restore();

// Title
doc.save()
  .font("Helvetica-Bold").fontSize(22).fillColor(BLK)
  .text("Course Materials Pack", ML, 112, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(12).fillColor(DGY)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 140, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Submitted in support of IIRSM Course Approval — Question 23", ML, 158, { lineBreak: false })
  .restore();

doc.y = 176;
doc.moveTo(ML, 176).lineTo(ML + CW, 176).strokeColor(OG).lineWidth(1.2).stroke();
doc.y = 186;

// Summary table — 7 rows × 16pt = 112pt
[
  ["Course",    "Chainsaw Maintenance & Cross Cutting (NPTC CS30/CS31 Aligned)"],
  ["Provider",  "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery",  "Fully Online — E-Learning (self-paced)"],
  ["Hours",     "4 hrs GLH  ·  2 hrs Assessment  ·  4 hrs Self-Study  ·  10 hrs TQT"],
  ["CPD",       "5 CPD Points (IIRSM)"],
  ["Threshold", "80% pass — randomised 45-question summative examination"],
  ["Purpose",   "Training presentation & delegate materials (Q23)"],
].forEach(([label, value], i) => {
  const y = doc.y;
  if (i % 2 === 0) doc.rect(ML, y, CW, 16).fill(LGY);
  doc.save()
    .font("Helvetica-Bold").fontSize(8.5).fillColor(OGD)
    .text(label, ML + 6, y + 4, { width: 68, lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(8.5).fillColor(DGY)
    .text(value, ML + 80, y + 4, { width: CW - 84, lineBreak: false })
    .restore();
  doc.y = y + 16;
});

sp(12);
hrule();
sp(10);

// Contents
doc.save().font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
  .text("Contents", ML, doc.y, { lineBreak: false }).restore();
sp(10);

[
  ["1", "How to Access the Live App & Admin Panel"],
  ["2", "A Note on the Training Manual"],
  ["3", `Assessment Bank — ${examQs.length} Multiple-Choice Questions`],
  ["4", `Supplementary Oral & Practical Mock Questions (${mockQs.length})`],
].forEach(([n, title]) => {
  const y = doc.y;
  doc.rect(ML, y, 20, 16).fill(OG);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(n, ML, y + 4, { width: 20, align: "center", lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(title, ML + 26, y + 4, { lineBreak: false })
    .restore();
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

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("Admin / Assessor Access — All Content Unlocked", ML, doc.y, { lineBreak: false }).restore();
sp(8);

[
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted — the full admin dashboard will appear.",
  "Explore the dashboard tabs: Feedback, Backup, Storage, Policy Documents and more.",
  "All Export buttons send data directly to protected Google Drive storage.",
  "Click 'APP PREVIEW' in the top-right corner of the dashboard to enter the fully unlocked app.",
  "All videos, features, certificates, and IIRSM-referenced content are fully accessible for review.",
].forEach((s, i) => step(i + 1, s));

sp(12); hrule(); sp(12);

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("New Learner Journey — Standard Access Route", ML, doc.y, { lineBreak: false }).restore();
sp(6);
doc.font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Experience the app exactly as a learner — sequential locking, quiz flow, and waiver. The app is under internal testing and has not been publicly released.", ML, doc.y, { width: CW });
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

// ── Section 2 flows straight on ──────────────────────────────────────────────
sectionHead("2","A Note on the Training Manual","File size & access options");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource. It is a richly illustrated 138-page document covering all Learning Outcomes and Assessment Criteria, including Advanced Workshop Extension modules.", ML, doc.y, { width: CW });
sp(12);

infoBox("File Size Notice",
  "The manual PDF is approximately 71 MB due to high-resolution diagrams and photographs. This exceeds most standard upload limits and cannot be attached directly to this IIRSM submission.");

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("How to obtain the manual:", ML, doc.y, { lineBreak: false }).restore();
sp(10);

[
  {
    label: "Option A — View within the App (Recommended)",
    body: "The full manual is embedded within the course platform. After logging in via the Admin Access route in Section 1, click APP PREVIEW. The manual is available as a downloadable reference throughout the course. All supporting policy documents are also accessible via the Admin Dashboard.",
  },
  {
    label: "Option B — WeTransfer / Secure File Share",
    body: "A copy can be provided on request via WeTransfer or similar. Contact David Daniel at chainsawcourses.com — the file will be sent within one working day.",
  },
].forEach(({ label, body }) => {
  const estLines = Math.ceil(body.length / 86);
  const h = 24 + estLines * 13 + 8;
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(LGY);
  doc.save()
    .font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(label, ML + 12, y + 7, { width: CW - 20, lineBreak: false })
    .restore();
  doc.font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y + 21, { width: CW - 20 });
  doc.y = Math.max(doc.y, y + h) + 8;
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ASSESSMENT BANK
// New page — content always starts fresh here
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();

sectionHead("3","Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  ·  Summative Examination Pool`);

infoBox("How the exam works",
  `The summative examination draws a randomised 45 questions from this ${examQs.length}-question bank. Questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must achieve 80% or above to pass. Correct answers are highlighted in orange with ✓.`);

// ─── Question loop ─────────────────────────────────────────────────────────────
// NO height estimation. Let pdfkit flow everything.
// Only trigger a page break if we're less than 80pt from the bottom — prevents
// badges orphaned at the foot of a page with nothing below them.
examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);

  // If very little space left, start a new page
  if (doc.y > PH - MB - 80) {
    footer();
    doc.addPage();
  }

  const y0 = doc.y;

  // Orange number badge — fixed 16 × 30
  doc.rect(ML, y0, 30, 16).fill(OG);
  // Badge text — lineBreak:false, no save/restore so doc.y advances minimally
  doc.font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(`Q${i + 1}`, ML, y0 + 3, { width: 30, align: "center", lineBreak: false });
  // AC tag right-aligned — lineBreak:false
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`,
      ML + 32, y0 + 4, { width: CW - 34, align: "right", lineBreak: false });

  // Force cursor past the badge before flowing question text
  // doc.y may be y0+~10 due to the text calls above; bump to y0+18
  if (doc.y < y0 + 18) doc.y = y0 + 18;

  // Question — flowing
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  sp(2);

  // Options — flowing
  options.forEach((opt, oi) => {
    const isCorrect = oi === q.correct_option;
    // Highlight background for correct answer — 1-line est (will clip if wraps, but text overlays fine)
    if (isCorrect) {
      const estH = Math.ceil((opt.length + 8) / 75) * 12 + 4;
      doc.rect(ML + 6, doc.y - 1, CW - 8, estH).fill(OGL);
    }
    doc.font(isCorrect ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9)
      .fillColor(isCorrect ? OG : MGY)
      .text(`${OPTS[oi]}.  ${opt}${isCorrect ? "  ✓" : ""}`,
        ML + 14, doc.y, { width: CW - 20 });
  });

  sp(5);
  hrule(RUL, 0.4);
  sp(4);
});

footer();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MOCK QUESTIONS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();

sectionHead("4","Supplementary Oral & Practical Mock Questions",
  `${mockQs.length} Questions  ·  Formative Practice Only — Not Formally Assessed`);

infoBox("Important — these questions do not contribute to the pass/fail outcome",
  `These ${mockQs.length} questions are oral and practical preparation aids. They do NOT form part of the summative examination, do NOT appear on the certificate, and are NOT formally assessed. Within the app, learners practise them via an AI-assisted voice or text feature that provides formative feedback.`);

mockQs.forEach((q, i) => {
  if (doc.y > PH - MB - 80) {
    footer();
    doc.addPage();
  }

  const y0 = doc.y;

  // Badge
  doc.rect(ML, y0, 30, 16).fill(BLK);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(OG)
    .text(`M${i + 1}`, ML, y0 + 3, { width: 30, align: "center", lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Oral / Practical  ·  Formative Only",
      ML + 32, y0 + 4, { width: CW - 34, align: "right", lineBreak: false });

  if (doc.y < y0 + 18) doc.y = y0 + 18;

  // Question
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  sp(2);

  // Key points
  if (q.keyPoints.length > 0) {
    doc.save()
      .font("Helvetica-Oblique").fontSize(8).fillColor(OG)
      .text("Key points a good answer should include:", ML + 14, doc.y, { lineBreak: false })
      .restore();
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
sp(10);
doc.rect(ML, doc.y, CW, 26).fill(OG);
doc.save()
  .font("Helvetica-Bold").fontSize(9).fillColor(WHT)
  .text("End of Course Materials Pack  ·  chainsawcourses.com  ·  © 2026 Chainsaw Courses Ltd",
    ML, doc.y + 9, { width: CW, align: "center", lineBreak: false })
  .restore();
doc.y += 36;

footer();

// ─── Done ─────────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const { size } = fs.statSync(OUT);
  console.log(`✅  ${Math.round(size / 1024)} KB`);
});
