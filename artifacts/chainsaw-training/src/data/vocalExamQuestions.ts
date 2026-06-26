export interface KeyPoint {
  label: string;
  keywords: string[];
}

export interface VocalPrompt {
  prompt: string;
  keyPoints: KeyPoint[];
  threshold: number;
  isAction?: boolean;
}

export interface VocalQuestion {
  id: number;
  question: string;
  prompts: VocalPrompt[];
}

export const VOCAL_EXAM_QUESTIONS: VocalQuestion[] = [

  // ── MAINTENANCE SECTION ──────────────────────────────────────────────────────

  {
    id: 1,
    question: "What are the 5 steps to risk assessment?",
    prompts: [{
      prompt: "What are the 5 steps to risk assessment?",
      threshold: 5,
      keyPoints: [
        { label: "Step 1 — Identify the hazards", keywords: ["identif", "hazard", "danger", "find the", "spot the", "look for"] },
        { label: "Step 2 — Decide who might be harmed and how", keywords: ["who might", "harmed", "harm", "injur", "affected", "at risk", "decide who"] },
        { label: "Step 3 — Evaluate the risks and decide on precautions", keywords: ["evaluat", "precaution", "control measure", "assess the risk", "weigh", "decide on"] },
        { label: "Step 4 — Record the findings and implement them", keywords: ["record", "implement", "document", "write", "log", "findings"] },
        { label: "Step 5 — Review and update the assessment", keywords: ["review", "update", "revise", "monitor", "revisit", "check again"] },
      ],
    }],
  },

  {
    id: 2,
    question: "Give me at least three hazards with the site and their control measures.",
    prompts: [{
      prompt: "Give me at least three hazards with the site and their control measures.",
      threshold: 3,
      keyPoints: [
        { label: "Members of public or bystanders — control: exclusion zone, warning signs, lookout person", keywords: ["public", "bystander", "people", "pedestrian", "exclusion zone", "other person", "member of public", "others nearby", "lookout", "banks person", "banksman"] },
        { label: "Overhead hazards — power lines, dead wood, hung-up branches — control: safe clearance, helmet, survey", keywords: ["overhead", "power line", "electric", "cable", "hung up", "branch above", "overhead line", "deadwood", "widow maker", "dead wood", "pylon", "utility line", "power cable"] },
        { label: "Uneven, slippery or steep terrain — control: grip boots, escape route, uphill side", keywords: ["uneven", "slippery", "slope", "terrain", "muddy", "wet", "steep", "ground condition", "unstable ground", "grip", "footing"] },
        { label: "Underground services — buried pipes or cables — control: utility map, CAT scan, hand dig", keywords: ["underground", "buried", "pipe", "service", "cable below", "buried cable", "dig", "cat scanner", "utility map", "buried service"] },
        { label: "Adverse weather — wind, rain, lightning, poor visibility — control: monitor forecast, stop work", keywords: ["weather", "wind", "rain", "lightning", "visibility", "frost", "ice", "storm", "snow", "gale", "weather condition"] },
        { label: "Vehicular or site traffic — control: road signs, cones, traffic management, hi-vis", keywords: ["traffic", "vehicle", "car", "lorry", "truck", "road", "passing vehicle", "machinery", "moving vehicle", "road user"] },
        { label: "Livestock, cattle, sheep or aggressive animals — control: clear area, liaise with landowner", keywords: ["livestock", "cattle", "sheep", "animal", "dog", "horse", "cow", "farm animal", "landowner"] },
        { label: "Stinging insects — bees, wasps, hornets — control: avoid nests, carry epipen if allergic", keywords: ["bee", "wasp", "hornet", "insect", "sting", "nest", "swarm", "hornet nest", "wasp nest"] },
        { label: "Metal, wire or nails embedded in trees — control: metal detector, visual inspection", keywords: ["metal", "nail", "wire", "embedded", "fence post", "staple", "metal in tree", "barbed wire", "hidden metal"] },
        { label: "Holes, trenches, ditches, water or unstable ground — control: mark hazards, avoid edges", keywords: ["hole", "trench", "ditch", "pond", "river", "water", "well", "drop", "cliff", "edge", "unstable soil", "land slip"] },
        { label: "Tripping hazards — stumps, rocks, brambles, debris — control: clear site, good housekeeping", keywords: ["trip", "stumps", "rock", "bramble", "debris", "clutter", "housekeeping", "tangle", "branch on ground"] },
        { label: "Fire risk — dry tinder, sparks — control: clear debris, carry extinguisher", keywords: ["fire", "tinder", "dry", "spark", "fire risk", "extinguisher", "flammable debris", "wildfire", "combustible"] },
        { label: "Nearby structures, fences, walls or property — control: felling direction away from structures", keywords: ["structure", "fence", "wall", "building", "property", "shed", "barn", "roof", "nearby building"] },
        { label: "Dust, spores or pollen — control: RPE, dust mask", keywords: ["dust", "pore", "pollen", "spore", "mould", "respiratory", "rpe", "dust mask", "airborne"] },
        { label: "Restricted escape routes — control: clear two escape paths at 45 degrees", keywords: ["escape route", "escape path", "exit route", "escape", "retreat", "evacuation route", "45 degree"] },
      ],
    }],
  },

  {
    id: 3,
    question: "Give me at least three hazards with the chainsaw and their control measures.",
    prompts: [{
      prompt: "Give me at least three hazards with the chainsaw and their control measures.",
      threshold: 3,
      keyPoints: [
        { label: "Kickback — sudden upward/backward motion of bar — control: two-handed grip, chain brake, no tip cutting", keywords: ["kickback", "kick back", "kick-back", "bar nose", "tip contact", "kickback zone"] },
        { label: "Cuts from the moving chain — control: chainsaw PPE, trousers, gloves, boots", keywords: ["cut", "chain contact", "bar contact", "laceration", "chainsaw trousers", "cut resistant", "blade contact", "ppe", "protective clothing"] },
        { label: "Fuel spillage or fire risk — control: cool engine before refuel, no smoking, move 3m before start", keywords: ["fuel", "spillage", "fire", "ignit", "flammable", "petrol", "fuel spill", "refuel", "fuel leak", "fuel cap", "two stroke"] },
        { label: "Exhaust fumes or carbon monoxide — control: ventilated area, never operate indoors", keywords: ["exhaust", "fume", "emission", "carbon monoxide", "co poison", "exhaust gas", "ventilation", "indoors", "inhalation"] },
        { label: "Burns from hot engine parts — control: gloves, cool before handling, avoid muffler contact", keywords: ["burn", "hot surface", "hot exhaust", "muffler", "hot engine", "blister", "scald"] },
        { label: "Vibration causing HAVS — control: anti-vibration gloves, limit exposure time, warm hands", keywords: ["vibrat", "havs", "hand arm vibration", "white finger", "vwf", "raynaud", "vibration exposure", "av glove"] },
        { label: "Noise causing hearing damage — control: ear defenders, limit daily exposure duration", keywords: ["noise", "hearing", "deaf", "ear", "ear defend", "decibel", "hearing damage", "hearing loss", "loud", "hearing protection"] },
        { label: "Flying debris or sawdust causing eye injury — control: face shield, safety glasses", keywords: ["debris", "sawdust", "eye", "flying", "wood chip", "projectile", "face shield", "visor", "glasses", "face protection"] },
        { label: "Chain break or derailment — control: tension checks, inspect chain links, chain catcher", keywords: ["chain break", "chain snap", "derail", "chain off", "chain throw", "broken chain", "chain catcher", "chain tension"] },
        { label: "Chain brake failure — control: pre-start check, functional test, remove from service if faulty", keywords: ["brake fail", "brake malfunction", "brake not work", "brake defect", "brake failure", "chain brake", "inertia brake", "front guard"] },
        { label: "Accidental starting or throttle fault — control: start on ground, throttle lock check, no drop start", keywords: ["accidental start", "unintentional", "drop start", "throttle stick", "throttle fault", "starting", "choke", "cold start"] },
        { label: "Leaking fuel cap or chain oil — control: inspect caps and O-rings, tighten before use", keywords: ["leak", "fuel cap", "oil cap", "o ring", "chain oil", "fuel leak", "oil leak", "bar oil"] },
        { label: "Loose or missing nuts, bolts or hand guards — control: inspect chassis before use", keywords: ["loose", "bolt", "nut", "hand guard", "front guard", "rear guard", "missing", "chassis", "casing"] },
      ],
    }],
  },

  {
    id: 4,
    question: "Give me at least three hazards with the job to be done and the control measures.",
    prompts: [{
      prompt: "Give me at least three hazards with the job to be done and the control measures.",
      threshold: 3,
      keyPoints: [
        { label: "Kickback during cutting — control: correct technique, chain brake, low-kickback chain", keywords: ["kickback", "kick back", "kick-back", "cutting technique"] },
        { label: "Falling timber, snags, widow makers or overhead dead wood — control: exclusion zone, check overhead", keywords: ["falling", "snag", "widow maker", "dead wood", "deadwood", "hung up", "log roll", "falling branch", "falling timber", "overhead dead", "leaning tree"] },
        { label: "Fatigue or lone working — control: regular breaks, check-in system, buddy system, GPS beacon", keywords: ["fatigue", "tired", "lone", "alone", "exhaustion", "working alone", "breaks", "check in", "buddy", "sole operator", "lone worker"] },
        { label: "Manual handling of heavy logs — control: log jacks, winches, team lift, machinery", keywords: ["manual handling", "heavy", "lifting", "log jack", "timber", "heavy log", "winch", "forwarder", "team lift", "log weight"] },
        { label: "Trapped bar or barber-chairing — control: assess tension, use wedges, correct felling technique", keywords: ["trapped", "pinch", "barber chair", "barber-chair", "compression", "tension", "wedge", "felling wedge", "back cut", "hinge"] },
        { label: "Rolling or shifting logs — control: stand uphill, chock logs, never below rolling timber", keywords: ["roll", "rolling log", "shifting log", "moving timber", "log move", "chock", "uphill", "timber roll"] },
        { label: "Struck by falling timber from colleague's work — control: communication, exclusion zones, signals", keywords: ["struck", "colleague", "co-worker", "another worker", "someone else", "communication", "signal", "hand signal"] },
        { label: "Slipping while carrying a running chainsaw — control: engage chain brake when moving, shut off over 3m", keywords: ["slip", "carrying saw", "running saw", "moving with saw", "chain brake when walking", "carrying chainsaw", "trip with saw"] },
        { label: "Tree hung-up in adjacent trees — control: never work under, use winch or machinery to pull down", keywords: ["hung up", "hung tree", "leaner", "lodged", "adjacent tree", "stuck in tree", "tree lean", "hung in"] },
        { label: "Root plate rebound after felling — control: assess weight, cut from safe angle, stand clear", keywords: ["root plate", "root ball", "rebound", "spring back", "root spring", "base", "rootplate"] },
        { label: "Operator fatigue and loss of concentration — control: mandatory breaks, rotate tasks, hydration", keywords: ["concentration", "fatigue", "tired", "loss of focus", "exhaustion", "hydration", "rotate task", "break"] },
        { label: "Inadequate training or lack of competence — control: hold valid certification, use supervision", keywords: ["training", "competence", "qualification", "certificate", "nptc", "lantra", "untrained", "supervision", "skills"] },
        { label: "Dust, noise or vibration from the task — control: RPE, hearing protection, limit exposure", keywords: ["dust", "noise", "vibration from task", "havs", "hand arm", "white finger", "hearing damage", "rpe", "respiratory"] },
        { label: "Working at height — control: climbing harness, ropes, anchors, work at height regulations", keywords: ["height", "climb", "elevated", "platform", "aerial", "harness", "rope", "work at height", "high up", "tree climb"] },
        { label: "Biological hazards — ticks, stinging plants, poisonous plants — control: inspect area, repellent, first aid", keywords: ["tick", "stinging plant", "poison", "nettle", "sting", "biological", "insect bite", "bramble", "thorn", "repellent"] },
      ],
    }],
  },

  {
    id: 5,
    question: "What emergency information do I need to know for the site?",
    prompts: [{
      prompt: "What emergency information do I need to know for the site?",
      threshold: 5,
      keyPoints: [
        { label: "Site location — grid reference, address or what3words", keywords: ["grid ref", "grid reference", "what three words", "what3words", "location", "site address", "coordinates", "postcode"] },
        { label: "Designated meeting point or muster point", keywords: ["meeting place", "muster point", "rendezvous", "rally point", "assembly point"] },
        { label: "Nearest access point or road", keywords: ["access point", "street", "access route", "entry point", "nearest road", "how to get in"] },
        { label: "Suitable helicopter landing area", keywords: ["helicopter", "landing", "heli", "air ambu", "landing spot"] },
        { label: "Nearest hospital, A&E or doctor's number", keywords: ["doctor", "hospital", "accident and emergency", "a&e", "phone number", "nearest medical", "a and e"] },
        { label: "Works manager or supervisor contact details", keywords: ["works manager", "supervisor contact", "manager", "emergency contact", "contact details"] },
        { label: "Your own mobile phone number", keywords: ["own number", "mobile number", "your number", "personal contact", "your mobile", "my number"] },
      ],
    }],
  },

  {
    id: 6,
    question: "What is the Health and Safety at Work Act all about?",
    prompts: [{
      prompt: "So what is the Health and Safety at Work Act all about?",
      threshold: 1,
      keyPoints: [
        { label: "Employees must take reasonable care of their own and others' safety", keywords: ["reasonable care", "care of others", "own safety", "other people", "duty of care"] },
        { label: "Follow training and instructions received", keywords: ["follow training", "follow your training", "trained", "act on training", "training received", "instructions"] },
        { label: "Do not misuse or interfere with safety equipment", keywords: ["misuse", "interfere", "tamper", "not misuse", "do not interfere", "safety equipment"] },
        { label: "Employers must provide a safe workplace and safe systems of work", keywords: ["employer", "safe workplace", "safe system", "safe place", "employer duty", "provide safe"] },
      ],
    }],
  },

  {
    id: 7,
    question: "Under PUWER, what does it say about the equipment?",
    prompts: [{
      prompt: "Under the Provision and Use of Work Equipment Regulations — PUWER — what does it say about the equipment?",
      threshold: 1,
      keyPoints: [
        { label: "Equipment must be maintained in an efficient state and good repair", keywords: ["maintained", "maintenance", "kept in good", "serviceable", "good repair", "efficient state"] },
        { label: "Equipment must be fit for purpose and suitable for the task", keywords: ["fit for purpose", "suitable", "appropriate", "right tool", "adequate", "fit for"] },
        { label: "Must only be used by trained and competent operators", keywords: ["trained", "competent", "qualified", "trained operator", "only used by", "certified"] },
        { label: "Equipment must have appropriate safeguards and controls", keywords: ["safeguard", "guard", "control", "safety device", "protection fitted"] },
      ],
    }],
  },

  {
    id: 8,
    question: "Who provides industry guidance for tree work?",
    prompts: [{
      prompt: "Who provides industry guidance for tree work?",
      threshold: 1,
      keyPoints: [
        { label: "FISA — Forest Industry Safety Accord", keywords: ["fisa", "forest industry safety accord", "forest industry"] },
        { label: "AFAG — Arboricultural Forestry Advisory Group", keywords: ["afag", "arboricultural forestry advisory", "advisory group"] },
        { label: "Forestry Commission / Natural Resources Wales / Forestry England", keywords: ["forestry commission", "natural resources wales", "forestry england", "forestry body"] },
        { label: "Arboricultural Association (AA)", keywords: ["arboricultural association", "arb association"] },
      ],
    }],
  },

  {
    id: 9,
    question: "Why is it important to maintain the saw to the manufacturer's specifications?",
    prompts: [{
      prompt: "Why is it important to maintain the saw to the manufacturer's specifications?",
      threshold: 1,
      keyPoints: [
        { label: "Ensures the machine is safe to use and reduces the risk of accidents", keywords: ["safe to use", "safety", "safe operation", "operator safety", "reduces risk", "prevent accident"] },
        { label: "Reduces machinery downtime and costly repairs", keywords: ["downtime", "repair", "breakdown", "out of service", "reliability", "less repair"] },
        { label: "Maintains performance and cutting efficiency", keywords: ["performance", "efficient", "cutting ability", "optimum", "operate correctly", "cutting performance"] },
        { label: "Maintains the machine's longevity", keywords: ["longevity", "last longer", "lifespan", "life of the saw", "extends life"] },
      ],
    }],
  },

  {
    id: 10,
    question: "The manufacturer has installed safety features on the saw — run through where they are and what they do.",
    prompts: [{
      prompt: "The manufacturer has installed safety features on the saw. Just run through where they are and what they do.",
      threshold: 4,
      keyPoints: [
        { label: "Combined chain brake and front hand guard — stops chain on kickback, protects hand", keywords: ["chain brake", "front hand guard", "hand guard", "brake stop", "stops the chain", "front guard"] },
        { label: "Throttle trigger lockout — prevents accidental throttle operation", keywords: ["throttle lockout", "trigger lockout", "accidental throttle", "throttle safety", "lock out", "throttle trigger"] },
        { label: "Chain catcher — catches chain if it breaks or derails", keywords: ["chain catcher", "catch the chain", "derailed chain", "chain off", "chain catcher pin"] },
        { label: "Rear hand guard / chain breakage guard — protects the rear hand", keywords: ["rear guard", "rear hand", "rear chain", "back guard", "back hand guard", "breakage guard"] },
        { label: "Anti-vibration mounts — reduces vibration to the hands", keywords: ["anti-vibration", "anti vibration", "vibration mount", "reduce vibration", "dampen vibration", "av system"] },
        { label: "On/off switch — stops the engine", keywords: ["on off switch", "on/off", "kill switch", "stop switch", "engine stop switch", "stops engine"] },
        { label: "Safety decals — mandatory information (PPE symbols)", keywords: ["safety decal", "decal", "symbol", "label", "warning label", "mandatory information", "ear defender", "eye protection symbol"] },
        { label: "Low-kickback chain — reduces kickback characteristics", keywords: ["low kickback", "kickback chain", "anti-kickback chain", "safety chain", "low kick back chain"] },
        { label: "Exhaust / silencer — reduces noise and emissions", keywords: ["exhaust", "silencer", "muffler", "noise reduc", "emission", "silences"] },
        { label: "Bar cover / scabbard — protects bar and chain during transport", keywords: ["bar cover", "guide bar cover", "scabbard", "cover protect", "chain cover", "protective cover"] },
      ],
    }],
  },

  {
    id: 11,
    question: "If you find one of the safety features is broken or missing, what will you do?",
    prompts: [{
      prompt: "If you find one of the safety features is broken or missing, what will you do?",
      threshold: 1,
      keyPoints: [
        { label: "Stop work immediately and take the saw out of service", keywords: ["stop work", "cease work", "take out of service", "do not use", "withdraw", "stop using", "out of service"] },
        { label: "Tag it / report it to your supervisor or employer", keywords: ["tag", "report", "supervisor", "employer", "inform", "label", "notify", "report it"] },
        { label: "Do not use until repaired or replaced by a competent person", keywords: ["do not use", "not until repaired", "until fixed", "competent person", "repaired", "replaced"] },
      ],
    }],
  },

  {
    id: 12,
    question: "What are the advantages of using battery chainsaws?",
    prompts: [{
      prompt: "What are the advantages of using battery chainsaws?",
      threshold: 1,
      keyPoints: [
        { label: "Quieter operation — reduced noise levels", keywords: ["quieter", "reduced noise", "less noise", "lower noise", "quiet", "less sound"] },
        { label: "Zero exhaust emissions — no fumes", keywords: ["no emission", "zero emission", "no exhaust", "no fumes", "clean", "emission free", "no fume"] },
        { label: "Less vibration transmitted to the operator", keywords: ["less vibration", "reduced vibration", "lower vibration", "vibration reduction", "less vibrat"] },
        { label: "No fuel to carry — no fuel spillage risk", keywords: ["no fuel", "fuel transport", "spillage", "no petrol", "no spill", "no fuel need", "don't need fuel"] },
        { label: "Better communication — can hear others on site", keywords: ["communication", "talk to", "speak to", "hear each other", "clearer comms", "communicate"] },
        { label: "Less maintenance required", keywords: ["less maintenance", "lower maintenance", "fewer service", "easier maintenance", "easier to maintain"] },
        { label: "Can be used indoors or in urban / sensitive environments", keywords: ["indoor", "urban", "sensitive", "inside", "enclosed", "public area"] },
      ],
    }],
  },

  {
    id: 13,
    question: "What are the disadvantages of using battery chainsaws?",
    prompts: [{
      prompt: "What are the disadvantages of using battery chainsaws?",
      threshold: 1,
      keyPoints: [
        { label: "Limited run time — battery capacity restricts working time", keywords: ["limited run", "battery life", "run time", "capacity", "run out", "limited time"] },
        { label: "Less power available for heavy or large-diameter timber", keywords: ["less power", "not as powerful", "heavy timber", "large diameter", "power limitation"] },
        { label: "Battery compatibility and misalignment risks", keywords: ["incompatible", "compatibility", "wrong battery", "incorrect battery", "misalign", "not compatible"] },
        { label: "Machine can be live when battery is fitted — no exhaust sound warning", keywords: ["live", "battery in", "always on", "no warning", "silent", "no engine noise", "energised"] },
        { label: "Risk of electric shock or short circuit when charging", keywords: ["electric shock", "short circuit", "charging risk", "electrocution", "fire when charging", "overheating battery"] },
        { label: "Cold weather reduces battery performance", keywords: ["cold", "temperature", "cold weather", "winter", "cold affect", "battery cold"] },
        { label: "Battery storage and disposal considerations", keywords: ["storage", "disposal", "store battery", "dispos", "battery storage"] },
      ],
    }],
  },

  {
    id: 14,
    question: "What maintenance might you do with the batteries, the saw and charger?",
    prompts: [{
      prompt: "What maintenance might you do with the batteries, the saw and charger?",
      threshold: 2,
      keyPoints: [
        { label: "Inspect battery for damage, cracks or deformation", keywords: ["inspect battery", "check battery", "battery damage", "crack", "deform", "battery condition"] },
        { label: "Clean battery contacts and guide tracks", keywords: ["clean contacts", "battery contacts", "guide track", "terminal", "clean terminal", "track clean"] },
        { label: "Store battery at correct charge level in a cool, dry place", keywords: ["store battery", "storage", "correct charge", "40", "50", "60", "cool dry", "storage charge"] },
        { label: "Inspect charger leads and connections for damage", keywords: ["charger lead", "charger cable", "charger connection", "charger damage", "inspect charger"] },
        { label: "Clean the saw's air filter and cooling system", keywords: ["air filter", "cooling system", "clean saw", "filter clean", "cooling clean"] },
        { label: "Check battery compartment for damage or debris", keywords: ["compartment", "battery compartment", "housing", "battery bay", "compartment clean"] },
      ],
    }],
  },

  {
    id: 15,
    question: "Can you take your top cover off your chainsaw please.",
    prompts: [{
      prompt: "Can you take your top cover off your chainsaw please.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 16,
    question: "So what's this?",
    prompts: [{
      prompt: "So what's this?",
      threshold: 1,
      keyPoints: [
        { label: "Air filter", keywords: ["air filter", "filter", "air cleaner"] },
      ],
    }],
  },

  {
    id: 17,
    question: "What does it do? (air filter)",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Prevents debris and dust entering the carburettor / engine", keywords: ["prevent debris", "stops dirt", "dirt out", "debris", "carburettor", "stops dust", "clean air", "air fuel"] },
      ],
    }],
  },

  {
    id: 18,
    question: "How do you maintain it? (air filter)",
    prompts: [{
      prompt: "And how do you maintain it?",
      threshold: 1,
      keyPoints: [
        { label: "Remove and clean — tap out, wash or blow out debris", keywords: ["clean", "tap out", "wash", "blow out", "remove debris", "clean filter"] },
        { label: "Inspect the filter housing and gasket for damage", keywords: ["inspect housing", "gasket", "housing", "housing damage", "filter housing"] },
        { label: "Replace the filter if damaged or worn", keywords: ["replace", "new filter", "fit new", "replace if", "damaged filter"] },
      ],
    }],
  },

  {
    id: 19,
    question: "So what's this? (spark plug)",
    prompts: [{
      prompt: "So what's this?",
      threshold: 1,
      keyPoints: [
        { label: "Spark plug", keywords: ["spark plug", "plug", "sparking plug"] },
      ],
    }],
  },

  {
    id: 20,
    question: "What does it do? (spark plug)",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Ignites the fuel/air mixture to fire the engine", keywords: ["ignite", "ignition", "fires", "combustion", "spark", "fire the engine", "fuel mix"] },
      ],
    }],
  },

  {
    id: 21,
    question: "What are you looking for and how would you maintain it? (spark plug)",
    prompts: [{
      prompt: "Can you tell me what you're looking for and how you'd maintain it?",
      threshold: 2,
      keyPoints: [
        { label: "Check electrode condition and gap — use a feeler gauge", keywords: ["electrode", "gap", "feeler gauge", "check gap", "electrode gap", "electrode condition"] },
        { label: "Look for fouling — carbon deposits, sooty or oily residue", keywords: ["fouling", "carbon", "sooty", "oily", "deposit", "black", "contamination"] },
        { label: "Check for cracks or physical damage to the ceramic", keywords: ["crack", "damage", "ceramic", "broken", "physical damage"] },
        { label: "Clean or replace as necessary", keywords: ["clean", "replace", "clean plug", "new plug", "fit new"] },
      ],
    }],
  },

  {
    id: 22,
    question: "In conjunction with the flywheel, what do these cylinder fins help do?",
    prompts: [{
      prompt: "In conjunction with the flywheel, what do these cylinder fins help do?",
      threshold: 1,
      keyPoints: [
        { label: "Cool the engine — draw air over the cylinder to prevent overheating", keywords: ["cool", "cooling", "prevent overheat", "overheat", "airflow", "air over", "temperature"] },
      ],
    }],
  },

  {
    id: 23,
    question: "How do you maintain the cooling system?",
    prompts: [{
      prompt: "So how do you maintain the cooling system?",
      threshold: 1,
      keyPoints: [
        { label: "Remove debris from the cylinder fins — brush or compressed air", keywords: ["remove debris", "clean fins", "debris from fins", "brush", "compressed air", "fin clean", "cylinder fin"] },
        { label: "Check and clear the flywheel housing and air intake", keywords: ["flywheel", "air intake", "housing", "clear intake", "flywheel housing"] },
      ],
    }],
  },

  {
    id: 24,
    question: "So what's this? (exhaust)",
    prompts: [{
      prompt: "So what's this?",
      threshold: 1,
      keyPoints: [
        { label: "Exhaust / silencer / muffler", keywords: ["exhaust", "silencer", "muffler", "exhaust system"] },
      ],
    }],
  },

  {
    id: 25,
    question: "What does it do? (exhaust)",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Reduces noise and directs exhaust gases / emissions away from the operator", keywords: ["reduce noise", "quieter", "exhaust gas", "emission", "noise reduction", "direct gas", "muffles"] },
      ],
    }],
  },

  {
    id: 26,
    question: "How do you maintain it? (exhaust)",
    prompts: [{
      prompt: "And how do you maintain it?",
      threshold: 1,
      keyPoints: [
        { label: "Check fixings — nuts and bolts are secure", keywords: ["nuts", "bolts", "fixings", "secure", "tighten", "check bolts", "fixing check"] },
        { label: "Check / clean the spark arrestor", keywords: ["spark arrestor", "spark arrester", "arrestor", "clean arrestor", "carbon build"] },
        { label: "Check for cracks or damage to the body", keywords: ["crack", "damage", "body crack", "check damage", "inspect exhaust"] },
      ],
    }],
  },

  {
    id: 27,
    question: "What is in here that you need to maintain and how would you do it? (fuel tank)",
    prompts: [{
      prompt: "What is in here that you need to maintain and how would you do it?",
      threshold: 1,
      keyPoints: [
        { label: "Fuel filter — located in the fuel tank", keywords: ["fuel filter", "filter in fuel", "fuel tank filter", "in the tank", "fuel pick-up"] },
        { label: "Remove, inspect and clean or replace the fuel filter", keywords: ["remove filter", "replace fuel filter", "clean filter", "new filter", "change filter"] },
      ],
    }],
  },

  {
    id: 28,
    question: "What is in here that you need to maintain and how would you do it? (oil tank)",
    prompts: [{
      prompt: "So what is in here that you need to maintain and how would you do it?",
      threshold: 1,
      keyPoints: [
        { label: "Oil filter — located in the bar oil tank", keywords: ["oil filter", "filter in oil", "bar oil tank", "oil tank filter", "oil pick-up"] },
        { label: "Remove, inspect and clean or replace the oil filter", keywords: ["remove oil filter", "replace oil filter", "clean oil filter", "new oil filter", "change oil filter"] },
      ],
    }],
  },

  {
    id: 29,
    question: "This is the recoil housing — can you take it off and de-tension the pull cord please.",
    prompts: [{
      prompt: "This is the recoil housing, can you take it off and de-tension the pull cord please.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 30,
    question: "Where would you expect to find damage? (recoil starter)",
    prompts: [{
      prompt: "Where would you expect to find damage?",
      threshold: 1,
      keyPoints: [
        { label: "Pull cord / rope — look for fraying, wear or knotting", keywords: ["pull cord", "rope", "cord", "fray", "wear on cord", "knotting", "cord damage"] },
        { label: "Recoil spring / coil spring — check for breakage or distortion", keywords: ["recoil spring", "coil spring", "spring", "broken spring", "spring damage"] },
        { label: "Pawl / ratchet — check for wear or breakage", keywords: ["pawl", "ratchet", "dog", "catch", "mechanism", "ratchet wear"] },
      ],
    }],
  },

  {
    id: 31,
    question: "Now can you take off the chain and bar side cover please.",
    prompts: [{
      prompt: "Now can you take off the chain and bar side cover please.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 32,
    question: "So what's this? (sprocket)",
    prompts: [{
      prompt: "So what's this?",
      threshold: 1,
      keyPoints: [
        { label: "Sprocket / drive sprocket", keywords: ["sprocket", "drive sprocket", "clutch sprocket", "chain sprocket"] },
      ],
    }],
  },

  {
    id: 33,
    question: "What does it do? (sprocket)",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Drives the chain along the guidebar", keywords: ["drives the chain", "drive chain", "moves the chain", "chain drive", "carries chain"] },
      ],
    }],
  },

  {
    id: 34,
    question: "How do you check for any wear or damage? (sprocket)",
    prompts: [{
      prompt: "How do you check for any wear or damage?",
      threshold: 1,
      keyPoints: [
        { label: "Check for hooked or wolf-teeth — look for sharp, curved points", keywords: ["hooked", "wolf teeth", "hook", "curved teeth", "sharp point", "worn tooth", "teeth shape"] },
        { label: "Check the needle bearing / drum for wear", keywords: ["needle bearing", "bearing", "drum", "needle cage", "bearing wear"] },
        { label: "Check depth of tooth wear — replace if excessively worn", keywords: ["depth of wear", "tooth depth", "excessive wear", "measure wear", "replace sprocket"] },
      ],
    }],
  },

  {
    id: 35,
    question: "If you need to replace the sprocket, how are you going to do that?",
    prompts: [{
      prompt: "If you need to replace the sprocket, how are you going to do that?",
      threshold: 1,
      keyPoints: [
        { label: "Use a clutch removal tool to remove the clutch", keywords: ["clutch removal", "removal tool", "remove clutch", "clutch tool", "spanner"] },
        { label: "Remove the needle bearing and spacers carefully", keywords: ["needle bearing", "needle cage", "bearing", "spacer", "remove bearing"] },
        { label: "Fit the new sprocket and reassemble correctly", keywords: ["fit new", "new sprocket", "replace sprocket", "reassemble", "refit"] },
        { label: "Torque to manufacturer's specification", keywords: ["torque", "specification", "torque spec", "correct torque", "tighten to spec"] },
      ],
    }],
  },

  {
    id: 36,
    question: "Now on to the chain brake — where would you find it on your saw?",
    prompts: [{
      prompt: "Now on to the chain brake — where would you find it on your saw?",
      threshold: 1,
      keyPoints: [
        { label: "Front of the saw — the front hand guard / front handle area", keywords: ["front", "front hand guard", "front guard", "front of saw", "front handle", "left hand guard"] },
      ],
    }],
  },

  {
    id: 37,
    question: "What does the chain brake do?",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Stops the chain rapidly — activated manually or by inertia on kickback", keywords: ["stops the chain", "halt chain", "chain stops", "inertia", "kickback", "activated"] },
        { label: "The brake band clamps around the clutch drum to arrest the chain", keywords: ["brake band", "clutch drum", "band clamp", "drum", "arrest", "clamp"] },
      ],
    }],
  },

  {
    id: 38,
    question: "How do you check the chain brake for any wear or damage?",
    prompts: [{
      prompt: "How do you check for any wear or damage?",
      threshold: 1,
      keyPoints: [
        { label: "Check the brake band for wear — check thickness", keywords: ["brake band", "band wear", "band thickness", "band condition", "check band"] },
        { label: "Check the front hand guard for damage or cracks", keywords: ["front hand guard", "guard damage", "guard crack", "hand guard condition"] },
        { label: "Test the brake activation — manual and inertia", keywords: ["test brake", "activate brake", "brake test", "manual activation", "inertia test", "test activation"] },
      ],
    }],
  },

  {
    id: 39,
    question: "This is your guidebar — what signs of wear or damage are you looking for?",
    prompts: [{
      prompt: "This is your guidebar — what signs of wear or damage are you looking for?",
      threshold: 1,
      keyPoints: [
        { label: "Uneven or burred rails", keywords: ["uneven rail", "burred", "rail condition", "burr", "rail wear", "uneven wear", "rail bur"] },
        { label: "Groove depth — worn groove", keywords: ["groove depth", "groove wear", "worn groove", "groove", "groove check"] },
        { label: "Bar straightness — bent bar", keywords: ["straightness", "straight", "bent", "bent bar", "bar straight"] },
        { label: "Sprocket nose wear or damage", keywords: ["sprocket nose", "nose sprocket", "nose wear", "tip", "nose damage"] },
        { label: "Overheating marks or heat discolouration", keywords: ["overheat", "heat mark", "discolouration", "bluing", "burn mark", "overheated bar"] },
      ],
    }],
  },

  {
    id: 40,
    question: "If the bar shows excessive wear or damage, what problems might you get?",
    prompts: [{
      prompt: "So if the bar shows excessive wear or damage, what problems might you get?",
      threshold: 1,
      keyPoints: [
        { label: "Chainsaw will not cut in a straight line — it will drift", keywords: ["not cut straight", "drift", "deviate", "wander", "pull to one side", "doesn't cut straight"] },
        { label: "Overheating of the bar and poor lubrication", keywords: ["overheat", "heat up", "poor lubrication", "dry chain", "lubrication problem", "hot bar"] },
        { label: "Chain derailment or accelerated chain / sprocket wear", keywords: ["chain off", "derail", "accelerated wear", "chain wear", "sprocket wear", "wear out faster"] },
      ],
    }],
  },

  {
    id: 41,
    question: "How are you going to maintain your bar?",
    prompts: [{
      prompt: "How are you going to maintain your bar?",
      threshold: 1,
      keyPoints: [
        { label: "Clean the groove and clear the oil holes", keywords: ["clean groove", "clear oil hole", "oil hole", "groove clean", "clear the groove", "oil port"] },
        { label: "Remove burrs from the rails with a flat file", keywords: ["remove burr", "deburr", "flat file", "file the rail", "burr removal", "dress rails"] },
        { label: "Turn / reverse the bar to even out wear", keywords: ["turn the bar", "reverse bar", "flip bar", "rotate bar", "bar turn", "even wear"] },
        { label: "Grease the nose sprocket", keywords: ["grease nose", "bar nose", "nose sprocket grease", "lubricate nose", "grease tip"] },
      ],
    }],
  },

  {
    id: 42,
    question: "Can you reassemble your saw please.",
    prompts: [{
      prompt: "Can you reassemble your saw please.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 43,
    question: "When you're ready, can you clamp your saw into a vice please.",
    prompts: [{
      prompt: "When you're ready, can you clamp your saw into a vice please.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 44,
    question: "How do you identify your chain?",
    prompts: [{
      prompt: "How do you identify your chain?",
      threshold: 1,
      keyPoints: [
        { label: "Pitch — the measurement of the chain drive links", keywords: ["pitch", "chain pitch"] },
        { label: "Gauge — the width of the drive link", keywords: ["gauge", "chain gauge", "drive link gauge"] },
        { label: "Number of drive links", keywords: ["drive link", "number of link", "drive links", "link count"] },
        { label: "Markings on the drive link or chain packaging", keywords: ["marking", "stamp", "chain box", "packaging", "manufacturer mark", "stamped on"] },
      ],
    }],
  },

  {
    id: 45,
    question: "What information do you need to replace your chain?",
    prompts: [{
      prompt: "What information do you need to replace your chain?",
      threshold: 2,
      keyPoints: [
        { label: "Pitch of the chain", keywords: ["pitch"] },
        { label: "Gauge of the chain", keywords: ["gauge"] },
        { label: "Number of drive links", keywords: ["drive link", "number of link"] },
        { label: "Length / size of the guidebar", keywords: ["bar length", "guide bar length", "length of bar", "bar size", "bar inches", "bar length"] },
        { label: "Cutter type / chain type", keywords: ["cutter type", "chain type", "type of chain", "cutter profile"] },
      ],
    }],
  },

  {
    id: 46,
    question: "What cutter profile do you have on your chain?",
    prompts: [{
      prompt: "What cutter profile do you have on your chain?",
      threshold: 1,
      keyPoints: [
        { label: "Chisel / full chisel or semi-chisel (whichever applies)", keywords: ["chisel", "semi-chisel", "semi chisel", "full chisel", "round", "cutter type"] },
      ],
    }],
  },

  {
    id: 47,
    question: "What is the other main type of cutter profile?",
    prompts: [{
      prompt: "What is the other main type of cutter profile?",
      threshold: 1,
      keyPoints: [
        { label: "Chisel or semi-chisel — whichever was not given in the previous answer", keywords: ["chisel", "semi-chisel", "semi chisel", "full chisel", "other type", "other profile"] },
      ],
    }],
  },

  {
    id: 48,
    question: "And what are their different uses?",
    prompts: [{
      prompt: "And what are their different uses?",
      threshold: 2,
      keyPoints: [
        { label: "Full chisel — fast cutting, hard or frozen wood, professional use", keywords: ["full chisel", "chisel", "fast", "hard wood", "frozen wood", "professional", "faster cut"] },
        { label: "Semi-chisel — softer or dirty wood, stays sharper longer, better for beginners", keywords: ["semi-chisel", "semi chisel", "dirty wood", "stays sharp", "beginner", "softer", "less kickback"] },
      ],
    }],
  },

  {
    id: 49,
    question: "What top plate angle are you filing at?",
    prompts: [{
      prompt: "What top plate angle are you filing at?",
      threshold: 1,
      keyPoints: [
        { label: "State the correct top plate filing angle (e.g. 25°, 30° or 35°) for the chain", keywords: ["degree", "angle", "25", "30", "35", "top plate angle", "filing angle"] },
      ],
    }],
  },

  {
    id: 50,
    question: "And what file size are you using?",
    prompts: [{
      prompt: "And what file size are you using?",
      threshold: 1,
      keyPoints: [
        { label: "State the correct file diameter for the chain (e.g. 4mm, 3/16\", 13/64\")", keywords: ["millimetre", "mm", "file size", "diameter", "round file", "3/16", "4mm", "13/64", "size of file"] },
      ],
    }],
  },

  {
    id: 51,
    question: "So where are you going to start sharpening?",
    prompts: [{
      prompt: "So where are you going to start sharpening?",
      threshold: 1,
      keyPoints: [
        { label: "Start at the shortest / most damaged cutter, or mark a starting cutter", keywords: ["shortest", "most damaged", "marked", "start at", "first cutter", "mark a cutter", "shortest cutter"] },
      ],
    }],
  },

  {
    id: 52,
    question: "So what's this? (depth gauge / raker)",
    prompts: [{
      prompt: "So what's this?",
      threshold: 1,
      keyPoints: [
        { label: "Depth gauge / raker", keywords: ["depth gauge", "raker", "depth limiter", "gauge"] },
      ],
    }],
  },

  {
    id: 53,
    question: "What does it do? (depth gauge)",
    prompts: [{
      prompt: "What does it do?",
      threshold: 1,
      keyPoints: [
        { label: "Controls the depth of cut — limits how much wood the cutter takes in each pass", keywords: ["depth of cut", "controls depth", "limits cut", "how much wood", "bite", "chip size", "controls bite"] },
      ],
    }],
  },

  {
    id: 54,
    question: "Why does the depth gauge need to be set correctly, and what's the danger in setting it too low?",
    prompts: [{
      prompt: "And why does it need to be set correctly, and what's the danger in setting it too low?",
      threshold: 1,
      keyPoints: [
        { label: "Controls chip size and cutting efficiency — optimum cutting speed", keywords: ["chip size", "cutting efficiency", "optimum speed", "cutting speed", "optimum cutting"] },
        { label: "Set too low: increased kickback risk — chain grabs aggressively into the wood", keywords: ["too low", "kickback", "grab", "aggressive", "chain grab", "danger too low", "excessive kickback"] },
      ],
    }],
  },

  {
    id: 55,
    question: "Why do you want to keep all your cutters the same size and the angles all the same?",
    prompts: [{
      prompt: "Why do you want to keep all your cutters the same size and the angles all the same?",
      threshold: 1,
      keyPoints: [
        { label: "Ensures the saw cuts in a straight line — balanced load on all cutters", keywords: ["straight line", "balanced", "equal load", "cuts straight", "even load", "balance"] },
        { label: "Reduces vibration and wear — even distribution of cutting force", keywords: ["reduce vibration", "less vibration", "even wear", "equal wear", "smooth operation", "reduce wear"] },
      ],
    }],
  },

  {
    id: 56,
    question: "What problems might you get if you use a really worn or badly sharpened chain?",
    prompts: [{
      prompt: "What problems might you get if you use a really worn or badly sharpened chain?",
      threshold: 1,
      keyPoints: [
        { label: "Increased risk of kickback", keywords: ["kickback", "kick back", "kick-back", "increased kickback"] },
        { label: "Chain will not cut in a straight line — drifts to one side", keywords: ["drift", "not cut straight", "wander", "pull to one side", "doesn't cut straight"] },
        { label: "Overheating of the bar and chain", keywords: ["overheat", "heat", "bar overheat", "chain overheat", "excessive heat"] },
        { label: "Increased operator effort, vibration and fatigue", keywords: ["operator effort", "more effort", "fatigue", "vibration", "harder to cut", "strain on operator"] },
      ],
    }],
  },

  {
    id: 57,
    question: "How do you dispose of your contaminated chainsaw waste and your litter?",
    prompts: [{
      prompt: "How do you dispose of your contaminated chainsaw waste and your litter?",
      threshold: 1,
      keyPoints: [
        { label: "Collect oil-contaminated waste separately — take to a licensed waste facility", keywords: ["contaminated waste", "oil waste", "licensed facility", "licensed tip", "waste facility", "waste oil", "separate waste"] },
        { label: "Never bury or burn contaminated waste", keywords: ["never bury", "do not bury", "not burn", "do not burn", "bury", "incinerate"] },
        { label: "Take all litter away from site — leave no trace", keywords: ["take litter", "leave no trace", "clean up site", "remove litter", "take away", "take it home"] },
      ],
    }],
  },

  // ── CROSS CUTTING SECTION ─────────────────────────────────────────────────────

  {
    id: 58,
    question: "What is the safe working distance between operators when cross cutting?",
    prompts: [{
      prompt: "What is the safe working distance between operators when cross cutting?",
      threshold: 1,
      keyPoints: [
        { label: "Two tree lengths / two times the height of the tallest tree being worked on (minimum)", keywords: ["two tree length", "two times", "two tree", "height of tree", "tallest tree", "two lengths", "exclusion zone"] },
      ],
    }],
  },

  {
    id: 59,
    question: "What bio-security measures might you put in place?",
    prompts: [{
      prompt: "What bio-security measures might you put in place?",
      threshold: 1,
      keyPoints: [
        { label: "Clean and disinfect tools, equipment and footwear before and after entering a site", keywords: ["clean tools", "disinfect", "clean boots", "footwear", "clean equipment", "clean and disinfect"] },
        { label: "Avoid moving potentially infected plant material off site", keywords: ["infected material", "infected", "plant material", "move material", "spread disease", "not move"] },
        { label: "Check for specific diseases / pathogens relevant to the site (e.g. ash dieback, Phytophthora)", keywords: ["ash dieback", "phytophthora", "disease", "pathogen", "specific disease", "chalara"] },
      ],
    }],
  },

  {
    id: 60,
    question: "What environmental factors do you need to consider?",
    prompts: [{
      prompt: "What environmental factors do you need to consider?",
      threshold: 1,
      keyPoints: [
        { label: "Wildlife and protected species — nesting birds, bats, badgers", keywords: ["wildlife", "protected species", "nesting bird", "bat", "badger", "ecology", "nesting season"] },
        { label: "Watercourses — prevent oil or fuel pollution of streams and ponds", keywords: ["watercourse", "stream", "pond", "river", "pollution", "oil spill", "fuel spill near water"] },
        { label: "Surrounding vegetation — avoid unnecessary damage to roots, ground flora", keywords: ["vegetation", "ground flora", "roots", "surrounding trees", "ground damage", "flora"] },
        { label: "Ground conditions — minimise soil compaction and rutting", keywords: ["soil compaction", "rutting", "ground condition", "compaction", "soil damage", "ground damage"] },
        { label: "Weather — high winds, rain, visibility", keywords: ["weather", "wind", "high wind", "rain", "visibility", "weather conditions"] },
      ],
    }],
  },

  {
    id: 61,
    question: "In this picture, where is the compression found?",
    prompts: [{
      prompt: "In this picture, where is the compression found?",
      threshold: 1,
      keyPoints: [
        { label: "On the upper / top side of the timber (for a supported log)", keywords: ["top", "upper", "above", "top side", "upper side", "on top", "compression is on top"] },
      ],
    }],
  },

  {
    id: 62,
    question: "And in this picture, where is the compression?",
    prompts: [{
      prompt: "And in this picture, where is the compression?",
      threshold: 1,
      keyPoints: [
        { label: "On the underside / bottom of the timber (for a cantilevered or hanging log)", keywords: ["bottom", "underside", "below", "under", "lower side", "underneath", "compression underneath"] },
      ],
    }],
  },

  {
    id: 63,
    question: "What are you going to do if you get your saw stuck or pinched?",
    prompts: [{
      prompt: "What are you going to do if you get your saw stuck, or pinched?",
      threshold: 1,
      keyPoints: [
        { label: "Do not force the saw — switch it off", keywords: ["do not force", "switch off", "turn off", "don't force", "stop the saw", "kill switch"] },
        { label: "Use a felling wedge or bar to open the cut", keywords: ["wedge", "felling wedge", "bar", "lever", "open the cut", "use a wedge"] },
        { label: "Assess the tension before attempting to free the saw", keywords: ["assess tension", "check tension", "tension", "assess", "identify tension", "before freeing"] },
        { label: "Never leave the saw running unattended in the timber", keywords: ["never leave running", "do not leave running", "unattended", "not leave", "saw running in wood"] },
      ],
    }],
  },

  {
    id: 64,
    question: "How are you going to cross cut a piece of timber that's slightly larger than your guidebar?",
    prompts: [{
      prompt: "How are you going to cross cut a piece of timber that's slightly larger than your guidebar?",
      threshold: 1,
      keyPoints: [
        { label: "Cut from one side then reposition and cut from the opposite side to meet in the middle", keywords: ["one side", "opposite side", "cut from both sides", "reposition", "both sides", "meet in middle"] },
        { label: "Ensure the two cuts align — use a straight edge or score the timber first", keywords: ["align", "score", "mark", "straight edge", "guide", "ensure cuts meet"] },
      ],
    }],
  },

  {
    id: 65,
    question: "How are you going to cut timber that's under high tension?",
    prompts: [{
      prompt: "How are you going to cut timber that's under high tension?",
      threshold: 1,
      keyPoints: [
        { label: "Identify compression and tension zones before cutting", keywords: ["identify compression", "identify tension", "compression zone", "tension zone", "assess before cutting"] },
        { label: "Overbuck from the top (compression side) or underbuck from below (tension side) as appropriate", keywords: ["overbuck", "underbuck", "top cut", "undercut", "cut from above", "cut from below"] },
        { label: "Make a relief cut first to release tension", keywords: ["relief cut", "release tension", "relieve tension", "first cut", "relief notch"] },
        { label: "Be prepared for sudden movement of the timber", keywords: ["sudden movement", "timber movement", "movement", "snap", "jump", "spring back", "move suddenly"] },
      ],
    }],
  },

  {
    id: 66,
    question: "When would you use a bore cut when cross cutting timber?",
    prompts: [{
      prompt: "When would you use a bore cut when cross cutting timber?",
      threshold: 1,
      keyPoints: [
        { label: "Timber diameter is larger than the guidebar — cannot cut through in one pass", keywords: ["larger than", "bigger than", "longer bar", "too large", "diameter larger", "can't cut through", "one pass"] },
        { label: "Timber under tension — to prevent the bar being pinched or trapped", keywords: ["tension", "pinch", "trapped", "under tension", "prevent pinch", "stop bar getting trapped", "avoid trapping"] },
        { label: "Working in confined space — to avoid the kickback zone at the nose", keywords: ["confined", "tight space", "kickback zone", "nose", "tip of bar", "restricted", "nose kickback"] },
      ],
    }],
  },

  {
    id: 67,
    question: "Once you've cut your timber, how are you going to move it safely?",
    prompts: [{
      prompt: "Once you've cut your timber, how are you going to move it safely?",
      threshold: 1,
      keyPoints: [
        { label: "Use appropriate tools — cant hook, timber jack, or cant dog", keywords: ["cant hook", "timber jack", "cant dog", "peavey", "mechanical aid", "log moving tool"] },
        { label: "Assess the weight — team lift if too heavy, correct manual handling posture", keywords: ["assess weight", "team lift", "manual handling", "correct posture", "back straight", "not too heavy"] },
      ],
    }],
  },

  {
    id: 68,
    question: "How do you make moving and working more ergonomic?",
    prompts: [{
      prompt: "How do you make moving and working more ergonomic?",
      threshold: 1,
      keyPoints: [
        { label: "Use the correct tools and mechanical aids to reduce manual effort", keywords: ["correct tools", "mechanical aid", "cant hook", "reduce manual", "use equipment", "right tool"] },
        { label: "Plan your movements — minimise unnecessary handling and twisting", keywords: ["plan movements", "minimise handling", "avoid twisting", "plan", "unnecessary lifting", "minimise"] },
        { label: "Take regular breaks to avoid fatigue", keywords: ["take breaks", "regular break", "rest", "avoid fatigue", "fatigue", "rest period"] },
      ],
    }],
  },

  {
    id: 69,
    question: "How are you going to make sure your timber stacks are stable?",
    prompts: [{
      prompt: "How are you going to make sure your timber stacks are stable?",
      threshold: 1,
      keyPoints: [
        { label: "Use stacking stakes / binders — secure the stack", keywords: ["stacking stake", "binder", "stake", "secure stack", "binding", "stacking binder"] },
        { label: "Stack on firm, level ground", keywords: ["firm ground", "level ground", "flat ground", "stable ground", "solid base"] },
        { label: "Do not stack too high — keep within a safe and manageable height", keywords: ["not too high", "safe height", "manageable height", "height limit", "stack height"] },
      ],
    }],
  },

  {
    id: 70,
    question: "What else do you need to think about when stacking lots of different timber?",
    prompts: [{
      prompt: "What else do you need to think about when stacking lots of different timber?",
      threshold: 1,
      keyPoints: [
        { label: "Sort and stack by species / length / size for ease of identification", keywords: ["sort", "species", "length", "size", "identification", "same length", "group by"] },
        { label: "Bio-security — do not mix potentially infected species or sites", keywords: ["bio-security", "biosecurity", "infected", "mix species", "different sites", "disease spread"] },
        { label: "Access for machinery — leave sufficient space for vehicles or equipment", keywords: ["access", "machinery", "vehicle", "space", "room for", "equipment access", "forwarder"] },
        { label: "Stability considerations — heavier or longer pieces at the base", keywords: ["stability", "heavy at bottom", "base", "heavier", "longer at base", "stable stack"] },
      ],
    }],
  },

  {
    id: 71,
    question: "Before you start your saw, what checks do you need to do?",
    prompts: [{
      prompt: "Before you start your saw, what checks do you need to do?",
      threshold: 2,
      keyPoints: [
        { label: "Check fuel level and bar oil level", keywords: ["fuel", "fuel level", "oil level", "bar oil", "check fuel", "check oil"] },
        { label: "Check bar and chain condition — tension, sharpness, lubrication", keywords: ["bar", "chain", "tension", "sharp", "lubrication", "bar condition", "chain condition", "chain tension"] },
        { label: "Check all nuts and bolts are tight", keywords: ["nuts", "bolts", "tight", "secure", "fixings", "tighten", "not loose"] },
        { label: "Check all safety features are present and working — chain brake, guards", keywords: ["safety features", "chain brake", "guards", "present", "working", "functional"] },
        { label: "Check PPE is correct and in good condition", keywords: ["ppe", "personal protective", "chainsaw trousers", "helmet", "visor", "gloves", "boots", "protective equipment"] },
        { label: "Check the area is clear of hazards and bystanders", keywords: ["area clear", "exclusion zone", "bystander", "hazard free", "clear area", "people clear", "site clear"] },
      ],
    }],
  },

  {
    id: 72,
    question: "What functional checks do you need to perform before you actually use your saw?",
    prompts: [{
      prompt: "What functional checks do you need to perform before you actually use your saw?",
      threshold: 2,
      keyPoints: [
        { label: "Start the saw and test the chain brake — manual activation and inertia", keywords: ["start the saw", "test chain brake", "chain brake", "manual", "inertia", "test brake"] },
        { label: "Check the chain does not move at idle speed", keywords: ["idle", "chain doesn't move", "chain not move", "idle speed", "chain at idle", "not moving at idle"] },
        { label: "Test the throttle trigger lockout", keywords: ["throttle lockout", "trigger lockout", "throttle trigger", "lockout", "trigger test"] },
        { label: "Check the chain oiler is working — bar oil reaching the chain", keywords: ["chain oiler", "oiler", "oil reaching", "bar oil", "oil flow", "oiling system", "oil throwing"] },
        { label: "Check the anti-vibration system is functioning", keywords: ["anti-vibration", "vibration", "av system", "vibration system", "anti vibration"] },
      ],
    }],
  },

  {
    id: 73,
    question: "With all checks done and everything in good condition and working correctly, you are ready to undertake the practical assessment.",
    prompts: [{
      prompt: "With all checks done and everything in good condition and working correctly, you are ready to undertake the practical assessment for using and cutting with a chainsaw. Ensure you have another person with you at all times when using a chainsaw. This is non-negotiable.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 74,
    question: "For the cutting part of the assessment you will need to demonstrate multiple cuts under tension and compression and perform bore cuts.",
    prompts: [{
      prompt: "For the cutting part of the assessment you will need to demonstrate multiple cuts under tension and compression and perform bore cuts, all whilst maintaining a good, safe work position — keep your head out the way!",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

  {
    id: 75,
    question: "Good luck.",
    prompts: [{
      prompt: "Good luck.",
      threshold: 0,
      isAction: true,
      keyPoints: [],
    }],
  },

];
