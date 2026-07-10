export type HazardCategory = "operator" | "statutory";

export interface HazardZone {
  type: "polygon" | "circle";
  coords: [number, number][] | [number, number];
  radius?: number;
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
      {
        type: "polygon",
        coords: [
          [51.72, -0.55],
          [51.72, 0.35],
          [51.25, 0.35],
          [51.25, -0.55],
        ],
      },
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
    color: "#7c3aed",
    regionLabel: "Kent & East Sussex Demarcated Area",
    operationalImpact:
      "Regulated wood pest present in Southeast England. Strict legal movement bans apply to raw conifer and spruce logs to prevent spread.",
    controls: [
      "Immediate pause on conifer cross-cutting operations within the demarcated area",
      "Check timber movement licensing compliance before dragging or bucking spruce/conifer stems",
      "Do not transport raw conifer material outside the zone without statutory authorisation",
    ],
    zones: [
      {
        type: "polygon",
        coords: [
          [51.25, 0.4],
          [51.25, 1.0],
          [50.85, 1.0],
          [50.85, 0.4],
        ],
      },
    ],
  },
  {
    id: "ash-dieback",
    commonName: "Chalara Ash Dieback",
    scientificName: "Hymenoscyphus fraxineus",
    category: "statutory",
    color: "#6366f1",
    regionLabel: "Widespread — England, Wales & Scotland",
    operationalImpact:
      "Extensively brittle timber profiles. Advanced decay causes ash crowns to unpredictably shatter or drop heavy limbs during ground tension processing.",
    controls: [
      "Establish double-distance safety zones around dead or visibly diseased ash stems",
      "Minimize heavy wedging or aggressive winching on brittle material",
      "Inspect crown and stem for cavities/cankers before committing to a cutting plan",
    ],
    zones: [
      { type: "circle", coords: [52.5, -1.9], radius: 40000 },
      { type: "circle", coords: [51.9, -2.4], radius: 35000 },
      { type: "circle", coords: [53.4, -2.5], radius: 30000 },
      { type: "circle", coords: [55.0, -3.2], radius: 30000 },
      { type: "circle", coords: [52.1, 0.6], radius: 25000 },
    ],
  },
  {
    id: "sod-pramorum",
    commonName: "Sudden Oak Death / Larch Dieback",
    scientificName: "Phytophthora ramorum",
    category: "statutory",
    color: "#8b5cf6",
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
    color: "#a855f7",
    regionLabel: "Kent, Sussex & Surrey",
    operationalImpact:
      "Regulated fungal disease causing cankers in sweet chestnut timber, with statutory restrictions on onward movement of processed material.",
    controls: [
      "Processed sweet chestnut biomass must be incinerated on-site or subjected to deep burial",
      "Raw logs from affected stands cannot be converted into transportable firewood",
      "Report suspected canker symptoms before processing further stems",
    ],
    zones: [
      {
        type: "polygon",
        coords: [
          [51.35, -0.1],
          [51.35, 0.7],
          [50.95, 0.7],
          [50.95, -0.1],
        ],
      },
    ],
  },
  {
    id: "western-hemlock-dieback",
    commonName: "Western Hemlock Dieback",
    scientificName: "Phytophthora pluvialis",
    category: "statutory",
    color: "#5b21b6",
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
