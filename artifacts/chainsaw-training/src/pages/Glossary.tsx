import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, BookOpen } from "lucide-react";

const TERMS: { term: string; definition: string; category: string }[] = [
  // A
  { term: "AFAG", definition: "Arboriculture and Forestry Advisory Group — the joint HSE/industry body that produces the numbered guidance sheets (e.g. AFAG 301, AFAG 804) covering safe working practices in arboricultural and forestry operations.", category: "Legislation & Standards" },
  { term: "Anti-kickback chain", definition: "A chain design incorporating safety features (such as a guard link or tie strap) that reduce the energy transferred to the bar during a kickback event, thereby reducing the severity of any resultant injury.", category: "Chain & Bar" },
  { term: "Anti-vibration system (AV)", definition: "A system of springs or rubber buffers mounted between the engine/powerhead and the handles that dampens the vibration transmitted to the operator's hands and arms, reducing the risk of Hand-Arm Vibration Syndrome (HAVS).", category: "Chainsaw Components" },
  { term: "Arboricultural Association (AA)", definition: "The UK trade association representing arborists and tree surgeons. Provides training, guidance, and a register of approved contractors.", category: "Industry Bodies" },
  { term: "Assessment criteria", definition: "The specific standards against which a learner's knowledge or competence is measured. In this course, assessment criteria are mapped to NPTC 0039-20 unit parameters for theoretical reference.", category: "Training & Assessment" },

  // B
  { term: "Bar (guidebar)", definition: "The elongated metal plate around which the chain rotates. Also called the guide bar or sword. Available in various lengths; bar length is measured from the front of the housing to the tip.", category: "Chain & Bar" },
  { term: "Bar nose", definition: "The rounded tip of the guide bar around which the chain travels. The nose is the highest-risk zone for kickback — contact with an object at the nose can cause the bar to kick back violently towards the operator.", category: "Chain & Bar" },
  { term: "Biosecurity", definition: "Measures taken to prevent the introduction and spread of harmful organisms (pests, diseases, or invasive species) into woodlands or other environments. Relevant to chainsaw operators who move between sites and may inadvertently transfer material.", category: "Environment & Site" },
  { term: "Bore cut", definition: "A cutting technique in which the nose of the bar is plunged directly into the timber to begin a cut from the inside. Requires advanced skill and increases kickback risk; operators must be trained and competent before attempting.", category: "Cutting Techniques" },
  { term: "Brash", definition: "The small branches, twigs, and foliage left behind after felling or pruning operations. Brash creates a trip hazard and can obscure the ground; it should be progressively cleared from the working area.", category: "Environment & Site" },
  { term: "Bucking", definition: "The process of cross-cutting a felled tree into logs. Involves assessing and managing tension and compression in the timber to prevent the chain from being pinched.", category: "Cutting Techniques" },

  // C
  { term: "Catchers (chain catchers)", definition: "A safety feature fitted to the chainsaw body, usually a metal finger or hook below the bar, designed to catch the chain if it breaks or derails during operation, reducing the risk of chain-strike injury to the operator's leg.", category: "Chainsaw Components" },
  { term: "Chain brake", definition: "A critical safety feature that stops the chain rotating within a fraction of a second. Can be activated manually (by the operator's wrist pushing the front hand guard forward) or inertially (by a sensor responding to rapid bar rotation during kickback).", category: "Chainsaw Components" },
  { term: "Chain pitch", definition: "The distance between any three consecutive rivets on the chain divided by two. Common pitches are 1/4\", 3/8\", .325\", and 3/8\" low-profile. The chain pitch must match the drive sprocket and guide bar.", category: "Chain & Bar" },
  { term: "Chain gauge", definition: "The thickness of the drive links that fit into the bar groove. Common gauges are .043\" (1.1mm), .050\" (1.3mm), .058\" (1.5mm), and .063\" (1.6mm). Chain, bar, and sprocket gauge must all match.", category: "Chain & Bar" },
  { term: "Chain tension", definition: "The correct degree of tightness of the chain on the bar. A correctly tensioned chain should pull away from the bar slightly when lifted at the mid-point but not be so loose that it sags or derails. Chain tension must be checked regularly during use.", category: "Maintenance" },
  { term: "Chaps (chainsaw chaps)", definition: "Personal protective equipment worn over the legs, constructed with layers of cut-resistant fibres (typically Kevlar or similar) that clog the chainsaw chain in the event of contact, stopping it before it reaches the skin. A legal requirement for professional chainsaw use.", category: "PPE" },
  { term: "Clutch", definition: "A centrifugal mechanism that automatically engages the chain sprocket when the engine reaches a certain RPM and disengages (stopping the chain) when the engine returns to idle. This means the chain should not rotate at tick-over.", category: "Chainsaw Components" },
  { term: "Competent person", definition: "In the context of chainsaw use under PUWER 1998, a person with sufficient training, practical experience, and knowledge to enable them to carry out their assigned tasks correctly and safely, and to identify and manage associated risks.", category: "Legislation & Standards" },
  { term: "Compression", definition: "A timber-cutting condition where the kerf (saw cut) closes in on the chain as the cut progresses, caused by the weight or tension of the timber acting above the cut. Compressed timber will pinch and trap the chain. The operator must recognise and manage compression before cutting.", category: "Cutting Techniques" },
  { term: "Control measures", definition: "The actions, equipment, training, or procedures put in place to reduce identified risks to an acceptable level. Control measures are identified as part of a risk assessment and form the basis of a safe system of work.", category: "Risk Management" },
  { term: "COSHH", definition: "Control of Substances Hazardous to Health Regulations 2002. Requires employers to assess and control the risks from hazardous substances. In chainsaw operations, relevant substances include bar oil, fuel/oil mix, exhaust fumes, and biological hazards such as pollen from certain tree species.", category: "Legislation & Standards" },
  { term: "CPD (Continuing Professional Development)", definition: "The ongoing process of tracking and developing the skills, knowledge, and experience gained as a professional, beyond initial qualification. This course awards 5 Verifiable CPD Points upon completion.", category: "Training & Assessment" },
  { term: "Cross-cutting", definition: "Cutting across the grain of the wood — typically cutting a trunk or branch perpendicular to its length. The most common chainsaw operation; requires understanding of tension and compression in the timber.", category: "Cutting Techniques" },

  // D
  { term: "Dead-man's throttle", definition: "A safety interlock incorporated into most professional chainsaws whereby the throttle trigger can only be depressed when the throttle lockout (interlock button on the rear handle) is simultaneously depressed. This prevents accidental acceleration.", category: "Chainsaw Components" },
  { term: "Decompression valve", definition: "A button or valve fitted to many chainsaw engines that releases cylinder compression, making the engine easier to pull-start. It closes automatically once the engine fires.", category: "Chainsaw Components" },
  { term: "Drive links", definition: "The lower part of each chain link that fits into the bar groove and is driven by the teeth of the sprocket. Drive link count is a key identifier when selecting replacement chain.", category: "Chain & Bar" },
  { term: "Dynamic risk assessment", definition: "An ongoing, real-time assessment of changing hazards and risks on a work site. Unlike a formal written risk assessment (which is completed in advance), a dynamic risk assessment is the continuous mental process of identifying new hazards as work progresses and adjusting the safe system of work accordingly.", category: "Risk Management" },

  // E
  { term: "Emergency action plan", definition: "A pre-prepared plan that sets out the actions to be taken in the event of an accident or emergency on site, including emergency contact numbers, location details, nearest hospital, and first-aid provisions. Must be prepared before starting work.", category: "Risk Management" },
  { term: "Escape route", definition: "A pre-planned path of retreat that the chainsaw operator will use to move safely away from a felling tree or timber movement. Escape routes should be cleared of obstacles before cutting begins and should be positioned at approximately 45° to the rear of the direction of fall.", category: "Environment & Site" },

  // F
  { term: "Felling", definition: "The act of cutting down a standing tree. Requires advanced planning including assessment of the lean, weight distribution, wind, and the presence of decay or structural defects. Covered by AFAG 702.", category: "Cutting Techniques" },
  { term: "File size", definition: "The diameter of the round file used to sharpen chainsaw chain cutters. File size is determined by chain pitch. Using the incorrect file size will produce incorrectly shaped cutters and accelerated chain wear.", category: "Maintenance" },
  { term: "Front hand guard", definition: "The curved guard positioned in front of the operator's left hand on the front handle. Acts as the manual activator of the chain brake when the operator's wrist contacts it during a kickback event.", category: "Chainsaw Components" },
  { term: "Fuel/oil mix (two-stroke mix)", definition: "The mixture of unleaded petrol and two-stroke engine oil required by conventional petrol chainsaw engines. Mix ratios are specified by the manufacturer (typically 50:1). Using the wrong ratio or straight petrol will destroy the engine.", category: "Maintenance" },

  // G
  { term: "Gauge (chain gauge)", definition: "See Chain gauge.", category: "Chain & Bar" },
  { term: "GLH (Guided Learning Hours)", definition: "The estimated number of hours a typical learner requires to complete the training activities in a course, excluding independent study. This course is rated at 16 GLH for the technical content, plus 1.5 GLH for directed online assessment.", category: "Training & Assessment" },

  // H
  { term: "HAVS (Hand-Arm Vibration Syndrome)", definition: "A permanent, disabling condition caused by prolonged exposure to vibration transmitted through the hands and arms. Symptoms include numbness, tingling, pain, and blanching (whitening) of the fingers. Governed by the Control of Vibration at Work Regulations 2005.", category: "Health & Safety" },
  { term: "Hazard", definition: "Anything that has the potential to cause harm. In chainsaw operations, hazards include the rotating chain, kickback, falling timber, uneven ground, noise, vibration, exhaust fumes, and biological agents.", category: "Risk Management" },
  { term: "HSE (Health and Safety Executive)", definition: "The UK's national regulator for workplace health, safety, and welfare. Produces statutory codes of practice, guidance documents (including the AFAG series), and enforces health and safety legislation.", category: "Legislation & Standards" },
  { term: "HSE INDG317", definition: "HSE leaflet 'Chainsaws at work' — a free guide that introduces the key legal requirements for safe chainsaw use in the workplace, including the requirement for operators to be trained and competent.", category: "Legislation & Standards" },

  // I
  { term: "IIRSM", definition: "International Institute of Risk and Safety Management. An independent educational charity established in 1975, dedicated to advancing standards in risk, health, and safety management. This course is submitted for IIRSM eLearning Course Approval.", category: "Industry Bodies" },
  { term: "Inertia brake", definition: "A chain brake activation mechanism that responds to the sudden rotational deceleration of the bar during a kickback event, using a weighted flyweight mechanism to engage the brake independently of any hand or arm contact.", category: "Chainsaw Components" },
  { term: "Inspection checklist (pre-start)", definition: "A systematic check of the chainsaw and associated equipment carried out before starting work each day (pre-start) and before beginning each cutting session (pre-use). Covers all safety-critical components including the chain brake, bar, chain, fuel/oil, and PPE.", category: "Maintenance" },

  // K
  { term: "Kerf", definition: "The slot or groove cut by the chainsaw chain as it passes through the wood. The width of the kerf equals the cutting width of the chain (determined by the gauge and cutter profile).", category: "Cutting Techniques" },
  { term: "Kickback", definition: "A sudden, violent rotational movement of the chainsaw bar upward and toward the operator, caused by contact between an object and the nose of the bar. One of the most dangerous chainsaw hazards; chain brakes and anti-kickback features are specifically designed to mitigate this risk.", category: "Health & Safety" },

  // L
  { term: "LANTRA", definition: "The Sector Skills Council for the environmental and land-based sector in the UK. Oversees vocational qualifications in arboriculture, forestry, horticulture, agriculture, and related disciplines.", category: "Industry Bodies" },
  { term: "Likelihood", definition: "In a risk assessment, an estimate of the probability that a hazardous event will occur. Combined with severity to produce an overall risk rating.", category: "Risk Management" },
  { term: "LOLER", definition: "Lifting Operations and Lifting Equipment Regulations 1998. Applies to lifting operations in arboricultural and forestry contexts, such as the use of aerial work platforms or rigging and lowering systems.", category: "Legislation & Standards" },
  { term: "Lone working", definition: "Working without colleagues or supervision in a location where assistance may not be readily available. Lone working is a significant hazard in chainsaw operations and requires specific emergency planning, including regular check-in procedures.", category: "Health & Safety" },

  // M
  { term: "Manual handling", definition: "Any activity requiring the use of physical force to lift, lower, push, pull, carry, or otherwise move a load. Covered by the Manual Handling Operations Regulations 1992. In chainsaw work, relevant activities include moving felled timber, fuel, and equipment.", category: "Health & Safety" },
  { term: "Mixed fuel", definition: "See Fuel/oil mix.", category: "Maintenance" },

  // N
  { term: "NOS (National Occupational Standards)", definition: "Statements of the standards of performance individuals must achieve in their work, together with specifications of the underpinning knowledge and understanding required. The content of this course is independently mapped to UK NOS for Chainsaw Operations.", category: "Training & Assessment" },
  { term: "NPTC", definition: "National Proficiency Tests Council. The City & Guilds business unit responsible for practical land-based skills qualifications in the UK. Issues the practical chainsaw certificates (NPTC 0039-20) required for professional chainsaw use.", category: "Training & Assessment" },
  { term: "NPTC 0039-20", definition: "The City & Guilds NPTC qualification standard covering Chainsaw Maintenance and Cross Cutting at Ground Level. This is the practical qualification required by UK legislation for professional chainsaw operators. The theoretical content of this course is independently mapped to NPTC 0039-20 unit parameters.", category: "Training & Assessment" },
  { term: "Noise at work", definition: "Exposure to high noise levels is governed by the Control of Noise at Work Regulations 2005. Chainsaws typically produce noise levels of 100–115 dB(A) — well above the Lower Exposure Action Value of 80 dB(A). Hearing protection (minimum SNR 27dB) is mandatory.", category: "Health & Safety" },

  // O
  { term: "Oiling system", definition: "The automatic or manual system that delivers bar and chain oil to the guide bar groove and chain during operation, lubricating the chain and reducing wear. A separate oil reservoir to the fuel tank. Oil flow rate is adjustable on many professional machines.", category: "Chainsaw Components" },
  { term: "OSH (Occupational Safety and Health)", definition: "The multidisciplinary field concerned with the safety, health, and welfare of people at work. Sometimes written as OHS.", category: "Health & Safety" },

  // P
  { term: "Personal Protective Equipment (PPE)", definition: "Clothing or equipment designed to protect the wearer from risk of injury or illness. For chainsaw operators, mandatory PPE includes chainsaw chaps or trousers, chainsaw boots, a forestry helmet with integrated face shield and ear defenders, cut-resistant gloves, and high-visibility vest (where required by site rules).", category: "PPE" },
  { term: "Pitch (chain pitch)", definition: "See Chain pitch.", category: "Chain & Bar" },
  { term: "PUWER", definition: "Provision and Use of Work Equipment Regulations 1998. Requires that work equipment (including chainsaws) is suitable, maintained, and used only by people with adequate training and instruction. Regulation 9 specifically requires adequate training for chainsaw operators.", category: "Legislation & Standards" },
  { term: "PWA (Progressive Web Application)", definition: "A web application that uses modern browser capabilities to deliver an app-like experience, including offline functionality, home screen installation, and push notifications. The chainsawcourses.com platform is delivered as a PWA.", category: "Platform & Technology" },

  // R
  { term: "RIDDOR", definition: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013. Requires employers to report specified workplace injuries, occupational diseases, and dangerous occurrences to the HSE. Chainsaw injuries resulting in over-7-day incapacitation are reportable.", category: "Legislation & Standards" },
  { term: "Risk", definition: "The combination of the likelihood that a hazardous event will occur and the severity of the harm that could result. Risk = Likelihood × Severity.", category: "Risk Management" },
  { term: "Risk assessment", definition: "A systematic process of identifying hazards, evaluating the likelihood and severity of harm, and determining control measures. Under the Management of Health & Safety at Work Regulations 1999, a written risk assessment is required for all significant work activities.", category: "Risk Management" },
  { term: "RoSPA", definition: "Royal Society for the Prevention of Accidents. A UK charity dedicated to accident prevention, offering training, qualifications, and course assurance schemes for health and safety training providers.", category: "Industry Bodies" },

  // S
  { term: "Safe system of work", definition: "A formal procedure that results from a systematic examination of a task, identifies all hazards, and defines safe methods to eliminate or minimise risk. A safe system of work should be in place for all chainsaw operations.", category: "Risk Management" },
  { term: "Severity", definition: "In a risk assessment, an estimate of how serious the harm could be if a hazardous event occurs. Combined with likelihood to produce an overall risk rating.", category: "Risk Management" },
  { term: "Snedding", definition: "The removal of branches from a felled tree. Carried out systematically from the base towards the top of the tree, working on the trunk side of the branch to protect the operator from the branch movement.", category: "Cutting Techniques" },
  { term: "Sprocket (drive sprocket)", definition: "The toothed gear driven by the clutch drum that meshes with the drive links of the chain and drives it around the guide bar. Sprocket pitch must match the chain pitch. Worn sprockets accelerate chain wear and should be replaced with the chain.", category: "Chainsaw Components" },
  { term: "Stanchion", definition: "A stake or prop used to prevent cut rounds of timber from rolling away from the operator after cutting. Particularly important on sloping ground.", category: "Environment & Site" },

  // T
  { term: "Tension (timber tension)", definition: "A timber-cutting condition where the kerf (saw cut) opens as the cut progresses, caused by the timber bending away from the point of cutting. Tensioned timber can cause the chain to snatch and the bar to be thrown. Operators must identify and manage tension before cutting.", category: "Cutting Techniques" },
  { term: "Throttle lockout", definition: "See Dead-man's throttle.", category: "Chainsaw Components" },
  { term: "TQT (Total Qualification Time)", definition: "The total number of hours a typical learner is expected to spend on a qualification, including guided learning, independent study, and assessment. This course has a TQT of 19 hours.", category: "Training & Assessment" },
  { term: "Two-stroke engine", definition: "An internal combustion engine that completes its power cycle in two piston strokes (one revolution of the crankshaft). Used in most conventional petrol chainsaws due to its high power-to-weight ratio. Requires a petrol/oil mix as fuel.", category: "Chainsaw Components" },

  // V
  { term: "Vibration white finger (VWF)", definition: "A specific manifestation of Hand-Arm Vibration Syndrome (HAVS) characterised by blanching (whitening) of the fingers caused by vibration-induced damage to the blood vessels. A permanent and irreversible condition.", category: "Health & Safety" },

  // W
  { term: "Waiver", definition: "A legal document in which a party voluntarily gives up a known right. In the context of this platform, the digital waiver is signed on first login and acknowledges the inherent risks of chainsaw operation and the limitation of the company's liability.", category: "Training & Assessment" },
  { term: "Watermark", definition: "A visible overlay applied to the course video content displaying the learner's name and email address. The watermark repositions every 60 seconds and is designed to deter sharing of video recordings.", category: "Platform & Technology" },
  { term: "WCAG 2.1 AA", definition: "Web Content Accessibility Guidelines version 2.1, Level AA. The internationally recognised standard for web accessibility. The chainsawcourses.com platform is designed to meet WCAG 2.1 AA requirements, ensuring it is usable by people with a range of disabilities.", category: "Platform & Technology" },
];

const CATEGORIES = Array.from(new Set(TERMS.map((t) => t.category))).sort();
const LETTERS = Array.from(new Set(TERMS.map((t) => t.term[0].toUpperCase()))).sort();

export default function Glossary() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TERMS.filter((t) => {
      const matchesSearch = !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q);
      const matchesCat = !activeCategory || t.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof TERMS>();
    filtered.forEach((t) => {
      const letter = t.term[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(t);
    });
    return map;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/training">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-mono font-black uppercase tracking-widest text-sm">Glossary of Terms</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Intro */}
        <div className="border-l-2 border-primary pl-4">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            A comprehensive reference glossary of chainsaw, arboricultural, health & safety, and training terms used throughout this course. Search by keyword or filter by category.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search terms or definitions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 font-mono text-xs h-9"
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
              !activeCategory ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="font-mono text-[10px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "term" : "terms"} {query || activeCategory ? "found" : "in glossary"}
        </p>

        {/* Terms grouped by letter */}
        {grouped.size === 0 ? (
          <p className="font-mono text-xs text-muted-foreground text-center py-10">No terms match your search.</p>
        ) : (
          Array.from(grouped.entries()).map(([letter, terms]) => (
            <div key={letter}>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-black text-2xl text-primary/30">{letter}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-1.5">
                {terms.map((t) => (
                  <Card key={t.term} className="border-border bg-card/50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono font-bold text-xs uppercase tracking-wide text-foreground">{t.term}</span>
                            <Badge variant="outline" className="font-mono text-[9px] rounded-none py-0 px-1 text-muted-foreground border-muted-foreground/30 shrink-0">
                              {t.category}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{t.definition}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="pt-4 border-t border-border">
          <p className="font-mono text-[9px] text-muted-foreground text-center">
            Glossary compiled with reference to HSE AFAG guidance, NPTC 0039-20 unit specifications, the Overleaf Chainsaw Manual, and current UK health & safety legislation. © 2026 Overleaf Publishers Ltd.
          </p>
        </div>
      </main>
    </div>
  );
}
