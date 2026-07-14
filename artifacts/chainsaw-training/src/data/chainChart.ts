export interface ChainChartRow {
  pitch: string;
  gauge: string;
  oregon: string[];
  stihl: string[];
  husqvarna: string[];
  fileSize: string;
  stihlFileSize?: string;
  topPlateAngle: string;
  notes?: string;
}

export const CHAIN_CHART: ChainChartRow[] = [
  // ── 1/4" ──────────────────────────────────────────────────────────────
  {
    pitch: '1/4"',
    gauge: '1.1mm (.043")',
    oregon: ["24"],
    stihl: ["71"],
    husqvarna: ["11"],
    fileSize: '4mm (5/32")',
    stihlFileSize: '3.2mm (1/8")',
    topPlateAngle: "30°",
    notes: "Small chainsaws, power pruners, top-handled saws. Husqvarna file: 3.5mm (9/64\").",
  },
  {
    pitch: '1/4"',
    gauge: '1.3mm (.050")',
    oregon: ["25"],
    stihl: ["13"],
    husqvarna: ["H00"],
    fileSize: '4mm (5/32")',
    stihlFileSize: '3.2mm (1/8")',
    topPlateAngle: "30°",
    notes: "Small chainsaws, power pruners, top-handled saws.",
  },

  // ── 3/8" Picco / Lo-Pro ───────────────────────────────────────────────
  {
    pitch: '3/8" Picco / Lo-Pro',
    gauge: '1.1mm (.043")',
    oregon: ["90"],
    stihl: ["61"],
    husqvarna: ["38"],
    fileSize: '4mm (5/32")',
    topPlateAngle: "30°",
    notes: "Common on small/mid-sized saws.",
  },
  {
    pitch: '3/8" Picco / Lo-Pro',
    gauge: '1.3mm (.050")',
    oregon: ["91", "95"],
    stihl: ["13", "63"],
    husqvarna: ["35", "36", "37", "93G"],
    fileSize: '4mm (5/32")',
    topPlateAngle: "30°",
    notes: "Common on small/mid-sized saws. Not to be confused with standard 3/8\".",
  },

  // ── .325" ─────────────────────────────────────────────────────────────
  {
    pitch: '.325"',
    gauge: '1.1mm (.043")',
    oregon: ["80"],
    stihl: ["61"],
    husqvarna: ["SP21G", "Xcut"],
    fileSize: '4mm (5/32")',
    topPlateAngle: "30°",
  },
  {
    pitch: '.325"',
    gauge: '1.3mm (.050")',
    oregon: ["20", "95", "95-S.Cut"],
    stihl: ["23"],
    husqvarna: ["22", "23", "25", "30", "33", "35", "37", "78", "SP-33G"],
    fileSize: '4.8mm (3/16")',
    topPlateAngle: "30°",
    notes: "Oregon angle varies by chain type: Full Chisel 25°, Semi Chisel 30°, Speedcut 30°.",
  },
  {
    pitch: '.325"',
    gauge: '1.5mm (.058")',
    oregon: ["21"],
    stihl: ["25"],
    husqvarna: ["21", "25", "38"],
    fileSize: '4.8mm (3/16")',
    topPlateAngle: "30°",
  },
  {
    pitch: '.325"',
    gauge: '1.6mm (.063")',
    oregon: ["22"],
    stihl: ["26"],
    husqvarna: ["26", "28"],
    fileSize: '4.8mm (3/16")',
    topPlateAngle: "30°",
  },

  // ── 3/8" ─────────────────────────────────────────────────────────────
  {
    pitch: '3/8"',
    gauge: '1.3mm (.050")',
    oregon: ["72", "78"],
    stihl: ["33"],
    husqvarna: ["46", "47", "C83"],
    fileSize: '5.5mm (7/32")',
    topPlateAngle: "30°",
    notes: "Oregon Full Chisel 25°.",
  },
  {
    pitch: '3/8"',
    gauge: '1.5mm (.058")',
    oregon: ["73", "77"],
    stihl: ["35"],
    husqvarna: ["C85", "85-Xcut", "H-42", "48", "54", "81", "S-42", "48", "49"],
    fileSize: '5.5mm (7/32")',
    stihlFileSize: '5.2mm (13/64")',
    topPlateAngle: "30°",
    notes: "Oregon Semi Chisel 30°. Stihl file size differs: 5.2mm (13/64\").",
  },
  {
    pitch: '3/8"',
    gauge: '1.6mm (.063")',
    oregon: ["75", "78"],
    stihl: ["36"],
    husqvarna: ["H-45", "50", "83", "S-42", "48", "49", "52"],
    fileSize: '5.5mm (7/32")',
    topPlateAngle: "30°",
    notes: "Oregon Round Chisel 30° / Hexa 25°.",
  },

  // ── .404" ─────────────────────────────────────────────────────────────
  {
    pitch: '.404"',
    gauge: '1.5mm (.058")',
    oregon: [],
    stihl: ["45"],
    husqvarna: ["69"],
    fileSize: '5.5mm (7/32")',
    topPlateAngle: "30°",
    notes: "No Oregon equivalent listed.",
  },
  {
    pitch: '.404"',
    gauge: '1.6mm (.063")',
    oregon: ["27", "52", "59", "68"],
    stihl: ["46"],
    husqvarna: ["57", "64"],
    fileSize: '5.5mm (7/32")',
    topPlateAngle: "30°",
  },
];

