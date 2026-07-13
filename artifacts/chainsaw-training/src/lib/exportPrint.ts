export interface RiskAssessmentExportData {
  id?: number;
  taskDescription: string;
  siteDescription?: string | null;
  address?: string | null;
  gridReference?: string | null;
  what3Words?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  nearestHospital?: string | null;
  hospitalPhone?: string | null;
  siteAccess?: string | null;
  meetingPoint?: string | null;
  firstAidKit?: string | null;
  nearestAed?: string | null;
  nearestSignal?: string | null;
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
  id?: number;
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

/** No-op — kept so existing callers don't break. Logo is embedded inline. */
export async function preloadLogoBase64(_logoUrl: string): Promise<string | null> {
  return null;
}

function riskBand(rating: number) {
  if (rating >= 15) return { bg: "#fee2e2", color: "#b91c1c", label: "HIGH" };
  if (rating >= 8)  return { bg: "#fef3c7", color: "#b45309", label: "MED" };
  return               { bg: "#dcfce7", color: "#15803d", label: "LOW" };
}

const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 20px 24px; }

  /* ── Save-as-PDF guidance banner (screen only, hidden when printing) ── */
  .save-banner {
    display: flex; align-items: center; gap: 12px;
    background: #1a1a1a; color: #fff; border-radius: 6px;
    padding: 12px 16px; margin-bottom: 18px;
    font-size: 13px; line-height: 1.5;
  }
  .save-banner .icon { font-size: 22px; flex-shrink: 0; }
  .save-banner strong { color: #ea5c0c; }
  .save-banner .hint { font-size: 11px; color: #aaa; margin-top: 3px; }
  .save-btn {
    margin-left: auto; background: #ea5c0c; color: #fff; border: none;
    border-radius: 4px; padding: 8px 16px; font-size: 12px; font-weight: 700;
    cursor: pointer; white-space: nowrap; letter-spacing: 0.04em;
  }
  .save-btn:hover { background: #c9520a; }

  /* ── Document chrome ── */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #ea5c0c; padding-bottom: 10px; margin-bottom: 14px; }
  .brand-name { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #ea5c0c; }
  .brand-sub  { font-size: 8px; text-transform: uppercase; letter-spacing: 0.12em; color: #888; margin-top: 2px; }
  .doc-title  { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; }
  .doc-date   { font-size: 9px; color: #888; margin-top: 3px; text-align: right; }
  .student-bar { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
  .student-name { font-size: 11px; font-weight: 700; }
  .student-date { font-size: 9px; color: #888; }
  h2 { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #ea5c0c; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 14px 0 6px; }
  .field { display: grid; grid-template-columns: 130px 1fr; gap: 4px 8px; margin-bottom: 4px; }
  .field-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; padding-top: 1px; }
  .field-value { font-size: 11px; color: #1a1a1a; }
  .field-value.blank { color: #aaa; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; background: #1a1a1a; color: #fff; padding: 5px 7px; text-align: left; }
  td { padding: 5px 7px; vertical-align: top; border-bottom: 1px solid #e5e7eb; font-size: 10px; line-height: 1.4; }
  tr:nth-child(even) td { background: #f9fafb; }
  .badge { display: inline-block; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 5px; border-radius: 3px; white-space: nowrap; }
  .status-pass { background: #dcfce7; color: #15803d; }
  .status-fail { background: #fee2e2; color: #b91c1c; }
  .status-na   { background: #f3f4f6; color: #6b7280; }
  .note-cell   { font-style: italic; color: #b91c1c; font-size: 9px; margin-top: 2px; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #aaa; text-align: center; line-height: 1.5; }

  @media print {
    .save-banner { display: none !important; }
    body { padding: 0; }
    @page { size: A4 portrait; margin: 14mm 12mm; }
  }
`;

function branded(title: string, subtitle: string, studentName: string, date: string, body: string) {
  const guideText = navigator.userAgent.includes("Mobile") || navigator.userAgent.includes("Android") || navigator.userAgent.includes("iPhone")
    ? "Tap <strong>Share → Print</strong>, then choose <strong>Save as PDF</strong>"
    : "Click <strong>Save as PDF</strong> button below — or press <strong>Ctrl+P</strong> (⌘P on Mac) and choose <strong>Save as PDF</strong> as the printer";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Chainsaw Courses</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
  <div class="save-banner">
    <span class="icon">📄</span>
    <div>
      <div>${guideText}</div>
      <div class="hint">This banner disappears when you print — your PDF will look clean.</div>
    </div>
    <button class="save-btn" onclick="window.print()">Save as PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="brand-name">Chainsaw Courses</div>
      <div class="brand-sub">Chainsaw Maintenance &amp; Cross Cutting</div>
    </div>
    <div>
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
    Personal working record only — does not replace a formal risk assessment, method statement, or employer RAMS process.<br>
    Always follow current HSE guidance and your employer's procedures.
  </div>

  <script>
    // Auto-open print dialog after a brief delay so the page renders first
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 600);
    });
  <\/script>
</body>
</html>`;
}

function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=960,height=800");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site, then try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

export function downloadRiskAssessmentPdf(data: RiskAssessmentExportData, _logoB64: string | null) {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })
    : new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  const locationParts = [data.address, data.gridReference ? `OS Grid: ${data.gridReference}` : null].filter(Boolean);

  const f = (label: string, value: string | null | undefined) =>
    `<div class="field"><span class="field-label">${label}</span><span class="field-value${!value ? ' blank' : ''}">${value || "—"}</span></div>`;

  const body = `
    <h2>Site &amp; Task Details</h2>
    ${f("Task Description", data.taskDescription)}
    ${f("Site Description", data.siteDescription)}
    ${f("Location", locationParts.length ? locationParts.join(" · ") : null)}
    ${f("What3Words", data.what3Words)}
    ${f("Coordinates", data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : null)}

    <h2>Emergency &amp; Site Safety Info</h2>
    ${f("Nearest A&amp;E Hospital", data.nearestHospital)}
    ${f("Hospital Phone", data.hospitalPhone)}
    ${f("Nearest AED", data.nearestAed)}
    ${f("Site First Aid Kit", data.firstAidKit)}
    ${f("Nearest Phone Signal", data.nearestSignal)}
    ${f("Meeting Point", data.meetingPoint)}
    ${f("Site Access", data.siteAccess)}

    <h2>Hazard Assessment</h2>
    <table>
      <thead>
        <tr>
          <th style="width:24%">Hazard</th>
          <th style="width:8%;text-align:center">Like.</th>
          <th style="width:8%;text-align:center">Sev.</th>
          <th style="width:11%;text-align:center">Risk</th>
          <th>Control Measures</th>
        </tr>
      </thead>
      <tbody>
        ${data.hazards.map((h) => {
          const b = riskBand(h.riskRating);
          return `<tr>
            <td>${h.label}</td>
            <td style="text-align:center">${h.likelihood}</td>
            <td style="text-align:center">${h.severity}</td>
            <td style="text-align:center">
              <span class="badge" style="background:${b.bg};color:${b.color}">${b.label} (${h.riskRating})</span>
            </td>
            <td>${h.controlMeasures || "<em style='color:#aaa'>None recorded</em>"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;

  openPrintWindow(branded("Dynamic Site Risk Assessment", "Chainsaw Courses · Site Safety Record", data.studentName || "", date, body));
}

export function downloadInspectionPdf(data: InspectionExportData, _logoB64: string | null) {
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
              <th style="width:14%;text-align:center">Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${sectionItems.map((item) => {
              const cls = item.status === "pass" ? "status-pass" : item.status === "fail" ? "status-fail" : "status-na";
              const lbl = item.status === "pass" ? "PASS" : item.status === "fail" ? "FAIL" : "N/A";
              return `<tr>
                <td>${item.label}</td>
                <td style="text-align:center"><span class="badge ${cls}">${lbl}</span></td>
                <td>${item.note ? `<span class="note-cell">${item.note}</span>` : ""}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      `;
    }).join("")}

    <h2>Overall Result</h2>
    <table>
      <tbody>
        <tr>
          <td style="text-align:center;padding:10px">
            <span class="badge ${data.hasFailures ? "status-fail" : "status-pass"}" style="font-size:12px;padding:5px 12px">
              ${data.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CLEAR"}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  `;

  openPrintWindow(branded("Pre-Start &amp; Pre-Use Inspection Checklist", "Chainsaw Courses · Equipment Safety Record", data.studentName || "", date, body));
}

export function copyRiskAssessmentText(data: RiskAssessmentExportData): string {
  const date = data.createdAt
    ? new Date(data.createdAt).toLocaleString("en-GB")
    : new Date().toLocaleString("en-GB");
  const opt = (label: string, value: string | null | undefined) => value ? `${label}: ${value}` : "";

  const lines: string[] = [
    "CHAINSAW COURSES — DYNAMIC SITE RISK ASSESSMENT",
    `Date: ${date}`,
    data.studentName ? `Operator: ${data.studentName}` : "",
    "",
    "TASK & SITE",
    `Task: ${data.taskDescription}`,
    opt("Site", data.siteDescription),
    opt("Location", data.address),
    opt("OS Grid", data.gridReference),
    opt("What3Words", data.what3Words),
    data.latitude && data.longitude ? `Coords: ${data.latitude}, ${data.longitude}` : "",
    "",
    "EMERGENCY & SITE SAFETY",
    opt("Nearest A&E Hospital", data.nearestHospital),
    opt("Hospital Phone", data.hospitalPhone),
    opt("Nearest AED", data.nearestAed),
    opt("Site First Aid Kit", data.firstAidKit),
    opt("Nearest Phone Signal", data.nearestSignal),
    opt("Meeting Point", data.meetingPoint),
    opt("Site Access", data.siteAccess),
    "",
    "HAZARD ASSESSMENT",
    ...data.hazards.map((h) => {
      const b = riskBand(h.riskRating);
      return [
        `• ${h.label}`,
        `  Likelihood: ${h.likelihood}  Severity: ${h.severity}  Risk: ${b.label} (${h.riskRating})`,
        h.controlMeasures ? `  Controls: ${h.controlMeasures}` : "",
      ].filter(Boolean).join("\n");
    }),
  ];
  return lines.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n");
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
  return lines.filter(Boolean).join("\n");
}
