import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

const PW = 595;
const PH = 842;
const ML = 52;
const MR = 52;
const MT = 72;
const MB = 52;
const CW = PW - ML - MR;

const ORANGE = rgb(0.851, 0.361, 0.024);
const BLACK  = rgb(0.1,  0.1,  0.1);
const GREY   = rgb(0.4,  0.4,  0.4);
const LGREY  = rgb(0.92, 0.92, 0.92);
const WHITE  = rgb(1,    1,    1);

interface Ctx {
  doc: PDFDocument;
  bold: PDFFont;
  reg: PDFFont;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  const words = text.split(" ").filter(Boolean);
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
  return lines;
}

function drawPageHeader(ctx: Ctx): void {
  const p = ctx.page;
  p.drawLine({ start: { x: ML, y: PH - MT + 14 }, end: { x: PW - MR, y: PH - MT + 14 }, thickness: 0.5, color: LGREY });
  p.drawText("CHAINSAW COURSES — HAZARDS & RISKS REFERENCE", {
    x: ML, y: PH - MT + 4, size: 7, font: ctx.reg, color: GREY,
  });
  p.drawText("chainsawcourses.com", {
    x: PW - MR - ctx.reg.widthOfTextAtSize("chainsawcourses.com", 7),
    y: PH - MT + 4, size: 7, font: ctx.reg, color: GREY,
  });
}

