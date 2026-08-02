/**
 * Generates a Dynamic Site Risk Assessment PDF and returns it as a Buffer.
 * Used by both the admin HTTP download endpoint and the Drive upload flow.
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export type HazardEntry = {
  id: string;
  label: string;
  likelihood: number;
  severity: number;
  riskRating: number;
  controlMeasures?: string;
  isCustom?: boolean;
};

export type RiskAssessmentRecord = {
  id: number;
  siteDescription: string | null;
  taskDescription: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  gridReference: string | null;
  what3Words: string | null;
  nearestHospital: string | null;
  hospitalPhone: string | null;
  siteAccess: string | null;
  meetingPoint: string | null;
  firstAidKit: string | null;
  nearestAed: string | null;
  nearestSignal: string | null;
  hazards: HazardEntry[];
  createdAt: Date;
  amendedAt: Date | null;
  studentName: string;
};

function riskBand(rating: number): { label: string; r: number; g: number; b: number } {
  if (rating >= 15) return { label: "HIGH", r: 220, g: 38,  b: 38 };
  if (rating >= 8)  return { label: "MED",  r: 217, g: 119, b: 6  };
  return                   { label: "LOW",  r: 22,  g: 163, b: 74 };
}

export function generateRiskAssessmentPdf(record: RiskAssessmentRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const orange = "#D97706";
    const dark = "#1C1C1C";
    const mid = "#555555";
    const L = 50;
    const R = 545;
    const W = R - L;

    const dateStr = record.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = record.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // Header
    const logoPath = path.resolve(process.cwd(), "../chainsaw-training/public/logo.png");
    const logoSize = 52;
    const headerY = 40;
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L, headerY, { width: logoSize, height: logoSize });
    }
    const textX = fs.existsSync(logoPath) ? L + logoSize + 12 : L;
    doc.fontSize(20).fillColor(orange).font("Helvetica-Bold").text("Chainsaw Courses", textX, headerY + 4, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text("CHAINSAW MAINTENANCE & CROSS CUTTING", textX, headerY + 30, { lineBreak: false });
    doc.text("", L, headerY + logoSize + 10);
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor(orange).lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    doc.fontSize(14).fillColor(dark).font("Helvetica-Bold").text("DYNAMIC SITE RISK ASSESSMENT", L, doc.y, { align: "left" });
    doc.moveDown(0.6);

    // Student / date bar
    const amendedDateStr = record.amendedAt ? record.amendedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null;
    const amendedTimeStr = record.amendedAt ? record.amendedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
    const barH = record.amendedAt ? 40 : 28;
    const barY = doc.y;
    doc.rect(L, barY, W, barH).fill("#F3F4F6");
    doc.fontSize(9).fillColor(dark).font("Helvetica-Bold").text(record.studentName ?? "—", L + 8, barY + 5, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text(`${dateStr}  ${timeStr}`, L + 8, barY + 16, { lineBreak: false });
    if (record.amendedAt) {
      doc.fontSize(9).fillColor(orange).font("Helvetica-Bold").text(`Amended: ${amendedDateStr}  ${amendedTimeStr}`, L + 8, barY + 28, { lineBreak: false });
    }
    doc.text("", L, barY + barH + 7);

    // Task & site section
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("TASK DESCRIPTION", L);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor(dark).font("Helvetica").text(record.taskDescription, L, doc.y, { width: W });
    doc.moveDown(0.6);

    if (record.siteDescription) {
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("SITE DESCRIPTION");
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor(dark).font("Helvetica").text(record.siteDescription, L, doc.y, { width: W });
      doc.moveDown(0.6);
    }

    if (record.address || record.gridReference || record.latitude || record.what3Words) {
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("SITE LOCATION");
      doc.moveDown(0.2);
      if (record.address) doc.fontSize(10).fillColor(dark).font("Helvetica").text(record.address, L, doc.y, { width: W });
      if (record.gridReference) doc.fontSize(9).fillColor(mid).font("Helvetica").text(`OS National Grid Reference: ${record.gridReference}`);
      if (record.what3Words) doc.fontSize(9).fillColor(mid).font("Helvetica").text(`What3Words: ${record.what3Words}`);
      if (record.latitude && record.longitude) doc.fontSize(9).fillColor(mid).font("Helvetica").text(`Coordinates: ${record.latitude}, ${record.longitude}`);
      doc.moveDown(0.6);
    }

    // Emergency & site safety section
    const emergencyFields: [string, string | null][] = [
      ["Nearest A&E Hospital",     record.nearestHospital],
      ["Hospital Phone Number",    record.hospitalPhone],
      ["Nearest AED (if known)",   record.nearestAed],
      ["Site First Aid Kit Location", record.firstAidKit],
      ["Nearest Phone Signal",     record.nearestSignal],
      ["Meeting Point",            record.meetingPoint],
      ["Site Access",              record.siteAccess],
    ];
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("EMERGENCY & SITE SAFETY INFO");
    doc.moveDown(0.25);
    const emgBoxY = doc.y;
    const emgH = emergencyFields.length * 14 + 8;
    doc.rect(L, emgBoxY, W, emgH).fill("#FFF7ED");
    let ey = emgBoxY + 5;
    for (const [label, value] of emergencyFields) {
      doc.fontSize(8).fillColor(mid).font("Helvetica-Bold").text(`${label}:`, L + 6, ey, { lineBreak: false, width: 170 });
      doc.fontSize(8).fillColor(value ? dark : "#AAAAAA").font("Helvetica").text(value ?? "—", L + 180, ey, { lineBreak: false, width: W - 186 });
      ey += 14;
    }
    doc.text("", L, emgBoxY + emgH + 6);
    doc.moveDown(0.4);

    // Hazards table
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("HAZARD ASSESSMENT");
    doc.moveDown(0.3);

    const colW = { hazard: 140, like: 38, sev: 38, risk: 58, controls: W - 140 - 38 - 38 - 58 };
    const rowH = 16;
    const tableX = L;
    let ty = doc.y;

    doc.rect(tableX, ty, W, rowH).fill(orange);
    let cx = tableX;
    doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
    doc.text("HAZARD",           cx + 4, ty + 4, { width: colW.hazard - 8,   lineBreak: false, align: "center" }); cx += colW.hazard;
    doc.text("LIKE.",            cx + 3, ty + 4, { width: colW.like - 6,     lineBreak: false, align: "center" }); cx += colW.like;
    doc.text("SEV.",             cx + 3, ty + 4, { width: colW.sev - 6,      lineBreak: false, align: "center" }); cx += colW.sev;
    doc.text("RISK",             cx + 3, ty + 4, { width: colW.risk - 6,     lineBreak: false, align: "center" }); cx += colW.risk;
    doc.text("CONTROL MEASURES", cx + 4, ty + 4, { width: colW.controls - 8, lineBreak: false, align: "center" });
    ty += rowH;

    for (let i = 0; i < record.hazards.length; i++) {
      const h = record.hazards[i];
      const band = riskBand(h.riskRating);
      const isEven = i % 2 === 0;
      const ctrlText = h.controlMeasures || "None recorded";
      const ctrlLines = Math.ceil(doc.heightOfString(ctrlText, { width: colW.controls - 8 }) / doc.currentLineHeight());
      const hazLines  = Math.ceil(doc.heightOfString(h.label,   { width: colW.hazard  - 8 }) / doc.currentLineHeight());
      const dynH = Math.max(rowH, Math.max(ctrlLines, hazLines) * doc.currentLineHeight() + 6);

      if (ty + dynH > 780) { doc.addPage(); ty = 50; }

      if (isEven) doc.rect(tableX, ty, W, dynH).fill("#F9FAFB");
      doc.rect(tableX, ty, W, dynH).strokeColor("#E5E7EB").lineWidth(0.4).stroke();

      cx = tableX;
      doc.fillColor(dark).fontSize(9).font("Helvetica");
      doc.text(h.label, cx + 4, ty + 4, { width: colW.hazard - 8, lineBreak: false }); cx += colW.hazard;
      doc.text(String(h.likelihood), cx + 3, ty + 4, { width: colW.like - 6, lineBreak: false, align: "center" }); cx += colW.like;
      doc.text(String(h.severity),   cx + 3, ty + 4, { width: colW.sev  - 6, lineBreak: false, align: "center" }); cx += colW.sev;

      const badgeW = colW.risk - 10;
      const badgeX = cx + 5;
      doc.rect(badgeX, ty + 3, badgeW, 11).fill(`rgb(${band.r},${band.g},${band.b})`);
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold")
         .text(`${band.label} (${h.riskRating})`, badgeX + 2, ty + 5, { width: badgeW - 4, lineBreak: false, align: "center" });
      cx += colW.risk;

      doc.fillColor(dark).fontSize(9).font("Helvetica");
      doc.text(ctrlText, cx + 4, ty + 4, { width: colW.controls - 8 });

      ty += dynH;
    }

    doc.text("", L, ty + 8);
    doc.moveDown(1.5);

    // Footer
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.fontSize(7).fillColor(mid).font("Helvetica")
       .text("Personal working record only — does not replace a formal risk assessment, method statement, or employer RAMS process.", L, doc.y, { align: "center", width: W });
    doc.fontSize(7).fillColor(mid).text("Always follow current HSE guidance and your employer's procedures. © Chainsaw Courses.", { align: "center", width: W });

    doc.end();
  });
}
