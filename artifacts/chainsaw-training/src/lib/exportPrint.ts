import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RiskAssessmentExportData {
  taskDescription: string;
  siteDescription?: string | null;
  address?: string | null;
  gridReference?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  hazards: Array<{
    label: string;
    likelihood: number;
    severity: number;
    riskRating: number;
    controlMeasures?: string | null;
    isCustom?: boolean | null;
  }>;
  studentName?: string;
  createdAt?: string;
}

export interface InspectionExportData {
  sawIdentifier?: string | null;
  items: Array<{
    id: string;
    label: string;
    section: string;
    status: string;
    note?: string | null;
  }>;
  hasFailures: boolean;
  studentName?: string;
  createdAt?: string;
}

/** Call this once on mount (e.g. useEffect) and store the result in a ref.
 *  Pass the result to downloadRiskAssessmentPdf / downloadInspectionPdf so
 *  those functions stay synchronous and aren't blocked by the browser. */
export async function preloadLogoBase64(logoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function riskBandStyle(rating: number) {
  if (rating >= 15) return { bg: [254, 226, 226] as [number, number, number], color: [185, 28, 28] as [number, number, number], label: "HIGH" };
  if (rating >= 8)  return { bg: [254, 243, 199] as [number, number, number], color: [180, 83, 9]  as [number, number, number], label: "MED" };
  return             { bg: [220, 252, 231] as [number, number, number], color: [21, 128, 61]  as [number, number, number], label: "LOW" };
}

const ORANGE: [number, number, number] = [234, 92, 12];
const DARK:   [number, number, number] = [26, 26, 26];
const GREY:   [number, number, number] = [136, 136, 136];
const LIGHT:  [number, number, number] = [229, 231, 235];
const PALE:   [number, number, number] = [249, 250, 251];
const WHITE:  [number, number, number] = [255, 255, 255];
const MARGIN = 14;

function pw(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }

function addHeader(doc: jsPDF, logoB64: string | null, title: string, subtitle: string): number {
  const w = pw(doc);
  doc.setDrawColor(...ORANGE).setLineWidth(0.8);
  doc.line(MARGIN, 10, w - MARGIN, 10);

  const y = 14;
  let textX = MARGIN;
  if (logoB64) {
    try { doc.addImage(logoB64, "PNG", MARGIN, y, 11, 11); textX = MARGIN + 14; } catch {}
  }

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ORANGE);
  doc.text("CHAINSAW COURSES", textX, y + 5);
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GREY);
  doc.text("PROFESSIONAL TRAINING PORTAL", textX, y + 9);

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...DARK);
  doc.text(title.toUpperCase(), w - MARGIN, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GREY);
  doc.text(subtitle, w - MARGIN, y + 8.5, { align: "right" });

  doc.setDrawColor(...LIGHT).setLineWidth(0.3);
  doc.line(MARGIN, y + 13, w - MARGIN, y + 13);
  return y + 16;
}

function addStudentBar(doc: jsPDF, studentName: string, date: string, y: number): number {
  const w = pw(doc);
  doc.setFillColor(...PALE).setDrawColor(...LIGHT).setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, w - MARGIN * 2, 8, 1, 1, "FD");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...DARK);
  doc.text(studentName || "Student", MARGIN + 3, y + 5.5);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GREY);
  doc.text(date, w - MARGIN - 3, y + 5.5, { align: "right" });
  return y + 11;
}

function addSectionHeading(doc: jsPDF, text: string, y: number): number {
  const w = pw(doc);
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ORANGE);
  doc.text(text.toUpperCase(), MARGIN, y + 4);
  doc.setDrawColor(...LIGHT).setLineWidth(0.3);
  doc.line(MARGIN, y + 5.5, w - MARGIN, y + 5.5);
  return y + 8;
}

function addField(doc: jsPDF, label: string, value: string, y: number): number {
  const labelW = 42;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GREY);
  doc.text(label.toUpperCase(), MARGIN, y + 3.5);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...DARK);
  const lines = doc.splitTextToSize(value, pw(doc) - MARGIN - labelW - MARGIN) as string[];
  doc.text(lines, MARGIN + labelW, y + 3.5);
  return y + Math.max(6, lines.length * 4.5);
}

function addFooter(doc: jsPDF) {
  const w = pw(doc);
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...LIGHT).setLineWidth(0.3);
  doc.line(MARGIN, h - 18, w - MARGIN, h - 18);
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(170, 170, 170);
  const txt =
    "This document was generated from the Chainsaw Courses Professional Training Portal. " +
    "This is a personal working record only — it does not replace a formal risk assessment, method statement, or employer RAMS process. " +
    "Always follow current HSE guidance and your employer's procedures.";
  doc.text(doc.splitTextToSize(txt, w - MARGIN * 2), w / 2, h - 14, { align: "center" });
}