function drawFooters(ctx: Ctx): void {
  ctx.pages.forEach((p, i) => {
    p.drawLine({ start: { x: ML, y: MB - 4 }, end: { x: PW - MR, y: MB - 4 }, thickness: 0.5, color: LGREY });
    p.drawText("This document is for personal reference only and must not be altered.", {
      x: ML, y: MB - 16, size: 6.5, font: ctx.reg, color: GREY,
    });
    const pg = `Page ${i + 1} of ${ctx.pages.length}`;
    p.drawText(pg, {
      x: PW - MR - ctx.reg.widthOfTextAtSize(pg, 6.5),
      y: MB - 16, size: 6.5, font: ctx.reg, color: GREY,
    });
  });
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

const HAZARD_CATEGORIES = [
  {
    category: "ON SITE",
    rows: [
      {
        hazard: "Uneven ground, mud, brambles, logs, branches and stumps.",
        risk: "Tripping, slipping and falling.",
        control: "Wear appropriate footwear, clear work area and keep the site tidy.",
      },
      {
        hazard: "Public footpath, dog walkers, any other 3rd parties.",
        risk: "Debris hitting pedestrians.",
        control: "Appropriate signs and banksperson if necessary.",
      },
      {
        hazard: "Overhead hanging branches and dead limbs.",
        risk: "Injury from falling limbs.",
        control: "Avoid working directly beneath hazards and wear protective helmet.",
      },
    ],
  },
  {
    category: "TASK",
    rows: [
      {
        hazard: "Chainsaw use.",
        risk: "Cuts and kickback.",
        control: "Use the correct body position, appropriate cutting techniques and suitable PPE.",
      },
      {
        hazard: "Timber movement.",
        risk: "Being hit or struck by the timber.",
        control: "Secure timber wherever possible, avoid working on steep slopes and prepare escape routes.",
      },
      {
        hazard: "Heavy logs and branches.",
        risk: "Musculo-skeletal injuries.",
        control: "Use machinery or lifting aids where possible. Use good lifting methods.",
      },
    ],
  },
  {
    category: "CHAINSAW",
    rows: [
      {
        hazard: "Fuel and lubricants.",
        risk: "Fire, chemical poisoning.",
        control: "Use spill mats and fill up away from flammable sources and watercourses.",
      },
      {
        hazard: "Kickback and cuts.",
        risk: "Laceration injuries.",
        control: "Wear suitable PPE, adopt the correct body position and use appropriate cutting techniques.",
      },
      {
        hazard: "Vibration, noise, dust, fumes, exhaust, flying debris.",
        risk: "Immediate and long term injuries.",
        control: "Use a maintained chainsaw and wear suitable PPE.",
      },
    ],
  },
];

export async function generateHazardsPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const firstPage = doc.addPage([PW, PH]);
  const ctx: Ctx = { doc, bold, reg, pages: [firstPage], page: firstPage, y: PH - MT };
  drawPageHeader(ctx);

  // ── Title block ─────────────────────────────────────────────────────────────
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 48, width: CW, height: 48, color: ORANGE });
  ctx.page.drawText("HAZARDS & RISKS", {
    x: ML + 14, y: ctx.y - 20, size: 18, font: bold, color: WHITE,
  });
  ctx.page.drawText("Chainsaw Operations — Common Hazards, Risks and Control Measures", {
    x: ML + 14, y: ctx.y - 36, size: 9, font: reg, color: WHITE,
  });
  ctx.y -= 60;

  // ── Intro ────────────────────────────────────────────────────────────────────
  ctx.y -= 10;
  const introLines = wrap(
    "There are many different hazards involved with chainsaw use. The best thing you can do is assume everything wants to hurt you. Prepare yourself, the machine and the site to minimise injuries. Use this reference sheet alongside your risk assessment to identify hazards before starting any chainsaw operation.",
    reg, 9.5, CW
  );
  for (const line of introLines) {
    ensureSpace(ctx, 14);
    ctx.page.drawText(line, { x: ML, y: ctx.y, size: 9.5, font: reg, color: BLACK });
    ctx.y -= 13;
  }
  ctx.y -= 12;

  // ── Table ─────────────────────────────────────────────────────────────────────
  const COL_CAT  = 40;
  const COL_HAZ  = 155;
  const COL_RISK = 140;
  const COL_CTRL = CW - COL_CAT - COL_HAZ - COL_RISK;
  const ROW_HDR  = 18;
  const CELL_PAD = 4;
  const TXT_SIZE = 8.5;
  const LINE_H   = 12;

  // Header row
  ensureSpace(ctx, ROW_HDR + 2);
  ctx.page.drawRectangle({ x: ML, y: ctx.y - ROW_HDR, width: CW, height: ROW_HDR, color: BLACK });
  const headers = ["", "HAZARD", "RISK", "CONTROL MEASURE"];
  const colX = [ML, ML + COL_CAT, ML + COL_CAT + COL_HAZ, ML + COL_CAT + COL_HAZ + COL_RISK];
  headers.forEach((h, i) => {
    if (!h) return;
    ctx.page.drawText(h, { x: colX[i] + CELL_PAD, y: ctx.y - 12, size: 8, font: bold, color: WHITE });
  });
  ctx.y -= ROW_HDR;

  // Category rows
  HAZARD_CATEGORIES.forEach(({ category, rows }, gi) => {
    const catColor = gi % 2 === 0 ? LGREY : rgb(0.97, 0.97, 0.97);

    // Calculate total height needed for this category
    const rowHeights = rows.map((row) => {
      const hLines = wrap(row.hazard, reg, TXT_SIZE, COL_HAZ - CELL_PAD * 2).length;
      const rLines = wrap(row.risk,   reg, TXT_SIZE, COL_RISK - CELL_PAD * 2).length;
      const cLines = wrap(row.control, reg, TXT_SIZE, COL_CTRL - CELL_PAD * 2).length;
      return Math.max(hLines, rLines, cLines) * LINE_H + CELL_PAD * 2;
    });
    const catHeight = rowHeights.reduce((a, b) => a + b, 0);

    ensureSpace(ctx, Math.min(catHeight + 4, PH - MT - MB));

    // Category label spanning all rows
    const catStartY = ctx.y;

    rows.forEach((row, ri) => {
      const rh = rowHeights[ri];

      ensureSpace(ctx, rh);

      // Row background
      ctx.page.drawRectangle({ x: ML, y: ctx.y - rh, width: CW, height: rh, color: catColor });

      // Category label cell (only draw on first row of category)
      if (ri === 0) {
        ctx.page.drawRectangle({ x: ML, y: catStartY - catHeight, width: COL_CAT, height: catHeight, color: ORANGE, opacity: 0.15 });
        // Vertical text simulation — draw category label rotated approximation
        const labelLines = category.split("").join(" ");
        const labelY = catStartY - catHeight / 2 + (bold.widthOfTextAtSize(labelLines, 7) / 2);
        ctx.page.drawText(category, {
          x: ML + 4,
          y: catStartY - catHeight / 2 - 3,
          size: 7,
          font: bold,
          color: ORANGE,
        });
        void labelY;
      }

      // Cell borders (right edge of each col)
      [COL_CAT, COL_CAT + COL_HAZ, COL_CAT + COL_HAZ + COL_RISK].forEach((x) => {
        ctx.page.drawLine({
          start: { x: ML + x, y: ctx.y },
          end:   { x: ML + x, y: ctx.y - rh },
          thickness: 0.4,
          color: LGREY,
        });
      });
      // Bottom border
      ctx.page.drawLine({
        start: { x: ML, y: ctx.y - rh },
        end:   { x: ML + CW, y: ctx.y - rh },
        thickness: 0.4,
        color: LGREY,
      });

      // Cell text
      const colWidths = [COL_HAZ, COL_RISK, COL_CTRL];
      const cellTexts = [row.hazard, row.risk, row.control];
      cellTexts.forEach((text, ci) => {
        const cx = colX[ci + 1] + CELL_PAD;
        const cw = colWidths[ci] - CELL_PAD * 2;
        const lines = wrap(text, reg, TXT_SIZE, cw);
        lines.forEach((line, li) => {
          ctx.page.drawText(line, {
            x: cx,
            y: ctx.y - CELL_PAD - LINE_H * li - 9,
            size: TXT_SIZE,
            font: reg,
            color: BLACK,
          });
        });
      });

      ctx.y -= rh;
    });

    // Category separator
    ctx.page.drawLine({
      start: { x: ML, y: ctx.y },
      end:   { x: ML + CW, y: ctx.y },
      thickness: 1.2,
      color: ORANGE,
      opacity: 0.4,
    });
  });

  ctx.y -= 20;

  // ── PPE reminder box ─────────────────────────────────────────────────────────
  ensureSpace(ctx, 80);
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 70, width: CW, height: 70, color: LGREY });
  ctx.page.drawRectangle({ x: ML, y: ctx.y - 70, width: 4,  height: 70, color: ORANGE });
  ctx.page.drawText("MINIMUM PPE FOR CHAINSAW OPERATIONS", {
    x: ML + 14, y: ctx.y - 14, size: 8.5, font: bold, color: BLACK,
  });
  const ppeItems = [
    "Chainsaw helmet with integrated visor and ear defenders",
    "Chainsaw-resistant jacket or upper-body protection",
    "Chainsaw trousers or chaps (EN 381 Class 1 minimum)",
    "Chainsaw-resistant gloves    •    Steel-capped chainsaw boots (EN 381-3)",
  ];
  ppeItems.forEach((item, i) => {
    ctx.page.drawText(`• ${item}`, {
      x: ML + 14, y: ctx.y - 28 - i * 11, size: 8, font: reg, color: BLACK,
    });
  });
  ctx.y -= 80;

  drawFooters(ctx);

  const pdfBytes = await doc.save();
  return pdfBytes;
}
