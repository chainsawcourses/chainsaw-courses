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
        { label: "Step 1 — Identify the hazards", keywords: ["identif", "hazard", "danger", "find the", "spot the", "look for", "look around", "things that can hurt", "see any danger"] },
        { label: "Step 2 — Decide who might be harmed and how", keywords: ["who might", "harmed", "harm", "injur", "affected", "at risk", "decide who", "who might get hurt", "who gets hurt"] },
        { label: "Step 3 — Evaluate the risks and decide on precautions", keywords: ["evaluat", "precaution", "control measure", "assess the risk", "weigh", "decide on", "how bad", "how to stop it", "how to prevent"] },
        { label: "Step 4 — Record the findings and implement them", keywords: ["record", "implement", "document", "write", "log", "findings", "write down what you found", "write it down"] },
        { label: "Step 5 — Review and update the assessment", keywords: ["review", "update", "revise", "monitor", "revisit", "check again", "check back later", "still working", "check it again"] },
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
        { label: "Members of public or bystanders — control: exclusion zone, warning signs, lookout person", keywords: ["public", "bystander", "people", "pedestrian", "exclusion zone", "other person", "member of public", "others nearby", "lookout", "banks person", "banksman", "people walking by", "keep them away"] },
        { label: "Overhead hazards — power lines, dead wood, hung-up branches — control: safe clearance, helmet, survey", keywords: ["overhead", "power line", "electric", "cable", "hung up", "branch above", "overhead line", "deadwood", "widow maker", "dead wood", "pylon", "utility line", "power cable"] },
        { label: "Uneven, slippery or steep terrain — control: grip boots, escape route, uphill side", keywords: ["uneven", "slippery", "slope", "terrain", "muddy", "wet", "steep", "ground condition", "unstable ground", "grip", "footing", "slippery mud", "uneven ground", "watch where you step"] },
        { label: "Underground services — buried pipes or cables — control: utility map, CAT scan, hand dig", keywords: ["underground", "buried", "pipe", "service", "cable below", "buried cable", "dig", "cat scanner", "utility map", "buried service"] },
        { label: "Adverse weather — wind, rain, lightning, poor visibility — control: monitor forecast, stop work", keywords: ["weather", "wind", "rain", "lightning", "visibility", "frost", "ice", "storm", "snow", "gale", "weather condition", "bad weather", "heavy rain", "strong winds", "stop working"] },
        { label: "Vehicular or site traffic — control: road signs, cones, traffic management, hi-vis", keywords: ["traffic", "vehicle", "car", "lorry", "truck", "road", "passing vehicle", "machinery", "moving vehicle", "road user"] },
        { label: "Livestock, cattle, sheep or aggressive animals — control: clear area, liaise with landowner", keywords: ["livestock", "cattle", "sheep", "animal", "dog", "horse", "cow", "farm animal", "landowner"] },
        { label: "Stinging insects — bees, wasps, hornets — control: avoid nests, carry epipen if allergic", keywords: ["bee", "wasp", "hornet", "insect", "sting", "nest", "swarm", "hornet nest", "wasp nest", "bugs"] },
        { label: "Metal, wire or nails embedded in trees — control: metal detector, visual inspection", keywords: ["metal", "nail", "wire", "embedded", "fence post", "staple", "metal in tree", "barbed wire", "hidden metal"] },
        { label: "Holes, trenches, ditches, water or unstable ground — control: mark hazards, avoid edges", keywords: ["hole", "trench", "ditch", "pond", "river", "water", "well", "drop", "cliff", "edge", "unstable soil", "land slip", "hidden holes"] },
        { label: "Tripping hazards — stumps, rocks, brambles, debris — control: clear site, good housekeeping", keywords: ["trip", "stumps", "rock", "bramble", "debris", "clutter", "housekeeping", "tangle", "branch on ground", "tripping over"] },
        { label: "Fire risk — dry tinder, sparks — control: clear debris, carry extinguisher", keywords: ["fire", "tinder", "dry", "spark", "fire risk", "extinguisher", "flammable debris", "wildfire", "combustible"] },
        { label: "Nearby structures, fences, walls or property — control: felling direction away from structures", keywords: ["structure", "fence", "wall", "building", "property", "shed", "barn", "roof", "nearby building"] },
        { label: "Dust, spores or pollen — control: RPE, dust mask", keywords: ["dust", "pore", "pollen", "spore", "mould", "respiratory", "rpe", "dust mask", "airborne"] },
        { label: "Restricted escape routes — control: clear two escape paths at 45 degrees", keywords: ["escape route", "escape path", "exit route", "escape", "retreat", "evacuation route", "45 degree"] },
        { label: "Sun / heat exposure — control: drink water, wear hat, take breaks", keywords: ["too hot", "sun", "sunstroke", "heat exhaustion", "overheating", "drink water", "wear hat", "hot sun"] },
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
        { label: "Kickback — sudden upward/backward motion of bar — control: two-handed grip, chain brake, no tip cutting", keywords: ["kickback", "kick back", "kick-back", "bar nose", "tip contact", "kickback zone", "saw kicking back", "jumps back", "bar jumping"] },
        { label: "Cuts from the moving chain — control: chainsaw PPE, trousers, gloves, boots", keywords: ["cut", "chain contact", "bar contact", "laceration", "chainsaw trousers", "cut resistant", "blade contact", "ppe", "protective clothing", "sharp chain cutting you", "tough pants", "chainsaw trousers"] },
        { label: "Fuel spillage or fire risk — control: cool engine before refuel, no smoking, move 3m before start", keywords: ["fuel", "spillage", "fire", "ignit", "flammable", "petrol", "fuel spill", "refuel", "fuel leak", "fuel cap", "two stroke", "spilling gas", "catch fire"] },
        { label: "Exhaust fumes or carbon monoxide — control: ventilated area, never operate indoors", keywords: ["exhaust", "fume", "emission", "carbon monoxide", "co poison", "exhaust gas", "ventilation", "indoors", "inhalation", "smoke from the engine", "fresh air"] },
        { label: "Burns from hot engine parts — control: gloves, cool before handling, avoid muffler contact", keywords: ["burn", "hot surface", "hot exhaust", "muffler", "hot engine", "blister", "scald", "burned on the hot engine", "don't touch hot parts"] },
        { label: "Vibration causing HAVS — control: anti-vibration gloves, limit exposure time, warm hands", keywords: ["vibrat", "havs", "hand arm vibration", "white finger", "vwf", "raynaud", "vibration exposure", "av glove", "shaking that hurts your hands", "shake your hands"] },
        { label: "Noise causing hearing damage — control: ear defenders, limit daily exposure duration", keywords: ["noise", "hearing", "deaf", "ear", "ear defend", "decibel", "hearing damage", "hearing loss", "loud", "hearing protection", "really loud noise", "ear muffs"] },
        { label: "Flying debris or sawdust causing eye injury — control: face shield, safety glasses", keywords: ["debris", "sawdust", "eye", "flying", "wood chip", "projectile", "face shield", "visor", "glasses", "face protection", "wood chips flying into your eyes"] },
        { label: "Chain break or derailment — control: tension checks, inspect chain links, chain catcher", keywords: ["chain break", "chain snap", "derail", "chain off", "chain throw", "broken chain", "chain catcher", "chain tension", "chain breaking and flying off"] },
        { label: "Chain brake failure — control: pre-start check, functional test, remove from service if faulty", keywords: ["brake fail", "brake malfunction", "brake not work", "brake defect", "brake failure", "chain brake", "inertia brake", "front guard"] },
        { label: "Accidental starting or throttle fault — control: start on ground, throttle lock check, no drop start", keywords: ["accidental start", "unintentional", "drop start", "throttle stick", "throttle fault", "starting", "choke", "cold start", "saw starting by accident", "safety lock"] },
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
        { label: "Falling timber, snags, widow makers or overhead dead wood — control: exclusion zone, check overhead", keywords: ["falling", "snag", "widow maker", "dead wood", "deadwood", "hung up", "log roll", "falling branch", "falling timber", "overhead dead", "leaning tree", "heavy branches falling", "hard hat", "branches falling on your head"] },
        { label: "Fatigue or lone working — control: regular breaks, check-in system, buddy system, GPS beacon", keywords: ["fatigue", "tired", "lone", "alone", "exhaustion", "working alone", "breaks", "check in", "buddy", "sole operator", "lone worker", "getting tired and making mistakes", "take lots of breaks"] },
        { label: "Manual handling of heavy logs — control: log jacks, winches, team lift, machinery", keywords: ["manual handling", "heavy", "lifting", "log jack", "timber", "heavy log", "winch", "forwarder", "team lift", "log weight", "hurting your back lifting", "bend your knees"] },
        { label: "Trapped bar or barber-chairing — control: assess tension, use wedges, correct felling technique", keywords: ["trapped", "pinch", "barber chair", "barber-chair", "compression", "tension", "wedge", "felling wedge", "back cut", "hinge", "getting stuck under a falling tree"] },
        { label: "Rolling or shifting logs — control: stand uphill, chock logs, never below rolling timber", keywords: ["roll", "rolling log", "shifting log", "moving timber", "log move", "chock", "uphill", "timber roll", "wood springing back"] },
        { label: "Struck by falling timber from colleague's work — control: communication, exclusion zones, signals", keywords: ["struck", "colleague", "co-worker", "another worker", "someone else", "communication", "signal", "hand signal", "working too close to someone else"] },
        { label: "Slipping while carrying a running chainsaw — control: engage chain brake when moving, shut off over 3m", keywords: ["slip", "carrying saw", "running saw", "moving with saw", "chain brake when walking", "carrying chainsaw", "trip with saw", "slipping while cutting"] },
        { label: "Tree hung-up in adjacent trees — control: never work under, use winch or machinery to pull down", keywords: ["hung up", "hung tree", "leaner", "lodged", "adjacent tree", "stuck in tree", "tree lean", "hung in"] },
        { label: "Root plate rebound after felling — control: assess weight, cut from safe angle, stand clear", keywords: ["root plate", "root ball", "rebound", "spring back", "root spring", "base", "rootplate"] },
        { label: "Operator fatigue and loss of concentration — control: mandatory breaks, rotate tasks, hydration", keywords: ["concentration", "fatigue", "tired", "loss of focus", "exhaustion", "hydration", "rotate task", "break"] },
        { label: "Inadequate training or lack of competence — control: hold valid certification, use supervision", keywords: ["training", "competence", "qualification", "certificate", "nptc", "lantra", "untrained", "supervision", "skills", "not knowing what to do"] },
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
        { label: "Site location — grid reference, address or what3words", keywords: ["grid ref", "grid reference", "what three words", "what3words", "location", "site address", "coordinates", "postcode", "exactly where you are", "where you are on a map"] },
        { label: "Designated meeting point or muster point", keywords: ["meeting place", "muster point", "rendezvous", "rally point", "assembly point", "meeting point"] },
        { label: "Nearest access point or road", keywords: ["access point", "street", "access route", "entry point", "nearest road", "how to get in", "how to get out of the woods"] },
        { label: "Suitable helicopter landing area", keywords: ["helicopter", "landing", "heli", "air ambu", "landing spot", "landing area"] },
        { label: "Nearest hospital, A&E or doctor's number", keywords: ["doctor", "hospital", "accident and emergency", "a&e", "phone number", "nearest medical", "a and e", "closest hospital", "phone number for ambulance"] },
        { label: "Works manager or supervisor contact details", keywords: ["works manager", "supervisor contact", "manager", "emergency contact", "contact details", "who to call if someone gets hurt"] },
        { label: "Your own mobile phone number", keywords: ["own number", "mobile number", "your number", "personal contact", "your mobile", "my number"] },
        { label: "Whether there is phone signal on site", keywords: ["phone signal", "signal", "mobile signal", "no signal", "reception", "connectivity", "if there is phone signal"] },
        { label: "Who knows you are working there — check-in system", keywords: ["who knows", "check in", "someone knows", "lone worker", "check-in", "knows you are working", "logged in"] },
        { label: "Location of fire extinguisher and first aid kit", keywords: ["fire extinguisher", "extinguisher", "first aid kit", "first aid", "first aid box", "fire kit"] },
      ],
    }],
  },

  {
    id: 6,
    question: "What is the Health and Safety at Work Act all about?",
    prompts: [{
      prompt: "So what is the Health and Safety at Work Act all about?",
      threshold: 2,
      keyPoints: [
        { label: "Employees must take reasonable care of their own and others' safety", keywords: ["reasonable care", "care of others", "own safety", "other people", "duty of care", "workers must be careful not to hurt themselves", "care of yourself", "not hurt yourself"] },
        { label: "Follow training and instructions received", keywords: ["follow training", "follow your training", "trained", "act on training", "training received", "instructions", "follow the safety rules", "follow rules"] },
        { label: "Do not misuse or interfere with safety equipment", keywords: ["misuse", "interfere", "tamper", "not misuse", "do not interfere", "safety equipment", "don't do silly things that are dangerous"] },
        { label: "Employers must provide a safe workplace and safe systems of work", keywords: ["employer", "safe workplace", "safe system", "safe place", "employer duty", "provide safe", "bosses must keep workers safe", "bosses keep their workers safe", "safe tools to use", "teach workers how to be safe"] },
        { label: "Everyone must work together to prevent accidents", keywords: ["work together", "cooperation", "everyone responsible", "joint responsibility", "everyone has to", "everyone's duty", "everyone must work together to stop accidents"] },
        { label: "Employees must report hazards and dangerous situations", keywords: ["report hazard", "tell someone", "report danger", "notify", "inform", "if something dangerous", "report it", "must tell someone", "dangerous situation"] },
      ],
    }],
  },

  {
    id: 7,
    question: "Under PUWER, what does it say about the equipment?",
    prompts: [{
      prompt: "Under the Provision and Use of Work Equipment Regulations — PUWER — what does it say about the equipment?",
      threshold: 2,
      keyPoints: [
        { label: "Equipment must be maintained in an efficient state and good repair", keywords: ["maintained", "maintenance", "kept in good", "serviceable", "good repair", "efficient state", "checked and fixed often", "must be checked", "not broken", "in good condition"] },
        { label: "Equipment must be fit for purpose and suitable for the task", keywords: ["fit for purpose", "suitable", "appropriate", "right tool", "adequate", "fit for", "right tools for the job", "tools must be the right ones"] },
        { label: "Must only be used by trained and competent operators", keywords: ["trained", "competent", "qualified", "trained operator", "only used by", "certified", "only people who know how", "taught how to use"] },
        { label: "Equipment must have appropriate safeguards and controls", keywords: ["safeguard", "guard", "control", "safety device", "protection fitted", "safety guards on them", "must have safety guards"] },
        { label: "Equipment must be safe to use", keywords: ["safe to use", "safe equipment", "must be safe", "safe for use", "not dangerous"] },
      ],
    }],
  },

  {
    id: 8,
    question: "Who provides industry guidance for tree work?",
    prompts: [{
      prompt: "Who provides industry guidance for tree work?",
      threshold: 2,
      keyPoints: [
        { label: "FISA — Forest Industry Safety Accord", keywords: ["fisa", "forest industry safety accord", "forest industry"] },
        { label: "AFAG — Arboricultural Forestry Advisory Group", keywords: ["afag", "arboricultural forestry advisory", "advisory group"] },
        { label: "Forestry Commission / Natural Resources Wales / Forestry England", keywords: ["forestry commission", "natural resources wales", "forestry england", "forestry body"] },
        { label: "Arboricultural Association (AA)", keywords: ["arboricultural association", "arb association"] },
        { label: "HSE — Health and Safety Executive", keywords: ["hse", "health and safety executive", "health and safety", "government safety", "government people who check on safety"] },
        { label: "Industry safety organisations / advisory groups", keywords: ["industry guidance", "industry group", "safety organisation", "groups of experts", "expert group", "groups that make", "safety inspectors", "safety body"] },
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
        { label: "Ensures the machine is safe to use and reduces the risk of accidents", keywords: ["safe to use", "safety", "safe operation", "operator safety", "reduces risk", "prevent accident", "keeps the saw working safely", "stops accidents from happening"] },
        { label: "Reduces machinery downtime and costly repairs", keywords: ["downtime", "repair", "breakdown", "out of service", "reliability", "less repair", "stops the saw from breaking down", "costly repairs"] },
        { label: "Maintains performance and cutting efficiency", keywords: ["performance", "efficient", "cutting ability", "optimum", "operate correctly", "cutting performance", "cuts better", "easier to start", "runs smoothly"] },
        { label: "Maintains the machine's longevity", keywords: ["longevity", "last longer", "lifespan", "life of the saw", "extends life", "makes the saw last a long time", "save money"] },
        { label: "It is what the manufacturer recommends", keywords: ["manufacturer", "manufacturer says", "made it say", "manufacturer recommendations", "manufacturer guidance", "what the people who made it say"] },
      ],
    }],
  },

  {
    id: 10,
    question: "The manufacturer has installed safety features on the saw — run through where they are and what they do.",
    prompts: [{
      prompt: "The manufacturer has installed safety features on the saw. Just run through where they are and what they do.",
      threshold: 10,
      keyPoints: [
        { label: "Combined chain brake and front hand guard — stops chain on kickback, protects hand", keywords: ["chain brake", "front hand guard", "hand guard", "brake stop", "stops the chain", "front guard", "chain brake stops chain if it jumps back", "kickback chain brake"] },
        { label: "Throttle trigger lockout — prevents accidental throttle operation", keywords: ["throttle lockout", "trigger lockout", "accidental throttle", "throttle safety", "lock out", "throttle trigger", "safety trigger", "stops you pressing the gas by accident", "accidental press"] },
        { label: "Chain catcher — catches chain if it breaks or derails", keywords: ["chain catcher", "catch the chain", "derailed chain", "chain off", "chain catcher pin", "catches the chain if it breaks"] },
        { label: "Rear hand guard / chain breakage guard — protects the rear hand", keywords: ["rear guard", "rear hand", "rear chain", "back guard", "back hand guard", "breakage guard"] },
        { label: "Anti-vibration mounts — reduces vibration to the hands", keywords: ["anti-vibration", "anti vibration", "vibration mount", "reduce vibration", "dampen vibration", "av system", "shaky mounts", "stops your hands from shaking too much"] },
        { label: "On/off switch — stops the engine", keywords: ["on off switch", "on/off", "kill switch", "stop switch", "engine stop switch", "stops engine", "turns the saw off quickly", "turns saw off"] },
        { label: "Safety decals — mandatory information (PPE symbols)", keywords: ["safety decal", "decal", "symbol", "label", "warning label", "mandatory information", "ear defender", "eye protection symbol"] },
        { label: "Low-kickback chain — reduces kickback characteristics", keywords: ["low kickback", "kickback chain", "anti-kickback chain", "safety chain", "low kick back chain"] },
        { label: "Exhaust / silencer — reduces noise and emissions", keywords: ["exhaust", "silencer", "muffler", "noise reduc", "emission", "silences", "muffler makes saw less noisy"] },
        { label: "Bar cover / scabbard — protects bar and chain during transport", keywords: ["bar cover", "guide bar cover", "scabbard", "cover protect", "chain cover", "protective cover", "covers the sharp chain when you carry it"] },
        { label: "Spiked bumper / spike / spike bumper — helps grip the wood when cutting", keywords: ["spiked bumper", "spike", "bumper spike", "dogs", "felling dogs", "grip the wood", "grip wood when cutting", "helps grip"] },
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
        { label: "Stop work immediately and take the saw out of service", keywords: ["stop work", "cease work", "take out of service", "do not use", "withdraw", "stop using", "out of service", "do not use the saw at all", "don't use it"] },
        { label: "Tag it / report it to your supervisor or employer", keywords: ["tag", "report", "supervisor", "employer", "inform", "label", "notify", "report it", "tell your boss", "put a sign on it saying it is broken"] },
        { label: "Do not use until repaired or replaced by a competent person", keywords: ["do not use", "not until repaired", "until fixed", "competent person", "repaired", "replaced", "wait until completely fixed", "never pretend it's okay"] },
        { label: "Write it in the maintenance log / record it", keywords: ["write down", "maintenance log", "record", "log it", "document", "write down what is broken", "write in a book"] },
      ],
    }],
  },

  {
    id: 12,
    question: "What are the advantages of using battery chainsaws?",
    prompts: [{
      prompt: "What are the advantages of using battery chainsaws?",
      threshold: 4,
      keyPoints: [
        { label: "Quieter operation — reduced noise levels", keywords: ["quieter", "reduced noise", "less noise", "lower noise", "quiet", "less sound", "much quieter to use", "quieter operation"] },
        { label: "Zero exhaust emissions — no fumes", keywords: ["no emission", "zero emission", "no exhaust", "no fumes", "clean", "emission free", "no fume", "don't make bad smoke", "no bad smoke"] },
        { label: "Less vibration transmitted to the operator", keywords: ["less vibration", "reduced vibration", "lower vibration", "vibration reduction", "less vibrat", "don't shake your hands as much", "less shaking"] },
        { label: "No fuel to carry — no fuel spillage risk", keywords: ["no fuel", "fuel transport", "spillage", "no petrol", "no spill", "no fuel need", "don't need fuel", "don't need smelly gas", "no fuel needed"] },
        { label: "Better communication — can hear others on site", keywords: ["communication", "talk to", "speak to", "hear each other", "clearer comms", "communicate", "can hear people talking", "hear people better", "better communication"] },
        { label: "Less maintenance required", keywords: ["less maintenance", "lower maintenance", "fewer service", "easier maintenance", "easier to maintain", "easier to clean and look after"] },
        { label: "Can be used indoors or in urban / sensitive environments", keywords: ["indoor", "urban", "sensitive", "inside", "enclosed", "public area", "inside a shed"] },
        { label: "Easy to start — just a button", keywords: ["easy to start", "push button", "just push a button", "button start", "easier to start", "button to start"] },
        { label: "Lighter to hold / carry", keywords: ["lighter", "not as heavy", "light weight", "less heavy", "easier to carry", "less weight", "not heavy"] },
      ],
    }],
  },

  {
    id: 13,
    question: "What are the disadvantages of using battery chainsaws?",
    prompts: [{
      prompt: "What are the disadvantages of using battery chainsaws?",
      threshold: 4,
      keyPoints: [
        { label: "Limited run time — battery capacity restricts working time", keywords: ["limited run", "battery life", "run time", "capacity", "run out", "limited time", "batteries run out quickly", "run out of battery", "batteries drain"] },
        { label: "Less power available for heavy or large-diameter timber", keywords: ["less power", "not as powerful", "heavy timber", "large diameter", "power limitation", "not strong enough for huge trees", "sometimes not strong enough"] },
        { label: "Battery compatibility and misalignment risks", keywords: ["incompatible", "compatibility", "wrong battery", "incorrect battery", "misalign", "not compatible"] },
        { label: "Machine can be live when battery is fitted — no exhaust sound warning", keywords: ["live", "battery in", "always on", "no warning", "silent", "no engine noise", "energised", "so quiet you might not hear them running"] },
        { label: "Risk of electric shock or short circuit when charging", keywords: ["electric shock", "short circuit", "charging risk", "electrocution", "fire when charging", "overheating battery", "water can break them and give shock", "electric shock from water"] },
        { label: "Cold weather reduces battery performance", keywords: ["cold", "temperature", "cold weather", "winter", "cold affect", "battery cold", "might not work well in very cold", "cold weather performance"] },
        { label: "Battery storage and disposal considerations", keywords: ["storage", "disposal", "store battery", "dispos", "battery storage", "expensive batteries", "batteries expensive", "expensive to buy"] },
        { label: "Need to bring extra batteries — charging not possible in the field", keywords: ["extra batteries", "spare batteries", "can't charge in the woods", "can't charge in middle of woods", "need to charge beforehand", "remember to charge night before", "need to bring extra"] },
        { label: "Heavier batteries add weight to the saw", keywords: ["batteries heavy", "heavy to carry", "battery weight", "adds weight", "heavy battery pack"] },
      ],
    }],
  },

  {
    id: 14,
    question: "What maintenance might you do with the batteries, the saw and charger?",
    prompts: [{
      prompt: "What maintenance might you do with the batteries, the saw and charger?",
      threshold: 4,
      keyPoints: [
        { label: "Inspect battery for damage, cracks or deformation", keywords: ["inspect battery", "check battery", "battery damage", "crack", "deform", "battery condition", "check for cracks or broken", "look for cracks"] },
        { label: "Clean battery contacts and guide tracks", keywords: ["clean contacts", "battery contacts", "guide track", "terminal", "clean terminal", "track clean", "keep metal bits clean so they connect well"] },
        { label: "Store battery at correct charge level in a cool, dry place", keywords: ["store battery", "storage", "correct charge", "40", "50", "60", "cool dry", "storage charge", "keep in dry place", "store somewhere dry", "not too hot or cold"] },
        { label: "Inspect charger leads and connections for damage", keywords: ["charger lead", "charger cable", "charger connection", "charger damage", "inspect charger", "charger cord not chewed", "cord not chewed or broken"] },
        { label: "Clean the saw's air filter and cooling system", keywords: ["air filter", "cooling system", "clean saw", "filter clean", "cooling clean", "clean saw so sawdust doesn't get in battery hole"] },
        { label: "Check battery compartment for damage or debris", keywords: ["compartment", "battery compartment", "housing", "battery bay", "compartment clean", "clean the battery hole", "wipe dust off with dry cloth"] },
        { label: "Do not overcharge or leave plugged in after fully charged", keywords: ["overcharge", "don't overcharge", "not leave plugged in", "don't leave plugged in too long", "after they are full", "overcharging"] },
        { label: "Do not drop batteries — protect from impact", keywords: ["don't drop", "drop batteries", "protect from impact", "avoid dropping", "don't drop on ground"] },
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
        { label: "Air filter", keywords: ["air filter", "filter", "air cleaner", "little sponge", "sponge filter", "foam filter", "paper filter", "cleans the air"] },
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
        { label: "Prevents debris and dust entering the carburettor / engine", keywords: ["prevent debris", "stops dirt", "dirt out", "debris", "carburettor", "stops dust", "clean air", "air fuel", "filters the air", "cleans the air before it goes in", "stops dirt getting into engine", "mask for the chainsaw"] },
      ],
    }],
  },

  {
    id: 18,
    question: "How do you maintain it? (air filter)",
    prompts: [{
      prompt: "And how do you maintain it?",
      threshold: 2,
      keyPoints: [
        { label: "Remove and clean — tap out, wash or blow out debris", keywords: ["clean", "tap out", "wash", "blow out", "remove debris", "clean filter", "wash in warm water", "warm water with soap", "blow the dust off", "tap gently", "brush softly", "air gun", "air line"] },
        { label: "Inspect the filter housing and gasket for damage", keywords: ["inspect housing", "gasket", "housing", "housing damage", "filter housing", "look for holes in it"] },
        { label: "Replace the filter if damaged or worn", keywords: ["replace", "new filter", "fit new", "replace if", "damaged filter", "buy a new one", "too dirty to clean"] },
        { label: "Ensure completely dry before refitting", keywords: ["completely dry", "dry before", "dry it out", "let it dry", "must be dry", "make sure it is dry"] },
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
        { label: "Spark plug", keywords: ["spark plug", "plug", "sparking plug", "little metal stick", "metal stick with white top", "goes into the engine", "makes the spark"] },
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
        { label: "Ignites the fuel/air mixture to fire the engine", keywords: ["ignite", "ignition", "fires", "combustion", "spark", "fire the engine", "fuel mix", "makes a tiny spark", "lights the gas on fire", "mini explosions", "like a match", "makes the engine go bang", "burn the fuel"] },
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
        { label: "Check electrode condition and gap — use a feeler gauge", keywords: ["electrode", "gap", "feeler gauge", "check gap", "electrode gap", "electrode condition", "tiny gap at the bottom", "right size gap"] },
        { label: "Look for fouling — carbon deposits, sooty or oily residue", keywords: ["fouling", "carbon", "sooty", "oily", "deposit", "black", "contamination", "black soot", "clean off black soot"] },
        { label: "Check for cracks or physical damage to the ceramic", keywords: ["crack", "damage", "ceramic", "broken", "physical damage", "white part cracked", "look for cracks"] },
        { label: "Clean or replace as necessary", keywords: ["clean", "replace", "clean plug", "new plug", "fit new", "put a new one in", "wire brush", "little wire brush"] },
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
        { label: "Cool the engine — draw air over the cylinder to prevent overheating", keywords: ["cool", "cooling", "prevent overheat", "overheat", "airflow", "air over", "temperature", "help the engine cool down", "let the heat escape", "stops the saw from getting too hot", "spread the heat out", "keeps engine at good temperature"] },
      ],
    }],
  },

  {
    id: 23,
    question: "How do you maintain the cooling system?",
    prompts: [{
      prompt: "So how do you maintain the cooling system?",
      threshold: 2,
      keyPoints: [
        { label: "Remove debris from the cylinder fins — brush or compressed air", keywords: ["remove debris", "clean fins", "debris from fins", "brush", "compressed air", "fin clean", "cylinder fin", "brush all sawdust out of little gaps", "sawdust out of the gaps", "blow air through it", "tap out stuck dirt"] },
        { label: "Check and clear the flywheel housing and air intake", keywords: ["flywheel", "air intake", "housing", "clear intake", "flywheel housing", "nothing blocking the air"] },
        { label: "Keep clean regularly — don't let mud or debris build up", keywords: ["keep clean", "regularly clean", "clean regularly", "don't let mud dry on it", "wipe clean when finished", "check often", "not clogged up"] },
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
        { label: "Exhaust / silencer / muffler", keywords: ["exhaust", "silencer", "muffler", "exhaust system", "where the smoke comes out", "metal box on the front", "little chimney"] },
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
        { label: "Reduces noise and directs exhaust gases / emissions away from the operator", keywords: ["reduce noise", "quieter", "exhaust gas", "emission", "noise reduction", "direct gas", "muffles", "blows the bad smoke away", "makes loud engine noise quieter", "directs hot air away", "hot gases away", "like exhaust pipe on car"] },
        { label: "Spark arrestor — contains spark arrestor screen to prevent fire", keywords: ["spark arrestor", "spark arrest", "prevent fire", "fire prevention", "spark screen", "little screen inside it", "net to catch sparks", "traps burning carbon", "stops sparks flying"] },
      ],
    }],
  },

  {
    id: 26,
    question: "How do you maintain it? (exhaust)",
    prompts: [{
      prompt: "And how do you maintain it?",
      threshold: 2,
      keyPoints: [
        { label: "Check fixings — nuts and bolts are secure", keywords: ["nuts", "bolts", "fixings", "secure", "tighten", "check bolts", "fixing check", "check the screws holding it are tight", "screws tight", "not rattling"] },
        { label: "Check / clean the spark arrestor", keywords: ["spark arrestor", "spark arrester", "arrestor", "clean arrestor", "carbon build", "clean the little spark catching net", "brush the net", "carbon mesh"] },
        { label: "Check for cracks or damage to the body", keywords: ["crack", "damage", "body crack", "check damage", "inspect exhaust", "look for cracks or holes", "cracks or holes", "rusted through"] },
        { label: "Let cool before handling — do not touch when hot", keywords: ["cool down", "let cool", "don't touch when hot", "wait until cold", "completely cold", "allow to cool", "don't touch until cold"] },
      ],
    }],
  },

  {
    id: 27,
    question: "What is in here that you need to maintain and how would you do it? (fuel tank)",
    prompts: [{
      prompt: "What is in here that you need to maintain and how would you do it?",
      threshold: 2,
      keyPoints: [
        { label: "Fuel filter — located in the fuel tank", keywords: ["fuel filter", "filter in fuel", "fuel tank filter", "in the tank", "fuel pick-up", "little fuel filter inside gas tank", "inside the gas tank"] },
        { label: "Remove, inspect and clean or replace the fuel filter", keywords: ["remove filter", "replace fuel filter", "clean filter", "new filter", "change filter", "use a little hook to pull it out", "hook to pull it out", "change once a year", "if dirty or blocked", "can't clean it just replace"] },
      ],
    }],
  },

  {
    id: 28,
    question: "What is in here that you need to maintain and how would you do it? (oil tank)",
    prompts: [{
      prompt: "So what is in here that you need to maintain and how would you do it?",
      threshold: 2,
      keyPoints: [
        { label: "Oil filter — located in the bar oil tank", keywords: ["oil filter", "filter in oil", "bar oil tank", "oil tank filter", "oil pick-up", "oil filter inside oil tank", "inside the oil tank"] },
        { label: "Remove, inspect and clean or replace the oil filter", keywords: ["remove oil filter", "replace oil filter", "clean oil filter", "new oil filter", "change oil filter", "hook it out like gas filter", "sometimes wash in clean gas", "sticky and dirty put new one in", "chain gets enough slippery oil"] },
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
        { label: "Pull cord / rope — look for fraying, wear or knotting", keywords: ["pull cord", "rope", "cord", "fray", "wear on cord", "knotting", "cord damage", "string you pull", "fuzzy or breaking", "string", "frayed cord", "broken cord"] },
        { label: "Recoil spring / coil spring — check for breakage or distortion", keywords: ["recoil spring", "coil spring", "spring", "broken spring", "spring damage", "metal spring inside", "spring might be snapped"] },
        { label: "Pawl / ratchet — check for wear or breakage", keywords: ["pawl", "ratchet", "dog", "catch", "mechanism", "ratchet wear", "little plastic teeth", "worn down teeth"] },
        { label: "Housing — check for cracks or damage to the casing", keywords: ["housing crack", "plastic cover", "cover cracked", "casing damage", "plastic cracked", "hole in cover", "cracked housing"] },
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
        { label: "Sprocket / drive sprocket", keywords: ["sprocket", "drive sprocket", "clutch sprocket", "chain sprocket", "little metal star", "metal gear", "gear", "metal star"] },
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
        { label: "Drives the chain along the guidebar", keywords: ["drives the chain", "drive chain", "moves the chain", "chain drive", "carries chain", "pulls the chain around", "transfers power to chain", "grips the bottom parts of chain", "makes the chain spin", "drives cutting teeth into wood"] },
      ],
    }],
  },

  {
    id: 34,
    question: "How do you check for any wear or damage? (sprocket)",
    prompts: [{
      prompt: "How do you check for any wear or damage?",
      threshold: 2,
      keyPoints: [
        { label: "Check for hooked or wolf-teeth — look for sharp, curved points", keywords: ["hooked", "wolf teeth", "hook", "curved teeth", "sharp point", "worn tooth", "teeth shape", "look at metal teeth for deep cuts", "deep cuts in teeth"] },
        { label: "Check the needle bearing / drum for wear", keywords: ["needle bearing", "bearing", "drum", "needle cage", "bearing wear", "see if it wobbles", "wobbles when you touch it"] },
        { label: "Check depth of tooth wear — replace if excessively worn", keywords: ["depth of wear", "tooth depth", "excessive wear", "measure wear", "replace sprocket", "grooves worn into metal", "grooves too deep", "if grooves are deeper than a tiny bit"] },
        { label: "Listen for clanking or rattling noises", keywords: ["clanking", "rattling", "noise", "listen for", "clank", "rattle"] },
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
        { label: "Use a clutch removal tool to remove the clutch", keywords: ["clutch removal", "removal tool", "remove clutch", "clutch tool", "spanner", "take the clutch off first", "special tool to unscrew clutch", "clutch unscrews backwards"] },
        { label: "Remove the needle bearing and spacers carefully", keywords: ["needle bearing", "needle cage", "bearing", "spacer", "remove bearing", "little roller bearing", "bearing inside"] },
        { label: "Fit the new sprocket and reassemble correctly", keywords: ["fit new", "new sprocket", "replace sprocket", "reassemble", "refit", "slide new sprocket onto shaft", "screw clutch back on"] },
        { label: "Torque to manufacturer's specification", keywords: ["torque", "specification", "torque spec", "correct torque", "tighten to spec", "tighten correctly"] },
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
        { label: "Front of the saw — the front hand guard / front handle area", keywords: ["front", "front hand guard", "front guard", "front of saw", "front handle", "left hand guard", "built into the side cover", "big plastic guard", "in front of your top hand", "right in front of your hand"] },
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
        { label: "Stops the chain rapidly — activated manually or by inertia on kickback", keywords: ["stops the chain", "halt chain", "chain stops", "inertia", "kickback", "activated", "stops chain spinning instantly", "stops chain from spinning", "protects you if saw kicks back", "very strong handbrake for saw", "life-saving safety feature"] },
        { label: "The brake band clamps around the clutch drum to arrest the chain", keywords: ["brake band", "clutch drum", "band clamp", "drum", "arrest", "clamp"] },
      ],
    }],
  },

  {
    id: 38,
    question: "How do you check the chain brake for any wear or damage?",
    prompts: [{
      prompt: "How do you check for any wear or damage?",
      threshold: 2,
      keyPoints: [
        { label: "Check the brake band for wear — check thickness", keywords: ["brake band", "band wear", "band thickness", "band condition", "check band", "metal band not worn too thin", "look at the metal band", "band too thin"] },
        { label: "Check the front hand guard for damage or cracks", keywords: ["front hand guard", "guard damage", "guard crack", "hand guard condition", "plastic handle not cracked", "check plastic handle"] },
        { label: "Test the brake activation — manual and inertia", keywords: ["test brake", "activate brake", "brake test", "manual activation", "inertia test", "test activation", "push handle forward to hear loud click", "loud click", "try to pull chain when brake on", "shouldn't move"] },
        { label: "Check the spring inside is strong and not worn", keywords: ["spring inside", "spring strong", "spring condition", "check spring", "spring not worn"] },
      ],
    }],
  },

  {
    id: 39,
    question: "This is your guidebar — what signs of wear or damage are you looking for?",
    prompts: [{
      prompt: "This is your guidebar — what signs of wear or damage are you looking for?",
      threshold: 3,
      keyPoints: [
        { label: "Uneven or burred rails", keywords: ["uneven rail", "burred", "rail condition", "burr", "rail wear", "uneven wear", "rail bur", "sharp metal edges", "burrs on rails", "look for sharp metal edges called burrs", "one side of rail higher"] },
        { label: "Groove depth — worn groove", keywords: ["groove depth", "groove wear", "worn groove", "groove", "groove check", "groove in middle squashed", "groove squashed"] },
        { label: "Bar straightness — bent bar", keywords: ["straightness", "straight", "bent", "bent bar", "bar straight", "bar bent or twisted", "look if bar is bent"] },
        { label: "Sprocket nose wear or damage", keywords: ["sprocket nose", "nose sprocket", "nose wear", "tip", "nose damage", "tip wheel broken or stuck", "check the tip wheel"] },
        { label: "Overheating marks or heat discolouration", keywords: ["overheat", "heat mark", "discolouration", "bluing", "burn mark", "overheated bar", "blue marks", "look for blue marks meaning too hot"] },
        { label: "Oil hole blocked with dirt", keywords: ["oil hole", "oil hole blocked", "blocked oil hole", "oil port blocked", "oil hole with dirt", "blocked with dirt"] },
        { label: "Groove too wide or chain sitting loosely", keywords: ["groove too wide", "chain loose", "chain sitting loosely", "groove wider than chain", "chain fits loosely", "chain doesn't fit"] },
      ],
    }],
  },

  {
    id: 40,
    question: "If the bar shows excessive wear or damage, what problems might you get?",
    prompts: [{
      prompt: "So if the bar shows excessive wear or damage, what problems might you get?",
      threshold: 3,
      keyPoints: [
        { label: "Chainsaw will not cut in a straight line — it will drift", keywords: ["not cut straight", "drift", "deviate", "wander", "pull to one side", "doesn't cut straight", "saw will not cut in straight line", "cut in a curve"] },
        { label: "Overheating of the bar and poor lubrication", keywords: ["overheat", "heat up", "poor lubrication", "dry chain", "lubrication problem", "hot bar", "bar will get very hot", "bar very hot and smoke"] },
        { label: "Chain derailment or accelerated chain / sprocket wear", keywords: ["chain off", "derail", "accelerated wear", "chain wear", "sprocket wear", "wear out faster", "chain might jump off bar completely", "chain jumps off", "chain ruined quickly"] },
        { label: "Reduced cutting performance — saw works harder", keywords: ["reduced performance", "slower", "slower cut", "harder to cut", "more effort", "saw will cut very slowly", "harder to push through wood"] },
        { label: "Increased vibration and danger", keywords: ["vibrate", "shake", "vibration", "more dangerous", "much more dangerous", "unsafe", "dangerous to use", "vibrate and shake hands"] },
      ],
    }],
  },

  {
    id: 41,
    question: "How are you going to maintain your bar?",
    prompts: [{
      prompt: "How are you going to maintain your bar?",
      threshold: 2,
      keyPoints: [
        { label: "Clean the groove and clear the oil holes", keywords: ["clean groove", "clear oil hole", "oil hole", "groove clean", "clear the groove", "oil port", "poke oil hole with wire", "wire to keep clear", "clean dirt out of middle groove"] },
        { label: "Remove burrs from the rails with a flat file", keywords: ["remove burr", "deburr", "flat file", "file the rail", "burr removal", "dress rails", "use flat file to scrape off burrs", "scrape off sharp metal burrs"] },
        { label: "Turn / reverse the bar to even out wear", keywords: ["turn the bar", "reverse bar", "flip bar", "rotate bar", "bar turn", "even wear", "turn bar upside down", "turn it over so it wears evenly", "flip it over"] },
        { label: "Grease the nose sprocket", keywords: ["grease nose", "bar nose", "nose sprocket grease", "lubricate nose", "grease tip", "put grease in little hole at tip", "grease tip if it has a wheel"] },
        { label: "Wipe clean and store dry to prevent rust", keywords: ["wipe clean", "store dry", "prevent rust", "clean with rag", "wipe with rag", "dry storage", "store somewhere dry"] },
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
        { label: "Pitch — the measurement of the chain drive links", keywords: ["pitch", "chain pitch", "how far apart the rivets are", "rivets", "distance between links"] },
        { label: "Gauge — the width of the drive link", keywords: ["gauge", "chain gauge", "drive link gauge", "how thick the bottom parts are", "thickness of drive links"] },
        { label: "Number of drive links", keywords: ["drive link", "number of link", "drive links", "link count", "count how many bottom parts", "count the drive links"] },
        { label: "Markings on the drive link or chain packaging", keywords: ["marking", "stamp", "chain box", "packaging", "manufacturer mark", "stamped on", "numbers stamped on the side", "look up the saw model in manual", "match to numbers on guide bar"] },
      ],
    }],
  },

  {
    id: 45,
    question: "What information do you need to replace your chain?",
    prompts: [{
      prompt: "What information do you need to replace your chain?",
      threshold: 5,
      keyPoints: [
        { label: "Pitch of the chain", keywords: ["pitch", "pitch of chain", "the pitch"] },
        { label: "Gauge of the chain", keywords: ["gauge", "gauge of chain", "the gauge"] },
        { label: "Number of drive links", keywords: ["drive link", "number of link", "exactly how many drive links", "drive link count"] },
        { label: "Length / size of the guidebar", keywords: ["bar length", "guide bar length", "length of bar", "bar size", "bar inches", "how long the guide bar is", "how long the bar is", "bar length inches"] },
        { label: "Cutter type / chain type", keywords: ["cutter type", "chain type", "type of chain", "cutter profile", "what shape of cutting teeth"] },
        { label: "Brand of your chainsaw", keywords: ["brand", "make", "brand of chainsaw", "chainsaw make", "manufacturer name"] },
        { label: "Model number of your chainsaw", keywords: ["model", "model number", "model of chainsaw", "saw model"] },
        { label: "Part number from the old chain", keywords: ["part number", "old chain number", "chain part number", "number from old chain", "number from the box"] },
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
        { label: "Chisel / full chisel or semi-chisel (whichever applies)", keywords: ["chisel", "semi-chisel", "semi chisel", "full chisel", "round", "cutter type", "rounded corners", "square corners", "sharp right angle", "little curve"] },
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
        { label: "Chisel or semi-chisel — whichever was not given in the previous answer", keywords: ["chisel", "semi-chisel", "semi chisel", "full chisel", "other type", "other profile", "if you have semi-chisel the other is full-chisel", "one has sharp square corners", "one has rounded corners"] },
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
        { label: "Full chisel — fast cutting, hard or frozen wood, professional use", keywords: ["full chisel", "chisel", "fast", "hard wood", "frozen wood", "professional", "faster cut", "cuts very fast in clean soft wood", "faster in clean wood"] },
        { label: "Semi-chisel — softer or dirty wood, stays sharper longer, better for beginners", keywords: ["semi-chisel", "semi chisel", "dirty wood", "stays sharp", "beginner", "softer", "less kickback", "better for dirty or hard wood", "muddy wood", "stays sharp longer in dirt"] },
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
        { label: "State the correct top plate filing angle (e.g. 25°, 30° or 35°) for the chain", keywords: ["degree", "angle", "25", "30", "35", "top plate angle", "filing angle", "25 or 30 degree", "hold the file at", "slightly slanted"] },
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
        { label: "State the correct file diameter for the chain (e.g. 4mm, 3/16\", 13/64\")", keywords: ["millimetre", "mm", "file size", "diameter", "round file", "3/16", "4mm", "13/64", "size of file", "5/32", "7/32", "depends on pitch", "depends on chain size"] },
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
        { label: "Start at the shortest / most damaged cutter, or mark a starting cutter", keywords: ["shortest", "most damaged", "marked", "start at", "first cutter", "mark a cutter", "shortest cutter", "most worn down", "worst tooth", "mark the first tooth", "marker pen"] },
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
        { label: "Depth gauge / raker", keywords: ["depth gauge", "raker", "depth limiter", "gauge", "little bump of metal", "little shark fin", "shark fin", "bump in front of tooth"] },
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
        { label: "Controls the depth of cut — limits how much wood the cutter takes in each pass", keywords: ["depth of cut", "controls depth", "limits cut", "how much wood", "bite", "chip size", "controls bite", "decides how deep the tooth can bite", "bumper to stop tooth going too deep", "controls size of wood chips", "controls how big a bite"] },
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
        { label: "Controls chip size and cutting efficiency — optimum cutting speed", keywords: ["chip size", "cutting efficiency", "optimum speed", "cutting speed", "optimum cutting", "if too high won't cut", "makes dust instead of chips", "just makes dust"] },
        { label: "Set too low: increased kickback risk — chain grabs aggressively into the wood", keywords: ["too low", "kickback", "grab", "aggressive", "chain grab", "danger too low", "excessive kickback", "saw very jumpy and dangerous", "tooth bites too much wood at once", "very jumpy and dangerous"] },
        { label: "Too low also strains the engine", keywords: ["strains engine", "engine strain", "huge strain on engine", "engine can break", "too much strain", "wears engine out"] },
      ],
    }],
  },

  {
    id: 55,
    question: "Why do you want to keep all your cutters the same size and the angles all the same?",
    prompts: [{
      prompt: "Why do you want to keep all your cutters the same size and the angles all the same?",
      threshold: 3,
      keyPoints: [
        { label: "Ensures the saw cuts in a straight line — balanced load on all cutters", keywords: ["straight line", "balanced", "equal load", "cuts straight", "even load", "balance", "cuts in perfectly straight line", "if one side longer saw cuts in curve"] },
        { label: "Reduces vibration and wear — even distribution of cutting force", keywords: ["reduce vibration", "less vibration", "even wear", "equal wear", "smooth operation", "reduce wear", "stops saw from vibrating", "every tooth does same amount of work"] },
        { label: "Prolongs chain life", keywords: ["chain life", "last longer", "chain lasts longer", "prolongs life", "chain lasts much longer", "extends chain life"] },
        { label: "Safer and more predictable to use", keywords: ["safer", "predictable", "much safer", "safe", "predictable cutting", "much safer to use", "stops guide bar wearing on one side"] },
      ],
    }],
  },

  {
    id: 56,
    question: "What problems might you get if you use a really worn or badly sharpened chain?",
    prompts: [{
      prompt: "What problems might you get if you use a really worn or badly sharpened chain?",
      threshold: 3,
      keyPoints: [
        { label: "Increased risk of kickback", keywords: ["kickback", "kick back", "kick-back", "increased kickback", "saw might kick back", "more kickback", "kickback more easily"] },
        { label: "Chain will not cut in a straight line — drifts to one side", keywords: ["drift", "not cut straight", "wander", "pull to one side", "doesn't cut straight", "cuts in a curve", "cuts sideways"] },
        { label: "Overheating of the bar and chain", keywords: ["overheat", "heat", "bar overheat", "chain overheat", "excessive heat", "engine will get very hot"] },
        { label: "Increased operator effort, vibration and fatigue", keywords: ["operator effort", "more effort", "fatigue", "vibration", "harder to cut", "strain on operator", "push really hard", "have to push really hard", "get very tired"] },
        { label: "Produces dust instead of chips — sign of poor sharpness", keywords: ["makes dust", "fine dust", "dust instead of chips", "dust not chips", "no wood chips", "fine saw dust"] },
      ],
    }],
  },

  {
    id: 57,
    question: "How do you dispose of your contaminated chainsaw waste and your litter?",
    prompts: [{
      prompt: "How do you dispose of your contaminated chainsaw waste and your litter?",
      threshold: 2,
      keyPoints: [
        { label: "Collect oil-contaminated waste separately — take to a licensed waste facility", keywords: ["contaminated waste", "oil waste", "licensed facility", "licensed tip", "waste facility", "waste oil", "separate waste", "old dirty oil must go to special recycling", "special recycling place", "take to recycling"] },
        { label: "Never bury or burn contaminated waste", keywords: ["never bury", "do not bury", "not burn", "do not burn", "bury", "incinerate", "do not pour oil on ground", "do not pour on ground", "don't pour in river"] },
        { label: "Take all litter away from site — leave no trace", keywords: ["take litter", "leave no trace", "clean up site", "remove litter", "take away", "take it home", "never leave oily rags in woods", "take everything away with you", "keep woods clean"] },
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
        { label: "Two tree lengths / two times the height of the tallest tree being worked on (minimum)", keywords: ["two tree length", "two times", "two tree", "height of tree", "tallest tree", "two lengths", "exclusion zone", "twice the height of the tree", "twice tree length", "minimum 5 meters", "5 meters", "5m"] },
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
        { label: "Clean and disinfect tools, equipment and footwear before and after entering a site", keywords: ["clean tools", "disinfect", "clean boots", "footwear", "clean equipment", "clean and disinfect", "wash equipment", "clean all mud and sawdust off boots", "wash your chainsaw and tools", "clean before going to new forest"] },
        { label: "Avoid moving potentially infected plant material off site", keywords: ["infected material", "infected", "plant material", "move material", "spread disease", "not move", "don't move sick wood to healthy forest", "don't move infected wood"] },
        { label: "Check for specific diseases / pathogens relevant to the site (e.g. ash dieback, Phytophthora)", keywords: ["ash dieback", "phytophthora", "disease", "pathogen", "specific disease", "chalara", "tell an expert if you see very sick tree", "check the rules for the forest"] },
        { label: "Park and access on hard ground to reduce spread", keywords: ["hard ground", "hard road", "park on hard road", "not in muddy woods", "park on hard surface"] },
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
        { label: "Wildlife and protected species — nesting birds, bats, badgers", keywords: ["wildlife", "protected species", "nesting bird", "bat", "badger", "ecology", "nesting season", "look out for birds nesting", "birds nesting in the trees"] },
        { label: "Watercourses — prevent oil or fuel pollution of streams and ponds", keywords: ["watercourse", "stream", "pond", "river", "pollution", "oil spill", "fuel spill near water", "don't let oil or gas spill into rivers", "into rivers or streams", "oil into river"] },
        { label: "Surrounding vegetation — avoid unnecessary damage to roots, ground flora", keywords: ["vegetation", "ground flora", "roots", "surrounding trees", "ground damage", "flora", "rare plants", "protect rare plants"] },
        { label: "Ground conditions — minimise soil compaction and rutting", keywords: ["soil compaction", "rutting", "ground condition", "compaction", "soil damage", "ground damage", "don't ruin the ground", "heavy trucks in mud"] },
        { label: "Weather — high winds, rain, visibility", keywords: ["weather", "wind", "high wind", "rain", "visibility", "weather conditions", "noise near houses", "too much noise", "noise near people"] },
        { label: "Follow rules and regulations about when and what to cut", keywords: ["rules", "regulations", "allowed to cut", "permission", "felling licence", "follow the rules", "follow rules about when allowed to cut"] },
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
        { label: "On the upper / top side of the timber (for a supported log)", keywords: ["top", "upper", "above", "top side", "upper side", "on top", "compression is on top", "squashed on top", "squashed together on top", "top is being squashed"] },
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
        { label: "On the underside / bottom of the timber (for a cantilevered or hanging log)", keywords: ["bottom", "underside", "below", "under", "lower side", "underneath", "compression underneath", "squashed on the bottom", "bottom is being squashed", "bottom is squashed"] },
      ],
    }],
  },

  {
    id: 63,
    question: "What are you going to do if you get your saw stuck or pinched?",
    prompts: [{
      prompt: "What are you going to do if you get your saw stuck, or pinched?",
      threshold: 3,
      keyPoints: [
        { label: "Do not force the saw — switch it off", keywords: ["do not force", "switch off", "turn off", "don't force", "stop the saw", "kill switch", "turn the chainsaw off immediately", "first turn it off", "switch it off immediately"] },
        { label: "Use a felling wedge or bar to open the cut", keywords: ["wedge", "felling wedge", "bar", "lever", "open the cut", "use a wedge", "hammer a plastic wedge", "plastic wedge", "use a strong stick as a lever", "lift the wood"] },
        { label: "Assess the tension before attempting to free the saw", keywords: ["assess tension", "check tension", "tension", "assess", "identify tension", "before freeing", "read the tension in the wood"] },
        { label: "Never leave the saw running unattended in the timber", keywords: ["never leave running", "do not leave running", "unattended", "not leave", "saw running in wood", "never try to cut saw out while still running"] },
        { label: "Beware of log rolling or moving when freed", keywords: ["log rolling", "rolling onto you", "careful log doesn't roll", "when it comes free", "log roll", "timber moving", "log moves"] },
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
        { label: "Cut from one side then reposition and cut from the opposite side to meet in the middle", keywords: ["one side", "opposite side", "cut from both sides", "reposition", "both sides", "meet in middle", "first cut down from one side", "then walk around", "walk around to other side", "cut from both sides"] },
        { label: "Ensure the two cuts align — use a straight edge or score the timber first", keywords: ["align", "score", "mark", "straight edge", "guide", "ensure cuts meet", "line saw up with first cut", "line up carefully"] },
        { label: "Or use a bore cut to plunge through the timber", keywords: ["bore cut", "bore cutting", "plunge cut", "push the tip straight through", "bore cut technique", "bore through"] },
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
        { label: "Identify compression and tension zones before cutting", keywords: ["identify compression", "identify tension", "compression zone", "tension zone", "assess before cutting", "high tension means wood bent like bow"] },
        { label: "Overbuck from the top (compression side) or underbuck from below (tension side) as appropriate", keywords: ["overbuck", "underbuck", "top cut", "undercut", "cut from above", "cut from below", "shallow cut on compression side first", "relief cut on squashed side", "main cut from tension side"] },
        { label: "Make a relief cut first to release tension", keywords: ["relief cut", "release tension", "relieve tension", "first cut", "relief notch", "small shallow cut first", "small cut first"] },
        { label: "Be prepared for sudden movement of the timber", keywords: ["sudden movement", "timber movement", "movement", "snap", "jump", "spring back", "move suddenly", "stand well back", "be ready to move quickly", "wood snaps suddenly"] },
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
        { label: "Timber diameter is larger than the guidebar — cannot cut through in one pass", keywords: ["larger than", "bigger than", "longer bar", "too large", "diameter larger", "can't cut through", "one pass", "timber too big for bar", "log bigger than guidebar"] },
        { label: "Timber under tension — to prevent the bar being pinched or trapped", keywords: ["tension", "pinch", "trapped", "under tension", "prevent pinch", "stop bar getting trapped", "avoid trapping", "heavy tension", "stop wood from splitting wildly", "barber-chairing"] },
        { label: "Working in confined space — to avoid the kickback zone at the nose", keywords: ["confined", "tight space", "kickback zone", "nose", "tip of bar", "restricted", "nose kickback", "avoid kickback at nose", "confined space"] },
      ],
    }],
  },

  {
    id: 67,
    question: "Once you've cut your timber, how are you going to move it safely?",
    prompts: [{
      prompt: "Once you've cut your timber, how are you going to move it safely?",
      threshold: 2,
      keyPoints: [
        { label: "Use appropriate tools — cant hook, timber jack, or cant dog", keywords: ["cant hook", "timber jack", "cant dog", "peavey", "mechanical aid", "log moving tool", "timber tongs", "log hook", "special tools"] },
        { label: "Assess the weight — team lift if too heavy, correct manual handling posture", keywords: ["assess weight", "team lift", "manual handling", "correct posture", "back straight", "not too heavy", "think before you lift", "don't just grab it", "ask a friend to help", "bend your knees"] },
        { label: "Clear a safe path before moving timber", keywords: ["clear path", "safe path", "clear before moving", "clear a path to walk", "clear safe path", "look before carrying"] },
        { label: "Wear gloves to protect from splinters", keywords: ["gloves", "wear gloves", "tough gloves", "protect from splinters", "chainsaw gloves"] },
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
        { label: "Use the correct tools and mechanical aids to reduce manual effort", keywords: ["correct tools", "mechanical aid", "cant hook", "reduce manual", "use equipment", "right tool", "use special tools"] },
        { label: "Plan your movements — minimise unnecessary handling and twisting", keywords: ["plan movements", "minimise handling", "avoid twisting", "plan", "unnecessary lifting", "minimise", "don't twist your back", "turn your feet instead of twisting spine", "keep back straight"] },
        { label: "Take regular breaks to avoid fatigue", keywords: ["take breaks", "regular break", "rest", "avoid fatigue", "fatigue", "rest period", "stretch muscles", "listen to your body"] },
        { label: "Keep the load close to your body and use your legs", keywords: ["close to body", "use your legs", "leg muscles", "bend knees", "knees bent", "legs do the work", "let strong leg muscles do the work"] },
      ],
    }],
  },

  {
    id: 69,
    question: "How are you going to make sure your timber stacks are stable?",
    prompts: [{
      prompt: "How are you going to make sure your timber stacks are stable?",
      threshold: 2,
      keyPoints: [
        { label: "Use stacking stakes / binders — secure the stack", keywords: ["stacking stake", "binder", "stake", "secure stack", "binding", "stacking binder", "cross the logs over each other at corners", "interlock", "lock them in"] },
        { label: "Stack on firm, level ground", keywords: ["firm ground", "level ground", "flat ground", "stable ground", "solid base", "build stack on flat level ground", "level flat ground"] },
        { label: "Do not stack too high — keep within a safe and manageable height", keywords: ["not too high", "safe height", "manageable height", "height limit", "stack height", "don't stack too high", "might fall over", "fall over"] },
        { label: "Use bearers at the base and heaviest logs at the bottom", keywords: ["bearers", "base", "bearer", "base logs", "strong straight logs at bottom", "heaviest logs at bottom", "big heavy logs at bottom"] },
        { label: "Lean the stack slightly inwards and ensure it won't roll", keywords: ["leans inward", "lean inwards", "inwards not outwards", "won't roll away", "won't roll", "slightly inwards", "stable lean"] },
      ],
    }],
  },

  {
    id: 70,
    question: "What else do you need to think about when stacking lots of different timber?",
    prompts: [{
      prompt: "What else do you need to think about when stacking lots of different timber?",
      threshold: 3,
      keyPoints: [
        { label: "Sort and stack by species / length / size for ease of identification", keywords: ["sort", "species", "length", "size", "identification", "same length", "group by", "sort logs by size", "separate different types", "sort by size so they stack neatly"] },
        { label: "Bio-security — do not mix potentially infected species or sites", keywords: ["bio-security", "biosecurity", "infected", "mix species", "different sites", "disease spread"] },
        { label: "Access for machinery — leave sufficient space for vehicles or equipment", keywords: ["access", "machinery", "vehicle", "space", "room for", "equipment access", "forwarder", "don't block any gates or roads", "think about how to get wood out again", "getting wood out again"] },
        { label: "Stability considerations — heavier or longer pieces at the base", keywords: ["stability", "heavy at bottom", "base", "heavier", "longer at base", "stable stack", "heavy thick logs at bottom", "smaller lighter branches on top"] },
        { label: "Leave gaps for airflow — allows timber to dry", keywords: ["gaps", "airflow", "dry out", "ventilation", "leave gaps", "air to blow through", "gaps for air", "wood dries out"] },
        { label: "Cover the top to protect from rain", keywords: ["cover", "rain", "cover top", "protect from rain", "cover the top to keep rain off", "protect from weather"] },
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
        { label: "Check fuel level and bar oil level", keywords: ["fuel", "fuel level", "oil level", "bar oil", "check fuel", "check oil", "enough gas and chain oil", "fuel and oil in the tanks"] },
        { label: "Check bar and chain condition — tension, sharpness, lubrication", keywords: ["bar", "chain", "tension", "sharp", "lubrication", "bar condition", "chain condition", "chain tension", "chain is tightened correctly", "check chain tension"] },
        { label: "Check all nuts and bolts are tight", keywords: ["nuts", "bolts", "tight", "secure", "fixings", "tighten", "not loose", "loose screws", "check for loose screws", "everything tight"] },
        { label: "Check all safety features are present and working — chain brake, guards", keywords: ["safety features", "chain brake", "guards", "present", "working", "functional", "chain brake handle clicks", "chain brake clicks forward"] },
        { label: "Check PPE is correct and in good condition", keywords: ["ppe", "personal protective", "chainsaw trousers", "helmet", "visor", "gloves", "boots", "protective equipment", "wearing all your safety clothes"] },
        { label: "Check the area is clear of hazards and bystanders", keywords: ["area clear", "exclusion zone", "bystander", "hazard free", "clear area", "people clear", "site clear", "look around to make sure area is safe", "no one standing too close"] },
        { label: "Check the air filter is clean", keywords: ["air filter clean", "filter clean", "clean air filter", "air filter check", "filter checked"] },
      ],
    }],
  },

  {
    id: 72,
    question: "What functional checks do you need to perform before you actually use your saw?",
    prompts: [{
      prompt: "What functional checks do you need to perform before you actually use your saw?",
      threshold: 4,
      keyPoints: [
        { label: "Start the saw and test the chain brake — manual activation and inertia", keywords: ["start the saw", "test chain brake", "chain brake", "manual", "inertia", "test brake", "push chain brake forward", "gently rev engine with brake on", "chain must not move"] },
        { label: "Check the chain does not move at idle speed", keywords: ["idle", "chain doesn't move", "chain not move", "idle speed", "chain at idle", "not moving at idle", "idles nicely without chain moving", "chain still at idle"] },
        { label: "Test the throttle trigger lockout", keywords: ["throttle lockout", "trigger lockout", "throttle trigger", "lockout", "trigger test", "press safety trigger lock", "can't press gas without it", "safety trigger check"] },
        { label: "Check the chain oiler is working — bar oil reaching the chain", keywords: ["chain oiler", "oiler", "oil reaching", "bar oil", "oil flow", "oiling system", "oil throwing", "hold over clean wood and rev to see oil spray", "oil spray off chain", "oil sprays off"] },
        { label: "Check the anti-vibration system is functioning", keywords: ["anti-vibration", "vibration", "av system", "vibration system", "anti vibration", "vibration check"] },
        { label: "Check the stop switch turns the engine off instantly", keywords: ["stop switch", "kill switch", "turns engine off instantly", "engine off instantly", "check stop switch", "switch off test"] },
        { label: "Check for unusual noises or rattles", keywords: ["unusual noise", "strange noise", "rattle", "rattling", "strange rattling", "funny noise", "no strange noises"] },
        { label: "Perform a test cut to ensure everything feels correct", keywords: ["test cut", "tiny test cut", "try a cut", "test cut feels right", "test cut in wood", "small test cut"] },
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

  // ── NEW QUESTIONS ─────────────────────────────────────────────────────────────

  {
    id: 76,
    question: "What bit of the bar do you need to avoid cutting with?",
    prompts: [{
      prompt: "What bit of the bar do you need to avoid cutting with?",
      threshold: 1,
      keyPoints: [
        { label: "Upper quadrant / nose of the bar — the kickback danger zone", keywords: ["upper quadrant", "top quarter", "nose", "tip", "kickback zone", "upper part of tip", "danger zone", "top of the bar nose", "upper nose", "bar nose", "avoid the tip", "rounded tip", "the tip of the bar", "kickback danger zone", "upper part of the rounded tip", "upper part of the tip", "top of the nose", "top of the rounded tip", "nose contact"] },
      ],
    }],
  },

  {
    id: 77,
    question: "What PPE do you need when using and operating a chainsaw?",
    prompts: [{
      prompt: "What PPE do you need when using and operating a chainsaw?",
      threshold: 6,
      keyPoints: [
        { label: "Safety helmet / hard hat — head protection from falling branches", keywords: ["helmet", "hard hat", "safety helmet", "head protection", "chainsaw helmet", "forestry helmet", "strong safety helmet", "head from falling branches", "helmet to protect head"] },
        { label: "Ear defenders or earplugs — hearing protection", keywords: ["ear defenders", "earplugs", "hearing protection", "ear protection", "ear muffs", "earmuffs", "ear defenders or earplugs", "stop the loud noise", "protect hearing"] },
        { label: "Safety glasses or visor / mesh visor — eye protection", keywords: ["safety glasses", "visor", "mesh visor", "face shield", "eye protection", "goggles", "face protection", "safety glasses or mesh visor", "stop wood chips hitting eyes"] },
        { label: "Chainsaw trousers / chaps — leg protection with cut-resistant fibres", keywords: ["chainsaw trousers", "chainsaw pants", "protective trousers", "leg protection", "cut-resistant trousers", "kevlar trousers", "chainsaw chaps", "special trousers with fibres", "fibres to jam the saw", "special chainsaw trousers"] },
        { label: "Chainsaw boots — foot protection with steel toecap and ankle protection", keywords: ["chainsaw boots", "safety boots", "steel toe boots", "protective boots", "chainsaw footwear", "tough chainsaw boots", "steel toes and good grip", "steel toe caps", "foot protection"] },
        { label: "Chainsaw gloves — hand and wrist protection", keywords: ["gloves", "chainsaw gloves", "hand protection", "protective gloves", "strong gloves", "extra protection on left hand", "gloves with protection"] },
        { label: "Hi-visibility clothing — so others can see you", keywords: ["hi-vis", "high visibility", "bright clothing", "fluorescent", "visible", "hi vis jacket", "bright colors", "wear bright colors", "can be seen in the woods"] },
        { label: "Helmet with visor and ear defenders combined", keywords: ["combined helmet", "helmet with visor", "helmet visor and ear", "all in one helmet", "forestry helmet with visor", "combined protection"] },
      ],
    }],
  },

];