export const PITCH_POWER_GUIDE = [
  { pitch: '1/4"', power: "< 45cc", size: "Small chainsaws / power pruners / top-handled saws" },
  { pitch: '3/8" Picco / Lo-Pro', power: "25cc – 45cc", size: "Small chainsaws" },
  { pitch: '.325"', power: "45cc – 60cc", size: "Mid-sized chainsaws" },
  { pitch: '3/8"', power: "60cc – 90cc", size: "Mid to large chainsaws" },
  { pitch: '.404"', power: "90cc – 120cc", size: "Large chainsaws" },
];

export interface ChainLetterCode {
  brand: "Stihl" | "Husqvarna" | "Oregon";
  code: string;
  meaning: string;
}

export const CHAIN_LETTER_CODES: ChainLetterCode[] = [
  { brand: "Stihl", code: "R", meaning: "Rapid — designed for fast cutting" },
  { brand: "Stihl", code: "M", meaning: "Mini — similar to Rapid, smaller cutters" },
  { brand: "Stihl", code: "S", meaning: "Super — high performance and cutting efficiency" },
  { brand: "Stihl", code: "RS", meaning: "Rapid Super — high performance, increased efficiency" },
  { brand: "Stihl", code: "RH", meaning: "Rapid Hexa — highest performance chain" },
  { brand: "Stihl", code: "C", meaning: "Comfort — reduces kickback and vibration" },
  { brand: "Stihl", code: "1-3", meaning: "Safety — kickback reducing features" },
  { brand: "Stihl", code: "L", meaning: "Square Ground — square ground tooth profile" },
  { brand: "Stihl", code: "LH", meaning: "Square Ground Semi-Skip — semi-skip with square ground profile" },
  { brand: "Stihl", code: "P", meaning: "Picco — low profile design, reduced kickback" },
  { brand: "Stihl", code: "PM", meaning: "Picco Mini — smaller cutter teeth for finer cuts" },
  { brand: "Stihl", code: "D", meaning: "Duro — hardened cutter teeth" },
  { brand: "Stihl", code: "X", meaning: "Ripping Chain — milling, cutting with the grain" },
  { brand: "Stihl", code: "H", meaning: "Harvester — heavy-duty, for harvester heads" },
  { brand: "Husqvarna", code: "X-Cut", meaning: "High performance professional chains" },
  { brand: "Husqvarna", code: "X Precision", meaning: "Narrow chain, smaller kerf for precision cutting" },
  { brand: "Husqvarna", code: "G", meaning: "Guard Link — designed to reduce kickback" },
  { brand: "Husqvarna", code: "C", meaning: "Full-Chisel — maximum cutting performance" },
  { brand: "Husqvarna", code: "S", meaning: "Semi Chisel — durability and cutting performance" },
  { brand: "Husqvarna", code: "H", meaning: "Micro/Chamfer Chisel — kickback and vibration reducing" },
  { brand: "Husqvarna", code: "P", meaning: "Pixel Chain — narrower kerf for efficiency" },
  { brand: "Oregon", code: "ACL / DPX / DX / VXL / X", meaning: "VersaCut — durable, versatile tooth profile" },
  { brand: "Oregon", code: "AP / BPX", meaning: "ControlCut — smoother cut, rounded tooth profile" },
  { brand: "Oregon", code: "EXL / EXJ / L / LGX / LPX", meaning: "PowerCut — full chisel, fast and efficient" },
  { brand: "Oregon", code: "P", meaning: "Standard — homeowner chain, low kickback" },
];