function triggerDownload(doc: jsPDF, filename: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function safeName(name?: string) {
  return (name || "student").replace(/\s+/g, "-").toLowerCase();
}

/** Synchronous — pass logoB64 pre-loaded via preloadLogoBase64() */
export function downloadRiskAssessmentPdf(data: RiskAssessmentExportData, logoB64: string | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  let y = addHeader(doc, logoB64, "Dynamic Site Risk Assessment", "Site Safety Record");
  y = addStudentBar(doc, data.studentName || "", date, y);

  y = addSectionHeading(doc, "Site & Task Details", y + 3);
  y = addField(doc, "Task Description", data.taskDescription, y);
  if (data.siteDescription) y = addField(doc, "Site Description", data.siteDescription, y);
  if (data.address)         y = addField(doc, "Location", data.address, y);
  if (data.gridReference)   y = addField(doc, "OS Grid Ref", data.gridReference, y);
  if (data.latitude && data.longitude) y = addField(doc, "Coordinates", `${data.latitude}, ${data.longitude}`, y);

  y = addSectionHeading(doc, "Hazard Assessment", y + 3);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Hazard", "Like.", "Sev.", "Risk", "Control Measures"]],
    body: data.hazards.map((h) => {
      const band = riskBandStyle(h.riskRating);
      return [
        h.label,
        String(h.likelihood),
        String(h.severity),
        {
          content: `${band.label} (${h.riskRating})`,
          styles: { fillColor: band.bg, textColor: band.color, fontStyle: "bold" as const, halign: "center" as const },
        },
        h.controlMeasures || "—",
      ];
    }),
    headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 7, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DARK },
    alternateRowStyles: { fillColor: PALE },
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 22 },
      4: { cellWidth: "auto" },
    },
  });

  addFooter(doc);
  triggerDownload(doc, `risk-assessment-${safeName(data.studentName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Synchronous — pass logoB64 pre-loaded via preloadLogoBase64() */
export function downloadInspectionPdf(data: InspectionExportData, logoB64: string | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  let y = addHeader(doc, logoB64, "Pre-Start & Pre-Use Inspection", "Equipment Safety Record");
  y = addStudentBar(doc, data.studentName || "", date, y);

  if (data.sawIdentifier) {
    y = addSectionHeading(doc, "Chainsaw Details", y + 3);
    y = addField(doc, "Saw Identifier", data.sawIdentifier, y);
  }

  const sections = Array.from(new Set(data.items.map((i) => i.section)));

  for (const section of sections) {
    y = addSectionHeading(doc, `${section} Checks`, y + 3);
    const sectionItems = data.items.filter((i) => i.section === section);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Check Item", "Result", "Notes"]],
      body: sectionItems.map((item) => {
        const isPass = item.status === "pass";
        const isFail = item.status === "fail";
        const badgeBg: [number, number, number] = isFail ? [254, 226, 226] : isPass ? [220, 252, 231] : [243, 244, 246];
        const badgeColor: [number, number, number] = isFail ? [185, 28, 28] : isPass ? [21, 128, 61] : [107, 114, 128];
        const statusLabel = isPass ? "PASS" : isFail ? "FAIL" : "N/A";
        return [
          item.label,
          { content: statusLabel, styles: { fillColor: badgeBg, textColor: badgeColor, fontStyle: "bold" as const, halign: "center" as const } },
          item.note ? { content: item.note, styles: { fontStyle: "italic" as const, textColor: [185, 28, 28] as [number, number, number] } } : "",
        ];
      }),
      headStyles: { fillColor: DARK, textColor: WHITE, fontSize: 7, fontStyle: "bold", cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DARK },
      alternateRowStyles: { fillColor: PALE },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 50 },
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  const resultBg: [number, number, number] = data.hasFailures ? [254, 226, 226] : [220, 252, 231];
  const resultColor: [number, number, number] = data.hasFailures ? [185, 28, 28] : [21, 128, 61];

  y = addSectionHeading(doc, "Overall Result", y + 3);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: [[{
      content: data.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CLEAR",
      styles: { fillColor: resultBg, textColor: resultColor, fontStyle: "bold" as const, halign: "center" as const, fontSize: 10 },
    }]],
    bodyStyles: { cellPadding: 5 },
  });

  addFooter(doc);
  triggerDownload(doc, `inspection-checklist-${safeName(data.studentName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function copyRiskAssessmentText(data: RiskAssessmentExportData): string {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB")
    : new Date().toLocaleString("en-GB");
  const lines: string[] = [
    "CHAINSAW COURSES — DYNAMIC SITE RISK ASSESSMENT",
    `Date: ${date}`,
    data.studentName ? `Operator: ${data.studentName}` : "",
    "",
    "TASK & SITE",
    `Task: ${data.taskDescription}`,
    data.siteDescription ? `Site: ${data.siteDescription}` : "",
    data.address ? `Location: ${data.address}` : "",
    data.gridReference ? `OS Grid: ${data.gridReference}` : "",
    "",
    "HAZARD ASSESSMENT",
    ...data.hazards.map((h) => {
      const band = riskBandStyle(h.riskRating);
      return [
        `• ${h.label}`,
        `  Likelihood: ${h.likelihood}  Severity: ${h.severity}  Risk: ${band.label} (${h.riskRating})`,
        h.controlMeasures ? `  Controls: ${h.controlMeasures}` : "",
      ].filter(Boolean).join("\n");
    }),
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

export function copyInspectionText(data: InspectionExportData): string {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB")
    : new Date().toLocaleString("en-GB");
  const lines: string[] = [
    "CHAINSAW COURSES — PRE-START & PRE-USE INSPECTION CHECKLIST",
    `Date: ${date}`,
    data.studentName ? `Operator: ${data.studentName}` : "",
    data.sawIdentifier ? `Saw: ${data.sawIdentifier}` : "",
    "",
    ...Array.from(new Set(data.items.map((i) => i.section))).flatMap((section) => [
      section.toUpperCase(),
      ...data.items
        .filter((i) => i.section === section)
        .map((item) => {
          const s = item.status === "pass" ? "✓ PASS" : item.status === "fail" ? "✗ FAIL" : "— N/A";
          return `  ${s}  ${item.label}${item.note ? `\n       Note: ${item.note}` : ""}`;
        }),
      "",
    ]),
    `OVERALL: ${data.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CLEAR"}`,
  ];
  return lines.filter((l) => l !== null && l !== undefined).join("\n");
}
