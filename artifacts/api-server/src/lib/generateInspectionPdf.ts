/**
 * Generates a Pre-Start / Pre-Use Inspection Checklist PDF and returns it as a Buffer.
 * Used by both the admin HTTP download endpoint and the Drive upload flow.
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export type InspectionItem = {
  id: string;
  label: string;
  section: string;
  status: "pass" | "fail" | "na";
  note?: string;
};

export type InspectionRecord = {
  id: number;
  sawIdentifier: string | null;
  items: InspectionItem[];
  hasFailures: boolean;
  createdAt: Date;
  amendedAt: Date | null;
  studentName: string;
};

export function generateInspectionPdf(record: InspectionRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const orange = "#D97706";
    const dark = "#1C1C1C";
    const mid = "#555555";
    const green = "#16A34A";
    const red = "#DC2626";
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

    doc.fontSize(14).fillColor(dark).font("Helvetica-Bold").text("PRE-START & PRE-USE INSPECTION CHECKLIST", L, doc.y);
    doc.moveDown(0.6);

    // Student / date bar
    const amendedDateStr = record.amendedAt ? record.amendedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null;
    const amendedTimeStr = record.amendedAt ? record.amendedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
    const extraLines = (record.sawIdentifier ? 1 : 0) + (record.amendedAt ? 1 : 0);
    const barH = 28 + extraLines * 12;
    const barY = doc.y;
    doc.rect(L, barY, W, barH).fill("#F3F4F6");
    doc.fontSize(9).fillColor(dark).font("Helvetica-Bold").text(record.studentName ?? "—", L + 8, barY + 5, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text(`${dateStr}  ${timeStr}`, L + 8, barY + 16, { lineBreak: false });
    let infoLineY = barY + 28;
    if (record.sawIdentifier) {
      doc.fontSize(9).fillColor(mid).font("Helvetica").text(`Saw / Equipment: ${record.sawIdentifier}`, L + 8, infoLineY, { lineBreak: false });
      infoLineY += 12;
    }
    if (record.amendedAt) {
      doc.fontSize(9).fillColor(orange).font("Helvetica-Bold").text(`Amended: ${amendedDateStr}  ${amendedTimeStr}`, L + 8, infoLineY, { lineBreak: false });
    }
    doc.text("", L, barY + barH + 8);

    // Columns
    const colW = { item: 230, status: 65, notes: W - 230 - 65 };
    const rowH = 16;
    const sections = Array.from(new Set(record.items.map((i) => i.section)));

    for (const section of sections) {
      const sectionItems = record.items.filter((i) => i.section === section);

      doc.moveDown(0.5);
      if (doc.y > 740) { doc.addPage(); doc.y = 50; }
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text(section.toUpperCase() + " CHECKS", L, doc.y);
      doc.moveDown(0.3);

      let ty = doc.y;

      // Table header
      doc.rect(L, ty, W, rowH).fill(orange);
      let cx = L;
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
      doc.text("CHECK ITEM", cx + 4, ty + 4, { width: colW.item - 8, lineBreak: false, align: "center" }); cx += colW.item;
      doc.text("RESULT",     cx + 3, ty + 4, { width: colW.status - 6, lineBreak: false, align: "center" }); cx += colW.status;
      doc.text("NOTES",      cx + 4, ty + 4, { width: colW.notes - 8, lineBreak: false, align: "center" });
      ty += rowH;

      for (let i = 0; i < sectionItems.length; i++) {
        const item = sectionItems[i];
        const noteText = item.note ?? "";
        doc.fontSize(9).font("Helvetica");
        const labelH = doc.heightOfString(item.label, { width: colW.item - 8 });
        doc.fontSize(8.5).font("Helvetica-Oblique");
        const noteH = noteText ? doc.heightOfString(noteText, { width: colW.notes - 8 }) : 0;
        const dynH = Math.max(rowH, labelH + 12, noteH + 12);

        if (ty + dynH > 780) { doc.addPage(); ty = 50; }

        if (i % 2 === 0) doc.rect(L, ty, W, dynH).fill("#F9FAFB");
        doc.rect(L, ty, W, dynH).strokeColor("#E5E7EB").lineWidth(0.4).stroke();

        cx = L;
        doc.fillColor(dark).fontSize(9).font("Helvetica");
        doc.text(item.label, cx + 4, ty + 4, { width: colW.item - 8 }); cx += colW.item;

        const isPass = item.status === "pass";
        const isFail = item.status === "fail";
        const badgeColor = isPass ? green : isFail ? red : "#6B7280";
        const badgeLabel = isPass ? "PASS" : isFail ? "FAIL" : "N/A";
        const badgeW = 36;
        const badgeX = cx + (colW.status - badgeW) / 2;
        doc.rect(badgeX, ty + 3, badgeW, 11).fill(badgeColor);
        doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold")
           .text(badgeLabel, badgeX + 2, ty + 5, { width: badgeW - 4, lineBreak: false, align: "center" });
        cx += colW.status;

        if (noteText) {
          doc.fillColor(isFail ? red : mid).fontSize(8.5).font("Helvetica-Oblique")
             .text(noteText, cx + 4, ty + 4, { width: colW.notes - 8 });
        }

        ty += dynH;
      }

      doc.text("", L, ty);
    }

    // Overall result
    doc.moveDown(1);
    if (doc.y > 720) { doc.addPage(); doc.y = 50; }
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("OVERALL RESULT", L);
    doc.moveDown(0.3);
    const resultY = doc.y;
    const resultColor = record.hasFailures ? red : green;
    const resultLabel = record.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CHECKS CLEAR";
    doc.rect(L, resultY, W, 26).fill(resultColor);
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold")
       .text(resultLabel, L, resultY + 7, { width: W, align: "center", lineBreak: false });
    doc.text("", L, resultY + 34);

    // Footer
    doc.moveDown(1.5);
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.fontSize(7).fillColor(mid).font("Helvetica")
       .text("Personal working record only — always follow manufacturer guidance and employer procedures. © Chainsaw Courses.", L, doc.y, { align: "center", width: W });

    doc.end();
  });
}
