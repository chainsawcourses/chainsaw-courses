import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// ── Page constants ────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const ML = 48;
const MR = 48;
const MT = 68;
const MB = 48;
const CW = PW - ML - MR;

// ── Colours (matching app brand) ─────────────────────────────────────────────
const ORANGE  = rgb(0.851, 0.361, 0.024);
const BLACK   = rgb(0.10,  0.10,  0.10);
const GREY    = rgb(0.40,  0.40,  0.40);
const LGREY   = rgb(0.92,  0.92,  0.92);
const MGREY   = rgb(0.78,  0.78,  0.78);
const WHITE   = rgb(1,     1,     1);
const AMBER   = rgb(0.80,  0.50,  0.05);
const RED     = rgb(0.72,  0.12,  0.12);
const GREEN   = rgb(0.09,  0.53,  0.27);

// ── Hazard data (mirrors DEFAULT_HAZARDS in RiskAssessment.tsx) ───────────────
const HAZARDS = [
  {
    label: "Chainsaw kickback / loss of control",
    likelihood: 2,
    severity: 5,
    controlMeasures:
      "Use correct body position at all times; keep left arm straight; never use the tip of the bar; engage chain brake immediately after each cut. Wear full chainsaw PPE including cut-resistant trousers, gloves and helmet with visor.",
  },
  {
    label: "Contact with moving chain (cutting, tripping into saw)",
    likelihood: 2,
    severity: 5,
    controlMeasures:
      "Keep clear of the cutting line; engage chain brake when moving or repositioning; lay saw down with bar pointing away from personnel. Maintain a secure two-handed grip at all times. Wear chainsaw-rated leg protection.",
  },
  {
    label: "Manual handling of heavy/awkward logs (crush or strain injury)",
    likelihood: 3,
    severity: 3,
    controlMeasures:
      "Use a timber cant hook, log tongs or mechanical assistance where available. Break work into smaller lifts; bend the knees and keep the load close to the body. Brief co-workers before moving large sections.",
  },
  {
    label: "Trips and falls over brash, logs, uneven or wet ground",
    likelihood: 3,
    severity: 3,
    controlMeasures:
      "Plan and clear the working area and escape routes before starting. Wear chainsaw boots with ankle support. Move brash clear of the cutting area progressively. Do not rush; maintain three points of contact on uneven ground.",
  },
  {
    label: "Bar trapped in timber under compression/tension releasing suddenly",
    likelihood: 3,
    severity: 4,
    controlMeasures:
      "Assess the direction of stress in the timber before cutting; always cut from the side that will open. Use a felling wedge to relieve compression on the bar if it becomes trapped. Never lever the saw free with the engine running.",
  },
  {
    label: "Cut sections rolling or falling once severed",
    likelihood: 3,
    severity: 3,
    controlMeasures:
      "Identify the likely roll direction before cutting and position outside that zone. Use stanchions, pegs or natural features to chock rounds. Plan the escape route uphill and to the side; step clear before the cut section moves.",
  },
  {
    label: "Noise and hand-arm vibration (HAVS) exposure",
    likelihood: 4,
    severity: 2,
    controlMeasures:
      "Wear EN352 hearing protection rated to the saw's noise level. Keep exposure within daily vibration action value limits (2.5 m/s2); record exposure time. Use anti-vibration gloves; keep the saw serviced and cutting sharp to reduce vibration.",
  },
  {
    label: "Fuel handling, spillage or fire risk during refuelling",
    likelihood: 1,
    severity: 4,
    controlMeasures:
      "Refuel at least 3 metres from any cutting area with the engine fully cold. Use a drip-free fuel can; wipe any spillage before starting. Keep a fire extinguisher accessible. Never refuel near standing water or dry vegetation in high fire-risk conditions.",
  },
  {
    label: "Adverse weather, poor light or visibility on site",
    likelihood: 2,
    severity: 2,
    controlMeasures:
      "Do not work in winds above Beaufort Scale 5 (small trees begin to sway). Ensure adequate natural or artificial lighting before starting. Stop work if visibility drops below the minimum exclusion zone distance. Wear hi-vis clothing where appropriate.",
  },
  {
    label: "Bystanders, public or other workers entering the exclusion zone",
    likelihood: 2,
    severity: 4,
    controlMeasures:
      "Establish a minimum exclusion zone of at least two tree lengths (or 50 m minimum). Use barrier tape, cones or a banksperson on public paths. Brief all workers on the exclusion zone boundaries before work begins. Engage chain brake and cease cutting if anyone enters the zone.",
  },
  {
    label: "Lone working with no means of summoning help",
    likelihood: 2,
    severity: 5,
    controlMeasures:
      "Never operate a chainsaw alone - a second competent person trained in emergency first aid must be present, within sight and sound, with access to a trauma kit and a means of calling emergency services. Confirm phone signal before starting work.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function riskRating(likelihood: number, severity: number) {
  return likelihood * severity;
}

function riskBand(rating: number): { label: string; color: typeof RED } {
  if (rating >= 15) return { label: "HIGH",   color: RED };
  if (rating >= 8)  return { label: "MEDIUM", color: AMBER };
  return               { label: "LOW",    color: GREEN };
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ").filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

interface Ctx {
  doc: PDFDocument;
  bold: PDFFont;
  reg: PDFFont;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
}

function newPage(ctx: Ctx): void {
  const p = ctx.doc.addPage([PW, PH]);
  ctx.pages.push(p);
  ctx.page = p;
  ctx.y = PH - MT;
  drawPageHeader(ctx);
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MB + 20) newPage(ctx);
}

function drawPageHeader(ctx: Ctx): void {
  const p = ctx.page;
  p.drawLine({ start: { x: ML, y: PH - MT + 12 }, end: { x: PW - MR, y: PH - MT + 12 }, thickness: 0.4, color: LGREY });
  p.drawText("CHAINSAW COURSES - HAZARDS & RISKS REFERENCE", { x: ML,                      y: PH - MT + 3, size: 7,   font: ctx.reg,  color: GREY });
  p.drawText("chainsawcourses.com",                           { x: PW - MR - ctx.reg.widthOfTextAtSize("chainsawcourses.com", 7), y: PH - MT + 3, size: 7, font: ctx.reg, color: GREY });
}

function drawFooters(ctx: Ctx): void {
  ctx.pages.forEach((p, i) => {
    p.drawLine({ start: { x: ML, y: MB - 4 }, end: { x: PW - MR, y: MB - 4 }, thickness: 0.4, color: LGREY });
    p.drawText("For personal reference only. Assess conditions on site before every operation.", { x: ML, y: MB - 15, size: 6.5, font: ctx.reg, color: GREY });
    const pg = `Page ${i + 1} of ${ctx.pages.length}`;
    p.drawText(pg, { x: PW - MR - ctx.reg.widthOfTextAtSize(pg, 6.5), y: MB - 15, size: 6.5, font: ctx.reg, color: GREY });
  });
}

// ── PDF generator ─────────────────────────────────────────────────────────────
export async function generateHazardsPdf(): Promise<Uint8Array> {
  const doc  = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const firstPage = doc.addPage([PW, PH]);
  const ctx: Ctx = { doc, bold, reg, pages: [firstPage], page: firstPage, y: PH - MT };
  drawPageHeader(ctx);

  // ── Title block ─────────────────────────────────────────────────────────────
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 46, width: CW, height: 46, color: ORANGE });
  ctx.page.drawText("HAZARDS & RISKS", {
    x: ML + 12, y: ctx.y - 17, size: 17, font: bold, color: WHITE,
  });
  ctx.page.drawText("Common hazards, risk ratings and control measures for chainsaw operations", {
    x: ML + 12, y: ctx.y - 33, size: 8.5, font: reg, color: WHITE,
  });
  ctx.y -= 58;

  // ── Intro ────────────────────────────────────────────────────────────────────
  const intro = "There are many different hazards involved with chainsaw use. Assume everything wants to hurt you - prepare yourself, the machine and the site to minimise injuries. Use this reference alongside your dynamic site risk assessment before every operation. Risk ratings use Likelihood x Severity (1-5 scale): Low = 1-7, Medium = 8-14, High = 15+";
  for (const line of wrap(intro, reg, 8.5, CW)) {
    ensureSpace(ctx, 13);
    ctx.page.drawText(line, { x: ML, y: ctx.y, size: 8.5, font: reg, color: BLACK });
    ctx.y -= 12;
  }
  ctx.y -= 10;

  // ── Hazard rows ───────────────────────────────────────────────────────────────
  // Layout: full-width card per hazard
  // Row: [left panel: label + L×S badge] [right panel: control measures]
  const LEFT_W   = 175;
  const RIGHT_W  = CW - LEFT_W - 8;
  const CELL_PAD = 7;
  const TXT_SZ   = 8;
  const LINE_H   = 11.5;
  const LABEL_SZ = 8.5;

  HAZARDS.forEach((h, idx) => {
    const rating = riskRating(h.likelihood, h.severity);
    const band   = riskBand(rating);

    // Pre-calculate label lines and control measure lines
    const labelLines   = wrap(h.label, bold, LABEL_SZ, LEFT_W - CELL_PAD * 2);
    const controlLines = wrap(h.controlMeasures, reg, TXT_SZ, RIGHT_W - CELL_PAD * 2);

    const leftContentH  = labelLines.length * (LABEL_SZ + 2) + 22; // lines + risk badge row
    const rightContentH = controlLines.length * LINE_H + CELL_PAD * 2;
    const rowH = Math.max(leftContentH + CELL_PAD * 2, rightContentH) + 4;

    ensureSpace(ctx, rowH + 4);

    const rowY = ctx.y;

    // Alternating background
    const bgColor = idx % 2 === 0 ? LGREY : WHITE;
    ctx.page.drawRectangle({ x: ML, y: rowY - rowH, width: CW, height: rowH, color: bgColor });

    // Left panel accent bar
    ctx.page.drawRectangle({ x: ML, y: rowY - rowH, width: 3, height: rowH, color: band.color });

    // Hazard number badge
    const numStr = String(idx + 1).padStart(2, "0");
    ctx.page.drawText(numStr, { x: ML + 8, y: rowY - CELL_PAD - 10, size: 8, font: bold, color: band.color });

    // Hazard label lines
    const labelStartX = ML + CELL_PAD + 18;
    const labelMaxW   = LEFT_W - CELL_PAD - 18;
    labelLines.forEach((line, li) => {
      ctx.page.drawText(line, {
        x: labelStartX,
        y: rowY - CELL_PAD - 10 - li * (LABEL_SZ + 2),
        size: LABEL_SZ,
        font: bold,
        color: BLACK,
      });
    });

    // Risk rating badge (below label)
    const badgeY   = rowY - CELL_PAD - 10 - labelLines.length * (LABEL_SZ + 2) - 4;
    const badgeTxt = `${band.label}  L${h.likelihood} x S${h.severity} = ${rating}`;
    const badgeW   = bold.widthOfTextAtSize(badgeTxt, 7) + 10;
    ctx.page.drawRectangle({ x: labelStartX - 1, y: badgeY - 1, width: badgeW, height: 13, color: band.color, opacity: 0.12 });
    ctx.page.drawText(badgeTxt, { x: labelStartX + 4, y: badgeY + 2, size: 7, font: bold, color: band.color });

    // Divider between left and right panels
    ctx.page.drawLine({
      start: { x: ML + LEFT_W, y: rowY - 4 },
      end:   { x: ML + LEFT_W, y: rowY - rowH + 4 },
      thickness: 0.5,
      color: MGREY,
    });

    // Control measures header
    const cmX = ML + LEFT_W + 8 + CELL_PAD;
    ctx.page.drawText("CONTROL MEASURES", {
      x: cmX,
      y: rowY - CELL_PAD - 8,
      size: 6.5,
      font: bold,
      color: GREY,
    });

    // Control measure lines
    controlLines.forEach((line, li) => {
      ctx.page.drawText(line, {
        x: cmX,
        y: rowY - CELL_PAD - 19 - li * LINE_H,
        size: TXT_SZ,
        font: reg,
        color: BLACK,
      });
    });

    // Bottom border
    ctx.page.drawLine({
      start: { x: ML, y: rowY - rowH },
      end:   { x: ML + CW, y: rowY - rowH },
      thickness: 0.4,
      color: MGREY,
    });

    ctx.y = rowY - rowH;
  });

  ctx.y -= 14;

  // ── Risk rating key ──────────────────────────────────────────────────────────
  ensureSpace(ctx, 42);
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 38, width: CW, height: 38, color: LGREY });
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 38, width: 3,  height: 38, color: ORANGE });
  ctx.page.drawText("RISK RATING KEY  (Likelihood x Severity)", {
    x: ML + 12, y: ctx.y - 11, size: 7.5, font: bold, color: BLACK,
  });
  const bands: Array<{ label: string; range: string; color: typeof RED }> = [
    { label: "LOW",    range: "1-7",    color: GREEN },
    { label: "MEDIUM", range: "8-14",   color: AMBER },
    { label: "HIGH",   range: "15-25",  color: RED },
  ];
  bands.forEach(({ label, range, color }, i) => {
    const bx = ML + 12 + i * 120;
    ctx.page.drawRectangle({ x: bx, y: ctx.y - 30, width: 50, height: 14, color, opacity: 0.18 });
    ctx.page.drawText(`${label}  ${range}`, { x: bx + 5, y: ctx.y - 24, size: 7.5, font: bold, color });
  });
  ctx.y -= 48;

  // ── PPE reminder ────────────────────────────────────────────────────────────
  ensureSpace(ctx, 62);
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 58, width: CW, height: 58, color: rgb(0.97, 0.97, 0.97) });
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 58, width: 3,  height: 58, color: ORANGE });
  ctx.page.drawText("MINIMUM PPE FOR CHAINSAW OPERATIONS", {
    x: ML + 12, y: ctx.y - 11, size: 7.5, font: bold, color: BLACK,
  });
  const ppeItems = [
    "Chainsaw helmet with integrated visor and ear defenders",
    "Chainsaw-resistant jacket or upper-body protection",
    "Chainsaw trousers or chaps (EN 381 Class 1 minimum)",
    "Chainsaw-resistant gloves",
    "Steel-capped chainsaw boots (EN 381-3)",
  ];
  ppeItems.forEach((item, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    ctx.page.drawText(`- ${item}`, {
      x: ML + 12 + col * 250,
      y: ctx.y - 24 - row * 11,
      size: 7.5, font: reg, color: BLACK,
    });
  });
  ctx.y -= 68;

  drawFooters(ctx);

  return doc.save();
}
