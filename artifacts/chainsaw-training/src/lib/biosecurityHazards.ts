export type HazardCategory = "operator" | "statutory";

export interface HazardZone {
  type: "circle";
  coords: [number, number];
  radius: number;
}

export interface HazardLink {
  label: string;
  url: string;
}

export interface Hazard {
  id: string;
  commonName: string;
  scientificName: string;
  category: HazardCategory;
  color: string;
  regionLabel: string;
  operationalImpact: string;
  controls: string[];
  zones: HazardZone[];
  links?: HazardLink[];
}

export const HAZARDS: Hazard[] = [
  {
    id: "opm",
    commonName: "Oak Processionary Moth",
    scientificName: "Thaumetopoea processionea",
    category: "operator",
    color: "#f97316",
    regionLabel: "Greater London & Home Counties",
    operationalImpact:
      "White silken canopy nests on oak. Running saws can aerosolize toxic urticating hairs, causing severe respiratory distress, skin blistering, and eye irritation.",
    controls: [
      "Visual canopy sweep of oak before cross-cutting any felled or standing timber",
      "If nests are present, switch to sealed safety goggles and Respiratory Protective Equipment (RPE) before continuing",
      "Do not use compressed air or brush cutters near nests — this aerosolizes hairs",
    ],
    zones: [
      { type: "circle", coords: [51.49, -0.1], radius: 45000 },
      { type: "circle", coords: [51.75, -0.45], radius: 15000 },
    ],
  },
  {
    id: "btm",
    commonName: "Brown Tail Moth",
    scientificName: "Euproctis chrysorrhoea",
    category: "operator",
    color: "#ef4444",
    regionLabel: "Essex & Suffolk Coastal Scrub",
    operationalImpact:
      "Infests scrub, hawthorn, and fruit trees along coastal and hedgerow habitat. Toxic hairs cause severe dermal blistering and can trigger acute asthma symptoms.",
    controls: [
      "Long-sleeved cut-resistant gear and skin barriers during branch clearance in scrub/hedgerow",
      "Face shields when working near hawthorn or fruit tree stands with visible web nests",
      "Wash exposed skin promptly if hair contact is suspected",
    ],
    zones: [
      { type: "circle", coords: [51.87, 1.28], radius: 20000 },
      { type: "circle", coords: [52.05, 1.15], radius: 18000 },
    ],
  },
  {
    id: "ips-typographus",
    commonName: "Eight-Toothed Spruce Bark Beetle",
    scientificName: "Ips typographus",
    category: "statutory",
    color: "#10b981",
    regionLabel: "South Lincolnshire · East Anglia · Greater London · South East England — Demarcated Area (Forestry Commission, June 2024)",
    operationalImpact:
      "Serious statutory pest of Picea (spruce). The Forestry Commission's June 2024 Demarcated Area (Notice 7) covers a large swathe of eastern England from south Lincolnshire and Norfolk in the north, through Cambridgeshire, Hertfordshire, Greater London, Essex, Kent and East Sussex in the south. If you are working within or bordering this area, specific legal restrictions on felling, killing, stacking, and moving spruce material apply. Contact the Ips typographus Team before carrying out any operations on spruce: ips.t@forestrycommission.gov.uk · 0300 067 4454.",
    controls: [
      "Felling restriction — provide written notice to the Forestry Commission at least 14 days before felling any spruce within the Demarcated Area. Felling may only commence once written authorisation is received.",
      "Killing restriction — ring-barking, chemical injection/application, mechanical intervention, or arboricultural killing of any Picea over 3 m in height requires prior written agreement from the Forestry Commission.",
      "No material left in situ — spruce material must not be left on site after felling unless a plant health inspector has authorised this in writing.",
      "Movement ban — spruce material with bark (logs with bark, isolated bark, live trees over 3 m) that originated within the Demarcated Area must not be moved out of the area.",
      "Felling licence — a separate felling licence may also be required (unless trees are completely dead, pose immediate risk, or the volume is within the 5 m³ quarterly exempt limit). Contact a Forestry Commission Woodland Officer if uncertain.",
      "Report suspected infestation (fresh bore dust, beetle galleries under bark) via TreeAlert before processing further stems.",
    ],
    links: [
      { label: "Ips typographus — GOV.UK pest guidance", url: "https://www.gov.uk/guidance/eight-toothed-european-spruce-bark-beetle-ips-typographus" },
      { label: "Apply for Ips typographus felling authorisation — GOV.UK", url: "https://www.gov.uk/guidance/apply-for-ips-typographus-authorisation-to-fell-and-process-spruce-trees" },
      { label: "Tree felling: getting permission — GOV.UK", url: "https://www.gov.uk/guidance/tree-felling-getting-permission" },
      { label: "TreeAlert — report tree pests & diseases", url: "https://treealert.forestresearch.gov.uk" },
      { label: "Latest Ips typographus news", url: "https://www.gov.uk/guidance/eight-toothed-european-spruce-bark-beetle-ips-typographus#latest-news" },
    ],
    // Circles approximate the FC June 2024 Demarcated Area boundary (illustrative — verify against official notices)
    zones: [
      { type: "circle", coords: [52.90,  0.15], radius: 90000 },  // South Lincolnshire / North Norfolk / The Wash
      { type: "circle", coords: [52.55,  1.25], radius: 75000 },  // Central & East Norfolk coast
      { type: "circle", coords: [52.10,  1.30], radius: 65000 },  // Suffolk coast / Ipswich
      { type: "circle", coords: [51.85,  1.00], radius: 58000 },  // North Essex / Colchester
      { type: "circle", coords: [51.55,  0.45], radius: 52000 },  // Essex / East London
      { type: "circle", coords: [51.48, -0.08], radius: 48000 },  // Greater London
      { type: "circle", coords: [51.18,  0.65], radius: 55000 },  // Kent
      { type: "circle", coords: [50.90,  0.30], radius: 38000 },  // East Sussex coast
      { type: "circle", coords: [52.10, -0.15], radius: 62000 },  // Cambridgeshire / Bedfordshire / Hertfordshire
      { type: "circle", coords: [51.75, -0.45], radius: 42000 },  // West Hertfordshire / Chilterns fringe
    ],
  },
  {
    id: "ash-dieback",
    commonName: "Chalara Ash Dieback",
    scientificName: "Hymenoscyphus fraxineus",
    category: "statutory",
    color: "#06b6d4",
    regionLabel: "Nationwide — Wales most severely affected; heavy infection across England & Scotland; present in N. Ireland",
    operationalImpact:
      "Confirmed in virtually every county of Great Britain. Wales is the most severely affected region (highest infection density); the Midlands, Yorkshire, East Anglia, SE England and parts of Scotland show extensive spread. Treat ALL ash as potentially infected regardless of location or crown appearance — advanced decay causes unpredictable crown shatter and heavy-limb drop.",
    controls: [
      "Treat all ash as potentially diseased and apply double-distance safety zones before cross-cutting",
      "Inspect crown for dead/hanging branches and stem for cankers or basal decay before committing to a cutting plan",
      "Minimise heavy wedging or aggressive winching on brittle material — use additional stem support",
      "Bag and remove sawdust from confirmed infected sites; tool wash-down before leaving",
      "Report any previously unrecorded site via TreeAlert (treealert.forestresearch.gov.uk)",
    ],
    // Zones reflect Forest Research distribution data — Wales is most intensely affected
    zones: [
      // Wales — most severely infected
      { type: "circle", coords: [52.45, -3.75], radius: 100000 }, // Central & North Wales
      { type: "circle", coords: [51.65, -3.40], radius: 70000 },  // South Wales / Valleys
      // England — Midlands & West
      { type: "circle", coords: [52.40, -2.10], radius: 72000 },  // West Midlands / Shropshire / Worcestershire
      { type: "circle", coords: [52.85, -1.00], radius: 68000 },  // East Midlands / Nottinghamshire
      { type: "circle", coords: [51.90, -1.80], radius: 58000 },  // Gloucestershire / Oxfordshire
      // England — Yorkshire & North
      { type: "circle", coords: [53.85, -1.55], radius: 72000 },  // Yorkshire / Humber
      { type: "circle", coords: [54.65, -1.65], radius: 58000 },  // Durham / NE England
      { type: "circle", coords: [53.60, -2.70], radius: 58000 },  // Lancashire / NW England
      { type: "circle", coords: [54.95, -2.90], radius: 52000 },  // Cumbria / Lake District
      // England — East Anglia
      { type: "circle", coords: [52.55,  1.15], radius: 72000 },  // Norfolk / North Suffolk
      { type: "circle", coords: [52.05,  1.20], radius: 62000 },  // South Suffolk / Essex
      // England — SE & South
      { type: "circle", coords: [51.20,  0.55], radius: 68000 },  // Kent / East Sussex / Surrey
      { type: "circle", coords: [51.48, -0.10], radius: 48000 },  // Greater London / Home Counties
      { type: "circle", coords: [51.05, -1.40], radius: 52000 },  // Hampshire / Isle of Wight area
      { type: "circle", coords: [50.90, -3.55], radius: 55000 },  // Devon / Somerset
      // Scotland — Central Belt & Borders
      { type: "circle", coords: [55.50, -2.55], radius: 62000 },  // Scottish Borders / Northumberland
      { type: "circle", coords: [56.05, -3.70], radius: 62000 },  // Central Scotland / Stirling
      { type: "circle", coords: [56.50, -2.85], radius: 58000 },  // Tayside / Angus / Perthshire
      { type: "circle", coords: [57.25, -2.50], radius: 58000 },  // Aberdeenshire
      { type: "circle", coords: [57.50, -4.20], radius: 52000 },  // Ross-shire / Highland
      { type: "circle", coords: [55.85, -4.35], radius: 50000 },  // Argyll / West Scotland
      // Northern Ireland
      { type: "circle", coords: [54.75, -6.20], radius: 52000 },  // Northern Ireland
    ],
  },
  {
    id: "sod-pramorum",
    commonName: "Sudden Oak Death / Larch Dieback",
    scientificName: "Phytophthora ramorum",
    category: "statutory",
    color: "#eab308",
    regionLabel: "South West England & Wales",
    operationalImpact:
      "Highly transmissible fungal pathogen spread via contaminated wood shavings, sawdust, and bar oil between sites.",
    controls: [
      "Complete tool, chain, guidebar and boot washdown using an approved chemical disinfectant before leaving site",
      "Bag and remove sawdust/shavings rather than leaving on site or transferring between sites",
      "Avoid moving untreated larch/oak material out of the affected area",
    ],
    zones: [
      { type: "circle", coords: [50.6, -3.9], radius: 45000 },
      { type: "circle", coords: [51.7, -3.6], radius: 35000 },
    ],
  },
  {
    id: "sweet-chestnut-blight",
    commonName: "Sweet Chestnut Blight",
    scientificName: "Cryphonectria parasitica",
    category: "statutory",
    color: "#ec4899",
    regionLabel: "Kent, Sussex & Surrey",
    operationalImpact:
      "Regulated fungal disease causing cankers in sweet chestnut timber, with statutory restrictions on onward movement of processed material.",
    controls: [
      "Processed sweet chestnut biomass must be incinerated on-site or subjected to deep burial",
      "Raw logs from affected stands cannot be converted into transportable firewood",
      "Report suspected canker symptoms before processing further stems",
    ],
    zones: [
      { type: "circle", coords: [51.15, 0.3], radius: 38000 },
    ],
  },
  {
    id: "western-hemlock-dieback",
    commonName: "Western Hemlock Dieback",
    scientificName: "Phytophthora pluvialis",
    category: "statutory",
    color: "#3b82f6",
    regionLabel: "Cornwall & Devon",
    operationalImpact:
      "Needle blight fungus tracking through wet soil and surface water, affecting conifer stands in the South West.",
    controls: [
      "Mandatory cleaning loops for fuel jerry cans, support vehicle tyres, and maintenance tools before relocating ground stations",
      "Avoid working across wet ground between infected and clean compartments without decontamination",
      "Dedicate tools to a single compartment where possible",
    ],
    zones: [{ type: "circle", coords: [50.4, -4.6], radius: 35000 }],
  },
];

export const CATEGORY_LABEL: Record<HazardCategory, string> = {
  operator: "Direct Operator Health Hazards",
  statutory: "Statutory Containment Zones",
};
