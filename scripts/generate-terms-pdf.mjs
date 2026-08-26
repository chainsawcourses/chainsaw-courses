import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFDocument = require('/home/runner/workspace/node_modules/.pnpm/pdfkit@0.19.1/node_modules/pdfkit/js/pdfkit.js');
import fs from 'fs';
import path from 'path';

const OUTPUT = path.resolve('/home/runner/workspace/generated-docs/chainsaw-courses-terms-and-conditions.pdf');
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

// ─── Palette ────────────────────────────────────────────────────────────────
const ORANGE    = '#D97706';
const DARK      = '#1A1A1A';
const MID       = '#4B4B4B';
const LIGHT     = '#6B7280';
const RULE      = '#E5E7EB';
const ACCENT_BG = '#FFF8ED';

// Top margin must be tall enough for the page header (logo + rule sit within 85pt)
const MARGIN_TOP    = 92;
const MARGIN_SIDE   = 60;
const MARGIN_BOTTOM = 55;

const doc = new PDFDocument({
  size: 'A4',
  bufferPages: true,
  margins: {
    top:    MARGIN_TOP,
    bottom: MARGIN_BOTTOM,
    left:   MARGIN_SIDE,
    right:  MARGIN_SIDE,
  },
});

const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

const PAGE_W  = 595.28;
const PAGE_H  = 841.89;
const W       = PAGE_W - MARGIN_SIDE * 2;   // usable text width

// ─── Layout helpers ─────────────────────────────────────────────────────────
function hRule(color = RULE) {
  doc.moveTo(MARGIN_SIDE, doc.y)
     .lineTo(MARGIN_SIDE + W, doc.y)
     .strokeColor(color).lineWidth(0.6).stroke();
}

function sectionHeader(number, title) {
  doc.moveDown(0.8);
  const barH = 19;
  const barY = doc.y;
  doc.rect(MARGIN_SIDE, barY, W, barH).fill('#FEF3C7');
  doc.rect(MARGIN_SIDE, barY, 4, barH).fill(ORANGE);
  doc.fontSize(9.5)
     .fillColor(DARK)
     .font('Helvetica-Bold')
     .text(`${number}. ${title.toUpperCase()}`, MARGIN_SIDE + 12, barY + 4, { width: W - 16, lineBreak: false });
  doc.y = barY + barH + 9;
}

function clause(number, text) {
  const numW  = 34;
  const textX = MARGIN_SIDE + numW;
  const textW = W - numW;
  const startY = doc.y;
  doc.fontSize(9).fillColor(ORANGE).font('Helvetica-Bold')
     .text(number, MARGIN_SIDE, startY, { width: numW, lineBreak: false });
  doc.fontSize(9).fillColor(DARK).font('Helvetica')
     .text(text, textX, startY, { width: textW, lineGap: 2 });
  doc.moveDown(0.45);
}

function bulletList(items) {
  const bulletX = MARGIN_SIDE + 34;
  const textX   = bulletX + 11;
  const textW   = W - 34 - 11;
  for (const item of items) {
    const y = doc.y;
    doc.fontSize(9).fillColor(ORANGE).font('Helvetica-Bold')
       .text('•', bulletX, y, { lineBreak: false });
    doc.fontSize(9).fillColor(DARK).font('Helvetica')
       .text(item, textX, y, { width: textW, lineGap: 2 });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.3);
}

function calloutBox(label, text) {
  const PADDING = 10;
  const LABEL_H = 13;
  const textW   = W - PADDING * 2;

  // Measure text height accurately
  doc.fontSize(8.5).font('Helvetica');
  const textH = doc.heightOfString(text, { width: textW });
  const boxH  = PADDING + LABEL_H + textH + PADDING;

  const boxY = doc.y;
  doc.rect(MARGIN_SIDE, boxY, W, boxH).fill(ACCENT_BG);
  doc.rect(MARGIN_SIDE, boxY, 3, boxH).fill(ORANGE);

  // Label
  doc.fontSize(7.5).fillColor(ORANGE).font('Helvetica-Bold')
     .text(label, MARGIN_SIDE + PADDING, boxY + PADDING, { width: textW, lineBreak: false });

  // Body
  doc.fontSize(8.5).fillColor(MID).font('Helvetica')
     .text(text, MARGIN_SIDE + PADDING, boxY + PADDING + LABEL_H, { width: textW, lineGap: 2 });

  doc.y = boxY + boxH + 10;
}

