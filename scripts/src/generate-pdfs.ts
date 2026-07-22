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

const ORANGE = "#D97706";
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
      `${docTitle}  ·  Overleaf Publishers Ltd  ·  chainsawcourses.com  ·  info@chainsawcourses.com  ·  ${version}  ·  July 2026  ·  Confidential`,
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
    .text("Overleaf Publishers Ltd  ·  Version 1.0  ·  July 2026  ·  chainsawcourses.com");
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

// ─── 7. Health & Safety Policy ───────────────────────────────────────────────

async function genHealthSafety(): Promise<void> {
  const doc = newDoc("Health & Safety Policy");
  drawPageHeader(doc);
  docTitle(doc, "Health & Safety Policy");

  sectionHeading(doc, "1. Statement of Intent");
  body(doc,
    "Overleaf Publishers Ltd is committed to ensuring the health, safety, and welfare of all learners, staff, contractors, and stakeholders associated with the Chainsaw Courses platform. We acknowledge our responsibilities under the Health and Safety at Work etc. Act 1974 and all relevant subordinate legislation, and we will take all reasonably practicable steps to fulfil those responsibilities."
  );

  sectionHeading(doc, "2. Scope");
  body(doc,
    "This policy applies to all activities associated with the delivery of the Chainsaw Courses eLearning platform, including course development, content review, platform maintenance, and learner support. As an online eLearning provider, our primary health and safety considerations relate to:"
  );
  bullet(doc, [
    "Digital wellbeing: screen time guidance and encouragement of regular breaks during prolonged study sessions.",
    "Content accuracy: ensuring all safety-critical information in the course is current, accurate, and aligned with HSE and FISA guidance.",
    "Learner welfare: signposting learners to appropriate support services if they encounter distressing content.",
    "Staff and contractor wellbeing: applying DSE (Display Screen Equipment) Regulations 1992 to all remote workers.",
  ]);

  sectionHeading(doc, "3. Responsibilities");
  body(doc, "Director / Owner:");
  bullet(doc, [
    "Overall responsibility for health and safety policy, compliance, and review.",
    "Ensuring adequate resources are allocated to maintain a safe and healthy working and learning environment.",
    "Reviewing this policy annually or following any significant change.",
  ]);
  body(doc, "\nContent Authors and Contributors:");
  bullet(doc, [
    "Ensuring all course content is factually accurate and reflects current HSE, FISA, and legislative guidance.",
    "Notifying the Director of any identified inaccuracies in safety-critical content without delay.",
  ]);
  body(doc, "\nLearners:");
  bullet(doc, [
    "Completing the digital waiver before accessing course content.",
    "Seeking qualified practical training before undertaking any chainsaw operation.",
    "Adhering to all applicable health and safety legislation in their workplace.",
  ]);

  sectionHeading(doc, "4. Risk Assessment");
  body(doc,
    "A risk assessment covering the platform's activities and potential harm pathways has been completed and is reviewed annually. Key risks identified include: learners applying theoretical knowledge without appropriate practical training; content becoming outdated relative to legislative changes; and technical failures that disrupt access to safety-critical information. Control measures are in place for each identified risk."
  );

  sectionHeading(doc, "5. Monitoring and Review");
  body(doc,
    "This policy will be reviewed annually or immediately following: any significant change in applicable legislation or HSE/FISA guidance; any accident, incident, or near-miss related to the platform's operations; or any feedback from learners or external auditors that identifies a health or safety concern. The review date and version number are updated at each review."
  );

  sectionHeading(doc, "6. Contact");
  body(doc,
    "Any health and safety concerns relating to the Chainsaw Courses platform should be reported to info@chainsawcourses.com. Concerns about course content accuracy will be escalated to the content author immediately and addressed within 5 working days."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Health_and_Safety_Policy.pdf", "Health & Safety Policy");
}

// ─── 8. Quality Management Policy ───────────────────────────────────────────

async function genQuality(): Promise<void> {
  const doc = newDoc("Quality Management Policy");
  drawPageHeader(doc);
  docTitle(doc, "Quality Management Policy");

  sectionHeading(doc, "1. Commitment to Quality");
  body(doc,
    "Overleaf Publishers Ltd is committed to designing, developing, and delivering the Chainsaw Courses eLearning platform to the highest standards of educational quality. Our Quality Management Policy provides the framework within which we continuously review and improve our course content, assessment methodology, learner support, and platform performance. This policy is aligned with IIRSM course approval requirements and wider UK vocational training quality standards."
  );

  sectionHeading(doc, "2. Quality Objectives");
  bullet(doc, [
    "Ensure all course content is accurate, current, and aligned with HSE, FISA, and legislative requirements.",
    "Achieve and maintain IIRSM eLearning Course Approval.",
    "Deliver a seamless, technically reliable platform experience for all learners.",
    "Maintain assessment validity and reliability at or above the 80% competency threshold.",
    "Respond to learner feedback within the timescales set out in the Complaints Procedure.",
    "Review and update course content at least annually, or immediately following any material change in regulation or guidance.",
  ]);

  sectionHeading(doc, "3. Course Design and Development");
  body(doc,
    "All course content is developed by or under the direct supervision of a qualified chainsaw professional holding relevant NPTC/City & Guilds certificates of competence. Content is cross-referenced against the current HSE/FISA guidance series, UK legislation, and the Overleaf Chainsaw Manual. All quiz questions and mock examination items are reviewed for accuracy, clarity, and alignment with the stated learning outcomes before publication."
  );

  sectionHeading(doc, "4. Content Review Schedule");
  twoColTable(doc, ["Trigger", "Action Required"], [
    ["Annual scheduled review", "Full content audit against current HSE/FISA guidance and legislation"],
    ["New HSE or FISA publication", "Targeted content review within 30 days of publication"],
    ["Legislative change", "Urgent content review; platform notice issued to active learners"],
    ["Learner feedback flagging inaccuracy", "Content review within 5 working days; correction if substantiated"],
    ["IIRSM audit or feedback", "Response and corrective action within timescales set by IIRSM"],
  ], 220);

  sectionHeading(doc, "5. Learner Feedback");
  body(doc,
    "Learner feedback is collected at the end of each training module via the in-platform feedback tool. Feedback is reviewed monthly by the course author and Director. Themes and trends are identified, and any content improvements arising from feedback are documented in the quality improvement log. Aggregate feedback data is reported to IIRSM as part of the annual course approval review."
  );

  sectionHeading(doc, "6. Continuous Improvement");
  body(doc,
    "Quality improvement is an ongoing process. All complaints, appeals, feedback, internal verification outcomes, and audit results are reviewed and used to inform course improvements. A quality improvement log is maintained and reviewed quarterly. The Director has overall responsibility for quality and signs off all material changes to course content."
  );

  sectionHeading(doc, "7. Policy Review");
  body(doc,
    "This Quality Management Policy will be reviewed annually or following any significant change in the regulatory environment, IIRSM requirements, or learner feedback. The version number and date are updated at each review."
  );

  body(doc, "\nFor queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");
  await save(doc, "Quality_Management_Policy.pdf", "Quality Management Policy");
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
    "Packaging for posted manuals uses recyclable and minimal materials.",
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

  console.log("\n✅  All PDFs generated successfully.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
