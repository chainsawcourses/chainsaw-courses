/**
 * generate-pdfs.ts
 * Generates all policy documents and the IIRSM Submission Brief for Chainsaw Courses.
 * Run: pnpm --filter @workspace/scripts run generate-pdfs
 * Output: artifacts/chainsaw-training/public/pdfs/
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, "../../artifacts/chainsaw-training/public/pdfs");
const LOGO_PATH = path.resolve(__dirname, "../../artifacts/chainsaw-training/public/logo.png");

const ORANGE = "#e27226";
const DARK = "#1C1C1C";
const MID = "#555555";
const LIGHT = "#888888";
const RULE = "#CCCCCC";
const SHADE = "#F3F4F6";

// ─── Helpers ────────────────────────────────────────────────────────────────

function newDoc(title: string): PDFKit.PDFDocument {
  return new PDFDocument({
    margin: 60,
    size: "A4",
    info: { Title: title, Author: "Overleaf Publishers Ltd", Creator: "Chainsaw Courses" },
  });
}

function drawPageHeader(doc: PDFKit.PDFDocument): void {
  const logoSize = 52;
  const hY = 60;
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 60, hY, { width: logoSize, height: logoSize });
  }
  const tX = fs.existsSync(LOGO_PATH) ? 60 + logoSize + 12 : 60;
  doc
    .fontSize(13)
    .fillColor(ORANGE)
    .font("Helvetica-Bold")
    .text("Chainsaw Courses", tX, hY + 4, { lineBreak: false });
  doc
    .fontSize(9)
    .fillColor(MID)
    .font("Helvetica")
    .text("CHAINSAW MAINTENANCE & CROSS CUTTING  ·  OVERLEAF PUBLISHERS LTD", tX, hY + 30, { lineBreak: false });
  doc.text("", 60, hY + logoSize + 8);
  doc
    .moveTo(60, doc.y)
    .lineTo(535, doc.y)
    .strokeColor(ORANGE)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);
}

function drawFooter(doc: PDFKit.PDFDocument, docTitle: string, version = "Version 1.0"): void {
  const bot = doc.page.height - 52;
  doc
    .moveTo(60, bot)
    .lineTo(535, bot)
    .strokeColor(RULE)
    .lineWidth(0.5)
    .stroke();
  doc
    .fontSize(7)
    .fillColor(LIGHT)
    .font("Helvetica")
    .text(
      `${docTitle}  ·  Overleaf Publishers Ltd  ·  Co. No. 15735226  ·  VAT 479581629  ·  chainsawcourses.com  ·  ${version}  ·  July 2026  ·  Confidential`,
      60,
      bot + 8,
      { lineBreak: false }
    );
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.6);
  doc
    .fontSize(8.5)
    .fillColor(ORANGE)
    .font("Helvetica-Bold")
    .text(text.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.25);
  doc
    .moveTo(60, doc.y)
    .lineTo(535, doc.y)
    .strokeColor(ORANGE)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
}

function body(doc: PDFKit.PDFDocument, text: string, gap = 4): void {
  doc
    .fontSize(9.5)
    .fillColor(DARK)
    .font("Helvetica")
    .text(text, { lineGap: gap, paragraphGap: 3 });
}

function bullet(doc: PDFKit.PDFDocument, items: string[]): void {
  items.forEach((item) => {
    doc
      .fontSize(9.5)
      .fillColor(DARK)
      .font("Helvetica")
      .text(`•   ${item}`, { indent: 8, lineGap: 3 });
  });
}

function docTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .fontSize(16)
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .text(text, { align: "left" });
  doc.moveDown(0.2);
  doc
    .fontSize(8)
    .fillColor(MID)
    .font("Helvetica")
    .text("Overleaf Publishers Ltd  ·  Co. No. 15735226  ·  VAT No. 479581629  ·  Version 1.0  ·  July 2026  ·  chainsawcourses.com");
  doc.moveDown(1);
}

function infoRow(doc: PDFKit.PDFDocument, label: string, value: string): void {
  const y = doc.y;
  doc
    .fontSize(8.5)
    .fillColor(MID)
    .font("Helvetica-Bold")
    .text(label, 60, y, { width: 155, lineBreak: false });
  doc
    .fontSize(9)
    .fillColor(DARK)
    .font("Helvetica")
    .text(value, 220, y, { width: 315 });
  doc.moveDown(0.25);
}

function tableRow(
  doc: PDFKit.PDFDocument,
  col1: string,
  col2: string,
  isHeader: boolean,
  rowY: number,
  col1W = 175
): void {
  const rowH = 26;
  const bgColor = isHeader ? ORANGE : doc.y % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
  if (isHeader) {
    doc.rect(60, rowY, 475, rowH).fill(ORANGE);
    doc
      .fontSize(8.5)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .text(col1.toUpperCase(), 68, rowY + 8, { width: col1W - 16, lineBreak: false });
    doc
      .fontSize(8.5)
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .text(col2.toUpperCase(), 60 + col1W + 8, rowY + 8, { width: 475 - col1W - 16, lineBreak: false });
  } else {
    doc.rect(60, rowY, 475, rowH).strokeColor(RULE).lineWidth(0.4).stroke();
    doc
      .fontSize(8.5)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(col1, 68, rowY + 8, { width: col1W - 16, lineBreak: false });
    doc
      .fontSize(8.5)
      .fillColor(DARK)
      .font("Helvetica")
      .text(col2, 60 + col1W + 8, rowY + 8, { width: 475 - col1W - 16, lineBreak: false });
  }
}

function twoColTable(
  doc: PDFKit.PDFDocument,
  headers: [string, string],
  rows: [string, string][],
  col1W = 175
): void {
  // Ensure there's room for the header + at least one data row before starting
  if (doc.y > doc.page.height - 160) {
    doc.addPage();
    drawPageHeader(doc);
  }
  let y = doc.y;
  tableRow(doc, headers[0], headers[1], true, y, col1W);
  y += 26;
  rows.forEach(([c1, c2], i) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      drawPageHeader(doc);
      y = doc.y;
    }
    const dynH = Math.max(26, Math.ceil(c2.length / 55) * 13 + 10);
    if (i % 2 === 0) doc.rect(60, y, 475, dynH).fill(SHADE);
    doc.rect(60, y, 475, dynH).strokeColor(RULE).lineWidth(0.4).stroke();
    doc
      .fontSize(8.5)
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(c1, 68, y + 7, { width: col1W - 16, lineBreak: false });
    doc
      .fontSize(8.5)
      .fillColor(DARK)
      .font("Helvetica")
      .text(c2, 60 + col1W + 8, y + 7, { width: 475 - col1W - 16, lineBreak: c2.length > 60 });
    y += dynH;
  });
  doc.text("", 60, y + 4);
  doc.moveDown(0.5);
}

function save(doc: PDFKit.PDFDocument, filename: string, footerTitle: string, version = "Version 1.0"): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = path.join(OUT_DIR, filename);
    const stream = fs.createWriteStream(out);

    // Register footer on each page
    const range = doc.bufferedPageRange();
    doc.on("pageAdded", () => {
      drawFooter(doc, footerTitle, version);
    });

    doc.pipe(stream);
    drawFooter(doc, footerTitle, version);
    doc.end();
    stream.on("finish", () => {
      console.log(`  ✓  ${filename}`);
      resolve();
    });
    stream.on("error", reject);
  });
}

// ─── 1. Terms & Conditions and Liability Waiver ─────────────────────────────

async function genTerms(): Promise<void> {
  const doc = newDoc("Terms & Conditions and Liability Waiver");
  drawPageHeader(doc);
  docTitle(doc, "Terms & Conditions and Liability Waiver");

  sectionHeading(doc, "1. Definitions");
  body(doc,
    '"Platform" means the Chainsaw Courses eLearning platform operated by Overleaf Publishers Ltd at chainsawcourses.com. "Course" means the online chainsaw maintenance and cross-cutting training programme. "Student" means any individual who purchases an Activation Code and accesses the Platform. "Activation Code" means the unique access credential issued upon purchase. "Manual" means the printed or digital Overleaf Chainsaw Manual supplied as course material.'
  );

  sectionHeading(doc, "2. Access and Licence");
  body(doc,
    "Upon purchase, the Student receives a single-user, non-transferable licence to access the Course content on one device. The Activation Code is bonded to the first device on which it is redeemed. Sharing credentials, Activation Codes, or access links is strictly prohibited and constitutes a breach of contract. Overleaf Publishers Ltd reserves the right to revoke access without refund in the event of suspected sharing or misuse."
  );
  bullet(doc, [
    "Licence is for personal, professional development use only.",
    "Access is granted for 12 months from the date of activation.",
    "Content may not be reproduced, redistributed, or commercially exploited.",
  ]);

  sectionHeading(doc, "3. Intellectual Property");
  body(doc,
    "All course content, video material, text, images, quiz questions, interactive tools, and the Overleaf Chainsaw Manual are the intellectual property of Overleaf Publishers Ltd and are protected by UK copyright law. The Student is granted a limited, non-exclusive licence to access and use the content for personal study only. No content may be recorded, downloaded, reproduced, or transmitted in any form without the express written consent of Overleaf Publishers Ltd."
  );

  sectionHeading(doc, "4. Comprehensive Liability Waiver");
  body(doc,
    "IMPORTANT: Chainsaw operation and maintenance are inherently hazardous activities. Improper handling, maintenance, or operation can result in severe, life-altering injury or death. By purchasing and accessing this Course, the Student explicitly acknowledges and agrees to the following:"
  );
  bullet(doc, [
    "The Course provides theoretical knowledge and educational guidance only. It does not constitute practical chainsaw training.",
    "Practical, hands-on training with a qualified instructor is legally required for professional chainsaw operation in the UK (PUWER 1998, Regulation 9).",
    "The Student assumes all risk associated with applying knowledge gained from this Course in any practical context.",
    "Overleaf Publishers Ltd, its directors, employees, and agents accept no liability for any injury, death, property damage, or consequential loss arising from the Student's use or application of information contained in the Course or Manual.",
    "The Student confirms they are aged 18 or over and are aware of the legal requirements for chainsaw operation in their jurisdiction.",
    "The liability waiver signed digitally at the point of first platform access forms an integral part of this agreement.",
  ]);

  sectionHeading(doc, "5. Data and Privacy");
  body(doc,
    "Personal data is collected and processed in accordance with our Data Protection Policy and UK GDPR. The Student's name, email address, device identifier, and training progress are stored for the purpose of delivering the Course and maintaining training records. Data is retained for 3 years from the date of last platform activity. Full details are set out in the Data Protection Policy available from the Documents Library within the Platform."
  );

  sectionHeading(doc, "6. Governing Law");
  body(doc,
    "These Terms & Conditions are governed by and construed in accordance with the law of England and Wales. Any dispute arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales. If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect."
  );

  sectionHeading(doc, "7. Amendments");
  body(doc,
    "Overleaf Publishers Ltd reserves the right to update these Terms & Conditions at any time. Students will be notified of material changes via the Platform. Continued use of the Platform following notification of changes constitutes acceptance of the revised Terms."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");

  await save(doc, "Terms_and_Conditions_Liability_Waiver.pdf", "Terms & Conditions and Liability Waiver");
}

// ─── 2. Refund & Cancellation Policy ────────────────────────────────────────

async function genRefund(): Promise<void> {
  const doc = newDoc("Refund & Cancellation Policy");
  drawPageHeader(doc);
  docTitle(doc, "Refund & Cancellation Policy");

  sectionHeading(doc, "1. Overview");
  body(doc,
    "This policy sets out the circumstances in which a refund or cancellation may be requested for the Chainsaw Courses eLearning platform. This policy is designed to comply with the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 and the Consumer Rights Act 2015."
  );

  sectionHeading(doc, "2. Cooling-Off Period");
  body(doc,
    "Under the Consumer Contracts Regulations 2013, you have a 14-day cooling-off period from the date of purchase during which you may cancel your order and receive a full refund, provided you have not yet activated your Activation Code and accessed the digital course content."
  );
  bullet(doc, [
    "14-day cooling-off period applies from date of purchase.",
    "Right to cancel is forfeited once the Activation Code is redeemed and course content is accessed.",
    "Students will be asked to expressly consent to immediate digital access and acknowledge forfeiture of the cooling-off right at the point of activation.",
  ]);

  sectionHeading(doc, "3. Cancellation After Activation");
  body(doc,
    "Once an Activation Code has been redeemed and the Student has accessed any course content, the right to a cooling-off refund is waived in accordance with Regulation 36 of the Consumer Contracts Regulations 2013 (supply of digital content with prior consent). Refunds after activation are not normally available except in the circumstances described in Section 4."
  );

  sectionHeading(doc, "4. Exceptional Refund Circumstances");
  body(doc,
    "A full or partial refund may be considered in the following exceptional circumstances:"
  );
  bullet(doc, [
    "Technical fault: A persistent technical fault prevents access to the Platform that cannot be resolved within 7 business days of a support request being logged.",
    "Duplicate purchase: The Student has accidentally purchased more than one Activation Code for the same course.",
    "Fraudulent transaction: The purchase was made without the Student's authorisation.",
    "Medical or bereavement emergency: At our discretion, in cases of serious illness or bereavement occurring within 14 days of purchase.",
  ]);
  body(doc,
    "To request a refund under exceptional circumstances, contact info@chainsawcourses.com with your full name, order reference, and a description of the circumstances. We will respond within 5 business days."
  );

  sectionHeading(doc, "5. Refund Process");
  body(doc,
    "Approved refunds will be processed to the original payment method within 14 business days. We reserve the right to withhold a partial processing fee where a refund is granted as a goodwill gesture outside the standard terms. Refunds are processed via the original payment platform (Shopify/Stripe); Overleaf Publishers Ltd has no ability to issue refunds via alternative payment methods."
  );

  sectionHeading(doc, "6. Faulty or Misdescribed Content");
  body(doc,
    "If course content is materially faulty or does not correspond to its published description, you are entitled to a remedy under the Consumer Rights Act 2015. Please contact info@chainsawcourses.com to report the issue. We will aim to resolve the fault within 7 business days. If the fault cannot be resolved, a full refund will be issued."
  );

  sectionHeading(doc, "7. How to Request a Refund");
  body(doc,
    "All refund requests must be submitted in writing to info@chainsawcourses.com. Please include: your full name, email address, order reference number, activation status (activated / not activated), and the reason for your request. We aim to acknowledge all requests within 2 business days."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Refund_and_Cancellation_Policy.pdf", "Refund & Cancellation Policy");
}

// ─── 3. Data Protection Policy ──────────────────────────────────────────────

async function genDataProtection(): Promise<void> {
  const doc = newDoc("Data Protection Policy");
  drawPageHeader(doc);
  docTitle(doc, "Data Protection Policy");

  sectionHeading(doc, "1. Data Controller");
  body(doc,
    "The data controller for the Chainsaw Courses platform is Overleaf Publishers Ltd (\"we\", \"us\", \"our\"), the operator of the vocational chainsaw safety training service at chainsawcourses.com. Contact: info@chainsawcourses.com. This policy is prepared in accordance with UK GDPR (UK Data Protection Act 2018) and reflects IIRSM vocational training data standards."
  );

  sectionHeading(doc, "2. Data We Collect and Why");
  twoColTable(
    doc,
    ["Data", "Purpose and Lawful Basis"],
    [
      ["Full name & email", "Identify the licensed learner; personalise training; embed dynamic watermark on videos. Lawful basis: Contract (Art. 6(1)(b))."],
      ["Activation Code", "Verify a valid purchase; prevent unauthorised sharing. Lawful basis: Contract."],
      ["Device identifier", "Bond access to a single device; prevent credential sharing. Lawful basis: Legitimate interests (Art. 6(1)(f))."],
      ["Video watch progress & timestamps", "Enable resume-on-return; enforce sequential module unlocking; verify completion. Lawful basis: Contract."],
      ["Quiz & exam scores", "Assess competency; gate module progression at 80% pass threshold. Lawful basis: Contract."],
      ["Digital waiver signature", "Record informed consent to safety terms. Lawful basis: Legal obligation / legitimate interests."],
      ["Inspection checklist records", "Personal chainsaw pre-use safety log; duty-of-care records (PUWER/LOLER). Lawful basis: Legitimate interests; legal obligation."],
      ["Risk assessment records", "Dynamic risk assessment log; statutory compliance. Lawful basis: Legitimate interests; legal obligation (MHSWR 1999)."],
      ["AI mock-test messages", "AI-assisted exam preparation; improve AI response quality. Lawful basis: Contract / legitimate interests."],
      ["Module feedback ratings", "Improve course content quality. Lawful basis: Legitimate interests."],
    ],
    190
  );

  sectionHeading(doc, "3. Data Retention");
  body(doc,
    "We retain your personal training record for 3 years from the date of your last platform activity, or such longer period as may be required by applicable health and safety legislation. This retention period reflects the vocational nature of the training and supports ongoing employer and regulatory audit requirements. After the retention period, all personal data is securely deleted or anonymised."
  );

  sectionHeading(doc, "4. Your Rights Under UK GDPR");
  bullet(doc, [
    "Right of access — request a copy of the personal data we hold about you.",
    "Right to rectification — ask us to correct inaccurate data.",
    "Right to erasure — ask us to delete your personal data (subject to statutory retention obligations).",
    "Right to restriction — ask us to restrict processing in certain circumstances.",
    "Right to data portability — receive your data in a structured, machine-readable format.",
    "Right to object — object to processing based on legitimate interests.",
  ]);
  body(doc,
    "You may exercise the Right to Erasure directly within the Platform using the 'Delete Account' option. This permanently erases all personal data held about you. For all other rights requests, contact info@chainsawcourses.com. We will respond within 30 days."
  );

  sectionHeading(doc, "5. Third-Party Services");
  twoColTable(doc, ["Service", "Data Shared and Purpose"], [
    ["Vimeo", "Video hosting & streaming. IP address only (standard CDN delivery); no personal data transmitted by us."],
    ["OpenAI (Replit AI proxy)", "AI mock-test & tutor responses. Chat message content only; no name, email, or identifiers transmitted."],
    ["Replit", "Platform hosting & infrastructure. All platform traffic passes through Replit infrastructure; governed by Replit's DPA."],
    ["OpenStreetMap Nominatim", "GPS reverse geocoding for risk assessments. Coordinates only; no personal identifiers transmitted."],
  ], 160);

  sectionHeading(doc, "6. Data Security");
  body(doc,
    "All data is transmitted over HTTPS. Personal data is stored in a securely hosted PostgreSQL database with access restricted to authorised personnel only. Passwords and tokens are never stored in plain text. Video streams are delivered via Vimeo's secure CDN with domain-level access restrictions. The device-lock mechanism means your training account is bound to your device, reducing the risk of unauthorised third-party access to your personal training record."
  );

  sectionHeading(doc, "7. Cookies & Local Storage");
  body(doc,
    "This application uses browser localStorage and cookies solely to persist session credentials (activation code, device identifier, user ID) between visits. No advertising, analytics, or tracking cookies are set. No third-party tracking scripts are loaded."
  );

  sectionHeading(doc, "8. Complaints");
  body(doc,
    "If you believe your data has been mishandled, you have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk or by calling 0303 123 1113. We would appreciate the opportunity to address your concern before you contact the ICO — please email info@chainsawcourses.com first."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Data_Protection_Policy.pdf", "Data Protection Policy");
}

// ─── 4. Complaints Procedure ─────────────────────────────────────────────────

async function genComplaints(): Promise<void> {
  const doc = newDoc("Complaints Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Complaints Procedure");

  sectionHeading(doc, "1. Our Commitment");
  body(doc,
    "Overleaf Publishers Ltd is committed to providing a high-quality vocational training experience. We take all complaints seriously and will handle them promptly, fairly, and confidentially. This procedure applies to all learners and other stakeholders who wish to raise a complaint about any aspect of our service."
  );

  sectionHeading(doc, "2. What Constitutes a Complaint");
  body(doc,
    "A complaint is any expression of dissatisfaction with our service, content, or conduct that requires a formal response. This includes, but is not limited to:"
  );
  bullet(doc, [
    "Course content that is inaccurate, incomplete, or materially misleading.",
    "Technical faults that have not been resolved within a reasonable timeframe.",
    "Concerns about the assessment process, quiz marking, or results.",
    "Unreasonable delays in responding to support requests.",
    "Concerns about data privacy or the handling of personal information.",
    "Conduct of any member of staff or contractor associated with the Platform.",
  ]);

  sectionHeading(doc, "3. Stage 1 — Informal Resolution (0–10 Working Days)");
  body(doc,
    "In the first instance, please contact us informally by email at info@chainsawcourses.com with a clear description of your complaint. We will acknowledge your complaint within 2 working days and aim to resolve it within 10 working days. Many complaints can be resolved at this stage without the need for formal escalation."
  );

  sectionHeading(doc, "4. Stage 2 — Formal Complaint (10–20 Working Days)");
  body(doc,
    "If you are not satisfied with the outcome of Stage 1, you may submit a formal written complaint to info@chainsawcourses.com, clearly marked 'FORMAL COMPLAINT'. Your complaint will be reviewed by a senior member of staff who was not involved in the original decision. We will issue a written response within 20 working days of receiving the formal complaint."
  );

  sectionHeading(doc, "5. Stage 3 — External Escalation");
  body(doc,
    "If you remain dissatisfied following Stage 2, you may escalate your complaint to an external body. Relevant external escalation routes include:"
  );
  bullet(doc, [
    "IIRSM (International Institute of Risk and Safety Management): where the complaint relates to the quality or content of the IIRSM-approved course — www.iirsm.org",
    "ICO (Information Commissioner's Office): where the complaint relates to data protection or privacy — ico.org.uk / 0303 123 1113.",
    "Citizens Advice Consumer Service: for general consumer rights issues — 0808 223 1133.",
  ]);

  sectionHeading(doc, "6. Confidentiality and Records");
  body(doc,
    "All complaints will be handled with discretion and confidentiality. Records of complaints and their outcomes are retained for 3 years and reviewed periodically as part of our quality management process. Complainants will not be disadvantaged in any way as a result of raising a complaint."
  );

  sectionHeading(doc, "7. Timescales Summary");
  twoColTable(doc, ["Stage", "Timescale"], [
    ["Stage 1 — Acknowledgement", "Within 2 working days"],
    ["Stage 1 — Resolution", "Within 10 working days"],
    ["Stage 2 — Formal response", "Within 20 working days of formal submission"],
    ["Stage 3 — External referral", "As directed by the relevant external body"],
  ], 220);

  body(doc, "\nTo raise a complaint: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Complaints_Procedure.pdf", "Complaints Procedure");
}

// ─── 5. Reasonable Adjustments Policy ───────────────────────────────────────

async function genReasonableAdjustments(): Promise<void> {
  const doc = newDoc("Reasonable Adjustments Policy");
  drawPageHeader(doc);
  docTitle(doc, "Reasonable Adjustments Policy");

  sectionHeading(doc, "1. Purpose");
  body(doc,
    "Overleaf Publishers Ltd is committed to providing equitable access to vocational training for all learners. This policy sets out our approach to making reasonable adjustments for students who may be disadvantaged by a disability, learning difficulty, long-term health condition, or other personal circumstance that affects their ability to access or engage with the Course."
  );

  sectionHeading(doc, "2. Legal Framework");
  body(doc,
    "This policy is informed by the Equality Act 2010, which places a duty on education and training providers to make reasonable adjustments to avoid placing disabled students at a substantial disadvantage compared to non-disabled students. Protected characteristics relevant to this policy include: disability, age, and any other characteristic that may affect a student's access to learning."
  );

  sectionHeading(doc, "3. Types of Adjustments Available");
  body(doc,
    "The following adjustments may be available to eligible students on request:"
  );
  bullet(doc, [
    "Extended access period beyond the standard 12-month access window.",
    "Technical support for assistive technologies (screen readers, text-to-speech software).",
    "Alternative formats for course materials where technically feasible.",
    "Flexibility in assessment timing where a health condition affects concentration or endurance.",
    "Reduced-session access to support students who cannot study for extended periods.",
    "Direct contact with a named tutor or support person for guidance.",
  ]);

  sectionHeading(doc, "4. How to Apply");
  body(doc,
    "To request a reasonable adjustment, please contact us in advance of commencing the course by emailing info@chainsawcourses.com. Your request should include:\n\n• A description of the adjustment you are requesting.\n• A brief explanation of the need (medical evidence may be required for significant adjustments).\n• Your contact details and order reference number.\n\nWe aim to respond to all requests within 5 working days. We will advise whether the requested adjustment can be made, and if not, what alternatives may be available."
  );

  sectionHeading(doc, "5. Confidentiality");
  body(doc,
    "All information disclosed in connection with a request for reasonable adjustments will be treated in strict confidence and handled in accordance with our Data Protection Policy. Information will not be shared with third parties without the student's consent, except where required by law."
  );

  sectionHeading(doc, "6. Assessment Adjustments");
  body(doc,
    "Where an adjustment affects the assessment process (quizzes, mock exam), we will ensure that any adjustment does not compromise the validity or integrity of the assessment, or unfairly advantage the student over other learners. Adjustments to the 80% pass threshold are not available, as this threshold is set by the IIRSM course approval framework and reflects the safety-critical nature of the subject matter."
  );

  sectionHeading(doc, "7. Review");
  body(doc,
    "This policy will be reviewed annually or following any relevant change in legislation or IIRSM guidance. Students who feel that their adjustment request has not been handled fairly may use our Complaints Procedure."
  );

  body(doc, "\nTo request an adjustment: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Reasonable_Adjustments_Policy.pdf", "Reasonable Adjustments Policy");
}

// ─── 6. Appeals Policy ───────────────────────────────────────────────────────

async function genAppeals(): Promise<void> {
  const doc = newDoc("Appeals Policy");
  drawPageHeader(doc);
  docTitle(doc, "Appeals Policy");

  sectionHeading(doc, "1. Purpose");
  body(doc,
    "This policy sets out the grounds on which a student may appeal against an assessment decision on the Chainsaw Courses platform, and the procedure for submitting and considering an appeal. Overleaf Publishers Ltd is committed to a fair, transparent, and impartial appeals process that protects the integrity of the assessment framework whilst respecting the rights of individual learners."
  );

  sectionHeading(doc, "2. Grounds for Appeal");
  body(doc,
    "A student may submit an appeal on the following grounds:"
  );
  bullet(doc, [
    "Procedural irregularity: The assessment was not conducted in accordance with the published Assessment Policy.",
    "Technical failure: A confirmed technical fault on the Platform materially affected the student's ability to complete an assessment.",
    "Adverse circumstances: Circumstances beyond the student's control that significantly affected their performance, and which were not and could not reasonably have been declared in advance.",
    "Marking error: The student believes there is a clear error in the automated marking of a quiz or mock examination.",
  ]);
  body(doc,
    "Appeals on the grounds of disagreement with the assessed content (i.e., the student believes a correct answer has been marked incorrect) will only be upheld where there is a demonstrable error in the question, answer, or marking criteria."
  );

  sectionHeading(doc, "3. Stage 1 — Informal Review (0–10 Working Days)");
  body(doc,
    "In the first instance, the student should contact info@chainsawcourses.com within 10 working days of the assessment decision, setting out the grounds for the appeal and any supporting evidence. The assessment will be reviewed by a member of staff not involved in the original assessment. A written outcome will be issued within 10 working days."
  );

  sectionHeading(doc, "4. Stage 2 — Formal Appeal (10–20 Working Days)");
  body(doc,
    "If the student is not satisfied with the Stage 1 outcome, a formal appeal may be submitted within 10 working days of receiving the Stage 1 response. The formal appeal will be reviewed by a senior member of staff or the Internal Verifier. A written outcome will be issued within 20 working days."
  );

  sectionHeading(doc, "5. Stage 3 — External Appeal (IIRSM)");
  body(doc,
    "Where the appeal relates to an IIRSM-approved element of the course, and the student remains dissatisfied following Stage 2, the student may refer the matter to IIRSM at www.iirsm.org. IIRSM's decision on course-approval matters is final."
  );

  sectionHeading(doc, "6. Timescales");
  twoColTable(doc, ["Stage", "Timescale"], [
    ["Stage 1 — Submission deadline", "Within 10 working days of the assessment decision"],
    ["Stage 1 — Outcome", "Within 10 working days of submission"],
    ["Stage 2 — Submission deadline", "Within 10 working days of Stage 1 outcome"],
    ["Stage 2 — Outcome", "Within 20 working days of formal submission"],
    ["Stage 3 — External (IIRSM)", "As directed by IIRSM"],
  ], 235);

  sectionHeading(doc, "7. Outcomes");
  body(doc,
    "Following a successful appeal, the assessment decision may be amended, the assessment may be re-taken, or an alternative remedy may be applied as appropriate. The outcome of an appeal will be recorded and used to inform quality improvement processes. Unsuccessful appeals will be communicated to the student with clear reasons."
  );

  body(doc, "\nTo submit an appeal: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Appeals_Policy.pdf", "Appeals Policy");
}

// ─── 7. Health, Safety & Wellbeing Policy (ISO 45001 framework) ──────────────

async function genHealthSafety(): Promise<void> {
  const doc = newDoc("Health, Safety & Wellbeing Policy");
  drawPageHeader(doc);
  docTitle(doc, "Health, Safety & Wellbeing Policy");

  sectionHeading(doc, "1. Policy Statement");
  body(doc, "Overleaf Publishers Ltd is committed to providing and maintaining, so far as is reasonably practicable, a safe and healthy working environment for all directors, employees, contractors, learners, and any other persons affected by our activities. We accept our legal obligations under the Health and Safety at Work etc. Act 1974, the Management of Health and Safety at Work Regulations 1999, and all applicable subordinate legislation. This policy reflects a structured occupational health and safety management framework and commits the organisation to the systematic identification, assessment, and control of workplace hazards; active consultation with workers; monitoring and continual improvement of health and safety performance; and full compliance with applicable legal and other requirements.\n\nThis commitment extends to learners: all course content reinforces a safety-first culture, and the theoretical knowledge delivered through Chainsaw Courses is explicitly a prerequisite to — not a substitute for — NPTC-accredited practical competence assessment.");

  sectionHeading(doc, "2. Scope and Organisational Context");
  body(doc, "This policy applies to: all staff, directors, and contractors engaged in course development, content review, platform maintenance, administration, and learner support; the Chainsaw Courses eLearning platform and all associated digital and physical operations; learners accessing the platform, to the extent of health and safety guidance provided through course content; and any third parties interacting with the organisation's premises or systems.\n\nOur primary operational context is a remote-first, digitally delivered eLearning business. Physical activities are limited to desk-based content development. Principal external risks include legislative changes requiring urgent content updates, cyber threats to learner data and platform availability, and reputational risk from inaccurate safety-critical course content.");

  sectionHeading(doc, "3. Legal Framework");
  twoColTable(doc, ["Legislation / Guidance", "Application"], [
    ["Health and Safety at Work etc. Act 1974", "Overarching duty of care to employees, contractors, and affected persons"],
    ["Management of H&S at Work Regulations 1999", "Risk assessment, planning, organisation, monitoring, and review"],
    ["Display Screen Equipment Regulations 1992", "Workstation assessment and rest breaks for screen-based workers"],
    ["Manual Handling Operations Regulations 1992", "Assessment and reduction of manual handling risk"],
    ["RIDDOR 2013", "Statutory reporting of injuries, dangerous occurrences, and occupational diseases"],
    ["Electricity at Work Regulations 1989", "Safe use of electrical equipment"],
    ["Working Time Regulations 1998", "Maximum working hours, rest breaks, and annual leave"],
    ["Equality Act 2010", "Reasonable adjustments for disabled workers"],
    ["First Aid at Work Regulations 1981", "Provision of first aid equipment and trained personnel"],
    ["HSE / FISA Chainsaw Safety Guidance Series", "Currency and accuracy of all chainsaw safety course content"],
    ["COSHH Regulations 2002", "Assessment of hazardous substances relevant to course content accuracy"],
  ], 200);

  sectionHeading(doc, "4. Roles and Responsibilities");
  body(doc, "Director / Managing Director:");
  bullet(doc, [
    "Ultimate accountability for all health and safety performance across the organisation.",
    "Setting, communicating, implementing, and reviewing health and safety policy and objectives.",
    "Allocating sufficient resources — financial, time, and personnel — to fulfil all health and safety obligations.",
    "Signing off risk assessments, safe systems of work, and emergency plans.",
    "Ensuring all staff and contractors are trained, competent, and have received role-specific health and safety briefings.",
    "Conducting formal annual management reviews of health and safety performance.",
    "Liaising with enforcing authorities (HSE, Local Authority Environmental Health) as required.",
    "Ensuring all RIDDOR-notifiable events are reported to the HSE within statutory timescales.",
  ]);
  body(doc, "\nContent Authors and Course Contributors:");
  bullet(doc, [
    "Ensuring all safety-critical course content is accurate, current, and aligned with HSE/FISA guidance and UK legislation.",
    "Notifying the Director without delay of any identified inaccuracy in course content that could affect learner safety.",
    "Completing annual workstation self-assessments and reporting ergonomic concerns to the Director.",
    "Attending all required health and safety briefings, inductions, and training events.",
  ]);
  body(doc, "\nContractors and Third Parties:");
  bullet(doc, [
    "Complying with this policy and all associated procedures during engagement.",
    "Providing evidence of appropriate training, public liability insurance, and competence prior to commencement.",
    "Reporting any incident, near-miss, or hazard identified during their engagement without delay.",
  ]);
  body(doc, "\nLearners:");
  bullet(doc, [
    "Completing the digital waiver and engaging with all health and safety content in the course.",
    "Understanding that the Chainsaw Courses platform provides theoretical knowledge only — practical chainsaw operations must be conducted under a competent instructor until NPTC competence is formally assessed and certified.",
    "Reporting concerns about course content accuracy to info@chainsawcourses.com.",
  ]);

  sectionHeading(doc, "5. Hazard Identification, Risk Assessment, and Control");
  body(doc, "Hazards are identified and risks assessed using a likelihood × severity matrix (1–5 scale): Low 1–4, Medium 5–12, High 13–18, Critical 19–25. Controls are selected following the hierarchy: Elimination → Substitution → Engineering controls → Administrative controls → PPE. Assessments are reviewed annually and following any incident, near-miss, or significant operational change.");
  twoColTable(doc, ["Risk", "Primary Controls"], [
    ["Display Screen Equipment — prolonged screen use", "Workstation self-assessment; 20-20-20 rule; minimum 5-min break per hour; adjustable equipment provision"],
    ["Sedentary work and musculoskeletal disorders", "Standing desk options; movement break prompts; ergonomics guidance in staff onboarding"],
    ["Work-related stress and mental wellbeing", "Workload monitoring; regular 1:1 check-ins; EAP signposting; mental health first aid resources"],
    ["Information security and data breach", "Information Security Policy; MFA; encrypted storage; access controls; incident response procedure"],
    ["Inaccurate safety-critical course content", "Annual content audit by qualified SME; version control; rapid correction procedure; IIRSM review cycle"],
    ["Contractor competence failure", "Pre-engagement competence and insurance verification; written scope of work; supervision where required"],
    ["Lone working — remote staff", "Regular check-in schedule; emergency contact register; escalation if check-in missed"],
    ["Cyber incident / platform unavailability", "Business Continuity Plan; offsite backups; incident response procedure; supplier SLA monitoring"],
  ], 200);

  sectionHeading(doc, "6. Worker Consultation and Participation");
  body(doc, "All workers are entitled and actively encouraged to: raise health and safety concerns without fear of detriment; participate in risk assessments relevant to their own activities; propose improvements; and access all health and safety documents including this policy, risk assessments, and incident records. All concerns are acknowledged within 2 working days and fully investigated within 10 working days. Outcomes are communicated to the worker and logged in the near-miss/incident register.");

  sectionHeading(doc, "7. Competence, Training, and Awareness");
  body(doc, "All personnel receive health and safety induction covering this policy, emergency procedures, role-specific risks, and incident reporting. Ongoing competence is maintained through: annual health and safety briefings; role-specific training (DSE assessment, first aid, fire safety) with records in the Competence and Training Register; external CPD for content authors including maintenance of NPTC qualifications; and pre-engagement competence verification for all contractors.");

  sectionHeading(doc, "8. Communication");
  body(doc, "Health and safety information is communicated through: this policy document, issued to all staff and contractors on engagement and reissued following review; health and safety briefings at onboarding and as required; prompt email notification of urgent safety-critical matters; and through the Chainsaw Courses platform, which communicates safety requirements to learners via course content, the digital waiver, and the AI mock examiner.");

  sectionHeading(doc, "9. Operational Planning and Control");
  bullet(doc, [
    "All new work activities are subject to a risk assessment before commencement.",
    "All contractors undergo a pre-engagement competence review (see Supplier and Contractor Evaluation Policy).",
    "All changes to safety-critical course content are subject to the Document Control Procedure and require Director sign-off.",
    "Platform downtime and cyber incidents are managed under the Business Continuity and Disaster Recovery Plan.",
    "All staff working with display screen equipment for more than 1 hour per day maintain a current DSE self-assessment, reviewed annually.",
  ]);

  sectionHeading(doc, "10. Emergency Preparedness and Response");
  body(doc, "Emergency arrangements are detailed in the Emergency Preparedness and Response Procedure. As a remote-first organisation, key provisions are: cyber incident response (Data Breach and Incident Response Procedure); remote worker safety via emergency contact register and lone worker check-in protocol; and escalation to emergency services (999/NHS 111) for personal medical emergencies. Emergency procedures are reviewed annually and following any activation.");

  sectionHeading(doc, "11. Incident Reporting, Investigation, and RIDDOR");
  body(doc, "All incidents, near-misses, dangerous occurrences, and work-related ill-health events must be reported to the Director within 24 hours. Investigation is conducted under the Incident and Near-Miss Reporting Procedure. RIDDOR notifications to the HSE are submitted without delay for: deaths and specified injuries; over-7-day incapacitation; dangerous occurrences; and diagnosed occupational diseases. All RIDDOR records are retained for a minimum of 10 years.");

  sectionHeading(doc, "12. Performance Monitoring");
  twoColTable(doc, ["Indicator", "Target"], [
    ["RIDDOR-reportable incidents", "Zero — reviewed at every management review"],
    ["Near-miss reports investigated on time", "100% within 10 working days"],
    ["DSE self-assessments current", "100% of qualifying staff — reviewed annually"],
    ["Risk assessments reviewed on schedule", "100% — tracked in Risk Register"],
    ["H&S training completion", "100% — tracked in Competence Register"],
    ["Contractor competence verified before engagement", "100% — tracked in Supplier Register"],
    ["Safety-critical content accuracy issues resolved", "Acknowledged ≤2 working days; resolved ≤5 working days"],
  ], 215);

  sectionHeading(doc, "13. Management Review");
  body(doc, "The Director conducts a formal management review of health and safety performance at least annually, covering: KPI performance; incident and near-miss trends; outstanding corrective actions; legislative changes; audit results; and worker feedback. Review outputs include updated objectives, policy changes, and resource decisions. Management review minutes are retained for a minimum of 7 years.");

  sectionHeading(doc, "14. Continual Improvement and Policy Review");
  body(doc, "This policy is reviewed annually as part of the management review, immediately following any significant incident, in response to legislative changes, and following feedback from workers or auditors. Previous versions are retained in the Document Register for a minimum of 7 years. Controlled under reference HSW-001.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Health_and_Safety_Policy.pdf", "Health, Safety & Wellbeing Policy");
}

// ─── 8. Quality Management System (ISO 9001 framework) ──────────────────────

async function genQuality(): Promise<void> {
  const doc = newDoc("Quality Management System — Policy and Framework");
  drawPageHeader(doc);
  docTitle(doc, "Quality Management System — Policy and Framework");

  sectionHeading(doc, "1. Quality Policy Statement");
  body(doc, "Overleaf Publishers Ltd is committed to designing, developing, and delivering the Chainsaw Courses eLearning platform to the highest standards of educational quality. The Director has ultimate responsibility for quality and commits the organisation to: consistently meeting applicable requirements (regulatory, accreditation, and learner); continually improving the effectiveness of the quality management system; and placing learner outcomes and safety at the centre of every product and process decision.\n\nThis document constitutes the organisation's quality manual. It sets out the scope of the QMS, the processes within it, and the policies and procedures governing each. All associated procedures and records are controlled under the Document Control and Records Management Procedure.");

  sectionHeading(doc, "2. Context of the Organisation");
  body(doc, "Internal context:");
  bullet(doc, [
    "A micro-enterprise led by a sole director with direct operational control of all QMS processes.",
    "All course content authored by or under direct supervision of a qualified chainsaw professional (NPTC certified).",
    "Digital-only delivery model; no physical training venues.",
    "Remote-first structure with reliance on specialist contractors for platform development and content review.",
  ]);
  body(doc, "\nExternal context:");
  bullet(doc, [
    "Regulatory: HSE/FISA guidance, UK Health and Safety legislation, IIRSM and RoSPA accreditation requirements.",
    "Market: growing demand for online pre-qualification chainsaw training; increasing regulatory scrutiny of eLearning safety courses.",
    "Technology: cloud platform dependency (Replit, Vimeo); evolving cybersecurity threat landscape.",
    "Competitive: established online health-and-safety training providers; NPTC assessment centres offering bundled theory content.",
  ]);
  body(doc, "\nInterested parties and their requirements:");
  twoColTable(doc, ["Interested Party", "Key Requirements"], [
    ["Learners", "Accurate, engaging, current content; reliable platform; fair assessment; responsive support"],
    ["IIRSM", "Compliance with eLearning course approval standards; documented QMS; regular review evidence"],
    ["RoSPA", "Rigorous content accuracy; qualified authorship; evidence of learner outcomes"],
    ["HSE / FISA", "Course content aligned with current guidance; no propagation of unsafe practices"],
    ["Forestry Commission / APHA", "Accurate biosecurity and plant health information in platform tools"],
    ["Payment processors", "Compliant terms, refund policy, and consumer rights adherence"],
    ["ICO / UK GDPR", "Lawful data processing; breach notification; data subject rights fulfilment"],
  ], 175);

  sectionHeading(doc, "3. Scope");
  body(doc, "The QMS applies to all activities of Overleaf Publishers Ltd affecting the quality of the Chainsaw Courses product and services: course content design, development, and review; assessment design and administration; platform operation and technical support; learner registration and progress management; supplier and contractor management; document and records management; and regulatory compliance. Exclusion: physical manufacturing operations are not applicable.");

  sectionHeading(doc, "4. Quality Objectives and KPIs");
  twoColTable(doc, ["Objective", "KPI / Target"], [
    ["Accurate, current course content", "Zero unresolved content accuracy complaints; annual review completed on schedule"],
    ["Reliable platform availability", "≥99% uptime 08:00–22:00 UK time"],
    ["Learner satisfaction", "≥85% satisfaction score on post-module feedback surveys"],
    ["Prompt learner support", "100% emails acknowledged ≤2 working days; resolved ≤5"],
    ["IIRSM course approval maintained", "Renewal submitted on time; zero unresolved compliance findings"],
    ["Fair and reliable assessment", "80% pass threshold; zero upheld appeals per year"],
    ["Internal audits completed", "100% of planned audits; all findings closed within agreed timescales"],
    ["Controlled document reviews", "100% of controlled documents reviewed within review cycle"],
    ["Supplier approval", "100% of new suppliers approved pre-engagement; annual review of key suppliers"],
  ], 230);

  sectionHeading(doc, "5. Process Approach");
  twoColTable(doc, ["Process", "Input → Output"], [
    ["Learner Enrolment", "Purchase → Active device-bonded learner record"],
    ["Course Delivery", "Learner access → Completion of modules, quizzes, and assessments"],
    ["Assessment Administration", "Quiz attempts → Results, progress records, and certification triggers"],
    ["Content Design and Development", "Subject matter + legislation → Published course module"],
    ["Content Review and Update", "Trigger event → Updated and version-controlled content"],
    ["Internal Verification", "Assessment materials → IV sign-off records"],
    ["Learner Support", "Learner query → Acknowledged and resolved query record"],
    ["Complaints and Appeals", "Complaint/appeal → Investigation outcome and corrective action"],
    ["Supplier Management", "Supplier need → Approved supplier register entry"],
    ["Internal Audit", "Audit schedule → Audit reports and corrective actions"],
    ["Management Review", "QMS performance data → Management review minutes and decisions"],
    ["Document Control", "Change request → Approved, distributed, and archived document"],
  ], 175);

  sectionHeading(doc, "6. Customer Focus and Satisfaction");
  body(doc, "Learner satisfaction is monitored through: in-platform post-module feedback surveys; complaints received via email; assessment appeals; and informal feedback. Data is collated quarterly, analysed for trends, and reported at each management review. Actions arising from feedback are logged in the quality improvement register and tracked to completion.");

  sectionHeading(doc, "7. Design and Development Controls");
  twoColTable(doc, ["Gate", "Criteria"], [
    ["G1 — Draft Complete", "All learning objectives addressed; cross-referenced against HSE/FISA guidance; SME review"],
    ["G2 — Assessment Alignment", "Quiz questions mapped to learning objectives; rationale documented; pass threshold validated"],
    ["G3 — Internal Verification", "IV assessor sign-off on content accuracy and assessment validity"],
    ["G4 — Director Approval", "Director review and sign-off; version number assigned; Document Register updated"],
    ["G5 — Platform Deployment", "Staging testing completed; functional testing passed; production deployment authorised"],
    ["G6 — Post-Publication Review", "30-day feedback review; issues logged as nonconformances"],
  ], 175);

  sectionHeading(doc, "8. Supplier and Externally Provided Services");
  twoColTable(doc, ["Supplier / Service", "Controls"], [
    ["Replit (cloud hosting)", "SLA monitoring; platform uptime tracking; business continuity coverage"],
    ["Vimeo Pro (video delivery)", "Domain-restricted embeds; CDN uptime monitoring; quality checks on upload"],
    ["Shopify / Stripe (payments)", "PCI-DSS compliance verification; tested checkout flows; refund policy compliance"],
    ["OpenAI via Replit (AI examiner)", "Topic restriction prompt engineering; fallback responses; content review"],
    ["Printers (physical manual)", "FSC certification verification; sample quality check; delivery timescales confirmed"],
    ["Contractors (content review)", "Qualification verification; written brief; review output sign-off; confidentiality agreement"],
  ], 175);

  sectionHeading(doc, "9. Nonconformance and Corrective Action");
  body(doc, "All nonconformances are: detected and recorded; contained where immediate action is possible; investigated using root cause analysis; subject to corrective action planning and implementation; verified for effectiveness; and closed with evidence. Trends are reviewed at each management review. Full detail in the Nonconformance and Corrective Action Procedure.");

  sectionHeading(doc, "10. Internal Audit");
  body(doc, "Internal audits of the QMS are scheduled and conducted at planned intervals (minimum annually) and ad hoc following significant events. Audits are planned, conducted, reported, and followed up under the Internal Audit Procedure. Results are reported to the management review. Where independence is required, an appropriately qualified external auditor may be commissioned.");

  sectionHeading(doc, "11. Management Review");
  body(doc, "The Director conducts a formal management review at least annually. Inputs include: KPI performance; nonconformance and corrective action status; internal audit results; learner feedback; supplier performance; risk register review; regulatory and accreditation changes; and improvement opportunities. Outputs include quality objectives, resource allocation, policy changes, and improvement actions. Records retained for a minimum of 7 years.");

  sectionHeading(doc, "12. Continual Improvement");
  body(doc, "Improvement opportunities are identified from: learner feedback; complaints and appeals; internal audits; management review outputs; nonconformance analysis; regulatory guidance; and staff/contractor suggestions. All improvement actions are logged in the quality improvement register with an owner, target date, and tracked to completion.");

  sectionHeading(doc, "13. Document Control");
  body(doc, "This document is controlled under reference QMS-001, reviewed annually as part of the management review, and approved by the Director prior to each issue. Previous versions are archived in the Document Register.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Quality_Management_Policy.pdf", "Quality Management System — Policy and Framework");
}

// ─── 9. Assessment Policy ────────────────────────────────────────────────────

async function genAssessment(): Promise<void> {
  const doc = newDoc("Assessment Policy");
  drawPageHeader(doc);
  docTitle(doc, "Assessment Policy");

  sectionHeading(doc, "1. Purpose");
  body(doc,
    "This policy sets out the principles, design criteria, and administration of assessments on the Chainsaw Courses eLearning platform. Assessment is central to the platform's purpose: to confirm that learners have achieved the theoretical knowledge required for safe chainsaw maintenance and cross-cutting before undertaking practical qualification training. This policy is aligned with IIRSM course approval standards."
  );

  sectionHeading(doc, "2. Assessment Design Principles");
  bullet(doc, [
    "Validity: Each assessment item tests knowledge directly related to a stated learning outcome.",
    "Reliability: Questions are unambiguous and produce consistent results across all learners.",
    "Fairness: Assessment content is free from bias and does not unfairly disadvantage any group of learners.",
    "Authenticity: Assessment items reflect realistic scenarios encountered in chainsaw operation and maintenance.",
    "Sufficiency: The volume and range of assessment items is sufficient to provide a reliable picture of each learner's knowledge.",
  ]);

  sectionHeading(doc, "3. Assessment Structure");
  twoColTable(doc, ["Assessment Type", "Detail"], [
    ["Module Quizzes (×7)", "Each of the 7 training modules concludes with a multiple-choice quiz. Quizzes are randomly drawn from a bank of questions to reduce repetition across attempts."],
    ["Mock Examination", "A 45-question randomised examination covering the full course content. Simulates the standard of knowledge required for NPTC practical assessment."],
    ["Pass Threshold", "80% correct answers required to pass each module quiz and the mock examination. This threshold reflects the safety-critical nature of chainsaw operation."],
    ["Retries", "Unlimited retries are permitted for module quizzes. The mock examination may be retaken after a cooling-off period."],
    ["Sequential Locking", "Module quizzes must be passed (≥80%) before the next module unlocks. Learners must also watch the full module video before the quiz becomes available."],
  ], 180);

  sectionHeading(doc, "4. Marking and Results");
  body(doc,
    "All assessments are marked automatically by the Platform. The marking algorithm applies a simple correct/incorrect binary to each multiple-choice question. The percentage score is calculated as (correct answers ÷ total questions) × 100. Results are recorded in the learner's progress record and are available at any time from the Training Dashboard."
  );

  sectionHeading(doc, "5. Assessment Security");
  body(doc,
    "Assessment items are drawn randomly from a question bank of sufficient size to reduce the likelihood of learners memorising answer sequences. The Platform's device-locking mechanism ensures all assessments are completed by the registered learner. Dynamic watermarking on video content and the digital waiver provide additional security and evidence of authentic engagement with the material."
  );

  sectionHeading(doc, "6. Malpractice");
  body(doc,
    "Any attempt to circumvent the assessment process — including sharing answers, using unauthorised aids, or allowing a third party to complete assessments on the learner's behalf — constitutes malpractice and will result in immediate suspension of access without refund. Please refer to the Malpractice & Maladministration Policy for full details."
  );

  sectionHeading(doc, "7. Adjustments to Assessment");
  body(doc,
    "Reasonable adjustments to the assessment process may be available for learners with a disability or learning difficulty. Please refer to the Reasonable Adjustments Policy. The 80% pass threshold cannot be adjusted as it is a fixed standard set within the IIRSM course approval framework."
  );

  sectionHeading(doc, "8. Review");
  body(doc,
    "Assessment items and marking criteria are reviewed annually as part of the Quality Management review cycle, and immediately following any material change in HSE/FISA guidance or IIRSM requirements."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Assessment_Policy.pdf", "Assessment Policy");
}

// ─── 10. Internal Verification Policy ───────────────────────────────────────

async function genInternalVerification(): Promise<void> {
  const doc = newDoc("Internal Verification Policy");
  drawPageHeader(doc);
  docTitle(doc, "Internal Verification Policy");

  sectionHeading(doc, "1. Purpose");
  body(doc,
    "Internal Verification (IV) is the process by which Overleaf Publishers Ltd ensures that assessment decisions, marking criteria, and course content are applied consistently, accurately, and in accordance with the published Assessment Policy and IIRSM course approval requirements. This policy sets out the IV process, responsibilities, and frequency."
  );

  sectionHeading(doc, "2. Scope");
  body(doc,
    "Internal verification covers the following areas:"
  );
  bullet(doc, [
    "Review of module quiz question banks for accuracy, currency, and alignment with learning outcomes.",
    "Review of mock examination questions for validity, reliability, and fairness.",
    "Sampling of learner assessment records to confirm consistency of automated marking.",
    "Review of course content against current HSE/FISA guidance and applicable legislation.",
    "Review of learner feedback data for evidence of systematic issues with assessment items.",
  ]);

  sectionHeading(doc, "3. Responsibilities");
  body(doc, "Internal Verifier (IV):");
  bullet(doc, [
    "Conducts scheduled and triggered verification activities.",
    "Documents all IV outcomes and corrective actions in the IV log.",
    "Reports significant findings to the Director without delay.",
    "Ensures corrective actions are implemented within the agreed timescale.",
  ]);
  body(doc, "\nDirector:");
  bullet(doc, [
    "Has overall responsibility for the IV process.",
    "Reviews IV outcomes as part of the quarterly quality review.",
    "Signs off all material changes to assessment content.",
  ]);

  sectionHeading(doc, "4. IV Schedule");
  twoColTable(doc, ["Activity", "Frequency"], [
    ["Full question bank review", "Annually (or following legislative/guidance change)"],
    ["Learner record sampling (10% minimum)", "Quarterly"],
    ["Course content alignment check", "Annually (or triggered by new HSE/FISA publication)"],
    ["Feedback data review", "Monthly"],
    ["Corrective action follow-up", "Within 20 working days of IV finding"],
  ], 230);

  sectionHeading(doc, "5. Documentation");
  body(doc,
    "All IV activities are recorded in the Internal Verification Log, which includes: the date of the activity, the scope of the review, findings, corrective actions required, person responsible, and completion date. The IV log is retained for 3 years and is available for inspection by IIRSM on request."
  );

  sectionHeading(doc, "6. Corrective Action");
  body(doc,
    "Where IV identifies an error or inconsistency in assessment content, the following steps will be taken:\n\n1. The affected content is immediately flagged for review and, where necessary, removed from active assessment.\n2. A corrected version is prepared and reviewed by the IV before reinstatement.\n3. Where the error may have materially affected learner outcomes, affected learners are notified and offered a re-assessment.\n4. The corrective action is documented in the IV log."
  );

  sectionHeading(doc, "7. Policy Review");
  body(doc,
    "This policy is reviewed annually as part of the Quality Management review cycle, or immediately following any change in IIRSM requirements or audit feedback."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Internal_Verification_Policy.pdf", "Internal Verification Policy");
}

// ─── 11. Malpractice & Maladministration Policy ──────────────────────────────

async function genMalpractice(): Promise<void> {
  const doc = newDoc("Malpractice & Maladministration Policy");
  drawPageHeader(doc);
  docTitle(doc, "Malpractice & Maladministration Policy");

  sectionHeading(doc, "1. Definitions");
  body(doc,
    "Malpractice means any deliberate act, default, or irregularity by a learner or member of staff that has, or could have, the effect of undermining the integrity of the assessment process. This includes, but is not limited to, cheating, plagiarism, impersonation, and sharing assessment answers.\n\nMaladministration means any non-deliberate act or omission that results in the assessment not being conducted in accordance with the published Assessment Policy, which has or could have the effect of affecting the validity, reliability, or fairness of the assessment."
  );

  sectionHeading(doc, "2. Examples of Learner Malpractice");
  bullet(doc, [
    "Allowing another person to complete assessments on the learner's behalf (impersonation).",
    "Sharing quiz questions, answers, or mock examination content with other learners.",
    "Using artificial intelligence or automated tools to answer quiz or examination questions.",
    "Attempting to bypass the Platform's device-locking mechanism.",
    "Providing false information at the point of activation or registration.",
    "Recording, distributing, or reproducing any assessment content.",
  ]);

  sectionHeading(doc, "3. Detection Mechanisms");
  body(doc,
    "The Platform incorporates multiple detection mechanisms to identify malpractice:"
  );
  bullet(doc, [
    "Device-locking: Each Activation Code is bonded to a single device. Any attempt to access the Platform from a different device will trigger a lockout.",
    "Dynamic watermarking: All video content carries a dynamic on-screen watermark displaying the learner's name and email address, repositioning every 60 seconds to prevent screen-recording obscuration.",
    "Assessment randomisation: Questions are drawn randomly from a large bank, reducing the utility of answer-sharing.",
    "Behavioural monitoring: Unusual patterns of assessment completion (e.g., all questions answered immediately with 100% accuracy) may be flagged for manual review.",
  ]);

  sectionHeading(doc, "4. Reporting Malpractice or Maladministration");
  body(doc,
    "Any member of staff, contractor, or learner who suspects malpractice or maladministration should report it promptly to info@chainsawcourses.com. Reports will be treated with confidentiality and investigated promptly. False or malicious reports may themselves constitute malpractice."
  );

  sectionHeading(doc, "5. Investigation Procedure");
  body(doc,
    "On receipt of a malpractice or maladministration report, the following steps will be taken:\n\n1. The Director is notified immediately.\n2. Platform access for the learner in question may be suspended pending investigation.\n3. Evidence is gathered and reviewed within 10 working days.\n4. The learner is notified of the allegation and given the opportunity to respond.\n5. A decision is made within 20 working days and communicated to the learner in writing.\n6. Where malpractice is confirmed, sanctions are applied."
  );

  sectionHeading(doc, "6. Sanctions");
  twoColTable(doc, ["Finding", "Sanction"], [
    ["Suspected malpractice (unconfirmed)", "Temporary suspension of access pending investigation"],
    ["Confirmed learner malpractice", "Permanent revocation of access without refund; notification to IIRSM where appropriate"],
    ["Staff/contractor maladministration", "Disciplinary action; corrective assessment where learners affected"],
    ["Suspected impersonation", "Referral to relevant authorities if fraud is suspected"],
  ], 210);

  sectionHeading(doc, "7. Appeals");
  body(doc,
    "A learner who believes a malpractice finding is unfair may appeal in accordance with the Appeals Policy. The appeal must be submitted within 10 working days of the finding being communicated."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Malpractice_and_Maladministration_Policy.pdf", "Malpractice & Maladministration Policy");
}

// ─── 12. Equality, Diversity & Inclusion Policy ───────────────────────────────

async function genEDI(): Promise<void> {
  const doc = newDoc("Equality, Diversity & Inclusion Policy");
  drawPageHeader(doc);
  docTitle(doc, "Equality, Diversity & Inclusion Policy");

  sectionHeading(doc, "1. Statement of Commitment");
  body(doc,
    "Overleaf Publishers Ltd is committed to promoting equality of opportunity, celebrating diversity, and fostering a culture of inclusion in all aspects of our operations. We will not tolerate discrimination, harassment, or victimisation in any form. This commitment applies to all learners, staff, contractors, and visitors associated with the Chainsaw Courses platform."
  );

  sectionHeading(doc, "2. Legal Framework");
  body(doc,
    "This policy is informed by the Equality Act 2010, which prohibits discrimination based on the following protected characteristics:"
  );
  bullet(doc, [
    "Age", "Disability", "Gender reassignment", "Marriage and civil partnership",
    "Pregnancy and maternity", "Race", "Religion or belief", "Sex", "Sexual orientation",
  ]);
  body(doc,
    "\nOverleaf Publishers Ltd will not discriminate against any learner or member of staff on the basis of any of the above protected characteristics."
  );

  sectionHeading(doc, "3. Our Commitments to Learners");
  bullet(doc, [
    "Course content will be reviewed regularly to ensure it is free from bias, stereotyping, and discriminatory language.",
    "Assessment materials will be designed to ensure that no group of learners is unfairly disadvantaged.",
    "Reasonable adjustments will be made for learners with disabilities or learning difficulties — see the Reasonable Adjustments Policy.",
    "All learners will be treated with dignity and respect.",
    "Complaints relating to discrimination or harassment will be investigated promptly and seriously.",
  ]);

  sectionHeading(doc, "4. Accessibility");
  body(doc,
    "We are committed to making the Platform as accessible as possible to all learners. Current accessibility features include: high-contrast design options, support for browser-level text scaling, compatibility with screen readers, keyboard navigation for all core platform functions, and closed captions on video content where available. We welcome feedback on accessibility barriers and will endeavour to address them promptly."
  );

  sectionHeading(doc, "5. Diversity in Course Content");
  body(doc,
    "The chainsaw and arboricultural sector has historically had low diversity in terms of gender and ethnicity. Chainsaw Courses is committed to producing course materials that actively reflect and support the diversification of the sector. This includes the use of inclusive language, diverse imagery where applicable, and content that acknowledges and addresses the specific challenges faced by underrepresented groups in the industry."
  );

  sectionHeading(doc, "6. Monitoring and Reporting");
  body(doc,
    "Overleaf Publishers Ltd will monitor learner feedback and complaints data for evidence of discrimination or accessibility barriers, and will report on EDI performance as part of the annual quality management review. Any incident of discrimination, harassment, or victimisation — whether involving a learner or member of staff — will be investigated and addressed in accordance with our Complaints Procedure."
  );

  sectionHeading(doc, "7. Policy Review");
  body(doc,
    "This policy will be reviewed annually or following any relevant change in legislation. All staff and contractors are required to familiarise themselves with this policy and adhere to its principles."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Equality_Diversity_Inclusion_Policy.pdf", "Equality, Diversity & Inclusion Policy");
}

// ─── 13. Safeguarding Policy ─────────────────────────────────────────────────

async function genSafeguarding(): Promise<void> {
  const doc = newDoc("Safeguarding Policy");
  drawPageHeader(doc);
  docTitle(doc, "Safeguarding Policy");

  sectionHeading(doc, "1. Statement of Commitment");
  body(doc,
    "Overleaf Publishers Ltd is committed to safeguarding the welfare of all learners who access the Chainsaw Courses platform. Although this is an adult vocational platform, we acknowledge that adult learners may nonetheless be vulnerable in certain circumstances, and we take our duty of care seriously. We will not knowingly permit access to minors and will take steps to protect the welfare of all users."
  );

  sectionHeading(doc, "2. Scope");
  body(doc,
    "This policy applies to all persons who access the Chainsaw Courses platform, all staff and contractors who develop or deliver course content, and all third parties who interact with learners on behalf of Overleaf Publishers Ltd. This is a platform for adult professionals; access by persons under the age of 18 is not permitted."
  );

  sectionHeading(doc, "3. Prevention of Under-18 Access");
  body(doc,
    "The following measures are in place to prevent access by persons under the age of 18:"
  );
  bullet(doc, [
    "Activation Codes are issued only upon purchase through our commercial platform, which requires the purchaser to confirm they are aged 18 or over.",
    "The digital waiver signed at the point of first access includes a declaration that the learner is aged 18 or over.",
    "The Platform's terms of service explicitly state that use is restricted to adults.",
  ]);
  body(doc,
    "If we become aware or have reasonable grounds to believe that a person under the age of 18 has accessed the Platform, we will immediately revoke their access and investigate how access was gained."
  );

  sectionHeading(doc, "4. Designated Safeguarding Contact");
  body(doc,
    "The Designated Safeguarding Contact (DSC) for Overleaf Publishers Ltd is the Director. Any safeguarding concern should be reported immediately to info@chainsawcourses.com, marked 'SAFEGUARDING — URGENT'.\n\nIn an emergency or where there is immediate risk of harm, contact emergency services (999) before contacting the DSC."
  );

  sectionHeading(doc, "5. Adult Safeguarding");
  body(doc,
    "Overleaf Publishers Ltd recognises that adult learners may be at risk of harm from others or from themselves. Any member of staff or contractor who becomes aware of a safeguarding concern involving an adult learner must:"
  );
  bullet(doc, [
    "Report the concern to the DSC immediately.",
    "Not attempt to investigate the concern themselves.",
    "Document what they observed or were told, using the learner's own words where possible.",
    "Maintain confidentiality — share information only with those who need to know.",
  ]);

  sectionHeading(doc, "6. Course Content and Safeguarding");
  body(doc,
    "Course content is reviewed to ensure it does not include material that could be used to cause harm. All safety-critical content is presented in a responsible and educational manner. The AI mock-test feature is restricted to chainsaw safety topics only and is not capable of providing advice that could be used to harm others."
  );

  sectionHeading(doc, "7. Policy Review");
  body(doc,
    "This safeguarding policy is reviewed annually or immediately following any safeguarding incident or change in relevant legislation or guidance. All staff and contractors are required to complete safeguarding awareness training appropriate to their role."
  );

  body(doc, "\nSafeguarding DSC: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Emergency: 999");
  await save(doc, "Safeguarding_Policy.pdf", "Safeguarding Policy");
}

// ─── 14. Environmental & Sustainability Policy ───────────────────────────────

async function genEnvironmental(): Promise<void> {
  const doc = newDoc("Environmental & Sustainability Policy");
  drawPageHeader(doc);
  docTitle(doc, "Environmental & Sustainability Policy");

  sectionHeading(doc, "1. Statement of Commitment");
  body(doc,
    "Overleaf Publishers Ltd is committed to operating responsibly and sustainably, and to minimising our environmental impact. We recognise that as a digital-first training provider, our operations have a substantially lower carbon footprint than traditional classroom-based training. We are committed to building on this advantage and continuously improving our environmental performance."
  );

  sectionHeading(doc, "2. Digital-First Delivery");
  body(doc,
    "The Chainsaw Courses platform is delivered entirely online. This eliminates the need for learners to travel to a training venue for the theoretical component of their chainsaw education, significantly reducing associated carbon emissions. Key environmental benefits of our digital-first model include:"
  );
  bullet(doc, [
    "No venue energy consumption for theoretical training delivery.",
    "No learner travel emissions for theoretical training.",
    "No physical printing of course materials (other than the optional companion manual).",
    "Server infrastructure hosted on Replit's cloud platform, which operates energy-efficient data centres.",
    "Video content delivered via Vimeo's CDN, which continuously invests in energy efficiency.",
  ]);

  sectionHeading(doc, "3. Physical Manual — Print Options");
  body(doc,
    "Where the Overleaf Chainsaw Manual is supplied as a physical printed book, we are committed to the following:"
  );
  bullet(doc, [
    "The Manual is printed by UK-based printers using FSC-certified or recycled paper stock wherever possible.",
    "Print runs are managed to minimise waste — digital-only access is offered to learners who do not require a physical copy.",
    "Packaging for posted manuals is kept to a minimum. We endeavour to use recycled and recyclable packaging materials wherever possible, including recycled cardboard mailers and paper-based void fill in place of single-use plastics.",
  ]);

  sectionHeading(doc, "4. Chainsaw Operations and the Environment");
  body(doc,
    "The Chainsaw Courses curriculum explicitly covers environmental and biosecurity responsibilities for chainsaw operators. This includes:"
  );
  bullet(doc, [
    "Biosecurity procedures to prevent the spread of tree pests and diseases between sites (covered in the Platform's Biosecurity & Hazard Map tool).",
    "Correct disposal of chainsaw bar oil, fuel, and chain bar oil to prevent ground and water contamination.",
    "Recognition of statutory tree health containment zones (ash dieback, oak processionary moth, etc.).",
    "Responsible timber processing and handling to minimise waste.",
  ]);

  sectionHeading(doc, "5. Waste and Resource Management");
  body(doc,
    "As a digital business, our physical waste is minimal. We are committed to:"
  );
  bullet(doc, [
    "Minimising single-use plastic and paper in all business operations.",
    "Recycling all office waste in accordance with local authority requirements.",
    "Choosing suppliers and service providers who demonstrate a commitment to environmental responsibility.",
  ]);

  sectionHeading(doc, "6. Monitoring and Review");
  body(doc,
    "Overleaf Publishers Ltd will review our environmental performance annually as part of our Quality Management review. We will consider whether additional environmental commitments are appropriate as the business grows and as environmental best practice evolves. Feedback on our environmental performance is welcome at info@chainsawcourses.com."
  );

  sectionHeading(doc, "7. Policy Review");
  body(doc,
    "This policy will be reviewed annually. The version number and review date are updated at each review cycle."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Environmental_and_Sustainability_Policy.pdf", "Environmental & Sustainability Policy");
}

// ─── 15. IIRSM Submission Brief ──────────────────────────────────────────────

async function genIIRSMBrief(): Promise<void> {
  const doc = newDoc("IIRSM Course Approval Submission — Chainsaw Courses");
  drawPageHeader(doc);

  // Cover block
  doc
    .fontSize(14)
    .fillColor(DARK)
    .font("Helvetica-Bold")
    .text("IIRSM ELEARNING COURSE APPROVAL SUBMISSION");
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor(MID)
    .font("Helvetica")
    .text("International Institute of Risk and Safety Management  ·  eLearning Course Approval Scheme");
  doc.moveDown(0.1);
  doc
    .moveTo(60, doc.y)
    .lineTo(535, doc.y)
    .strokeColor(ORANGE)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);

  // Section 1 — Course Overview
  sectionHeading(doc, "Section 1 | Course Overview");
  infoRow(doc, "Course Title", "Chainsaw Maintenance & Cross Cutting — Vocational Safety Theory");
  infoRow(doc, "Awarding / Approval Body", "IIRSM (International Institute of Risk and Safety Management)");
  infoRow(doc, "Provider", "Overleaf Publishers Ltd  ·  chainsawcourses.com");
  infoRow(doc, "Qualification Alignment", "NPTC/City & Guilds Unit 0039-20 (Chainsaw Maintenance & Cross Cutting) — theoretical underpinning");
  infoRow(doc, "Level", "Level 2 (equivalent) — vocational knowledge and understanding");
  infoRow(doc, "Delivery Mode", "Online eLearning — Progressive Web Application (PWA), device-locked, video-streamed");
  infoRow(doc, "Duration", "Approximately 6–8 hours of guided learning across 7 sequential modules");
  infoRow(doc, "Assessment", "7 module quizzes (80% pass threshold each) + 45-question mock examination");
  infoRow(doc, "Target Learner", "Arboricultural and forestry professionals seeking NPTC theoretical preparation; landowners; groundworkers");
  infoRow(doc, "Cost", "£198 (includes digital platform access and optional Overleaf Chainsaw Manual)");
  infoRow(doc, "Version", "1.4  ·  July 2026");
  doc.moveDown(0.5);

  // Section 2 — Author / Instructor Credentials
  sectionHeading(doc, "Section 2 | Author & Instructor Credentials");
  body(doc,
    "The course has been authored, developed, and is delivered under the supervision of a practising chainsaw professional holding the following NPTC City & Guilds certificates of competence. These qualifications provide the practical authority and subject-matter expertise underpinning all course content, assessment items, and the companion Overleaf Chainsaw Manual."
  );
  doc.moveDown(0.4);

  twoColTable(
    doc,
    ["NPTC Unit", "Title"],
    [
      ["0039-20", "Chainsaw Maintenance and Cross Cutting"],
      ["0039-21", "Fell and Process Small Trees with a Chainsaw"],
      ["0039-22", "Fell Trees with a Chainsaw"],
      ["0039-23", "Fell Trees with a Chainsaw (Large Trees)"],
      ["0039-24", "Chainsaw Cross Cutting and Log Making"],
      ["0039-31", "Operate a Chainsaw from a Rope and Harness"],
      ["0039-32", "Fell Trees with a Chainsaw (in Close Proximity to Objects of High Value)"],
      ["0039-33", "Convert Felled Trees with a Chainsaw"],
      ["0039-37", "Operate a Chainsaw from an Aerial Work Platform"],
      ["0039-38", "Emergency Dismantle Trees with a Chainsaw"],
    ],
    110
  );

  infoRow(doc, "CPD Status", "Author holds current CPD membership with IIRSM and engages in ongoing professional development in chainsaw safety and vocational eLearning design");
  infoRow(doc, "Platform Development", "Full-stack eLearning platform designed, developed, and operated by the author — Progressive Web Application with device-locked access, Vimeo video streaming, and automated assessment");
  infoRow(doc, "Reference Text", "Course content cross-referenced against the Overleaf Chainsaw Manual (published reference text), current HSE/FISA guidance series, and applicable UK legislation");
  doc.moveDown(0.5);

  // Section 3 — Learning Outcomes
  doc.addPage();
  drawPageHeader(doc);
  sectionHeading(doc, "Section 3 | Learning Outcomes & Assessment Criteria");
  body(doc,
    "The course is structured across seven sequential video modules, each mapped to a discrete learning outcome. Learners must complete each module video in full and achieve 80% or higher on the associated module quiz before the next module unlocks. A final summative examination of 45 randomised questions is required for certification."
  );
  doc.moveDown(0.4);

  twoColTable(
    doc,
    ["Module", "Learning Outcome"],
    [
      ["Equipment List", "Identify and describe the personal protective equipment (PPE) and tools required for safe chainsaw operation, including chainsaw classification, bar length selection, and EN protection standards."],
      ["PPE & First Aid", "Demonstrate knowledge of appropriate PPE standards and first-aid procedures relevant to chainsaw injury, including tourniquet application, wound management, and emergency services protocol."],
      ["5 Steps to Risk Assessment", "Apply the HSE five-step risk assessment framework to chainsaw operations, identifying hazards, evaluating risk levels, and selecting appropriate control measures."],
      ["Hazards & Risks", "Identify site-specific hazards and evaluate risk levels using likelihood and severity matrices, producing a documented dynamic risk assessment suitable for professional operational use."],
      ["Emergency Planning Information", "Develop and communicate an emergency action plan for chainsaw operations on site, including site access for emergency services, nearest medical facility, and first aider identification."],
      ["Law & Legislation", "Describe the legal framework governing chainsaw use including PUWER 1998, MHSWR 1999, Control of Noise at Work Regulations 2005, Control of Vibration at Work Regulations 2005, and HSE guidance."],
      ["Chainsaw Safety Features", "Identify and explain the function of all primary chainsaw safety features and their activation mechanisms, including chain brake, hand guard, chain catcher, anti-vibration system, and throttle interlock."],
    ],
    115
  );

  doc.moveDown(0.5);

  // Section 4 — Course Content Overview
  sectionHeading(doc, "Section 4 | Course Content — Detailed Syllabus");

  twoColTable(
    doc,
    ["Topic Area", "Content Covered"],
    [
      ["Chainsaw anatomy & classification", "Bar length, CC rating, chain pitch and gauge, drive sprocket, guide bar lubrication system, oil pump, chain tensioner, safety features (chain brake, hand guard, chain catcher, anti-vibration, throttle interlock)"],
      ["Personal Protective Equipment", "EN 381 chainsaw trousers (Classes 1–3), chainsaw boots (EN ISO 20345 / EN 381-3), gloves (EN 381-7), forestry helmet (EN 397 + EN 352), eye protection (EN 166), hearing protection (EN 352)"],
      ["First Aid — chainsaw specific", "Wound classification; application of tourniquets and haemostatic dressings; shock management; calling emergency services; communicating site location (OS National Grid reference, What3Words)"],
      ["Risk Assessment (5 steps)", "Hazard identification; who might be harmed and how; risk evaluation (likelihood × severity); control measures (hierarchy of controls); review and monitoring"],
      ["Dynamic Risk Assessment", "Site-specific hazard assessment; site description; emergency planning; exclusion zones; lone-working protocols; likelihood and severity rating (1–5 matrix) for chainsaw-specific hazards"],
      ["Emergency Planning", "Site access for emergency vehicles; nearest A&E/trauma centre; nearest AED; first aider on site; emergency contact protocol; communication in areas of poor signal"],
      ["UK Legislation", "HSW Act 1974; PUWER 1998 (Reg. 9 — training requirement); MHSWR 1999 (risk assessment); PPE Regulations 2022; Control of Noise at Work Regulations 2005 (EAV/ELV); Control of Vibration at Work Regulations 2005 (HAV); RIDDOR 2013; LOLER 1998"],
      ["Biosecurity", "Oak Processionary Moth (OPM); ash dieback (Hymenoscyphus fraxineus); spruce bark beetle; sudden oak death; equipment decontamination between sites; reporting obligations under Plant Health (Forestry) Order 2005"],
      ["Chain maintenance", "Chain sharpening angles (top-plate, side-plate, raker depth); file sizes by pitch; chain types (full-chisel, semi-chisel, low-profile); chain identification by pitch, gauge, and drive-link count"],
      ["Safe systems of work", "Pre-start inspection checklist; TILE (Task, Individual, Load, Environment) assessment; exclusion zones (2× tree height); working alone policy; fatigue management; refuelling procedure"],
    ],
    130
  );

  // Section 5 — Assessment Methodology
  doc.addPage();
  drawPageHeader(doc);
  sectionHeading(doc, "Section 5 | Assessment Methodology");

  body(doc,
    "Assessment on the Chainsaw Courses platform is designed to be valid, reliable, fair, and sufficient to confirm theoretical competence at the level required to support NPTC 0039-20 practical assessment preparation."
  );
  doc.moveDown(0.3);

  twoColTable(
    doc,
    ["Assessment Element", "Specification"],
    [
      ["Assessment format", "Multiple-choice questions (MCQ) with four answer options per question"],
      ["Question bank size", "Minimum 10 questions per module (70+ module questions total); 45-question mock examination drawn from full bank"],
      ["Randomisation", "Questions and answer option order randomised on each attempt to prevent memorisation of answer sequences"],
      ["Pass threshold", "80% correct answers required for each module quiz and for the mock examination"],
      ["Sequential gating", "Each module quiz must be passed (≥80%) before the subsequent module video unlocks. Module video must be watched in full before the quiz is accessible"],
      ["Retries", "Unlimited retries permitted for module quizzes. Mock examination may be retaken after a 24-hour cooling-off period"],
      ["Results recording", "All quiz and examination results are recorded automatically to the learner's progress record with timestamp; accessible at any time from the Training Dashboard"],
      ["Anti-malpractice", "Device-locking (one device per Activation Code); dynamic video watermarking (learner name + email, repositioning every 60 seconds); behavioural review for anomalous completion patterns"],
      ["Feedback", "Immediate right/wrong feedback provided on each question after module quiz submission; mock examination feedback provided on completion"],
    ],
    175
  );

  sectionHeading(doc, "Section 6 | Quality Assurance and Compliance");

  twoColTable(
    doc,
    ["QA Element", "Detail"],
    [
      ["Content review cycle", "Full content audit conducted annually against current HSE/FISA guidance and UK legislation; triggered reviews within 30 days of any new publication or legislative change"],
      ["Internal verification", "All assessment items reviewed by Internal Verifier for accuracy, currency, validity, and alignment with learning outcomes — see Internal Verification Policy"],
      ["Learner feedback", "Module feedback ratings collected at end of each module; reviewed monthly; aggregate data reported to IIRSM annually"],
      ["Complaints and appeals", "Formal complaints and appeals procedures in place — see Complaints Procedure and Appeals Policy"],
      ["Data protection", "UK GDPR compliant; ICO registered; learner data retained for 3 years — see Data Protection Policy"],
      ["Accessibility", "Platform designed for WCAG 2.1 AA compatibility; reasonable adjustments available on request — see Reasonable Adjustments Policy"],
      ["Safeguarding", "Adult-only platform (18+); age verification at purchase and activation; designated safeguarding contact in post — see Safeguarding Policy"],
      ["Policies published", "All governance policies available to learners via the in-platform Documents Library"],
    ],
    175
  );

  sectionHeading(doc, "Section 7 | Technical Platform Specification");

  twoColTable(
    doc,
    ["Component", "Specification"],
    [
      ["Platform type", "Progressive Web Application (PWA) — accessible via any modern browser; no app store installation required"],
      ["Access control", "Unique Activation Code per learner; bonded to single device via UUID stored in browser localStorage"],
      ["Video delivery", "Vimeo Pro — domain-restricted embed; dynamic on-screen watermark overlay (learner name + email)"],
      ["Database", "PostgreSQL — learner progress, quiz results, waiver, inspection, and risk assessment records stored securely"],
      ["Authentication", "Token-based session management; activation code + device ID + user ID triple validation on all API calls"],
      ["Infrastructure", "Hosted on Replit cloud infrastructure; HTTPS throughout; auto-scaling; UK/EU data residency"],
      ["Assessment engine", "Server-side randomised question selection from PostgreSQL question bank; automated marking and results recording"],
      ["AI mock examiner", "OpenAI GPT-4o via Replit AI proxy; restricted to chainsaw safety topics only; falls back gracefully if AI is unavailable"],
      ["PDF generation", "Server-generated signed waivers, inspection reports, risk assessments, and completion certificates — consistent orange branding"],
      ["Accessibility features", "Keyboard navigation; screen-reader compatible markup; responsive design (mobile, tablet, desktop)"],
    ],
    175
  );

  sectionHeading(doc, "Section 8 | Declaration");
  body(doc,
    "I confirm that the information contained in this submission is accurate and complete to the best of my knowledge. The course content has been developed with reference to current HSE and FISA guidance, applicable UK legislation, and the practical experience gained through the NPTC qualifications listed in Section 2. I understand that IIRSM may request further information or a demonstration of the platform as part of the approval process."
  );
  doc.moveDown(0.8);
  body(doc, "Submitted by:   Overleaf Publishers Ltd");
  body(doc, "Website:          chainsawcourses.com");
  body(doc, "Contact:           info@chainsawcourses.com");
  body(doc, "Date:               July 2026");
  body(doc, "Version:          1.4");

  await save(doc, "IIRSM_Submission_Brief.pdf", "IIRSM Course Approval Submission — Chainsaw Courses", "Version 1.4");
}

// ─── 16. Document Control and Records Management ─────────────────────────────

async function genDocumentControl(): Promise<void> {
  const doc = newDoc("Document Control and Records Management Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Document Control and Records Management Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure establishes the controls required to ensure that all documents and records produced, received, or maintained by Overleaf Publishers Ltd are: created and approved by authorised personnel; clearly identified and version-controlled; available at the point of use; protected from unintended alteration or unauthorised access; and retained and disposed of in accordance with applicable legal and regulatory requirements.\n\nScope: all controlled documents including policies, procedures, work instructions, forms, templates, and externally generated regulatory documents referenced in the QMS; and all records generated as evidence of conformance or operational performance. Document reference: QMS-001.");

  sectionHeading(doc, "2. Document Identification and Reference Numbering");
  twoColTable(doc, ["Document Type", "Reference Prefix"], [
    ["Quality Management policies and procedures", "QMS-NNN"],
    ["Health, safety, and wellbeing documents", "HSW-NNN"],
    ["Information security documents", "ISP-NNN"],
    ["Assessment and curriculum documents", "ASS-NNN"],
    ["Human resources and training documents", "HRT-NNN"],
    ["Environmental and sustainability documents", "ENV-NNN"],
    ["Legal and commercial documents", "LEG-NNN"],
    ["Operational forms and templates", "FRM-NNN"],
  ], 230);
  body(doc, "\nEach document title page and footer carries: document reference, title, version number, effective date, review date, and approving authority.");

  sectionHeading(doc, "3. Document Lifecycle — Creation to Approval");
  twoColTable(doc, ["Stage", "Action and Responsibility"], [
    ["Draft", "Author prepares document using the standard template. Draft marked 'DRAFT — Not for Use'."],
    ["Review", "Author circulates to relevant stakeholders for comment. Comments collated and addressed."],
    ["Approval", "Director reviews final draft and approves for issue. Signed approval record filed."],
    ["Issue", "Approved document issued to recipients. Document Register updated. Previous version superseded."],
    ["Communication", "Recipients notified. Key changes summarised in covering note for revisions."],
    ["Scheduled Review", "Document reviewed on scheduled date or following a trigger event."],
    ["Retirement", "Documents no longer required removed from active use and archived. Register updated."],
  ], 100);

  sectionHeading(doc, "4. Master Document Register");
  body(doc, "The Master Document Register is maintained by the Director and contains, for each controlled document: reference number; title; current version number; effective date; scheduled review date; document owner; physical/digital location; and distribution list. The Register is reviewed monthly for upcoming review dates.");

  sectionHeading(doc, "5. Version Control");
  body(doc, "Version numbering follows Major.Minor convention (e.g. 1.0, 1.1, 2.0).");
  bullet(doc, [
    "Major revision (X.0): fundamental change to policy intent, scope, or structure — full approval cycle required.",
    "Minor revision (X.Y): typographical correction or addition of clarifying detail — Director sign-off required.",
    "Draft documents numbered 0.1, 0.2 etc. — not issued for operational use.",
  ]);

  sectionHeading(doc, "6. Review Triggers and Schedule");
  twoColTable(doc, ["Document Category", "Standard Review Cycle"], [
    ["Policies (all categories)", "Annual"],
    ["Operational procedures", "Annual or following a significant process change"],
    ["Forms and templates", "Biennial or following a procedural change"],
    ["Externally generated regulatory documents", "On receipt of new edition or notification of amendment"],
  ], 220);
  body(doc, "\nAdditional review triggers: regulatory or legislative change; audit finding; management review decision; incident/near-miss; stakeholder feedback identifying a discrepancy.");

  sectionHeading(doc, "7. Control of Externally Generated Documents");
  body(doc, "Externally generated documents (HSE guidance, IIRSM/RoSPA standards, legislation) forming part of the QMS reference framework are: listed in the Document Register with source, version date, and verification date; checked for updates at least annually; and replaced in the Register with the latest version upon update.");

  sectionHeading(doc, "8. Records Retention Schedule");
  twoColTable(doc, ["Record Type", "Minimum Retention"], [
    ["Learner registration, progress, and assessment records", "7 years from course completion"],
    ["Digital waiver signatures", "7 years from signature date"],
    ["Complaint and appeal records", "7 years"],
    ["Incident reports and RIDDOR records", "10 years (RIDDOR requirement for dangerous occurrences/disease)"],
    ["Internal audit reports and corrective actions", "7 years"],
    ["Management review minutes", "7 years"],
    ["Supplier evaluation records", "Duration of engagement + 3 years"],
    ["Training and competence records", "Duration of engagement + 7 years"],
    ["Data breach records", "7 years from discovery (ICO requirement)"],
    ["Contract and commercial records", "7 years from contract end (Companies Act requirement)"],
    ["Health and safety risk assessments", "Current version + previous 2 versions retained"],
    ["Financial and VAT records", "7 years (HMRC requirement)"],
  ], 230);

  sectionHeading(doc, "9. Storage and Access");
  body(doc, "Documents and records are stored in the organisation's designated secure digital storage system (cloud-based, access-controlled per the Access Control Policy). Backup copies are maintained under the Business Continuity and Disaster Recovery Plan. Physical documents are stored in a locked cabinet. Records containing personal data are managed in accordance with the Data Protection Policy.");

  sectionHeading(doc, "10. Secure Disposal");
  body(doc, "At the end of the retention period, records are reviewed for any ongoing legal or regulatory hold requirement. In the absence of a hold: digital records are securely deleted (cryptographically erased or overwritten); physical records are cross-shredded. A destruction certificate is filed in the Document Register. Records containing personal data are disposed of in accordance with UK GDPR requirements.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Document_Control_and_Records_Management.pdf", "Document Control and Records Management Procedure");
}

// ─── 17. Management Review Procedure ─────────────────────────────────────────

async function genManagementReview(): Promise<void> {
  const doc = newDoc("Management Review Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Management Review Procedure");

  sectionHeading(doc, "1. Purpose");
  body(doc, "This procedure ensures that Overleaf Publishers Ltd conducts regular, systematic reviews of the management system to confirm its continuing suitability, adequacy, and effectiveness. Management reviews provide the forum for top management to evaluate performance, make strategic decisions, and set direction for continual improvement across quality, health and safety, and information security. Document reference: QMS-002.");

  sectionHeading(doc, "2. Frequency");
  body(doc, "A formal management review is conducted at least annually by the Director. Additional ad hoc reviews are triggered by: a significant incident or near-miss; a major regulatory or legislative change; a significant nonconformance or pattern of nonconformances; external audit findings requiring strategic response; or a significant change in the organisation's activities, context, or objectives.");

  sectionHeading(doc, "3. Inputs to Management Review");
  body(doc, "The following inputs are collated and presented at each management review:");
  twoColTable(doc, ["Input", "Source"], [
    ["Status of previous management review actions", "Action log from previous review"],
    ["Changes in external and internal context and interested parties", "Director assessment; regulatory/guidance update log"],
    ["Performance against quality, H&S, and information security objectives and KPIs", "KPI dashboard; monitoring records"],
    ["Learner feedback and satisfaction data", "Feedback survey results; complaint and appeal log"],
    ["Nonconformance and corrective action status", "Nonconformance register"],
    ["Internal and external audit results", "Audit reports"],
    ["Supplier and contractor performance", "Supplier evaluation records"],
    ["Incidents, near-misses, and RIDDOR reports", "Incident register"],
    ["Data breach and information security incident log", "Security incident register"],
    ["Regulatory and accreditation compliance status (IIRSM, RoSPA, ICO, HSE)", "Compliance monitoring records"],
    ["Opportunities for improvement and innovation", "Improvement log; staff/contractor suggestions"],
    ["Resources adequacy — financial, human, technological", "Director assessment"],
  ], 200);

  sectionHeading(doc, "4. Management Review Process");
  bullet(doc, [
    "Director collates all inputs in the week prior to the scheduled review meeting.",
    "Review meeting conducted (may be solo for sole-director organisations; external advisers or contractors may be invited to contribute).",
    "Each input is reviewed and discussed; performance against objectives assessed.",
    "Decisions and actions recorded in the Management Review Minutes template.",
    "Actions assigned with named owner, target date, and success criterion.",
    "Minutes approved and filed in the Document Register within 5 working days of the review.",
    "Actions tracked to completion at subsequent reviews or earlier if urgency requires.",
  ]);

  sectionHeading(doc, "5. Outputs from Management Review");
  body(doc, "Outputs include formal decisions and actions on:");
  bullet(doc, [
    "Opportunities for improvement to the management system and its processes.",
    "Any need for changes to the management system policies, objectives, or procedures.",
    "Resource requirements — additional personnel, training, technology, or financial allocation.",
    "Updates to risk assessments, risk registers, or control measures.",
    "Any changes to interested party requirements needing a management system response.",
    "Opportunities for improvement to the Chainsaw Courses product, platform, or learner experience.",
  ]);

  sectionHeading(doc, "6. Records");
  body(doc, "Management review minutes are a controlled record, retained for a minimum of 7 years in the Document Register. They are referenced at the subsequent management review to confirm action completion and continuity of review.");

  sectionHeading(doc, "7. Procedure Review");
  body(doc, "This procedure is reviewed annually as part of the management review process. Controlled under reference QMS-002.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Management_Review_Procedure.pdf", "Management Review Procedure");
}

// ─── 18. Nonconformance and Corrective Action Procedure ──────────────────────

async function genNonconformance(): Promise<void> {
  const doc = newDoc("Nonconformance and Corrective Action Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Nonconformance and Corrective Action Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure establishes how Overleaf Publishers Ltd identifies, controls, investigates, and permanently resolves nonconformances — instances where a product, service, or process fails to meet a specified requirement. It applies to nonconformances identified through internal audits, learner feedback, complaints, appeals, incident investigations, management reviews, or day-to-day operation. Document reference: QMS-003.");

  sectionHeading(doc, "2. Definition of Nonconformance");
  body(doc, "A nonconformance (NC) is any deviation from a specified requirement. Types include:");
  twoColTable(doc, ["Type", "Examples"], [
    ["Product / content nonconformance", "Inaccurate or outdated course content; quiz question error; broken platform feature"],
    ["Process nonconformance", "Failure to follow Document Control Procedure; supplier engagement without prior approval"],
    ["Regulatory nonconformance", "Failure to meet IIRSM/RoSPA requirement; ICO obligation not met within required timescale"],
    ["H&S nonconformance", "Risk assessment not completed; RIDDOR report not submitted; contractor engaged without competence check"],
    ["Security nonconformance", "Unauthorised data access; failure to apply access control policy; backup failure"],
    ["Customer / learner complaint", "Any substantiated complaint that represents a service failure"],
  ], 165);

  sectionHeading(doc, "3. Nonconformance Response Process");
  twoColTable(doc, ["Step", "Action"], [
    ["1 — Detect and Record", "NC identified and recorded in the Nonconformance Register with date, description, category, and identifier of the person raising it."],
    ["2 — Contain", "Immediate containment action taken to limit the impact (e.g. suspend affected course content pending correction; revoke compromised access credential)."],
    ["3 — Assess Severity", "NC classified as Minor (limited impact, easily corrected), Major (significant impact or systemic failure), or Critical (regulatory breach, safety risk, or data breach)."],
    ["4 — Investigate — Root Cause", "Root cause analysis performed using 5-Whys or Ishikawa fishbone method. Root cause documented in NC Register."],
    ["5 — Corrective Action Plan", "Corrective actions identified to address root cause (not just symptoms). Actions assigned with owner, target date, and success criterion."],
    ["6 — Implement", "Corrective actions implemented by the assigned owner within the agreed timescale."],
    ["7 — Verify Effectiveness", "Effectiveness of corrective action verified by the Director or Lead Auditor. Evidence of effectiveness recorded."],
    ["8 — Close", "NC closed in the Register with verification date and evidence reference. Closed NCs reviewed for trends at management review."],
  ], 130);

  sectionHeading(doc, "4. Severity Classification and Response Timescales");
  twoColTable(doc, ["Severity — Criteria", "Response Timescale"], [
    ["Minor — limited impact; no regulatory breach; no safety risk", "Corrective action within 30 days"],
    ["Major — significant impact on learner or business; systemic process failure", "Corrective action within 14 days; management review input"],
    ["Critical — regulatory breach; safety risk; data breach; IIRSM/RoSPA non-compliance", "Immediate containment; corrective action within 7 days; escalate to relevant authority as required"],
  ], 230);

  sectionHeading(doc, "5. Preventive Action and Opportunity for Improvement");
  body(doc, "In addition to corrective action (addressing existing nonconformances), Overleaf Publishers Ltd proactively identifies opportunities to prevent potential nonconformances before they occur, using: trend analysis of the NC Register; results of internal audits; management review outputs; learner feedback patterns; and changes in the regulatory environment. Preventive actions are logged in the Improvement Register and tracked to completion.");

  sectionHeading(doc, "6. Records");
  body(doc, "The Nonconformance Register is a controlled record maintained by the Director. It includes: NC reference, date raised, description, category, severity, root cause, corrective actions, implementation date, verification date, and closure status. The Register is reviewed at each management review and retained for a minimum of 7 years.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Nonconformance_and_Corrective_Action.pdf", "Nonconformance and Corrective Action Procedure");
}

// ─── 19. Internal Audit Procedure ────────────────────────────────────────────

async function genInternalAuditProc(): Promise<void> {
  const doc = newDoc("Internal Audit Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Internal Audit Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure establishes how Overleaf Publishers Ltd plans, conducts, reports, and follows up internal audits of the management system. Internal audits provide objective evidence of whether the management system: conforms to the organisation's own requirements and applicable standards; has been effectively implemented and maintained; and is achieving its objectives. Document reference: QMS-004.\n\nNote: this procedure governs management system audits. It is separate from the Internal Verification procedure, which governs assessment quality assurance activities.");

  sectionHeading(doc, "2. Audit Programme");
  body(doc, "The Director maintains an Annual Audit Programme, reviewed and updated at each management review. The programme specifies: the areas and processes to be audited; the scheduled audit dates; the method and scope of each audit; and the nominated auditor. The following areas are audited as a minimum each annual cycle:");
  bullet(doc, [
    "Quality Management System — all core QMS processes (enrolment, course delivery, assessment, content review, supplier management, document control).",
    "Health, Safety & Wellbeing — risk assessments, training records, incident/near-miss log, DSE assessments.",
    "Information Security — access controls, data handling, backup integrity, supplier security.",
    "Regulatory Compliance — IIRSM/RoSPA requirements, ICO/GDPR obligations, RIDDOR compliance.",
    "Environmental — compliance with Environmental & Sustainability Policy commitments.",
  ]);

  sectionHeading(doc, "3. Auditor Independence");
  body(doc, "Auditors must not audit their own work. As a sole-director organisation, where the Director is also the primary process owner, external audit input will be sought at least every 2 years for key processes to ensure objectivity. Appropriately qualified external auditors may be commissioned for critical areas including information security and regulatory compliance.");

  sectionHeading(doc, "4. Audit Preparation");
  bullet(doc, [
    "Audit scope, objectives, and criteria confirmed and communicated in advance.",
    "Previous audit reports, outstanding corrective actions, and relevant process documentation reviewed.",
    "Audit checklist prepared, tailored to the scope.",
    "Auditee notified at least 5 working days in advance (except for unannounced audits where justified by risk).",
  ]);

  sectionHeading(doc, "5. Audit Conduct");
  bullet(doc, [
    "Audit conducted by document review, record sampling, and interview.",
    "Evidence collected objectively; findings recorded against specific requirements.",
    "Findings classified as: Conformance; Observation (potential for improvement); Minor Nonconformance; Major Nonconformance.",
    "Closing meeting held with auditee to present preliminary findings before finalisation.",
  ]);

  sectionHeading(doc, "6. Audit Reporting");
  body(doc, "An Audit Report is issued within 5 working days of the closing meeting. It includes: audit scope, objectives, and criteria; auditor name and date; summary of evidence reviewed; findings and classification; recommended corrective actions for any nonconformances; and overall audit conclusion.");

  sectionHeading(doc, "7. Follow-Up and Corrective Action");
  body(doc, "All nonconformances identified in audit are raised as formal NCs in the Nonconformance Register and managed under the Nonconformance and Corrective Action Procedure. The auditor verifies completion of corrective actions at a follow-up review. Audit reports and corrective action evidence are filed in the Document Register and presented at the next management review.");

  sectionHeading(doc, "8. Records");
  body(doc, "Audit programme, individual audit reports, checklists, and corrective action records are retained for a minimum of 7 years. The audit programme is a standing agenda item at the management review.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Internal_Audit_Procedure.pdf", "Internal Audit Procedure");
}

// ─── 20. Supplier and Contractor Evaluation Policy ───────────────────────────

async function genSupplierEvaluation(): Promise<void> {
  const doc = newDoc("Supplier and Contractor Evaluation Policy");
  drawPageHeader(doc);
  docTitle(doc, "Supplier and Contractor Evaluation Policy");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This policy sets out how Overleaf Publishers Ltd selects, approves, monitors, and reviews suppliers and contractors to ensure that externally provided services and products consistently meet quality, safety, and security requirements. It applies to all third-party providers of goods and services that could affect the quality of the Chainsaw Courses platform, learner safety, or data security. Document reference: QMS-005.");

  sectionHeading(doc, "2. Supplier Categories");
  twoColTable(doc, ["Category (Risk Level)", "Examples"], [
    ["Platform and infrastructure (High — direct impact on availability and security)", "Replit (hosting), Vimeo (video), payment gateways"],
    ["AI and data processing (High — affects content quality and data security)", "OpenAI via Replit proxy"],
    ["Content and subject matter (High — affects safety-critical content accuracy)", "NPTC/SME contractors, technical reviewers"],
    ["Print and fulfilment (Medium — affects product quality and packaging compliance)", "Manual printers, postal fulfilment"],
    ["Professional services (Medium — affects compliance and data handling)", "Accountants, legal advisers, IT support"],
    ["Utilities and office supplies (Low — minimal direct product quality impact)", "Energy, stationery, telecoms"],
  ], 250);

  sectionHeading(doc, "3. Supplier Approval Process");
  body(doc, "No new supplier or contractor may be engaged until the approval process is complete. Steps:");
  twoColTable(doc, ["Step", "Action"], [
    ["1 — Identify need", "Director identifies requirement and defines specification for the required product/service."],
    ["2 — Supplier identification", "Minimum of two potential suppliers identified and assessed where possible."],
    ["3 — Pre-qualification", "Supplier completes pre-qualification questionnaire covering: capability, quality management, information security, H&S, environmental policy, and relevant insurance."],
    ["4 — Verification", "Director verifies: public liability insurance (≥£1M); relevant professional qualifications/certifications; financial stability indicators; references (for high-risk suppliers); and regulatory compliance."],
    ["5 — Risk assessment", "Supplier risk assessed and classification assigned (see Section 2)."],
    ["6 — Approval", "Director approves supplier for engagement. Approved Supplier Register updated."],
    ["7 — Contract / order", "Written contract or purchase order issued, including quality, security, and H&S requirements as appropriate to the risk category."],
  ], 130);

  sectionHeading(doc, "4. Supplier Performance Monitoring");
  body(doc, "Ongoing monitoring is proportionate to supplier risk category:");
  twoColTable(doc, ["Supplier Type", "Monitoring Frequency and Method"], [
    ["High-risk suppliers (platform, AI, content)", "Quarterly performance review; SLA compliance check; annual formal evaluation"],
    ["Medium-risk suppliers", "Annual performance review; issue-triggered review as required"],
    ["Low-risk suppliers", "Biennial review or issue-triggered"],
  ], 175);
  body(doc, "\nPerformance issues, complaints, or nonconformances involving a supplier are raised as NCs in the Nonconformance Register. Serious or persistent performance failures may result in supplier suspension or removal from the Approved Supplier Register.");

  sectionHeading(doc, "5. Contractor Health and Safety");
  body(doc, "All contractors engaged by Overleaf Publishers Ltd are required to: provide evidence of appropriate public liability and professional indemnity insurance before commencement; confirm their competence for the specific work; adhere to the organisation's Health, Safety & Wellbeing Policy during their engagement; and report any incident, near-miss, or unsafe condition identified during their engagement.");

  sectionHeading(doc, "6. Contractor Information Security");
  body(doc, "Contractors with access to the organisation's systems, data, or learner records are required to: sign a confidentiality and data processing agreement before commencing work; comply with the Information Security Policy and Access Control Policy; report any suspected security incident immediately; and return or securely destroy all data on contract termination.");

  sectionHeading(doc, "7. Approved Supplier Register");
  body(doc, "The Approved Supplier Register is maintained by the Director and contains: supplier name; services provided; risk category; approval date; insurance expiry; review date; and performance notes. The Register is reviewed at least annually and at each management review. Suppliers not reviewed within their required review cycle are suspended pending re-evaluation.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Supplier_and_Contractor_Evaluation.pdf", "Supplier and Contractor Evaluation Policy");
}

// ─── 21. Information Security Policy ─────────────────────────────────────────

async function genInfoSecurity(): Promise<void> {
  const doc = newDoc("Information Security Policy");
  drawPageHeader(doc);
  docTitle(doc, "Information Security Policy");

  sectionHeading(doc, "1. Purpose and Policy Statement");
  body(doc, "Overleaf Publishers Ltd is committed to protecting the confidentiality, integrity, and availability of all information assets — whether relating to learners, business operations, course content, or third-party providers. This policy establishes the framework for managing information security risks across the organisation, and applies to all personnel, contractors, systems, and processes. Document reference: ISP-001.\n\nThe organisation recognises that information security is a business-critical function: learner personal data is processed at scale; device-bonded activation codes represent direct commercial value; and the integrity of safety-critical course content has a direct impact on learner welfare.");

  sectionHeading(doc, "2. Information Security Objectives");
  bullet(doc, [
    "Protect learner personal data in compliance with UK GDPR and the Data Protection Act 2018.",
    "Maintain confidentiality of activation codes and commercial information.",
    "Ensure platform integrity — prevention of unauthorised modification of course content or assessment records.",
    "Maintain platform availability — learner access is not disrupted by preventable security failures.",
    "Detect, respond to, and recover from information security incidents within defined timescales.",
    "Ensure all personnel and contractors understand and fulfil their information security obligations.",
  ]);

  sectionHeading(doc, "3. Information Asset Classification");
  twoColTable(doc, ["Classification — Description", "Examples"], [
    ["Confidential — sensitive; restricted to named individuals; serious harm if disclosed", "Learner PII; activation codes; financial records; admin credentials; data breach records"],
    ["Internal — for use within the organisation; not for public release", "Internal procedures; audit reports; supplier contracts; management review minutes"],
    ["Public — approved for external release; no restriction", "Marketing materials; published policies; course syllabus; platform FAQs"],
  ], 230);
  body(doc, "\nAll information assets are treated as Confidential by default unless explicitly classified otherwise. The Asset Register (maintained by the Director) lists all key information assets, their classification, owner, location, and applicable controls.");

  sectionHeading(doc, "4. Roles and Responsibilities");
  bullet(doc, [
    "Director: overall accountability for information security; approves security policy and procedures; leads incident response.",
    "All personnel and contractors: responsible for complying with this policy and associated procedures; reporting suspected security incidents without delay.",
    "Platform systems: automated controls (device locking, session management, rate limiting, encrypted transmission) operated and monitored by the Director.",
  ]);

  sectionHeading(doc, "5. Technical Security Controls");
  twoColTable(doc, ["Control", "Implementation"], [
    ["Data transmission encryption", "All data transmitted over HTTPS/TLS 1.2+ enforced across all platform endpoints"],
    ["Database encryption", "PostgreSQL database encrypted at rest; hosted on Replit infrastructure with encryption by default"],
    ["Authentication", "Activation code + device UUID + user ID triple validation on all authenticated API calls"],
    ["Password / secret management", "All secrets stored in environment variables (Replit Secrets); never hardcoded; rotated on suspicion of compromise"],
    ["Access control", "Role-based access: learners access only their own records; admin access requires separate token with 24h TTL"],
    ["Session management", "Admin sessions expire after 24 hours; learner sessions tied to device UUID stored in localStorage"],
    ["Video content protection", "Vimeo domain-restricted embeds; dynamic learner watermark repositions every 60 seconds"],
    ["Anti-sharing", "Activation codes bonded to first device at redemption; administrator can reset device bond on verified request only"],
    ["Input validation", "All API inputs validated with Zod schemas; parameterised queries prevent SQL injection"],
    ["Rate limiting", "API rate limiting applied to all authentication endpoints"],
    ["Backup and recovery", "Database backups managed per Business Continuity and Disaster Recovery Plan"],
  ], 175);

  sectionHeading(doc, "6. Physical Security");
  body(doc, "As a remote-first organisation, physical security controls focus on: securing personal devices used for work (screensaver lock ≤5 minutes; full-disk encryption); physical access to any premises where business data is processed; and secure disposal of physical media containing business data (cross-shredding for paper; cryptographic erasure or physical destruction for digital media).");

  sectionHeading(doc, "7. Human Resources Security");
  bullet(doc, [
    "All staff and contractors receive an information security briefing on engagement.",
    "Contractors with access to personal data or systems sign a confidentiality and data processing agreement.",
    "Access rights are provisioned on a least-privilege, need-to-know basis and revoked immediately on termination of engagement.",
    "Personnel are required to report suspected security incidents without delay — no detriment for good-faith reports.",
  ]);

  sectionHeading(doc, "8. Third-Party and Cloud Service Security");
  body(doc, "The security of third-party providers (Replit, Vimeo, payment processors) is reviewed annually under the Supplier and Contractor Evaluation Policy. All third parties processing personal data are subject to a data processing agreement (DPA). Cloud services used are: Replit (hosting, UK/EU data residency); Vimeo (video CDN); and payment processors subject to PCI-DSS compliance. Security-relevant provider notifications (breach disclosures, vulnerability advisories) are assessed by the Director within 2 working days of receipt.");

  sectionHeading(doc, "9. Security Incident Management");
  body(doc, "All suspected or confirmed information security incidents are managed under the Data Breach and Incident Response Procedure. The Director is the primary incident owner. All personnel and contractors are required to report suspected incidents immediately upon detection.");

  sectionHeading(doc, "10. Security Review and Improvement");
  body(doc, "Information security performance is reviewed at each management review. The Asset Register and technical controls are reviewed annually. Security incident trends are analysed for systemic weaknesses. External penetration testing or security assessment is considered annually and commissioned where risk assessment indicates necessity.");

  sectionHeading(doc, "11. Policy Review");
  body(doc, "This policy is reviewed annually and following any significant security incident, regulatory change, or material change in the technical environment. Controlled under reference ISP-001.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Information_Security_Policy.pdf", "Information Security Policy");
}

// ─── 22. Access Control Policy ───────────────────────────────────────────────

async function genAccessControl(): Promise<void> {
  const doc = newDoc("Access Control and Identity Management Policy");
  drawPageHeader(doc);
  docTitle(doc, "Access Control and Identity Management Policy");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This policy defines the principles, requirements, and controls governing access to Overleaf Publishers Ltd's information systems, data, and physical assets. It applies to all personnel, contractors, and third-party providers who have access to any organisational system or data, whether on-site or remote. Document reference: ISP-002.\n\nThe objective is to ensure that access to information assets is granted on a least-privilege, need-to-know basis; is formally authorised before it is granted; is monitored during use; and is promptly revoked when no longer required.");

  sectionHeading(doc, "2. Access Control Principles");
  bullet(doc, [
    "Least privilege: users are granted the minimum level of access required to perform their authorised function — no more.",
    "Need-to-know: access to sensitive data (learner records, financial data, admin functions) is restricted to personnel with a documented business need.",
    "Separation of duties: where feasible, no single individual controls all steps of a sensitive process.",
    "Formal authorisation: all access grants are explicitly authorised by the Director before provisioning.",
    "Regular review: access rights are reviewed at minimum annually and upon any change in role.",
    "Prompt revocation: access is revoked within 24 hours of termination of employment or contractor engagement.",
  ]);

  sectionHeading(doc, "3. User Access Management");
  twoColTable(doc, ["Stage", "Control"], [
    ["Registration", "New users registered only on written authorisation from the Director. System accounts created with minimum required permissions."],
    ["Provisioning", "Access provisioned to specific systems/data only. Credentials issued via secure channel; never via email in plaintext."],
    ["Authentication", "Strong authentication required: passwords minimum 12 characters, mixed case/number/symbol; MFA enforced for admin and cloud service access."],
    ["Periodic review", "Access rights reviewed annually; dormant accounts (>90 days inactive) suspended and reviewed."],
    ["Termination", "All access revoked within 24 hours of departure. Shared credentials changed immediately. Equipment and physical access items recovered."],
  ], 115);

  sectionHeading(doc, "4. Platform Access Tiers");
  twoColTable(doc, ["Tier — Users — Authentication", "Access Rights"], [
    ["Learner — Registered students — Activation code + device UUID bond", "Own progress, quiz results, waiver, inspection, and risk assessment records only"],
    ["Administrator — Director only — Admin password + in-memory token (24h TTL)", "All learner records; content management; activation code management; waiver PDFs; device bond reset"],
    ["Infrastructure — Director / authorised contractors — Replit account + MFA", "Replit workspace, database, server code, environment secrets; access via Replit RBAC"],
  ], 250);

  sectionHeading(doc, "5. Privileged Access Management");
  bullet(doc, [
    "Administrative access to the platform backend and database is restricted to the Director and explicitly authorised contractors.",
    "Admin tokens have a 24-hour TTL and are stored in-memory only — they do not persist across server restarts.",
    "Database access is not exposed to the public internet; all access is via application API or authorised Replit console.",
    "Environment secrets (API keys, DATABASE_URL, SESSION_SECRET) are stored exclusively in Replit Secrets and are never logged or displayed.",
    "Any access required for maintenance or debugging by a third party is granted on a time-limited, task-specific basis and revoked immediately on completion.",
  ]);

  sectionHeading(doc, "6. Remote Access");
  body(doc, "All remote access to organisational systems and data is: conducted over encrypted connections (HTTPS/TLS); from devices with full-disk encryption enabled and up-to-date security patching; and subject to the same authentication requirements as on-premises access. Use of public Wi-Fi for accessing sensitive data without a VPN is prohibited.");

  sectionHeading(doc, "7. Password Policy");
  bullet(doc, [
    "Minimum length: 12 characters.",
    "Complexity: must include uppercase, lowercase, numbers, and special characters.",
    "Password reuse: last 10 passwords may not be reused.",
    "Password sharing: strictly prohibited — each user must have a unique credential.",
    "Compromise response: passwords changed immediately on suspicion of compromise; all active sessions invalidated.",
    "Password managers: recommended for all personnel to generate and store strong, unique passwords.",
  ]);

  sectionHeading(doc, "8. Multi-Factor Authentication");
  body(doc, "MFA is mandatory for: all cloud infrastructure accounts (Replit, Vimeo, payment platforms, email); admin access to platform backend; and access to any system holding personal data or financial information. Acceptable MFA methods: authenticator app (TOTP); hardware security key (FIDO2). SMS-based MFA is acceptable where other methods are not supported by the service.");

  sectionHeading(doc, "9. Access Review and Revocation");
  body(doc, "A formal access review is conducted at least annually. The review confirms: all active access accounts have a current business justification; permissions match current roles; dormant accounts are suspended; and no orphaned accounts from previous contractor engagements remain active. Findings are recorded in the Access Review Register and any anomalies are raised as nonconformances.");

  sectionHeading(doc, "10. Policy Review");
  body(doc, "This policy is reviewed annually and following any security incident, significant personnel change, or material change to the system architecture. Controlled under reference ISP-002.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Access_Control_Policy.pdf", "Access Control and Identity Management Policy");
}

// ─── 23. Data Breach and Incident Response Procedure ─────────────────────────

async function genDataBreachResponse(): Promise<void> {
  const doc = newDoc("Data Breach and Information Security Incident Response Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Data Breach and Incident Response Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure establishes how Overleaf Publishers Ltd detects, contains, investigates, notifies, and recovers from information security incidents and personal data breaches. It applies to all personnel, contractors, and systems. Document reference: ISP-003.\n\nA personal data breach is any security incident that leads to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to personal data. Under UK GDPR, certain breaches must be reported to the Information Commissioner's Office (ICO) within 72 hours of becoming aware, and affected individuals notified without undue delay where the breach is likely to result in high risk to their rights and freedoms.");

  sectionHeading(doc, "2. Incident Classification");
  twoColTable(doc, ["Category — Description", "Examples"], [
    ["P1 Critical — active breach; mass data exposure; platform compromise; ransomware", "Database exfiltration; admin credential compromise; ransomware on infrastructure"],
    ["P2 High — confirmed breach; limited exposure; no evidence of misuse yet", "Accidental bulk email disclosure; single learner record exposed; lost unencrypted device"],
    ["P3 Medium — suspected breach or near-miss; potential vulnerability identified", "Phishing attempt; unusual login activity; misconfigured access control discovered"],
    ["P4 Low — minor procedural failure; no confirmed data exposure", "Incorrect data sent to single recipient and recovered; temporary system misconfiguration corrected"],
  ], 230);

  sectionHeading(doc, "3. Incident Response Phases");
  twoColTable(doc, ["Phase", "Actions"], [
    ["1 — Detect and Report", "Any suspected incident reported to Director immediately on discovery. Incident logged in Security Incident Register with date/time, discoverer, and initial description."],
    ["2 — Triage (within 1 hour)", "Director assesses classification (P1–P4). P1/P2: immediate escalation and containment. P3/P4: investigation initiated within 4 hours."],
    ["3 — Contain (within 4 hours for P1/P2)", "Affected systems isolated or access revoked. Compromised credentials changed. Evidence preserved. Platform availability maintained where safely possible under the BCP."],
    ["4 — Assess", "Scope of breach established: data types affected; number of individuals; likely consequences; whether breach is ongoing or contained."],
    ["5 — ICO Notification (within 72 hours)", "For breaches likely to result in risk to individuals' rights and freedoms, notification submitted to ICO via ico.org.uk/report-a-breach within 72 hours of awareness."],
    ["6 — Individual Notification", "Where the breach is likely to result in high risk to individuals, affected learners notified without undue delay via email, with clear description of the breach, its likely consequences, and mitigating steps taken."],
    ["7 — Investigate", "Full root cause analysis conducted. Contributing factors identified. Interim corrective actions documented."],
    ["8 — Recover", "Systems restored; data integrity verified; enhanced monitoring implemented. Recovery actions documented."],
    ["9 — Review and Improve", "Post-incident review completed within 30 days. NC raised in Nonconformance Register. Preventive actions implemented to prevent recurrence."],
  ], 130);

  sectionHeading(doc, "4. ICO Notification Requirements");
  body(doc, "Notification to the ICO is required when a personal data breach is likely to result in risk to the rights and freedoms of natural persons. Notification must include:");
  bullet(doc, [
    "Description of the nature of the breach, including categories and approximate numbers of individuals and records concerned.",
    "Name and contact details of the Data Protection contact (Director: info@chainsawcourses.com).",
    "Description of the likely consequences of the breach.",
    "Description of measures taken or proposed to address the breach, including measures to mitigate its possible adverse effects.",
  ]);
  body(doc, "\nWhere full information is not available within 72 hours, initial notification is submitted with the information available, with further information provided as it becomes available (phased notification).");

  sectionHeading(doc, "5. Breach Register");
  body(doc, "All incidents are logged in the Security Incident and Breach Register, regardless of whether ICO notification is required. The register contains: incident reference; date/time detected; date/time reported; classification; description; personal data categories and volumes affected; containment and recovery actions; ICO notification reference (if applicable); individual notification status; and closure date. The register is reviewed at each management review and retained for a minimum of 7 years.");

  sectionHeading(doc, "6. Drill and Testing");
  body(doc, "The incident response procedure is reviewed annually and tested at least every 2 years via a tabletop exercise. Test outcomes are documented and any gaps in the procedure are raised as improvement actions.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Data_Breach_and_Incident_Response.pdf", "Data Breach and Incident Response Procedure");
}

// ─── 24. Business Continuity and Disaster Recovery Plan ──────────────────────

async function genBCP(): Promise<void> {
  const doc = newDoc("Business Continuity and Disaster Recovery Plan");
  drawPageHeader(doc);
  docTitle(doc, "Business Continuity and Disaster Recovery Plan");

  sectionHeading(doc, "1. Purpose and Objectives");
  body(doc, "This plan ensures that Overleaf Publishers Ltd can maintain, restore, and recover critical business functions and the Chainsaw Courses platform following a disruptive event. Document reference: QMS-006.\n\nObjectives: maintain learner access to course content with minimum disruption; protect learner and business data from permanent loss; restore full platform functionality within defined recovery timescales; and ensure regulatory and contractual obligations continue to be met during and after a disruption.");

  sectionHeading(doc, "2. Recovery Objectives");
  twoColTable(doc, ["Metric", "Target"], [
    ["Recovery Time Objective (RTO) — time to restore critical systems", "≤4 hours for platform availability; ≤24 hours for full functionality"],
    ["Recovery Point Objective (RPO) — maximum data loss acceptable", "≤24 hours (daily backup minimum; continuous where available)"],
    ["Maximum Tolerable Downtime (MTD)", "72 hours — beyond this, learner notifications and regulatory obligations are triggered"],
  ], 210);

  sectionHeading(doc, "3. Business Impact Analysis");
  twoColTable(doc, ["Business Function (Criticality)", "Impact of Disruption"], [
    ["Learner platform access — course content, quizzes, progress (Critical)", "Loss of service to paying learners; reputational damage; potential refund obligation"],
    ["Activation code system (Critical)", "New learners cannot activate; existing learners may lose device bond"],
    ["Learner data — progress, waiver, inspection records (Critical)", "Data loss violates UK GDPR; loss of evidence for IIRSM compliance"],
    ["Payment processing — Shopify/Stripe (High)", "Loss of new revenue; handled by third-party providers with their own BCPs"],
    ["Admin dashboard (High)", "Director cannot manage learner records or generate compliance documents"],
    ["AI mock examiner (Medium)", "Degrades gracefully to keyword-based fallback; not safety-critical"],
    ["Email and learner communications (Medium)", "Delay in support responses; notifications delayed but catchable"],
    ["PDF generation — waivers, inspection reports (Medium)", "Records cannot be generated; learner data still preserved in database"],
  ], 140);

  sectionHeading(doc, "4. Threat Scenarios and Response");
  twoColTable(doc, ["Threat", "Response"], [
    ["Cloud hosting outage (Replit)", "Monitor provider status page. If outage >2 hours, activate learner communication plan. Recovery follows provider restoration; no action needed for infrastructure. If provider SLA breached, evaluate alternative hosting migration."],
    ["Database corruption or accidental deletion", "Restore from most recent backup (Replit managed or supplementary backup). Verify data integrity post-restoration. Log data loss period and notify affected learners if personal data impacted."],
    ["Ransomware or malicious compromise", "Isolate affected systems immediately. Activate Data Breach and Incident Response Procedure. Restore from last known clean backup. Engage specialist incident response if required. Notify ICO if personal data involved."],
    ["Accidental code deployment causing platform failure", "Rollback to last stable deployment via version control (Git). Staging environment testing before production redeployment. Estimated recovery: ≤2 hours."],
    ["Loss of key personnel (sole director incapacity)", "Emergency contact and succession brief held by a nominated trusted person. Access to critical credentials via a secure, pre-arranged process (sealed envelope or password manager emergency access). Escalate to professional advisor if extended incapacity."],
    ["Third-party video platform (Vimeo) outage", "Notify learners via platform banner. Progress heartbeats continue to work. Video-specific module access suspended; other platform functionality unaffected."],
    ["Payment processor outage", "New activations paused. Existing learners unaffected. Monitor provider status; activate alternative payment method if outage exceeds 24 hours."],
  ], 130);

  sectionHeading(doc, "5. Backup Strategy");
  bullet(doc, [
    "Database backups: automated daily backup managed by Replit infrastructure; additional manual export weekly stored in a separate, encrypted cloud location.",
    "Code and configuration: all code version-controlled in Git; no single point of failure.",
    "Environment secrets: stored in Replit Secrets and additionally documented in a secure, offline, access-controlled record.",
    "Static assets (PDFs, course materials): backed up weekly to a separate cloud storage location.",
    "Backup integrity: restoration test conducted quarterly; results logged.",
  ]);

  sectionHeading(doc, "6. Communication Plan");
  body(doc, "During a disruptive event, communications are managed as follows:");
  twoColTable(doc, ["Audience — Timescale", "Communication Method"], [
    ["Active learners — within 2 hours of declaring an incident affecting access", "In-platform banner and/or direct email"],
    ["New purchasers (activation failing) — within 4 hours", "Automated response; manual follow-up email"],
    ["IIRSM / RoSPA (if prolonged outage) — within 24 hours if outage exceeds MTD", "Direct contact via info@chainsawcourses.com"],
    ["ICO (if data breach) — within 72 hours", "ICO online reporting portal (ico.org.uk/report-a-breach)"],
  ], 260);

  sectionHeading(doc, "7. Plan Testing and Review");
  body(doc, "This plan is reviewed annually and tested at least every 2 years via tabletop exercise. Key test scenarios include: database restoration from backup; platform rollback following a failed deployment; and simulated loss-of-access scenario for sole director. Test outcomes are documented and any gaps are raised as improvement actions. This plan is controlled under reference QMS-006.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Business_Continuity_and_Disaster_Recovery.pdf", "Business Continuity and Disaster Recovery Plan");
}

// ─── 25. Incident and Near-Miss Reporting Procedure ──────────────────────────

async function genIncidentReporting(): Promise<void> {
  const doc = newDoc("Incident and Near-Miss Reporting Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Incident and Near-Miss Reporting Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure establishes the requirements for reporting, recording, investigating, and learning from incidents, near-misses, dangerous occurrences, and work-related ill-health events occurring in connection with the activities of Overleaf Publishers Ltd. It applies to all directors, employees, contractors, and, where relevant, learners. It fulfils the organisation's obligations under the Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 (RIDDOR) and supports continual improvement of health and safety performance. Document reference: HSW-002.");

  sectionHeading(doc, "2. Definitions");
  twoColTable(doc, ["Term", "Definition"], [
    ["Incident", "An unplanned event that results in, or has the potential to result in, injury, ill health, damage, or other loss"],
    ["Near-Miss", "An event that, under slightly different circumstances, could have resulted in injury, ill health, or damage — but did not"],
    ["Dangerous Occurrence", "A specified event that must be reported to the HSE under RIDDOR regardless of whether injury occurred (e.g. collapse of scaffolding, explosion, radiation incident)"],
    ["Work-Related Ill Health", "A condition caused or made worse by work activities, including occupational stress, musculoskeletal disorder, respiratory disease, and skin disease"],
    ["RIDDOR-Reportable Injury", "Death; specified injury (fractures, amputations, crush injuries, etc.); over-7-day incapacitation; occupational disease; dangerous occurrence"],
  ], 150);

  sectionHeading(doc, "3. Reporting Obligations");
  body(doc, "All incidents and near-misses must be reported to the Director within 24 hours of occurrence or discovery. Reporting must not be delayed to await investigation. Reports are made via: email to info@chainsawcourses.com with subject 'INCIDENT REPORT'; verbal report followed by written confirmation within 24 hours; or self-reporting by the Director in the Incident Register.");

  sectionHeading(doc, "4. RIDDOR Statutory Notification");
  body(doc, "The Director is responsible for ensuring all RIDDOR-notifiable events are reported to the HSE within the required timescales:");
  twoColTable(doc, ["Event Type — Timescale", "Reporting Method"], [
    ["Death arising from work-related accident — without delay (within 10 days)", "HSE RIDDOR portal online or telephone 0345 300 9923"],
    ["Specified injury to a worker — without delay (within 10 days)", "HSE RIDDOR portal online"],
    ["Over-7-day incapacitation of a worker — within 15 days of incident", "HSE RIDDOR portal online"],
    ["Non-fatal accident to non-worker (visitor / public) — within 10 days", "HSE RIDDOR portal online"],
    ["Occupational disease diagnosis — upon receipt of confirmation", "HSE RIDDOR portal online"],
    ["Dangerous occurrence — without delay (within 10 days)", "HSE RIDDOR portal online or telephone 0345 300 9923"],
  ], 230);

  sectionHeading(doc, "5. Investigation Process");
  body(doc, "All incidents and near-misses are investigated proportionately to their severity and learning potential:");
  twoColTable(doc, ["Severity — Timescale", "Investigation Depth"], [
    ["Low — within 10 working days (minor injury / near-miss, no recurring pattern)", "Basic investigation: immediate cause; immediate corrective action"],
    ["Medium — within 7 working days (significant near-miss; recurring pattern; moderate injury)", "Intermediate: contributing factors; process review; corrective action plan"],
    ["High — within 5 working days (RIDDOR-reportable; serious near-miss; pattern of incidents)", "Full investigation: 5-Whys or fishbone root cause analysis; systemic corrective actions; management review input"],
  ], 230);

  sectionHeading(doc, "6. Investigation Methodology");
  bullet(doc, [
    "Gather evidence: secure the scene (where applicable); preserve physical and documentary evidence; interview involved parties and witnesses promptly.",
    "Timeline reconstruction: establish the sequence of events leading to the incident.",
    "Immediate cause identification: what directly caused the incident?",
    "Root cause analysis: why did the immediate cause occur? Use 5-Whys or Ishikawa diagram for medium and high-severity events.",
    "Contributing factor analysis: what background conditions made the incident possible?",
    "Control gap analysis: which existing controls failed or were absent?",
    "Corrective and preventive actions: address root causes, not just symptoms. Actions logged in Nonconformance Register.",
  ]);

  sectionHeading(doc, "7. Learning and Communication");
  body(doc, "Investigation findings and lessons learned are: summarised in the Incident Register; communicated to relevant personnel to prevent recurrence; reviewed at the management review for trend analysis; and, where applicable, used to update risk assessments, safe systems of work, training content, or procedures.");

  sectionHeading(doc, "8. Incident Register");
  body(doc, "The Incident Register is maintained by the Director and contains: incident reference; date and time; location; description; type (incident/near-miss/dangerous occurrence/ill health); injury/damage details; immediate cause; root cause; corrective actions; RIDDOR reference (if applicable); investigation completion date; and closure status. RIDDOR records retained for 10 years; all other incident records retained for 7 years.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Incident_and_Near_Miss_Procedure.pdf", "Incident and Near-Miss Reporting Procedure");
}

// ─── 26. Emergency Preparedness and Response Procedure ───────────────────────

async function genEmergency(): Promise<void> {
  const doc = newDoc("Emergency Preparedness and Response Procedure");
  drawPageHeader(doc);
  docTitle(doc, "Emergency Preparedness and Response Procedure");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This procedure identifies foreseeable emergency situations relevant to Overleaf Publishers Ltd's activities and establishes planned responses to protect people, preserve data and business assets, and fulfil regulatory obligations. It applies to all personnel, contractors, and, where relevant, learners. Document reference: HSW-003.");

  sectionHeading(doc, "2. Identified Emergency Scenarios");
  twoColTable(doc, ["Scenario", "Primary Risk"], [
    ["Personal medical emergency (staff or contractor)", "Injury or death; failure to summon emergency services promptly"],
    ["Fire or premises emergency", "Injury; loss of equipment and data held on physical devices"],
    ["Cyber attack / ransomware", "Data breach; platform unavailability; financial loss; regulatory penalty"],
    ["Personal data breach", "UK GDPR breach; ICO notification obligation; individual harm"],
    ["Platform catastrophic failure or data loss", "Loss of learner access; potential data loss; reputational damage"],
    ["Loss or incapacity of sole director", "Business continuity failure; inability to fulfil regulatory obligations"],
    ["Severe weather or natural event affecting personnel", "Injury; inability to access systems; communication failure"],
    ["Violent or threatening behaviour (online or in person)", "Personal safety; data security if account compromised"],
  ], 175);

  sectionHeading(doc, "3. Emergency Response Actions by Scenario");
  body(doc, "Personal medical emergency:");
  bullet(doc, [
    "Call 999 immediately. Do not delay to report internally first.",
    "Provide first aid if trained and it is safe to do so.",
    "Notify the Director (or, if the Director is the casualty, the emergency contact on record).",
    "Log the incident in the Incident Register and notify HSE under RIDDOR if required.",
  ]);
  body(doc, "\nFire or premises emergency:");
  bullet(doc, [
    "Evacuate the premises immediately following the building's evacuation procedure.",
    "Call 999. Do not attempt to fight a fire unless trained and it is safe to do so.",
    "Ensure devices are locked before evacuating where it is safe and quick to do so.",
    "Account for all personnel; notify emergency services of any missing persons.",
    "Notify the Director; activate Business Continuity Plan if premises are unavailable.",
  ]);
  body(doc, "\nCyber attack / ransomware:");
  bullet(doc, [
    "Isolate affected systems immediately — disconnect from network where possible.",
    "Do not pay any ransom demand without taking specialist legal and security advice.",
    "Activate Data Breach and Incident Response Procedure.",
    "Preserve evidence; engage specialist incident response if required.",
    "Notify ICO within 72 hours if personal data is involved.",
  ]);
  body(doc, "\nLoss or incapacity of sole director:");
  bullet(doc, [
    "Nominated emergency contact (held in sealed emergency instructions) to be activated.",
    "Emergency instructions provide access to: platform admin credentials (secure method); key contact details for IIRSM, payment processors, and legal/financial advisers; instructions for learner communication.",
    "Business Continuity Plan Section 4 (Loss of Key Personnel) to be followed.",
  ]);

  sectionHeading(doc, "4. Emergency Contact Information");
  twoColTable(doc, ["Contact", "Details"], [
    ["Emergency services (all)", "999"],
    ["NHS non-emergency / medical advice", "111"],
    ["HSE Incident Contact Centre (RIDDOR)", "0345 300 9923"],
    ["ICO (data breach notification)", "ico.org.uk/report-a-breach  ·  0303 123 1113"],
    ["Forestry Commission (plant health emergencies)", "0300 067 4454"],
    ["Director (business emergency)", "info@chainsawcourses.com"],
    ["Replit support (platform emergency)", "support.replit.com"],
    ["Vimeo support (video emergency)", "vimeo.com/help"],
  ], 160);

  sectionHeading(doc, "5. Drills and Testing");
  body(doc, "Emergency response procedures are reviewed annually. The following scenarios are tested at least every 2 years via tabletop or practical exercise: cyber incident response; platform data loss and recovery; loss of sole director. Test outcomes are documented and gaps raised as improvement actions.");

  sectionHeading(doc, "6. Communication During Emergencies");
  body(doc, "During any emergency affecting platform availability or learner data: learners are notified via in-platform banner and direct email within 2 hours of declaration; IIRSM and RoSPA are notified within 24 hours if the event is likely to affect course approval compliance; the ICO is notified within 72 hours of any personal data breach. All communications are documented and filed.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Emergency_Preparedness_and_Response.pdf", "Emergency Preparedness and Response Procedure");
}

// ─── 27. Competence and Training Framework ───────────────────────────────────

async function genCompetenceFramework(): Promise<void> {
  const doc = newDoc("Competence and Training Framework");
  drawPageHeader(doc);
  docTitle(doc, "Competence and Training Framework");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This framework defines the competence requirements for all roles associated with Overleaf Publishers Ltd's activities, the processes for determining competence, and the requirements for ongoing training and professional development. It applies to the Director, employed staff, and all contractors engaged in activities that could affect product quality, health and safety, information security, or regulatory compliance. Document reference: HRT-001.");

  sectionHeading(doc, "2. Competence Determination");
  body(doc, "Competence is determined by assessing: education and qualifications; prior experience and training; demonstrated skills and abilities; and ongoing performance. Competence is assessed at the point of engagement (pre-employment or pre-contractor assessment) and is monitored through ongoing supervision, review, and performance assessment. Gaps between required and actual competence are addressed through targeted training or by restricting activities until competence is achieved.");

  sectionHeading(doc, "3. Role Competence Profiles");
  twoColTable(doc, ["Role", "Essential Competence Requirements"], [
    ["Director / Course Author", "NPTC chainsaw qualifications relevant to course content (0039-20 to 0039-38 as applicable); knowledge of current HSE/FISA guidance; eLearning instructional design understanding; UK GDPR awareness; platform administration competence; H&S management awareness"],
    ["Platform Developer / Contractor", "Relevant software development qualifications or demonstrable experience; information security awareness; understanding of data protection in software design; platform-specific technical competence (TypeScript, React, Express, PostgreSQL)"],
    ["Content Reviewer / Subject Matter Expert", "Relevant professional qualification in chainsaw safety or arboriculture (e.g. NPTC, NTPC); current knowledge of HSE/FISA guidance and relevant legislation; understanding of assessment alignment principles"],
    ["Internal Verification Assessor", "Understanding of assessment principles and quality assurance; familiarity with IIRSM/RoSPA requirements; independence from the content being verified"],
    ["Administrative support", "Understanding of data handling and confidentiality obligations; platform administration basics; complaint handling awareness"],
  ], 145);

  sectionHeading(doc, "4. Induction Training");
  body(doc, "All new personnel (employees and contractors) complete a structured induction before commencing their role, covering:");
  bullet(doc, [
    "Organisational overview: mission, values, products, and operating model.",
    "Health, safety, and wellbeing: this policy; role-specific risks; emergency procedures; incident reporting.",
    "Information security: Information Security Policy; data handling requirements; password and access control requirements; incident reporting.",
    "Data protection: UK GDPR obligations; lawful bases for processing; data subject rights; breach reporting.",
    "Quality management: QMS overview; document control; nonconformance and corrective action reporting.",
    "Role-specific procedures: relevant operational procedures for the specific role.",
  ]);

  sectionHeading(doc, "5. Ongoing Training Requirements");
  twoColTable(doc, ["Training Area", "Frequency — Who"], [
    ["Health and safety briefing (updates, incidents review)", "Annual — All personnel"],
    ["Information security awareness update", "Annual — All personnel with system access"],
    ["UK GDPR and data protection refresher", "Biennial or following regulatory change — All personnel handling personal data"],
    ["First aid (where required by risk assessment)", "Per qualification renewal cycle (typically 3 years) — Director / designated first aider"],
    ["DSE workstation self-assessment", "Annual or following workstation change — All screen-based workers"],
    ["NPTC/professional qualification renewal (CPD)", "Per qualification body requirements — Director / content authors"],
    ["Platform and tooling updates", "As required following material system changes — All system users"],
    ["Management system auditor training (if applicable)", "Prior to first audit; refresher every 3 years — Director / lead auditor"],
  ], 195);

  sectionHeading(doc, "6. Competence and Training Register");
  body(doc, "The Competence and Training Register is maintained by the Director and records, for each individual: name; role; required competencies; evidence of qualification/experience for each competency; training completed (with dates and certificates); training gaps identified; and planned training to address gaps. The Register is reviewed annually and at each management review.");

  sectionHeading(doc, "7. Awareness");
  body(doc, "All personnel are made aware of: the quality, health and safety, and information security policies and their relevance to their role; the consequences of non-compliance; their contribution to the effectiveness of the management system; and the benefits of improved performance. Awareness is delivered through induction, briefings, and policy document distribution.");

  sectionHeading(doc, "8. Framework Review");
  body(doc, "This framework is reviewed annually as part of the management review and following any significant change in roles, regulatory requirements, or identified competence gaps. Controlled under reference HRT-001.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Competence_and_Training_Framework.pdf", "Competence and Training Framework");
}

// ─── 28. Risk Register and Management Framework ───────────────────────────────

async function genRiskRegister(): Promise<void> {
  const doc = newDoc("Risk Register and Management Framework");
  drawPageHeader(doc);
  docTitle(doc, "Risk Register and Management Framework");

  sectionHeading(doc, "1. Purpose and Scope");
  body(doc, "This framework establishes how Overleaf Publishers Ltd identifies, assesses, treats, monitors, and reviews risks across all areas of the business — encompassing quality, health and safety, information security, and business continuity. It ensures that the organisation proactively manages uncertainty and protects its ability to achieve its objectives. Document reference: QMS-007.");

  sectionHeading(doc, "2. Risk Management Principles");
  bullet(doc, [
    "Risk management is integrated into all business processes and decision-making, not treated as a separate activity.",
    "Risks are identified from all relevant sources: internal and external context; stakeholder requirements; incident and near-miss records; audit findings; management review; and environmental scanning.",
    "Both threats (negative risks) and opportunities (positive risks) are considered.",
    "Risk treatment is proportionate to the level of risk and the organisation's risk tolerance.",
    "Risk owners are accountable for the implementation and effectiveness of risk treatments.",
    "The Risk Register is a living document, reviewed continuously and formally at each management review.",
  ]);

  sectionHeading(doc, "3. Risk Assessment Methodology");
  body(doc, "Risks are assessed using a 5×5 likelihood × consequence matrix:");
  twoColTable(doc, ["Score / Likelihood", "Consequence"], [
    ["1 — Rare (unlikely in any given year)", "Negligible — minimal impact; no regulatory implication"],
    ["2 — Unlikely (possible but not expected)", "Minor — limited impact; manageable without disruption"],
    ["3 — Possible (could occur in some circumstances)", "Moderate — significant impact; some disruption; possible regulatory notice"],
    ["4 — Likely (will probably occur in most circumstances)", "Major — serious impact; significant disruption; regulatory sanction possible"],
    ["5 — Almost certain (expected to occur)", "Catastrophic — business-threatening; regulatory prosecution; significant data breach"],
  ], 175);
  body(doc, "\nRisk Rating = Likelihood × Consequence. Bands: Low 1–4 (green); Medium 5–12 (amber); High 13–18 (red); Critical 19–25 (black). High and Critical risks require Director review and immediate action. Medium risks require a documented treatment plan. Low risks are monitored and reviewed annually.");

  sectionHeading(doc, "4. Risk Treatment Options");
  twoColTable(doc, ["Treatment", "Description"], [
    ["Avoid", "Eliminate the activity or condition giving rise to the risk"],
    ["Reduce / Mitigate", "Implement controls to reduce likelihood or consequence to an acceptable level"],
    ["Transfer", "Transfer risk to a third party (e.g. insurance, contract terms, supplier SLAs)"],
    ["Accept", "Acknowledge residual risk where it is within tolerance and further treatment is not reasonably practicable"],
    ["Exploit (opportunity)", "Take deliberate action to increase the likelihood of a positive risk/opportunity materialising"],
  ], 110);

  sectionHeading(doc, "5. Risk Register — Current Risk Summary");
  twoColTable(doc, ["Risk (L×C = Rating)", "Treatment / Controls"], [
    ["Inaccurate/outdated course content → unsafe practice (2×5 = 10 Medium)", "Annual SME content audit; rapid correction procedure; IIRSM IV review cycle"],
    ["Personal data breach — learner records (2×4 = 8 Medium)", "Encryption at rest and in transit; access controls; MFA; Data Breach Response Procedure"],
    ["Platform availability failure — hosting outage (2×4 = 8 Medium)", "Business Continuity Plan; offsite backups; RTO/RPO targets; Replit SLA monitoring"],
    ["Regulatory non-compliance — IIRSM/RoSPA/ICO (2×4 = 8 Medium)", "Compliance calendar; annual internal audit; management review; legal adviser retainer"],
    ["Sole director incapacity — key person dependency (2×4 = 8 Medium)", "Emergency succession instructions; BCP; documented access procedures for nominated contact"],
    ["Learner misuses course as substitute for practical NPTC assessment (3×4 = 12 Medium)", "Digital waiver; prominent practical training disclaimer throughout platform"],
    ["Third-party supplier failure — Vimeo/Replit (2×3 = 6 Medium)", "Supplier evaluation; BCP; fallback procedures; platform diversification where feasible"],
    ["DSE-related musculoskeletal injury — staff (2×2 = 4 Low)", "Annual workstation self-assessment; breaks guidance; ergonomics provision"],
    ["Intellectual property infringement claim (1×4 = 4 Low)", "Content originality review; source attribution; legal adviser review"],
    ["Fraudulent chargebacks — financial loss (2×2 = 4 Low)", "Device locking; activation code controls; clear terms and conditions"],
    ["Competitor replicates course content (2×2 = 4 Low)", "Copyright notice; dynamic video watermarking; DMCA/UK copyright enforcement"],
    ["Supply chain disruption to physical manual (1×2 = 2 Low)", "Multiple approved printers; print-on-demand capability; digital-only access option"],
  ], 195);

  sectionHeading(doc, "6. Risk Review and Escalation");
  body(doc, "The Risk Register is reviewed: continuously by the Director for emerging risks; quarterly for medium risks; annually for all risks as part of the management review process. New risks identified between formal reviews are added to the Register immediately and their treatment plan developed within 10 working days. Critical risks are escalated to the Director immediately on identification and addressed without delay.");

  sectionHeading(doc, "7. Integration with Other Management System Elements");
  body(doc, "The Risk Register is integrated with: the Nonconformance Register (risks arising from NCs); the Incident Register (risks identified through incident investigation); the Internal Audit Programme (audit scope informed by risk profile); the Supplier Evaluation process (supplier risk assessment); and the Management Review (risk review as a standing agenda item).");

  sectionHeading(doc, "8. Framework Review");
  body(doc, "This framework is reviewed annually as part of the management review. The Risk Register is a controlled document held under reference QMS-007.");

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd  ·  Reg. No. 15735226  ·  VAT 479581629");
  await save(doc, "Risk_Register_and_Management_Framework.pdf", "Risk Register and Management Framework");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nGenerating PDFs → ${OUT_DIR}\n`);

  await genTerms();
  await genRefund();
  await genDataProtection();
  await genComplaints();
  await genReasonableAdjustments();
  await genAppeals();
  await genHealthSafety();
  await genQuality();
  await genAssessment();
  await genInternalVerification();
  await genMalpractice();
  await genEDI();
  await genSafeguarding();
  await genEnvironmental();
  await genIIRSMBrief();
  await genDocumentControl();
  await genManagementReview();
  await genNonconformance();
  await genInternalAuditProc();
  await genSupplierEvaluation();
  await genInfoSecurity();
  await genAccessControl();
  await genDataBreachResponse();
  await genBCP();
  await genIncidentReporting();
  await genEmergency();
  await genCompetenceFramework();
  await genRiskRegister();

  console.log("\n✅  All PDFs generated successfully.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