// ─── CONTENT ────────────────────────────────────────────────────────────────

// Title block
doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold').text('Terms and Conditions', { align: 'center' });
doc.fontSize(12).fillColor(MID).font('Helvetica').text('of Service & Sale', { align: 'center' });
doc.moveDown(0.4);
doc.fontSize(8.5).fillColor(LIGHT).font('Helvetica').text(
  'Overleaf Publishers Ltd (trading as chainsawcourses.com)  ·  Last Updated: July 2026',
  { align: 'center' }
);
doc.moveDown(0.5);
hRule();
doc.moveDown(0.6);

// Intro paragraph
doc.fontSize(9).fillColor(MID).font('Helvetica').text(
  'Please read these Terms and Conditions carefully before purchasing or accessing any course, digital material, or companion manual from Overleaf Publishers Ltd. By completing a purchase, redeeming an activation code, or using the chainsawcourses.com platform, you agree to be bound by these Terms in full.',
  { lineGap: 3 }
);

// ── Section 1 ───────────────────────────────────────────────────────────────
sectionHeader('1', 'Company Information & Agreement');
clause('1.1', 'These Terms and Conditions ("Terms") govern the purchase, access, and use of e-learning courses, digital materials, and companion reference manuals provided by Overleaf Publishers Ltd (Company Registration Number: pending), trading as chainsawcourses.com ("we", "us", "our", "the Company").');
clause('1.2', 'Registered Office: 69 Newstead Avenue, Orpington, BR6 9RW, United Kingdom.');
clause('1.3', 'Contact Email: info@chainsawcourses.com. All formal correspondence, cancellation requests, and complaints must be submitted in writing to this address.');
clause('1.4', 'By purchasing, registering, or activating an account on chainsawcourses.com, you ("the Learner", "the Client", "you") agree to be bound by these Terms in full. If you do not agree, you must not access or use our services.');

// ── Section 2 ───────────────────────────────────────────────────────────────
sectionHeader('2', 'Scope of Service & Course Access');
clause('2.1', 'Overleaf Publishers Ltd provides theory-only digital e-learning courses delivered via a Progressive Web Application (PWA), alongside optional companion physical reference literature ("The Chainsaw Manual").');
clause('2.2', 'Device-Locked Access: Course modules are accessed via a unique single-use activation code. Upon redemption, the digital credential is bonded to the Learner\'s primary login device and browser environment. This measure prevents unauthorised credential sharing and protects the integrity of our software.');
clause('2.3', 'Course access is granted for a minimum period of 12 months from the date of activation. During this period, the Learner may complete video modules, undertake quiz assessments, and access course resources at any time.');
clause('2.4', 'We reserve the right to update or improve course content during the access period. Such updates will be made available to active Learners at no additional cost.');

// ── Section 3 ───────────────────────────────────────────────────────────────
sectionHeader('3', 'Cancellation & Refund Policy');
calloutBox('YOUR CONSUMER RIGHTS', 'As a consumer purchasing digital goods online from within the United Kingdom, you are protected by the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013. The provisions below explain precisely how those rights apply to our digital products.');
clause('3.1', 'Statutory 14-Day Cooling-Off Period: You have the right to cancel your order within 14 days of purchase without giving any reason, provided the conditions in clause 3.3 are met.');
clause('3.2', 'Waiver of Right Upon Digital Access: In accordance with UK consumer law governing digital content, if you log in, redeem your activation code, or begin streaming or downloading any course module within the 14-day period, you explicitly request immediate performance of the contract. In doing so, you acknowledge and accept that you waive your right to cancel and receive a refund.');
clause('3.3', 'Eligible Refund Conditions: A full 100% refund will be issued only where all of the following conditions are satisfied:');
bulletList([
  'A written cancellation request is submitted to info@chainsawcourses.com within 14 calendar days of the date of purchase; AND',
  'The digital activation code has not been redeemed, activated, or used on any device; AND',
  'No course video, module content, or digital material has been accessed or streamed.',
]);
clause('3.4', 'Physical Companion Manuals: Where a physical copy of "The Chainsaw Manual" was dispatched as part of a bundle, it must be returned unopened, undamaged, and in fully resalable condition at the buyer\'s cost before any refund for the physical component can be processed. Digital course and physical book refunds are assessed independently.');
clause('3.5', 'Refund Processing: Approved refunds will be processed within 14 days of the Company confirming eligibility, via the original payment method.');

