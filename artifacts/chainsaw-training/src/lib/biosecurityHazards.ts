export type HazardCategory = "operator" | "statutory";

export interface HazardZone {
  type: "circle";
  coords: [number, number];
  radius: number;
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
    regionLabel: "East Anglia & East Midlands — Suffolk, Norfolk, Cambridgeshire, Bedfordshire & Lincolnshire",
    operationalImpact:
      "Regulated wood pest within a statutory containment zone covering parts of Suffolk, Norfolk, Cambridgeshire, Bedfordshire, and Lincolnshire. Strict legal movement bans apply to raw conifer and spruce logs, bark, and timber within and from the demarcated area.",
    controls: [
      "Immediate pause on conifer cross-cutting operations within the demarcated area until timber movement licensing is confirmed",
      "Check Forestry Commission/APHA movement licence compliance before dragging, cross cutting, or stacking spruce/conifer stems",
      "Do not transport raw conifer material, bark, or brash outside the zone without statutory authorisation",
      "Report sightings of suspected infestation (fresh bore dust, beetle galleries under bark) via TreeAlert (treealert.forestresearch.gov.uk)",
    ],
    zones: [
      { type: "circle", coords: [52.15, 1.15], radius: 48000 },
      { type: "circle", coords: [52.75, 1.00], radius: 52000 },
      { type: "circle", coords: [52.30, 0.10], radius: 42000 },
      { type: "circle", coords: [52.05, -0.40], radius: 28000 },
      { type: "circle", coords: [53.10, -0.30], radius: 62000 },
    ],
  },
  {
    id: "ash-dieback",
    commonName: "Chalara Ash Dieback",
    scientificName: "Hymenoscyphus fraxineus",
    category: "statutory",
    color: "#06b6d4",
    regionLabel: "Nationwide — confirmed in most counties across England, Wales, Scotland & N. Ireland",
    operationalImpact:
      "Confirmed in virtually every county in Great Britain. Extensively brittle timber profiles — advanced decay causes ash crowns to unpredictably shatter or drop heavy limbs. Assume any ash stem may be affected regardless of apparent crown condition.",
    controls: [
      "Treat all ash as potentially diseased and apply double-distance safety zones before cross-cutting",
      "Inspect crown for dead/hanging branches and stem for cankers or basal decay before committing to a cutting plan",
      "Minimise heavy wedging or aggressive winching on brittle material — use additional stem support",
      "Bag and remove sawdust from confirmed infected sites; tool wash-down before leaving",
      "Report any previously unrecorded site via TreeAlert (treealert.forestresearch.gov.uk)",
    ],
    zones: [
      { type: "circle", coords: [52.6,  1.2], radius: 60000 },
      { type: "circle", coords: [51.2,  0.8], radius: 50000 },
      { type: "circle", coords: [53.9, -1.4], radius: 65000 },
      { type: "circle", coords: [52.8, -0.8], radius: 55000 },
      { type: "circle", coords: [52.4, -2.0], radius: 50000 },
      { type: "circle", coords: [51.0, -3.2], radius: 55000 },
      { type: "circle", coords: [52.2, -3.7], radius: 65000 },
      { type: "circle", coords: [53.6, -2.6], radius: 48000 },
      { type: "circle", coords: [54.6, -1.6], radius: 48000 },
      { type: "circle", coords: [56.3, -3.8], radius: 60000 },
      { type: "circle", coords: [57.5, -4.1], radius: 50000 },
      { type: "circle", coords: [54.8, -6.2], radius: 42000 },
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
