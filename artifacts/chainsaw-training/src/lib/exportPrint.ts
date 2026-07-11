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

function riskBandStyle(rating: number) {
  if (rating >= 15) return { bg: "#fee2e2", color: "#b91c1c", label: "HIGH" };
  if (rating >= 8) return { bg: "#fef3c7", color: "#b45309", label: "MEDIUM" };
  return { bg: "#dcfce7", color: "#15803d", label: "LOW" };
}

function branded(logoUrl: string, title: string, subtitle: string, studentName: string, date: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title} — Chainsaw Courses</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #1a1a1a; background: #fff; padding: 24px 28px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #ea5c0c; padding-bottom: 10px; margin-bottom: 14px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { height: 44px; }
    .brand-name { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #ea5c0c; }
    .brand-sub { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: #888; margin-top: 1px; }
    .doc-meta { text-align: right; }
    .doc-meta .doc-title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; color: #1a1a1a; }
    .doc-meta .doc-date { font-size: 9px; color: #888; margin-top: 3px; text-transform: uppercase; }
    h2 { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #ea5c0c; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 14px 0 6px; }
    .field { display: grid; grid-template-columns: 140px 1fr; gap: 4px 8px; margin-bottom: 4px; }
    .field-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; padding-top: 1px; }
    .field-value { font-size: 11px; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; background: #1a1a1a; color: #fff; padding: 5px 7px; text-align: left; }
    td { padding: 5px 7px; vertical-align: top; border-bottom: 1px solid #e5e7eb; font-size: 10px; line-height: 1.4; }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge { display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 6px; border-radius: 3px; white-space: nowrap; }
    .status-pass { background: #dcfce7; color: #15803d; }
    .status-fail { background: #fee2e2; color: #b91c1c; }
    .status-na { background: #f3f4f6; color: #6b7280; }
    .note-cell { font-style: italic; color: #b91c1c; font-size: 9px; margin-top: 3px; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8.5px; color: #aaa; text-align: center; line-height: 1.5; }
    .student-bar { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .student-bar span { font-size: 10px; }
    .student-name { font-weight: 700; color: #1a1a1a; }
    .student-date { color: #888; font-size: 9px; }
    @media print {
      body { padding: 0; }
      @page { size: A4 portrait; margin: 14mm 12mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="Chainsaw Courses logo" onerror="this.style.display='none'" />
      <div>
        <div class="brand-name">Chainsaw Courses</div>
        <div class="brand-sub">Professional Training Portal</div>
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${title}</div>
      <div class="doc-date">${subtitle}</div>
    </div>
  </div>

  <div class="student-bar">
    <span class="student-name">${studentName || "Student"}</span>
    <span class="student-date">${date}</span>
  </div>

  ${body}

  <div class="footer">
    This document was generated from the Chainsaw Courses Professional Training Portal.<br>
    This is a personal working record only — it does not replace a formal risk assessment, method statement, or employer RAMS process.<br>
    Always follow current HSE guidance and your employer's procedures.
  </div>
</body>
</html>`;
}

export function printRiskAssessment(data: RiskAssessmentExportData, logoUrl: string) {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  const locationParts = [data.address, data.gridReference ? `OS Grid: ${data.gridReference}` : null].filter(Boolean);

  const body = `
    <h2>Site & Task Details</h2>
    <div class="field"><span class="field-label">Task Description</span><span class="field-value">${data.taskDescription}</span></div>
    ${data.siteDescription ? `<div class="field"><span class="field-label">Site Description</span><span class="field-value">${data.siteDescription}</span></div>` : ""}
    ${locationParts.length ? `<div class="field"><span class="field-label">Location</span><span class="field-value">${locationParts.join(" · ")}</span></div>` : ""}
    ${data.latitude && data.longitude ? `<div class="field"><span class="field-label">Coordinates</span><span class="field-value">${data.latitude}, ${data.longitude}</span></div>` : ""}

    <h2>Hazard Assessment</h2>
    <table>
      <thead>
        <tr>
          <th style="width:24%">Hazard</th>
          <th style="width:8%; text-align:center">Like.</th>
          <th style="width:8%; text-align:center">Sev.</th>
          <th style="width:10%; text-align:center">Risk</th>
          <th>Control Measures</th>
        </tr>
      </thead>
      <tbody>
        ${data.hazards.map((h) => {
          const band = riskBandStyle(h.riskRating);
          return `<tr>
            <td>${h.label}</td>
            <td style="text-align:center">${h.likelihood}</td>
            <td style="text-align:center">${h.severity}</td>
            <td style="text-align:center">
              <span class="badge" style="background:${band.bg};color:${band.color}">${band.label} (${h.riskRating})</span>
            </td>
            <td>${h.controlMeasures || "<em style='color:#aaa'>None recorded</em>"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

  openAndPrint(branded(logoUrl, "Dynamic Site Risk Assessment", "Chainsaw Courses · Site Safety Record", data.studentName || "", date, body));
}

export function printInspection(data: InspectionExportData, logoUrl: string) {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  const sections = Array.from(new Set(data.items.map((i) => i.section)));

  const body = `
    ${data.sawIdentifier ? `
    <h2>Chainsaw Details</h2>
    <div class="field"><span class="field-label">Saw Identifier</span><span class="field-value">${data.sawIdentifier}</span></div>
    ` : ""}

    ${sections.map((section) => {
      const sectionItems = data.items.filter((i) => i.section === section);
      return `
        <h2>${section} Checks</h2>
        <table>
          <thead>
            <tr>
              <th style="width:55%">Check Item</th>
              <th style="width:15%; text-align:center">Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${sectionItems.map((item) => {
              const badgeClass = item.status === "pass" ? "status-pass" : item.status === "fail" ? "status-fail" : "status-na";
              const statusLabel = item.status === "pass" ? "PASS" : item.status === "fail" ? "FAIL" : "N/A";
              return `<tr>
                <td>${item.label}</td>
                <td style="text-align:center"><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td>${item.note ? `<span class="note-cell">${item.note}</span>` : ""}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      `;
    }).join("")}

    <h2>Overall Result</h2>
    <div class="field">
      <span class="field-label">Outcome</span>
      <span class="field-value">
        <span class="badge ${data.hasFailures ? "status-fail" : "status-pass"}" style="font-size:11px;padding:3px 8px">
          ${data.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CLEAR"}
        </span>
      </span>
    </div>
  `;

  openAndPrint(branded(logoUrl, "Pre-Start & Pre-Use Inspection Checklist", "Chainsaw Courses · Equipment Safety Record", data.studentName || "", date, body));
}

function openAndPrint(html: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
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
