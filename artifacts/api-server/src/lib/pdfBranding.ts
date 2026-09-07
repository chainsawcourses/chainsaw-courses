import fs from "fs";
import path from "path";

const publicCandidates = [
  path.resolve("artifacts/chainsaw-training/public"),
  path.resolve("../chainsaw-training/public"),
  path.resolve("../../artifacts/chainsaw-training/public"),
];

const publicDir =
  publicCandidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  }) ?? publicCandidates[0];

export function publicAssetPath(filename: string): string {
  return path.join(publicDir, filename);
}

type HeaderOptions = {
  left?: number;
  right?: number;
  y?: number;
  chainsawLogoSize?: number;
  titleSize?: number;
  subtitleSize?: number;
};

/**
 * Draws the shared Chainsaw Courses + official IIRSM Approved Course header
 * used by PDFKit-generated learner and admin documents.
 */
export function drawApprovedPdfKitHeader(
  doc: PDFKit.PDFDocument,
  options: HeaderOptions = {},
): void {
  const left = options.left ?? 50;
  const right = options.right ?? 545;
  const y = options.y ?? 40;
  const chainsawLogoSize = options.chainsawLogoSize ?? 52;
  const titleSize = options.titleSize ?? 20;
  const subtitleSize = options.subtitleSize ?? 8;
  const orange = "#D97706";
  const mid = "#555555";

  const chainsawLogo = publicAssetPath("logo.png");
  const approvalLogo = publicAssetPath("iirsm-horizontal-logo.png");
  const hasChainsawLogo = fs.existsSync(chainsawLogo);
  const hasApprovalLogo = fs.existsSync(approvalLogo);
  const approvalWidth = hasApprovalLogo ? Math.min(148, (right - left) * 0.31) : 0;
  const textX = hasChainsawLogo ? left + chainsawLogoSize + 12 : left;
  const textRight = hasApprovalLogo ? right - approvalWidth - 12 : right;

  if (hasChainsawLogo) {
    doc.image(chainsawLogo, left, y, {
      width: chainsawLogoSize,
      height: chainsawLogoSize,
    });
  }

  doc
    .fontSize(titleSize)
    .fillColor(orange)
    .font("Helvetica-Bold")
    .text("Chainsaw Courses", textX, y + 4, {
      width: Math.max(120, textRight - textX),
      lineBreak: false,
    });
  doc
    .fontSize(subtitleSize)
    .fillColor(mid)
    .font("Helvetica")
    .text("CHAINSAW MAINTENANCE & CROSS CUTTING", textX, y + 30, {
      width: Math.max(120, textRight - textX),
      lineBreak: false,
    });

  if (hasApprovalLogo) {
    doc.image(approvalLogo, right - approvalWidth, y - 3, {
      width: approvalWidth,
    });
  }

  const approvalHeight = approvalWidth / 2.3;
  const blockHeight = Math.max(chainsawLogoSize, approvalHeight);
  doc.text("", left, y + blockHeight + 8);
  doc
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .strokeColor(orange)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.8);
}