// ── Section 4 ───────────────────────────────────────────────────────────────
sectionHeader('4', 'Theory-Only Legal & Practical Disclaimer');
calloutBox('IMPORTANT SAFETY NOTICE', 'Our courses provide theoretical preparation only. No e-learning certificate issued by Chainsaw Courses constitutes a licence, practical qualification, or authorisation to operate a chainsaw in a professional or commercial capacity.');
clause('4.1', 'Theoretical Preparation Only: All courses on chainsawcourses.com are theory-only educational modules designed to support continuing professional development (CPD) and examination preparation. Completion of a course, or the issuance of a digital certificate, does NOT grant practical qualification, physical competency certification, or an NPTC/Lantra practical licence to operate a chainsaw.');
clause('4.2', 'Independent Practical Assessment Required: Candidates seeking a recognised practical ticket must independently book and complete a practical assessment through a registered NPTC or Lantra assessment centre. The Company has no affiliation with such centres and is not responsible for assessment availability, scheduling, or outcomes.');
clause('4.3', 'Limitation of Liability: Chainsaws are inherently dangerous machines. Overleaf Publishers Ltd accepts no liability whatsoever for personal injury, death, property damage, or financial loss resulting from the practical application of any technique, maintenance procedure, or operation described within our digital courses or companion manuals. All physical chainsaw operations must comply with HSE regulations, manufacturer guidelines, applicable legislation, and a properly documented risk assessment.');

// ── Section 5 ───────────────────────────────────────────────────────────────
sectionHeader('5', 'Assessments, Pass Thresholds & Certification');
clause('5.1', 'Pass Mark: To successfully complete a course and receive a digital certificate, the Learner must achieve a score of 80% or higher on the randomised summative examination.');
clause('5.2', 'Resits: Unlimited examination resits are permitted at no additional charge. There is no waiting period between attempts.');
clause('5.3', 'Certificate Issuance: Upon achieving a passing score, a digital PDF certificate bearing the Learner\'s full name, course title, completion date, and a unique verification reference will be generated automatically and delivered by email.');
clause('5.4', 'Certificate Validity: Our digital certificates are evidence of theoretical study and examination performance. They do not constitute formal qualifications under any regulatory or licensing framework.');

// ── Section 6 ───────────────────────────────────────────────────────────────
sectionHeader('6', 'Intellectual Property & Copyright');
clause('6.1', 'All course curricula, streaming video content, software code, graphics, diagrams, text, assessments, and physical literature (including "The Chainsaw Manual") are the exclusive intellectual property of Overleaf Publishers Ltd and David J Daniel, protected under UK and international copyright law.');
clause('6.2', 'Licence to Learners: Upon activation, Learners are granted a limited, non-exclusive, non-transferable personal licence to access and view the course materials for private educational use only. This licence does not transfer any ownership rights.');
clause('6.3', 'Prohibited Uses: Users strictly must not:');
bulletList([
  'Screen-record, download, rip, or otherwise reproduce course video files by any means.',
  'Copy, distribute, sell, sublicense, or share activation codes or login credentials with any third party.',
  'Reproduce, republish, or adapt course text, technical diagrams, or assessment content for commercial training, resale, or redistribution without prior written consent from Overleaf Publishers Ltd.',
]);
clause('6.4', 'Any breach of this clause may result in immediate termination of access without refund, and may give rise to legal proceedings for copyright infringement.');

// ── Section 7 ───────────────────────────────────────────────────────────────
sectionHeader('7', 'Data Protection & Privacy');
clause('7.1', 'Personal data collected during registration, payment, and course use (including name, email address, device information, and assessment records) is processed securely in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.');
clause('7.2', 'Data Security: All data transmissions between the Learner and our platform are protected using TLS 1.3 encryption. We do not store full payment card details; payments are processed by PCI-DSS compliant third-party providers.');
clause('7.3', 'Your Rights: Under UK GDPR, you have the right to access, correct, or request erasure of your personal data at any time. To exercise these rights, please contact info@chainsawcourses.com. Full details are available in our Privacy Policy at chainsawcourses.com/privacy.');

