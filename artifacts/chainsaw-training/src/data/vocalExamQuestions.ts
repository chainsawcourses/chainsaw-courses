export interface KeyPoint {
  label: string;
  keywords: string[];
}

export interface VocalPrompt {
  prompt: string;
  keyPoints: KeyPoint[];
  threshold: number;
}

export interface VocalQuestion {
  id: number;
  nptcRef: number;
  question: string;
  prompts: VocalPrompt[];
}

export const VOCAL_EXAM_QUESTIONS: VocalQuestion[] = [
  {
    id: 1,
    nptcRef: 1,
    question: "Explain the risk assessment process.",
    prompts: [
      {
        prompt: "What is step one of the risk assessment process?",
        threshold: 1,
        keyPoints: [
          { label: "Identify the hazards", keywords: ["identif", "hazard", "danger", "find", "spot", "look for"] },
        ],
      },
      {
        prompt: "What is step two?",
        threshold: 1,
        keyPoints: [
          { label: "Decide who might be harmed and how", keywords: ["who might", "harmed", "harm", "injur", "affected", "at risk", "decide who"] },
        ],
      },
      {
        prompt: "What is step three?",
        threshold: 1,
        keyPoints: [
          { label: "Evaluate the risks and decide on precautions", keywords: ["evaluat", "precaution", "control", "assess", "weigh", "decide on"] },
        ],
      },
      {
        prompt: "What is step four?",
        threshold: 1,
        keyPoints: [
          { label: "Record the findings and implement them", keywords: ["record", "implement", "document", "write", "log", "findings"] },
        ],
      },
      {
        prompt: "And what is step five — the final step?",
        threshold: 1,
        keyPoints: [
          { label: "Review and update the assessment as necessary", keywords: ["review", "update", "revise", "monitor", "revisit", "check again"] },
        ],
      },
    ],
  },
  {
    id: 2,
    nptcRef: 2,
    question: "Identify the hazards, risks and controls associated with the site, task and machine.",
    prompts: [
      {
        prompt: "Starting with the site — identify at least three hazards, risks and controls associated with the site.",
        threshold: 3,
        keyPoints: [
          { label: "Uneven or slippery ground", keywords: ["uneven", "slippery", "ground condition", "terrain", "slope", "muddy", "wet ground"] },
          { label: "Other people or members of the public in the area", keywords: ["public", "people", "bystander", "other person", "exclusion zone", "others nearby", "pedestrian"] },
          { label: "Overhead hazards — power lines, hung-up branches", keywords: ["overhead", "power line", "electric", "cable", "hung up", "branch above", "overhead line"] },
          { label: "Underground services — buried pipes or cables", keywords: ["underground", "buried", "pipe", "service", "cable below", "buried cable"] },
          { label: "Adverse weather conditions", keywords: ["weather", "wind", "rain", "visibility", "lightning", "frost", "ice", "storm"] },
        ],
      },
      {
        prompt: "Now the task — identify at least three hazards, risks and controls associated with the task.",
        threshold: 3,
        keyPoints: [
          { label: "Kickback during cutting", keywords: ["kickback", "kick back", "kick-back"] },
          { label: "Falling timber, snags or widow makers", keywords: ["falling", "snag", "widow maker", "dead wood", "hung", "log roll", "falling branch"] },
          { label: "Fatigue or lone working", keywords: ["fatigue", "tired", "alone", "lone working", "exhaustion", "working alone"] },
          { label: "Dust, noise or vibration from the task", keywords: ["dust", "noise", "vibration from task", "havs", "hand arm", "white finger", "hearing damage"] },
          { label: "Chain or bar contact with the operator", keywords: ["contact", "bar contact", "chain contact", "cut hand", "leg contact", "operator contact"] },
        ],
      },
      {
        prompt: "And finally, the machine — identify at least three hazards, risks and controls associated with the machine.",
        threshold: 3,
        keyPoints: [
          { label: "Chain break or chain throw", keywords: ["chain break", "chain throw", "chain snap", "derail", "chain off"] },
          { label: "Fuel spillage or fire risk", keywords: ["fuel", "spillage", "fire", "ignit", "flammable", "petrol", "fuel spill"] },
          { label: "Exhaust fumes or burns from hot surfaces", keywords: ["exhaust", "fume", "emission", "carbon monoxide", "burn", "hot surface"] },
          { label: "Machine vibration causing HAVS", keywords: ["machine vibration", "saw vibration", "vibrat", "havs", "hand arm vibration"] },
          { label: "Chain brake failure", keywords: ["brake fail", "brake malfunction", "brake not work", "brake defect", "brake failure"] },
        ],
      },
    ],
  },
  {
    id: 3,
    nptcRef: 3,
    question: "Outline the emergency planning relevant to the working area.",
    prompts: [
      {
        prompt: "Outline the emergency planning relevant to the working area.",
        threshold: 5,
        keyPoints: [
          { label: "Site location, grid reference or what3words", keywords: ["grid ref", "grid reference", "what three words", "what3words", "location", "site address", "coordinates"] },
          { label: "Designated meeting place or muster point", keywords: ["meeting place", "muster point", "rendezvous", "rally point", "assembly"] },
          { label: "Nearest access point or street name", keywords: ["access point", "street", "access route", "entry point", "nearest road"] },
          { label: "Type of access (road type, 4WD, light vehicles)", keywords: ["type of access", "four wheel", "4x4", "vehicle", "road access", "public road", "light vehicle"] },
          { label: "Suitable helicopter landing area", keywords: ["helicopter", "landing", "heli", "air ambu"] },
          { label: "Phone number of nearest doctor or A&E hospital", keywords: ["doctor", "hospital", "accident and emergency", "a&e", "phone number", "nearest medical"] },
          { label: "Works manager or supervisor contact details", keywords: ["works manager", "supervisor contact", "manager", "emergency contact", "contact details"] },
          { label: "Your own mobile number", keywords: ["own number", "mobile number", "your number", "personal contact", "your mobile"] },
        ],
      },
    ],
  },
  {
    id: 4,
    nptcRef: 4,
    question: "Outline your responsibilities as an operator under the Health and Safety at Work Act and PUWER.",
    prompts: [
      {
        prompt: "Outline your responsibilities as an operator under the Health and Safety at Work Act and PUWER.",
        threshold: 4,
        keyPoints: [
          { label: "HASWA: follow training received", keywords: ["follow training", "follow your training", "trained", "act on training", "training received"] },
          { label: "HASWA: take reasonable care of own and others' safety", keywords: ["reasonable care", "care of others", "own safety", "other people", "responsibility for", "duty of care"] },
          { label: "PUWER: equipment must be maintained", keywords: ["maintained", "maintenance", "kept in good", "serviceable", "equipment condition"] },
          { label: "PUWER: equipment must be fit for purpose", keywords: ["fit for purpose", "suitable", "appropriate", "right tool", "adequate"] },
        ],
      },
    ],
  },
  {
    id: 5,
    nptcRef: 5,
    question: "State providers of industry good practice for chainsaw operations.",
    prompts: [
      {
        prompt: "State providers of industry good practice for chainsaw operations.",
        threshold: 2,
        keyPoints: [
          { label: "Forest Industry Safety Accord (FISA)", keywords: ["fisa", "forest industry safety accord"] },
          { label: "Regional forestry bodies e.g. Forestry Commission", keywords: ["forestry commission", "regional forestry", "natural resources", "forestry england", "forestry body"] },
          { label: "Arboricultural Forestry Advisory Group (AFAG)", keywords: ["afag", "arboricultural forestry advisory", "advisory group"] },
          { label: "Arboricultural Association (AA)", keywords: ["arboricultural association", "arb association"] },
        ],
      },
    ],
  },
  {
    id: 6,
    nptcRef: 6,
    question: "Explain why it is important to maintain chainsaws to the manufacturer's recommendations.",
    prompts: [
      {
        prompt: "Explain why it is important to maintain chainsaws to the manufacturer's recommendations.",
        threshold: 1,
        keyPoints: [
          { label: "Ensures the machine is safe to use", keywords: ["safe to use", "safety", "safe operation", "operator safety", "reduces risk", "prevent accident"] },
          { label: "Reduces machinery repair downtime", keywords: ["downtime", "repair", "breakdown", "out of service", "reliability", "longevity", "last longer", "less repair"] },
          { label: "Maintains performance and cutting efficiency", keywords: ["performance", "efficient", "cutting ability", "optimum", "operate correctly"] },
        ],
      },
    ],
  },
  {
    id: 7,
    nptcRef: 7,
    question: "Identify and explain the function of all the key safety features of a chainsaw.",
    prompts: [
      {
        prompt: "Identify and explain the function of all the key safety features of a chainsaw.",
        threshold: 8,
        keyPoints: [
          { label: "Guide bar cover — protects the bar and chain", keywords: ["bar cover", "guide bar cover", "scabbard", "cover protect", "chain cover"] },
          { label: "Chain with low kickback characteristics — reduces kickback", keywords: ["low kickback", "kickback chain", "anti-kickback chain", "safety chain", "low kick back chain"] },
          { label: "Exhaust — noise reduction and reduces emissions", keywords: ["exhaust", "silencer", "muffler", "noise reduc", "emission"] },
          { label: "Combined chain brake and front hand guard — stops chain, protects hand", keywords: ["chain brake", "front hand guard", "hand guard", "brake stop", "stops the chain", "front guard"] },
          { label: "Chain catcher — catches a derailed chain", keywords: ["chain catcher", "catch the chain", "derailed chain", "chain off"] },
          { label: "Anti-vibration mounts — reduces vibration", keywords: ["anti-vibration", "anti vibration", "vibration mount", "reduce vibration", "dampen vibration"] },
          { label: "On/off switch — stops the engine", keywords: ["on off switch", "on/off", "kill switch", "stop switch", "engine stop switch", "stops engine"] },
          { label: "Safety decals — provides mandatory information (hand/eye/ear symbols)", keywords: ["safety decal", "decal", "symbol", "label", "warning label", "mandatory information", "ear defender symbol", "eye symbol"] },
          { label: "Throttle trigger lockout — prevents accidental throttle operation", keywords: ["throttle lockout", "trigger lockout", "accidental throttle", "throttle safety", "lock out"] },
          { label: "Rear chain breakage guard — protects the rear hand", keywords: ["rear guard", "rear hand", "rear chain", "back guard", "back hand guard", "breakage guard"] },
        ],
      },
    ],
  },
  {
    id: 8,
    nptcRef: 9,
    question: "State the hazards associated with battery powered chainsaw equipment.",
    prompts: [
      {
        prompt: "State the hazards associated with battery powered chainsaw equipment.",
        threshold: 4,
        keyPoints: [
          { label: "Incorrect battery/machine compatibility", keywords: ["incompatible", "compatibility", "wrong battery", "incorrect battery", "not compatible"] },
          { label: "Machine can be live when battery is in place", keywords: ["live", "battery in", "powered on", "active when", "energised"] },
          { label: "Machine may not have an on/off switch", keywords: ["no switch", "no on off", "no kill switch", "always on", "no stop"] },
          { label: "Battery misalignment or falling from machine", keywords: ["misalign", "dislodg", "fall from", "drop", "not seated", "incorrect fitting"] },
          { label: "Electric shock risk", keywords: ["electric shock", "electrocution", "shock", "electri"] },
          { label: "Short circuiting and combustion when charging", keywords: ["short circuit", "combustion", "fire when charging", "charging risk", "overheating battery"] },
          { label: "Malfunction due to water contamination", keywords: ["water", "wet", "moisture", "contamination", "waterproof", "ingress"] },
          { label: "Battery storage and disposal hazards", keywords: ["storage", "disposal", "store battery", "dispos", "battery storage"] },
          { label: "Lack of power or insufficient charge", keywords: ["lack of power", "insufficient charge", "low battery", "run out", "power loss"] },
        ],
      },
    ],
  },
  {
    id: 9,
    nptcRef: 10,
    question: "Explain battery power unit maintenance and checks.",
    prompts: [
      {
        prompt: "Explain battery power unit maintenance and checks.",
        threshold: 4,
        keyPoints: [
          { label: "Battery guide tracks inspected and cleaned", keywords: ["guide track", "battery track", "slot", "clean track", "inspect track"] },
          { label: "Battery is not damaged, cracked or deformed", keywords: ["not damaged", "no crack", "not cracked", "not deformed", "intact", "undamaged", "check battery condition"] },
          { label: "Battery has sufficient charge", keywords: ["sufficient charge", "enough charge", "charged", "charge level", "battery charged"] },
          { label: "Machine air intake and cooling system cleaned and inspected", keywords: ["air intake", "cooling system", "cooling", "intake clean", "airway"] },
          { label: "Keypad inspected for damage and cleaned (if applicable)", keywords: ["keypad", "key pad", "display", "control panel", "interface"] },
          { label: "Battery compartment inspected for damage", keywords: ["compartment", "battery compartment", "housing", "battery bay", "bay inspect"] },
        ],
      },
    ],
  },
  {
    id: 10,
    nptcRef: 11,
    question: "State the benefits associated with the use of battery powered machines.",
    prompts: [
      {
        prompt: "State the benefits associated with the use of battery powered machines.",
        threshold: 4,
        keyPoints: [
          { label: "Reduced weight", keywords: ["lighter", "reduced weight", "less weight", "weight reduction", "less heavy"] },
          { label: "Reduced vibration", keywords: ["reduced vibration", "less vibration", "lower vibration", "vibration reduction"] },
          { label: "Reduced noise", keywords: ["quieter", "reduced noise", "less noise", "lower noise", "quieter operation"] },
          { label: "No emissions", keywords: ["no emission", "zero emission", "no exhaust", "no fumes", "clean", "emission free"] },
          { label: "Clearer communication with others on site", keywords: ["communication", "talk to", "speak to", "hear each other", "clearer comms"] },
          { label: "Less maintenance requirements", keywords: ["less maintenance", "lower maintenance", "fewer service", "easier maintenance"] },
          { label: "More accurate operation due to no engine torque", keywords: ["accurate", "torque", "no engine torque", "precise", "better control"] },
          { label: "No need to transport fuel or risk of fuel spillage", keywords: ["no fuel", "fuel transport", "spillage", "no petrol", "no spill", "no fuel need"] },
        ],
      },
    ],
  },
  {
    id: 11,
    nptcRef: 12,
    question: "Explain the function and maintenance requirements of the individual chainsaw components.",
    prompts: [
      {
        prompt: "Explain the function and maintenance requirements of the individual chainsaw components — spark plug, air filter, chain brake, cooling system, exhaust system, clutch and drive system, sprocket, starter mechanism, fuel filter and oil filter.",
        threshold: 7,
        keyPoints: [
          { label: "Spark plug — provides ignition; inspect, clean, check electrode gap", keywords: ["spark plug", "ignition", "electrode", "gap", "plug clean"] },
          { label: "Air filter — prevents debris entering carburettor; clean thoroughly", keywords: ["air filter", "carburettor", "debris", "air fuel ratio", "filter clean"] },
          { label: "Chain brake — stops the chain; inspect, clean mechanism, check band wear", keywords: ["chain brake", "brake band", "clutch housing", "brake stop", "brake mechanism"] },
          { label: "Cooling system — prevents overheating; remove debris from fins and cylinder", keywords: ["cooling", "overheat", "fins", "cylinder", "cool system", "debris from fins"] },
          { label: "Exhaust system — reduces noise/emissions; check nuts, spark arrestor, remove residue", keywords: ["exhaust", "silencer", "spark arrestor", "nuts and bolts", "residue", "exhaust check"] },
          { label: "Clutch/drive system — provides drive to chain; inspect, clean, remove clutch", keywords: ["clutch", "drive system", "drive to chain", "sprocket assembly", "needle cage", "crankshaft"] },
          { label: "Sprocket — drives chain along bar; check for wear", keywords: ["sprocket", "drive sprocket", "sprocket wear", "sprocket check"] },
          { label: "Starter mechanism — engages flywheel; inspect cord, tension spring", keywords: ["starter", "recoil", "pull cord", "flywheel", "starter cord", "coil spring"] },
          { label: "Greasing/lubrication — prevents wear; grease components as appropriate", keywords: ["grease", "lubrication", "lubricat", "needle cage grease", "oil component"] },
          { label: "Fuel filter — prevents debris entering engine; locate, remove, replace", keywords: ["fuel filter", "fuel cap", "fuel tank", "filter from tank", "fuel debris"] },
          { label: "Oil filter — prevents debris entering guide bar; locate, remove, clean or replace", keywords: ["oil filter", "oil cap", "bar oil", "oil tank", "oil debris"] },
        ],
      },
    ],
  },
  {
    id: 12,
    nptcRef: 13,
    question: "Explain the function and maintenance requirements of the guidebar.",
    prompts: [
      {
        prompt: "Explain the function and maintenance requirements of the guidebar.",
        threshold: 4,
        keyPoints: [
          { label: "Function: holds and carries the chain to enable cutting of timber", keywords: ["holds the chain", "carries the chain", "carry the chain", "enable cutting", "support chain", "bar carry"] },
          { label: "Check for uneven/damaged rails and maintain as appropriate", keywords: ["uneven rail", "damaged rail", "rail check", "rail condition", "burr", "burred"] },
          { label: "Check straightness of bar and bar groove depth", keywords: ["straightness", "straight", "groove depth", "groove", "bar groove", "groove check"] },
          { label: "Clear bar groove and oil holes; inspect sprocket nose", keywords: ["oil hole", "groove clear", "sprocket nose", "clear groove", "clean hole"] },
          { label: "Grease bar nose sprocket and turn bar to reduce wear", keywords: ["grease nose", "bar nose", "turn the bar", "rotating bar", "reverse bar", "bar turn"] },
          { label: "Identify overheating, cracking and remove burrs", keywords: ["overheat bar", "crack", "burr removal", "remove burr", "burring"] },
        ],
      },
    ],
  },
  {
    id: 13,
    nptcRef: 14,
    question: "Describe the problems encountered when the chain and guidebar are worn, damaged or poorly maintained.",
    prompts: [
      {
        prompt: "Describe the problems encountered when the chain and guidebar are worn, damaged or poorly maintained.",
        threshold: 3,
        keyPoints: [
          { label: "Chainsaw does not cut in a straight line", keywords: ["straight line", "not cut straight", "drift", "deviate", "wander", "pull to one side"] },
          { label: "Overheating of the guidebar", keywords: ["overheat", "heat up", "hot bar", "bar overheat", "bar heat"] },
          { label: "Poor lubrication of the chain", keywords: ["poor lubrication", "lack of oil", "dry chain", "not lubricated", "lubrication problem"] },
          { label: "Increased chain, bar and sprocket wear", keywords: ["increased wear", "accelerated wear", "wear out faster", "premature wear", "extra wear"] },
        ],
      },
    ],
  },
  {
    id: 14,
    nptcRef: 15,
    question: "State all the information required to replace a chainsaw chain.",
    prompts: [
      {
        prompt: "State all the information required to replace a chainsaw chain.",
        threshold: 5,
        keyPoints: [
          { label: "Pitch of the chain", keywords: ["pitch"] },
          { label: "Gauge of the chain", keywords: ["gauge"] },
          { label: "Length of the guidebar", keywords: ["bar length", "guide bar length", "length of bar", "bar size", "bar inches"] },
          { label: "Number of drive links", keywords: ["drive link", "number of link", "drive links"] },
          { label: "Cutter type", keywords: ["cutter type", "chain type", "type of chain", "chain specification"] },
        ],
      },
    ],
  },
  {
    id: 15,
    nptcRef: 16,
    question: "Identify different cutter types and their application.",
    prompts: [
      {
        prompt: "Identify different cutter types and their application.",
        threshold: 3,
        keyPoints: [
          { label: "Chisel chain (full chisel)", keywords: ["chisel", "full chisel"] },
          { label: "Semi-chisel chain", keywords: ["semi-chisel", "semi chisel"] },
          { label: "Application depends on timber type, operator experience and preference", keywords: ["timber type", "application", "experience", "preference", "wood type", "operator prefer", "species"] },
        ],
      },
    ],
  },
  {
    id: 16,
    nptcRef: 17,
    question: "Explain how to select the correct filing information for the chain and why this is necessary.",
    prompts: [
      {
        prompt: "Explain how to select the correct filing information for the chain and why this is necessary.",
        threshold: 5,
        keyPoints: [
          { label: "Select correct file size using chain charts, manufacturer info or chain box", keywords: ["file size", "chain chart", "manufacturer", "chain box", "correct file", "filing guide"] },
          { label: "Reason: ensures chain is sharpened to manufacturer's recommendations", keywords: ["manufacturer recommendation", "correct angle", "to spec", "manufacturer spec", "as recommended"] },
          { label: "Reason: enhances cutting performance and accurate cutting", keywords: ["cutting performance", "enhance", "accurate cutting", "efficient cut", "improves cutting"] },
          { label: "Reason: decreased vibration and reduced kickback risk", keywords: ["decreased vibration", "reduce vibration", "reduce kickback", "less kickback", "kickback risk"] },
          { label: "Depth gauge: achieves optimum cutting speed and reduces kickback", keywords: ["depth gauge", "raker", "optimum speed", "cutting speed", "kickback reduction"] },
          { label: "Depth gauge: reduces chain vibration", keywords: ["depth gauge vibration", "raker height", "vibration reduction", "gauge setting"] },
        ],
      },
    ],
  },
  {
    id: 17,
    nptcRef: 18,
    question: "Explain the function and maintenance requirements of the chain.",
    prompts: [
      {
        prompt: "Explain the function and maintenance requirements of the chain.",
        threshold: 4,
        keyPoints: [
          { label: "Function: carries cutting components to enable cutting of timber", keywords: ["carries cutting", "cutting components", "enable cutting", "carries the cutter", "carry cutting"] },
          { label: "Check cutters for damage and select first cutter to sharpen", keywords: ["check cutter", "damaged cutter", "first cutter", "inspect cutter", "cutter damage"] },
          { label: "Secure chain in vice and use correct file size with a handle", keywords: ["vice", "chain vice", "bench vice", "secure chain", "file with handle", "correct size file"] },
          { label: "Maintain correct top and side plate angles throughout", keywords: ["top plate", "side plate", "filing angle", "plate angle", "correct angle", "maintain angle"] },
          { label: "Ensure consistent cutter length; remove burrs; maintain depth gauges", keywords: ["consistent length", "cutter length", "remove burr", "depth gauge", "equal length"] },
        ],
      },
    ],
  },
  {
    id: 18,
    nptcRef: 20,
    question: "State the steps to be taken when a chainsaw is not repairable, faulty or non-operational.",
    prompts: [
      {
        prompt: "State the steps to be taken when a chainsaw is not repairable, faulty or non-operational.",
        threshold: 3,
        keyPoints: [
          { label: "Label the chainsaw and remove it from service", keywords: ["label", "tag", "remove from service", "out of service", "taken out", "condemned", "quarantine"] },
          { label: "Carry out any operator maintenance possible", keywords: ["operator maintenance", "user maintenance", "what maintenance you can", "basic maintenance", "operator check"] },
          { label: "Arrange for repair of the chainsaw", keywords: ["arrange repair", "book repair", "send for repair", "get it repaired", "repair arranged", "workshop", "mechanic"] },
        ],
      },
    ],
  },
  {
    id: 19,
    nptcRef: 22,
    question: "Describe the correct methods for disposing of waste from chainsaw maintenance.",
    prompts: [
      {
        prompt: "Describe the correct methods for disposing of waste from chainsaw maintenance.",
        threshold: 2,
        keyPoints: [
          { label: "Use designated waste or recycling bins", keywords: ["waste bin", "recycle", "designated bin", "waste disposal", "recycling bin", "skip", "waste container"] },
          { label: "Waste oils placed in approved containers for proper disposal", keywords: ["waste oil", "approved container", "oil disposal", "oil container", "used oil", "oil drum"] },
        ],
      },
    ],
  },
  {
    id: 20,
    nptcRef: 27,
    question: "State the appropriate safe working distances from other operators during cross-cutting.",
    prompts: [
      {
        prompt: "State the appropriate safe working distances from other operators during cross-cutting.",
        threshold: 2,
        keyPoints: [
          { label: "Five metres minimum from other operators", keywords: ["five metre", "5 metre", "5m", "five meters"] },
          { label: "Or twice the length of the longest product being cut", keywords: ["twice the length", "two times the length", "2 times", "longest product", "longest piece"] },
        ],
      },
    ],
  },
  {
    id: 21,
    nptcRef: 28,
    question: "State routine bio-security controls relevant to chainsaw operations.",
    prompts: [
      {
        prompt: "State routine bio-security controls relevant to chainsaw operations.",
        threshold: 1,
        keyPoints: [
          { label: "Disinfection or cleaning of equipment between sites", keywords: ["disinfect", "clean equipment", "cross-contamination", "cross contamination", "decontaminat"] },
          { label: "Cleaning or disposal of contaminated PPE", keywords: ["clean ppe", "dispose ppe", "contaminated ppe", "ppe cleaning", "boot cleaning"] },
          { label: "Preventing spread of disease or pests between sites", keywords: ["disease", "pest", "spread", "pathogen", "phytophthora", "ash dieback", "biosecurity"] },
        ],
      },
    ],
  },
  {
    id: 22,
    nptcRef: 29,
    question: "State the environmental considerations specific to cross-cutting.",
    prompts: [
      {
        prompt: "State the environmental considerations specific to cross-cutting.",
        threshold: 1,
        keyPoints: [
          { label: "Fuelling site — fuel away from water or sensitive areas", keywords: ["fuelling site", "fuelling area", "fuel away", "refuel location", "fuelling spot"] },
          { label: "Type of fuel or oil — use biodegradable where possible", keywords: ["biodegradable", "bio oil", "type of fuel", "fuel type", "oil type", "vegetable oil"] },
          { label: "Use of battery powered saws to reduce emissions", keywords: ["battery saw", "electric saw", "no emission", "battery power", "reduce emission"] },
          { label: "Minimise damage to surrounding vegetation and habitat", keywords: ["vegetation", "habitat", "environment", "damage to soil", "compaction", "watercourse"] },
        ],
      },
    ],
  },
  {
    id: 23,
    nptcRef: 32,
    question: "Describe tension and compression in timber.",
    prompts: [
      {
        prompt: "Describe tension and compression in timber.",
        threshold: 2,
        keyPoints: [
          { label: "Tension is on the outside edge of strained timber — when cut the kerf opens", keywords: ["tension", "outside edge", "kerf open", "open when cut", "tension side"] },
          { label: "Compression is on the inside edge of strained timber — when cut the kerf closes", keywords: ["compression", "inside edge", "kerf close", "close when cut", "compress side"] },
        ],
      },
    ],
  },
  {
    id: 24,
    nptcRef: 33,
    question: "Describe the procedure for removing a trapped saw.",
    prompts: [
      {
        prompt: "Describe the procedure for removing a trapped saw.",
        threshold: 5,
        keyPoints: [
          { label: "First: switch off engine and/or apply chain brake", keywords: ["switch off", "turn off", "chain brake", "engine off", "stop engine", "apply brake", "first thing"] },
          { label: "Lever the timber to open the cut", keywords: ["lever", "lever timber", "open the cut", "open the kerf", "prise open"] },
          { label: "Drive a wedge into the closed kerf", keywords: ["wedge", "drive wedge", "insert wedge", "plastic wedge", "felling wedge"] },
          { label: "Withdraw the saw from the kerf", keywords: ["withdraw", "pull out", "remove the saw", "extract the saw", "free the saw"] },
          { label: "Use another saw to free it — cut at least 300mm from the trapped saw", keywords: ["another saw", "second saw", "300mm", "300 mm", "twelve inch", "12 inch", "free with another"] },
        ],
      },
    ],
  },
  {
    id: 25,
    nptcRef: 34,
    question: "State the recognised methods required to cross-cut timber.",
    prompts: [
      {
        prompt: "State the recognised methods required to cross-cut timber — covering timber under no tension or compression, timber under tension and compression, timber under extreme tension or compression, and timber above guidebar length.",
        threshold: 4,
        keyPoints: [
          { label: "No tension/compression: single cut through or partially cut and turn", keywords: ["single cut", "no tension", "no compression", "turn timber", "straight through", "partially cut"] },
          { label: "Tension and compression: release compression then cut tension, or bore cuts", keywords: ["release compression", "bore cut", "bore through", "tension and compression", "cut from tension"] },
          { label: "Extreme tension/compression: multiple tension or compression cuts", keywords: ["multiple cut", "extreme tension", "extreme compression", "series of cut", "multiple tension", "multiple compression"] },
          { label: "Timber above bar length: use reduction cut, larger saw, or cut from both sides", keywords: ["reduction cut", "larger saw", "both sides", "longer bar", "above bar length", "cut from both"] },
        ],
      },
    ],
  },
  {
    id: 26,
    nptcRef: 37,
    question: "Describe how to apply ergonomic working methods during chainsaw operations.",
    prompts: [
      {
        prompt: "Describe how to apply ergonomic working methods during chainsaw operations.",
        threshold: 2,
        keyPoints: [
          { label: "Provide work areas at a comfortable height to avoid stooping", keywords: ["comfortable height", "avoid stooping", "stoop", "working height", "height adjust", "back strain"] },
          { label: "Work in a pattern to prevent unnecessary repetitive movements", keywords: ["pattern", "repetitive", "avoid repetitive", "work pattern", "systematic", "reduce repetition"] },
          { label: "Replace manual labour with machinery where possible", keywords: ["machinery", "replace manual", "use machine", "mechanical aid", "avoid manual", "use equipment"] },
        ],
      },
    ],
  },
  {
    id: 27,
    nptcRef: 38,
    question: "Describe how to safely move timber.",
    prompts: [
      {
        prompt: "Describe how to safely move timber.",
        threshold: 4,
        keyPoints: [
          { label: "Use safe lifting techniques", keywords: ["safe lift", "correct lift", "lifting technique", "bend knees", "straight back", "squat"] },
          { label: "Move timber within operator's personal lifting capacity", keywords: ["personal capacity", "within capacity", "own lifting", "not too heavy", "lifting limit", "weight limit"] },
          { label: "Move lightest to heaviest", keywords: ["lightest first", "light to heavy", "heaviest last", "order of lifting"] },
          { label: "Dragging or rolling timber", keywords: ["drag", "roll", "rolling", "dragging"] },
          { label: "Use of aid tools — timber tongs, cant hook", keywords: ["aid tool", "cant hook", "timber tong", "handsaw", "log tong", "tool assist", "hook"] },
          { label: "Use of machinery where possible", keywords: ["machine", "forwarder", "tractor", "mechanical", "machinery move"] },
        ],
      },
    ],
  },
  {
    id: 28,
    nptcRef: 39,
    question: "State the considerations for stacking of timber.",
    prompts: [
      {
        prompt: "State the considerations for stacking of timber.",
        threshold: 4,
        keyPoints: [
          { label: "Extraction method", keywords: ["extraction", "extract method", "how it will be removed", "forwarder", "haulage"] },
          { label: "Species of timber", keywords: ["species", "type of wood", "oak", "ash", "conifer", "hardwood", "softwood", "wood type"] },
          { label: "Length and diameter of the timber", keywords: ["length", "diameter", "size", "length and diameter", "log size"] },
          { label: "Product specific requirements", keywords: ["product specific", "product requirement", "specification", "end use", "product type"] },
        ],
      },
    ],
  },
  {
    id: 29,
    nptcRef: 40,
    question: "State the precautions to take to avoid uncontrolled timber movement.",
    prompts: [
      {
        prompt: "State the precautions to take to avoid uncontrolled timber movement.",
        threshold: 2,
        keyPoints: [
          { label: "Ensure manual stacks do not exceed one metre in height", keywords: ["one metre", "1 metre", "1m height", "metre high", "meter high", "stack height"] },
          { label: "Use site features such as tree stumps to brace timber", keywords: ["stump", "brace", "tree stump", "site feature", "brace behind", "support"] },
          { label: "Avoid stacking on steep slopes or unsecured ground", keywords: ["steep slope", "slope", "unsecured", "unstable ground", "flat ground", "avoid slope"] },
          { label: "Appropriate signage in the area", keywords: ["signage", "sign", "warning sign", "barrier", "hazard sign", "mark the area"] },
        ],
      },
    ],
  },
];
