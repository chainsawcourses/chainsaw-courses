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

// ── Hazard data (mirrors DEFAULT_HAZARDS in RiskAssessment.tsx + additional) ──
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
  // ── Additional hazards ───────────────────────────────────────────────────────
  {
    label: "Falling limbs and overhead deadwood (widow makers)",
    likelihood: 3,
    severity: 5,
    controlMeasures:
      "Inspect the canopy overhead before starting work and identify any dead, hanging or partially attached limbs. Do not work beneath identified hazards - remove them first or relocate the work area. Wear a certified chainsaw helmet at all times.",
  },
  {
    label: "Hidden embedded objects in timber (wire, nails, fencing stakes, stone)",
    likelihood: 3,
    severity: 4,
    controlMeasures:
      "Visually inspect timber before cutting and probe with a bar or metal detector where risk is high (hedgerow trees, old gateposts, farm woodland). Reduce chain speed on first cuts into unknown timber. Use eye protection rated for high-velocity projectiles.",
  },
  {
    label: "Working on slopes - operator, saw or cut logs sliding downhill",
    likelihood: 3,
    severity: 4,
    controlMeasures:
      "Work across the slope rather than up and down where possible. Stand on the uphill side of the timber. Chock logs before cutting. Wear footwear with aggressive grip; use a ground anchor or rope if the gradient exceeds safe standing limits.",
  },
  {
    label: "Proximity to overhead electricity lines",
    likelihood: 1,
    severity: 5,
    controlMeasures:
      "Identify all overhead lines before work begins using a site plan or site walk. Maintain a minimum 9 m horizontal clearance from distribution lines and 15 m from high-voltage transmission lines. Contact the line owner to de-energise if work must be conducted closer. Never touch or approach a fallen power line.",
  },
  {
    label: "Insect nests, tick bites or wildlife encounter on site",
    likelihood: 3,
    severity: 2,
    controlMeasures:
      "Inspect the work area and disturb potential nesting sites (log piles, soil banks, hollow trees) with a long tool before approaching closely. Wear insect-repellent clothing and tuck trousers into socks in tick-risk areas. Carry an antihistamine; note the location of the nearest hospital for serious allergic reactions.",
  },
  {
    label: "Chainsaw chain break or sudden ejection from bar",
    likelihood: 1,
    severity: 4,
    controlMeasures:
      "Check chain tension and condition before each use; replace worn or damaged chain links immediately. Never operate with a loose chain. Ensure the chain catcher is present and undamaged. Wear cut-resistant gloves, leg protection and a helmet with full visor.",
  },
  {
    label: "Exhaust fumes and carbon monoxide in poorly ventilated areas",
    likelihood: 2,
    severity: 3,
    controlMeasures:
      "Never run a petrol chainsaw in an enclosed space such as a barn, container or undercover storage area. Ensure adequate natural airflow when working in hollows or dense canopy. Take regular breaks in fresh air; if dizziness or headache develop, stop work immediately and move to open air.",
  },
  {
    label: "Operator fatigue reducing concentration and reaction time",
    likelihood: 3,
    severity: 3,
    controlMeasures:
      "Limit continuous chainsaw use to 30-minute intervals with regular rest breaks. Do not operate a chainsaw when ill, on sedating medication or after less than 6 hours of sleep. Plan the most demanding cuts early in the session when alertness is highest. Rotate operators where possible on longer jobs.",
  },
  {
    label: "Dust, fine debris and sawdust causing eye or respiratory irritation",
    likelihood: 4,
    severity: 2,
    controlMeasures:
      "Wear a full-face visor or safety spectacles rated to EN166 at all times when cutting. Use a dust/mist respirator (FFP2 minimum) when cutting dry, resinous or treated timber for extended periods. Work upwind of the cutting zone where possible.",
  },
  {
    label: "Manual handling of the chainsaw during transport and repositioning",
    likelihood: 3,
    severity: 2,
    controlMeasures:
      "Always fit the bar scabbard and ensure the chain brake is engaged before carrying the saw. Carry with bar pointing rearward and engine off. Use a dedicated chainsaw carry bag or case for transport in a vehicle. Do not carry the saw with the engine running.",
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

    // Pre-calculate label lines and control measure lines.
    // Label available width: LEFT_W minus both cell pads minus the 18px number badge.
    const LABEL_WRAP_W   = LEFT_W - CELL_PAD * 2 - 18;
    // Control available width: RIGHT_W minus both cell pads minus a small safety margin.
    const CONTROL_WRAP_W = RIGHT_W - CELL_PAD * 2 - 6;
    const labelLines   = wrap(h.label,           bold, LABEL_SZ, LABEL_WRAP_W);
    const controlLines = wrap(h.controlMeasures, reg,  TXT_SZ,   CONTROL_WRAP_W);

    // Left height: label lines + risk badge (badge takes ~18px below last label line)
    const leftContentH  = labelLines.length * (LABEL_SZ + 2) + 22;
    // Right height: "CONTROL MEASURES" header (19px) + body lines + bottom pad
    const rightContentH = 19 + controlLines.length * LINE_H + CELL_PAD;
    const rowH = Math.max(leftContentH + CELL_PAD * 2, rightContentH + CELL_PAD) + 4;

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

  // ── Manual handling guidance ─────────────────────────────────────────────────
  const mhPoints = [
    "Never attempt to lift logs over 20 kg alone - use mechanical aids (cant hook, log tongs, timber jack) or work with a second person.",
    "Keep back straight and bend at the knees; hold the load close to the body and avoid twisting at the waist.",
    "Cut timber into manageable sections before attempting to move it - smaller rounds are far safer than rolling or dragging full-length stems.",
    "Clear the path before lifting - remove brash, check footing and identify the destination before the load leaves the ground.",
    "Be aware of pinch points between logs and between logs and fixed objects (stumps, vehicles, machines).",
    "Use a log trolley or timber buggy for repeated short-distance moves; avoid carrying chainsaw and timber at the same time.",
  ];
  // Calculate height: title + each point wrapped
  const mhWrapped = mhPoints.map((pt) => wrap(pt, reg, 7.5, CW - 28));
  const mhTotalLines = mhWrapped.reduce((s, ls) => s + ls.length, 0);
  const mhH = 18 + mhTotalLines * 11 + 10;
  ensureSpace(ctx, mhH);
  ctx.page.drawRectangle({ x: ML, y: ctx.y - mhH, width: CW, height: mhH, color: rgb(0.97, 0.97, 0.97) });
  ctx.page.drawRectangle({ x: ML, y: ctx.y - mhH, width: 3,  height: mhH, color: ORANGE });
  ctx.page.drawText("MANUAL HANDLING - HEAVY LOGS & TIMBER", {
    x: ML + 12, y: ctx.y - 11, size: 7.5, font: bold, color: BLACK,
  });
  let mhY = ctx.y - 22;
  mhWrapped.forEach((lines) => {
    lines.forEach((line, li) => {
      ctx.page.drawText(li === 0 ? `- ${line}` : `  ${line}`, {
        x: ML + 12, y: mhY, size: 7.5, font: reg, color: BLACK,
      });
      mhY -= 11;
    });
  });
  ctx.y -= mhH + 10;

  drawFooters(ctx);

  return doc.save();
}