// ── Section 8 ───────────────────────────────────────────────────────────────
sectionHeader('8', 'Complaints & Governing Law');
clause('8.1', 'Complaints Procedure: If you are dissatisfied with any aspect of our service, please submit your complaint in writing to info@chainsawcourses.com. All complaints will be acknowledged within 3 business days and resolved in accordance with our formal Complaints Policy.');
clause('8.2', 'Governing Law: These Terms and Conditions are governed by and construed in accordance with the laws of England and Wales. Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.');
clause('8.3', 'Severability: If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision shall be severed and shall not affect the validity and enforceability of the remaining provisions.');
clause('8.4', 'Entire Agreement: These Terms, together with our Privacy Policy and any order confirmation, constitute the entire agreement between the Company and the Learner relating to the subject matter herein and supersede all prior representations, understandings, or agreements.');

// Footer rule + company line (last page only — will be on whichever page content ends)
doc.moveDown(1.5);
hRule();
doc.moveDown(0.5);
doc.fontSize(8).fillColor(LIGHT).font('Helvetica').text(
  'Overleaf Publishers Ltd  ·  Registered in England and Wales  ·  69 Newstead Avenue, Orpington, BR6 9RW\ninfo@chainsawcourses.com  ·  chainsawcourses.com  ·  © 2026 Overleaf Publishers Ltd. All rights reserved.',
  { align: 'center', lineGap: 3 }
);

// ─── POST-PROCESSING: stamp header + page numbers on every buffered page ────
const iirsmHorizontalLogoPath = path.resolve('/home/runner/workspace/artifacts/chainsaw-training/public/iirsm-horizontal-logo.png');
const iirsmHorizontalLogoExists = fs.existsSync(iirsmHorizontalLogoPath);
const iirsmHorizontalLogoBuffer = iirsmHorizontalLogoExists ? fs.readFileSync(iirsmHorizontalLogoPath) : null;

const range = doc.bufferedPageRange();
const totalPages = range.count;

for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);

  // Zero out margins during post-processing so no overflow/new-page triggers fire.
  // We restore them after each page stamp.
  const savedMargins = { ...doc.page.margins };
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

  // ── Page header (all pages) ────────────────────────────────────────────
  const HY = 28; // top of header zone

  if (iirsmHorizontalLogoBuffer) {
    doc.image(iirsmHorizontalLogoBuffer, MARGIN_SIDE, HY, { width: 78, height: 34 });
    doc.fontSize(13).fillColor(ORANGE).font('Helvetica-Bold')
       .text('Chainsaw Courses', MARGIN_SIDE + 86, HY + 3, { lineBreak: false });
    doc.fontSize(7.5).fillColor(LIGHT).font('Helvetica')
       .text('OVERLEAF PUBLISHERS LTD  ·  chainsawcourses.com', MARGIN_SIDE + 86, HY + 21, { lineBreak: false });
  } else {
    doc.fontSize(13).fillColor(ORANGE).font('Helvetica-Bold')
       .text('Chainsaw Courses', MARGIN_SIDE, HY + 3, { lineBreak: false });
    doc.fontSize(7.5).fillColor(LIGHT).font('Helvetica')
       .text('OVERLEAF PUBLISHERS LTD  ·  chainsawcourses.com', MARGIN_SIDE, HY + 21, { lineBreak: false });
  }

  // Orange rule under header
  doc.moveTo(MARGIN_SIDE, 70)
     .lineTo(MARGIN_SIDE + W, 70)
     .strokeColor(ORANGE).lineWidth(1.2).stroke();

  // ── Page number (bottom right) ─────────────────────────────────────────
  doc.fontSize(7.5).fillColor(LIGHT).font('Helvetica')
     .text(
       `Page ${i + 1} of ${totalPages}`,
       MARGIN_SIDE,
       PAGE_H - 28,
       { width: W, align: 'right', lineBreak: false }
     );

  // Restore margins so subsequent page switches behave normally
  doc.page.margins = savedMargins;
}

doc.end();

await new Promise((resolve, reject) => {
  stream.on('finish', resolve);
  stream.on('error', reject);
});

console.log(`PDF written (${totalPages} pages): ${OUTPUT}`);
