import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, BookOpen } from "lucide-react";

const TERMS: { term: string; definition: string; category: string }[] = [
  // A
  { term: "AFAG", definition: "Arboriculture and Forestry Advisory Group — the joint HSE/industry body that produces the numbered guidance sheets (e.g. AFAG 301, AFAG 804) covering safe working practices in arboricultural and forestry operations.", category: "Legislation & Standards" },
  { term: "Air filter", definition: "A filter element fitted to the air intake of the chainsaw engine that removes dust and debris from incoming air before it enters the carburettor. A blocked or damaged air filter restricts airflow, causing a rich fuel mixture, poor performance, and increased engine wear. Must be cleaned regularly.", category: "Chainsaw Components" },
  { term: "Air-line", definition: "Compressed air used to clean chainsaw components during maintenance, including the air filter housing, cooling fins, and bar groove. Effective at removing sawdust and debris without risk of damage to delicate components.", category: "Maintenance" },
  { term: "Anti-kickback chain", definition: "A chain design incorporating safety features (such as a guard link or tie strap) that reduce the energy transferred to the bar during a kickback event, thereby reducing the severity of any resultant injury.", category: "Chain & Bar" },
  { term: "Anti-vibration system (AV)", definition: "A system of springs or rubber buffers mounted between the engine/powerhead and the handles that dampens the vibration transmitted to the operator's hands and arms, reducing the risk of Hand-Arm Vibration Syndrome (HAVS).", category: "Chainsaw Components" },
  { term: "Arboricultural Association (AA)", definition: "The UK trade association representing arborists and tree surgeons. Provides training, guidance, and a register of approved contractors.", category: "Industry Bodies" },
  { term: "Assessment criteria", definition: "The specific standards against which a learner's knowledge or competence is measured. In this course, assessment criteria are mapped to NPTC 0039-20 unit parameters for theoretical reference.", category: "Training & Assessment" },

  // B
  { term: "Bar (guidebar)", definition: "The elongated metal plate around which the chain rotates. Also called the guide bar. Available in various lengths; bar length is measured from the front of the housing to the tip.", category: "Chain & Bar" },
  { term: "Bar dresser", definition: "A tool used to maintain and straighten the groove of a guide bar. Removes burrs and re-profiles the bar rails to ensure the chain runs straight and the groove depth remains correct. Regular use extends bar life.", category: "Maintenance" },
  { term: "Bar nose", definition: "The rounded tip of the guide bar around which the chain travels. The nose is the highest-risk zone for kickback — contact with an object at the nose can cause the bar to kick back violently towards the operator.", category: "Chain & Bar" },
  { term: "Biosecurity", definition: "Measures taken to prevent the introduction and spread of harmful organisms (pests, diseases, or invasive species) into woodlands or other environments. Relevant to chainsaw operators who move between sites and may inadvertently transfer material.", category: "Environment & Site" },
  { term: "Bluing", definition: "Blue or purple discolouration on metal surfaces caused by excessive heat buildup. On a chainsaw, bluing of the guide bar, cutter teeth, or clutch components indicates overheating due to lack of lubrication, a blunt chain, or excessive load. Blued metal has weakened structural integrity.", category: "Maintenance" },
  { term: "Bore cut", definition: "A cutting technique in which the nose of the bar is plunged directly into the timber to begin a cut from the inside. Requires advanced skill and increases kickback risk; operators must be trained and competent before attempting.", category: "Cutting Techniques" },
  { term: "Box cut", definition: "A cutting technique using two horizontal and two vertical cuts to create a rectangular section in the timber. Used to control the direction of timber movement or to remove a specific section cleanly.", category: "Cutting Techniques" },
  { term: "Brash", definition: "The small branches, twigs, and foliage left behind after felling or pruning operations. Brash creates a trip hazard and can obscure the ground; it should be progressively cleared from the working area.", category: "Environment & Site" },
  { term: "BTC (Bottom Dead Centre)", definition: "The position of the piston when it is at its lowest point in the cylinder, at the end of its downward stroke. One of two reference points (with TDC) used to describe piston position during the two-stroke combustion cycle.", category: "Chainsaw Components" },
  { term: "Butterfly valve", definition: "A rotating disc valve inside the carburettor that controls airflow into the engine, regulating the air-fuel mixture. Opening the butterfly valve increases airflow and raises engine speed.", category: "Chainsaw Components" },

  // C
  { term: "Calipers", definition: "A precision measuring tool used to measure the diameter, thickness, or distance between surfaces on chainsaw components. Used during maintenance to check cutter tooth length, depth gauge height, and chain wear against manufacturer tolerances.", category: "Maintenance" },
  { term: "Carburettor", definition: "The device that mixes fuel and air in the correct ratio for combustion in the engine. Adjusted using the H (high speed), L (low speed), and idle screws. An incorrectly tuned carburettor causes poor starting, chain creep at idle, or engine damage.", category: "Chainsaw Components" },
  { term: "Catchers (chain catchers)", definition: "A safety feature fitted to the chainsaw body, usually a metal finger or hook below the bar, designed to catch the chain if it breaks or derails during operation, reducing the risk of chain-strike injury to the operator's leg.", category: "Chainsaw Components" },
  { term: "CC (Cubic centimetres)", definition: "The unit used to measure engine displacement — the total volume swept by the piston inside the cylinder. A higher CC figure generally indicates a more powerful engine. Typical professional chainsaw engines range from 35cc to 90cc.", category: "Chainsaw Components" },
  { term: "Centrifugal clutch", definition: "A clutch system that automatically engages drive to the chain when engine speed increases above a threshold RPM, and disengages when the engine returns to idle. Prevents the chain from rotating while the saw is idling.", category: "Chainsaw Components" },
  { term: "Centrifugal force", definition: "The outward force experienced by rotating components. In the clutch assembly, centrifugal force causes the clutch shoes (weights) to move outward as engine speed rises, engaging the clutch drum and driving the chain.", category: "Chainsaw Components" },
  { term: "Chain", definition: "The continuous loop of linked cutting teeth driven around the guide bar to cut wood. Consists of drive links, cutter teeth, tie straps, and depth gauges. Must be correctly tensioned, sharp, and lubricated at all times during use.", category: "Chain & Bar" },
  { term: "Chain brake", definition: "A critical safety feature that stops the chain rotating within a fraction of a second. Can be activated manually (by the operator's wrist pushing the front hand guard forward) or inertially (by responding to rapid bar rotation during kickback).", category: "Chainsaw Components" },
  { term: "Chain chart", definition: "A reference chart used to identify the correct chain type and specifications for a given chainsaw model. Typically lists pitch, gauge, drive link count, file size, and top plate filing angle. Available in the appendix of this manual and on the chain identification tool in this course.", category: "Chain & Bar" },
  { term: "Chain creep", definition: "Slow movement of the chain while the engine is idling, caused by an incorrectly adjusted idle speed or carburettor. The chain must not move at idle — chain creep is a hazard and indicates the saw requires adjustment before use.", category: "Chainsaw Components" },
  { term: "Chain gauge", definition: "The thickness of the drive links that fit into the bar groove. Common gauges are .043\" (1.1mm), .050\" (1.3mm), .058\" (1.5mm), and .063\" (1.6mm). Chain, bar, and sprocket gauge must all match.", category: "Chain & Bar" },
  { term: "Chain pitch", definition: "The distance between any three consecutive rivets on the chain divided by two. Common pitches are 1/4\", 3/8\", .325\", and 3/8\" low-profile. The chain pitch must match the drive sprocket and guide bar.", category: "Chain & Bar" },
  { term: "Chain tension", definition: "The correct degree of tightness of the chain on the bar. A correctly tensioned chain should pull away from the bar slightly when lifted at the mid-point but not be so loose that it sags or derails. Chain tension must be checked regularly during use.", category: "Maintenance" },
  { term: "Chaps (chainsaw chaps)", definition: "Personal protective equipment worn over the legs, constructed with layers of cut-resistant fibres (typically Kevlar or similar) that clog the chainsaw chain in the event of contact, stopping it before it reaches the skin. A legal requirement for professional chainsaw use.", category: "PPE" },
  { term: "Choke", definition: "A control that restricts air intake to enrich the fuel mixture during cold starting, making the engine easier to fire. The choke must be turned off once the engine has started; running with the choke on will cause the engine to flood and run excessively rich.", category: "Chainsaw Components" },
  { term: "Clutch", definition: "A centrifugal mechanism that automatically engages the chain sprocket when the engine reaches a certain RPM and disengages (stopping the chain) when the engine returns to idle. This means the chain should not rotate at tick-over.", category: "Chainsaw Components" },
  { term: "Clutch drum", definition: "The rotating drum connected to the sprocket that is driven when the clutch shoes engage. Transfers power from the clutch assembly to the chain. The drum and sprocket should be inspected for wear and replaced together with the chain.", category: "Chainsaw Components" },
  { term: "Clutch shoes (weights)", definition: "The components of the centrifugal clutch that move outward due to centrifugal force as engine speed rises, pressing against the clutch drum to transfer drive to the chain. Also called clutch weights.", category: "Chainsaw Components" },
  { term: "Clutch springs", definition: "The springs that hold the clutch shoes inward at low engine speeds, keeping the clutch disengaged. As engine speed rises, centrifugal force overcomes the spring tension and the shoes move outward to engage the clutch drum.", category: "Chainsaw Components" },
  { term: "Cold start", definition: "The procedure for starting a chainsaw engine that is at ambient temperature. Typically requires the choke to be fully closed and the decompression valve (where fitted) to be depressed before pulling the starter cord.", category: "Maintenance" },
  { term: "Combustion", definition: "The process of burning the air-fuel mixture inside the engine cylinder to produce the power that drives the piston. In a two-stroke engine, combustion occurs once per revolution of the crankshaft.", category: "Chainsaw Components" },
  { term: "Combi spanner", definition: "A combination tool included with most chainsaws, typically combining a box spanner for the bar nuts and a screwdriver blade for adjustments. Used during routine chain tensioning and bar changes.", category: "Maintenance" },
  { term: "Competent person", definition: "In the context of chainsaw use under PUWER 1998, a person with sufficient training, practical experience, and knowledge to enable them to carry out their assigned tasks correctly and safely, and to identify and manage associated risks.", category: "Legislation & Standards" },
  { term: "Compression", definition: "A timber-cutting condition where the kerf (saw cut) closes in on the chain as the cut progresses, caused by the weight or tension of the timber acting above the cut. Compressed timber will pinch and trap the chain. The operator must recognise and manage compression before cutting.", category: "Cutting Techniques" },
  { term: "Control measures", definition: "The actions, equipment, training, or procedures put in place to reduce identified risks to an acceptable level. Control measures are identified as part of a risk assessment and form the basis of a safe system of work.", category: "Risk Management" },
  { term: "COSHH", definition: "Control of Substances Hazardous to Health Regulations 2002. Requires employers to assess and control the risks from hazardous substances. In chainsaw operations, relevant substances include bar oil, fuel/oil mix, exhaust fumes, and biological hazards such as pollen from certain tree species.", category: "Legislation & Standards" },
  { term: "CPD (Continuing Professional Development)", definition: "The ongoing process of tracking and developing the skills, knowledge, and experience gained as a professional, beyond initial qualification. This course awards 5 Verifiable CPD Points upon completion.", category: "Training & Assessment" },
  { term: "Cross-cutting", definition: "Cutting across the grain of the wood — typically cutting a trunk or branch perpendicular to its length. The most common chainsaw operation; requires understanding of tension and compression in the timber.", category: "Cutting Techniques" },
  { term: "Cutter teeth", definition: "The sharp cutting components of the chainsaw chain that remove wood as the chain rotates. Each cutter has a top plate, side plate, and depth gauge. Cutter teeth must be kept sharp and filed to the correct angles to ensure safe, efficient cutting.", category: "Chain & Bar" },
  { term: "Cylinder", definition: "The chamber in the engine where combustion occurs and the piston moves. In a two-stroke chainsaw engine, the cylinder also serves as the pathway for fuel-air mixture intake and exhaust gas expulsion.", category: "Chainsaw Components" },

  // D
  { term: "Dead-man's throttle", definition: "A safety interlock incorporated into most professional chainsaws whereby the throttle trigger can only be depressed when the throttle lockout (interlock button on the rear handle) is simultaneously depressed. This prevents accidental acceleration.", category: "Chainsaw Components" },
  { term: "Debris", definition: "Loose material such as wood chips, dust, or sawdust produced during chainsaw cutting. Debris can obscure the work area, clog the air filter, and create slip or trip hazards. The work area should be regularly cleared.", category: "Environment & Site" },
  { term: "Decompression valve", definition: "A button or valve fitted to many chainsaw engines that releases cylinder compression, making the engine easier to pull-start. It closes automatically once the engine fires.", category: "Chainsaw Components" },
  { term: "De-limbing", definition: "The process of removing branches from a felled tree. Should be carried out systematically, working from the base of the tree towards the top and cutting on the trunk side of each branch to control movement and protect the operator.", category: "Cutting Techniques" },
  { term: "Depth gauge (raker)", definition: "A projection on the chain in front of each cutter tooth that limits the depth of cut by controlling how much timber the cutter can engage. If depth gauges are too high, the chain will not cut efficiently; if too low, the chain will grab and increase kickback risk. Also called a raker.", category: "Chain & Bar" },
  { term: "Diaphragm", definition: "A flexible membrane inside the carburettor that regulates fuel flow in response to engine demand. Diaphragms can harden, crack, or distort with age, causing fuel delivery problems. Replacement is part of a full carburettor service.", category: "Chainsaw Components" },
  { term: "Drive links", definition: "The lower part of each chain link that fits into the bar groove and is driven by the teeth of the sprocket. Drive link count is a key identifier when selecting replacement chain.", category: "Chain & Bar" },
  { term: "Drive shaft", definition: "The shaft that transfers rotational power from the engine crankshaft to the clutch assembly. Must be correctly aligned and lubricated during assembly.", category: "Chainsaw Components" },
  { term: "Dynamic risk assessment", definition: "An ongoing, real-time assessment of changing hazards and risks on a work site. Unlike a formal written risk assessment (which is completed in advance), a dynamic risk assessment is the continuous mental process of identifying new hazards as work progresses and adjusting the safe system of work accordingly.", category: "Risk Management" },

  // E
  { term: "E-clip", definition: "A small, C-shaped retaining clip used to secure rotating components — such as the clutch drum or sprocket — onto a shaft. Must be correctly seated during reassembly; a missing or incorrectly fitted E-clip can cause component separation during operation.", category: "Chainsaw Components" },
  { term: "Electrode", definition: "The part of the spark plug that creates the electrical spark to ignite the air-fuel mixture. Electrode condition (gap, colour, and deposit type) indicates engine health. A brown or tan electrode indicates correct combustion; black indicates running rich or oiling problems.", category: "Chainsaw Components" },
  { term: "Emergency action plan", definition: "A pre-prepared plan that sets out the actions to be taken in the event of an accident or emergency on site, including emergency contact numbers, location details, nearest hospital, and first-aid provisions. Must be prepared before starting work.", category: "Risk Management" },
  { term: "Engine flooding", definition: "A condition where excessive fuel in the cylinder prevents the engine from starting. Caused by operating the choke incorrectly or excessive pulling attempts. Remedied by removing the spark plug, clearing the cylinder, and attempting to restart with the choke off and throttle open.", category: "Maintenance" },
  { term: "Escape route", definition: "A pre-planned path of retreat that the chainsaw operator will use to move safely away from a felling tree or timber movement. Escape routes should be cleared of obstacles before cutting begins and should be positioned at approximately 45° to the rear of the direction of fall.", category: "Environment & Site" },
  { term: "Exhaust / Muffler", definition: "The component that directs exhaust gases away from the engine and reduces noise output. Also houses the spark arrestor. A clogged exhaust restricts gas flow and causes loss of power. The muffler runs at high temperature and must not be touched without allowing it to cool.", category: "Chainsaw Components" },

  // F
  { term: "Feeler gauge", definition: "A precision tool used to measure small gaps, most commonly used to check and set the spark plug electrode gap. An incorrect spark plug gap causes difficult starting, misfiring, or loss of power.", category: "Maintenance" },
  { term: "Felling", definition: "The act of cutting down a standing tree. Requires advanced planning including assessment of the lean, weight distribution, wind, and the presence of decay or structural defects. Covered by AFAG 702.", category: "Cutting Techniques" },
  { term: "Felling lever", definition: "A lever, typically made of plastic or aluminium, used to assist in directing a felled tree and to roll or lift sections of timber. Also used to turn or reposition logs during cross-cutting. Essential kit for solo operators.", category: "Equipment & Tools" },
  { term: "File size", definition: "The diameter of the round file used to sharpen chainsaw chain cutters. File size is determined by chain pitch. Using the incorrect file size will produce incorrectly shaped cutters and accelerated chain wear.", category: "Maintenance" },
  { term: "Fins", definition: "The metal cooling ribs on the outside of the engine cylinder that dissipate heat generated by combustion. Blocked or damaged fins cause overheating. Must be kept clear of sawdust and debris, particularly during extended use.", category: "Chainsaw Components" },
  { term: "Flywheel", definition: "A rotating disc or ring attached to the crankshaft that stores rotational energy and stabilises engine speed between combustion events. Also carries the magnets that generate the ignition current for the spark plug.", category: "Chainsaw Components" },
  { term: "Flywheel puller", definition: "A specialist tool used to remove the flywheel from the crankshaft during engine maintenance. Required because the flywheel is pressed onto a tapered crankshaft and cannot be removed by hand force alone.", category: "Maintenance" },
  { term: "Front hand guard", definition: "The curved guard positioned in front of the operator's left hand on the front handle. Acts as the manual activator of the chain brake when the operator's wrist contacts it during a kickback event.", category: "Chainsaw Components" },
  { term: "Fuel filter", definition: "A filter fitted to the fuel line inside the fuel tank that removes contaminants before fuel reaches the carburettor. A blocked fuel filter causes fuel starvation and loss of power. Should be replaced regularly as part of routine maintenance.", category: "Chainsaw Components" },
  { term: "Fuel tank", definition: "The reservoir that stores the two-stroke fuel-oil mix. Capacity typically ranges from 250ml to 900ml depending on saw model. Should be filled in a well-ventilated area away from ignition sources, and the cap checked for a secure seal before starting.", category: "Chainsaw Components" },
  { term: "Fuel/oil mix (two-stroke mix)", definition: "The mixture of unleaded petrol and two-stroke engine oil required by conventional petrol chainsaw engines. Mix ratios are specified by the manufacturer (typically 50:1). Using the wrong ratio or straight petrol will destroy the engine.", category: "Maintenance" },
  { term: "Full chisel", definition: "A chain cutter type with square, sharp corners on the tooth profile. Provides fast and aggressive cutting in clean timber but dulls quickly in dirty or abrasive conditions. Requires more precise sharpening than semi-chisel.", category: "Chain & Bar" },
  { term: "Full-skip chain", definition: "A chain configuration with drive links between each pair of cutters omitted, resulting in fewer cutters on the chain. Typically used on longer guide bars where the reduced cutter frequency helps maintain cutting efficiency and reduce power requirement.", category: "Chain & Bar" },

  // G
  { term: "Gasket", definition: "A sealing material placed between mating engine components (such as the cylinder and crankcase) to prevent leaks of fuel, oil, or combustion gases. A damaged or incorrectly fitted gasket causes air leaks that disrupt the fuel-air mixture and reduce engine performance.", category: "Chainsaw Components" },
  { term: "Gauge (chain gauge)", definition: "See Chain gauge.", category: "Chain & Bar" },
  { term: "GLH (Guided Learning Hours)", definition: "The estimated number of hours a typical learner requires to complete the training activities in a course, excluding independent study. This course is rated at 16 GLH for the technical content, plus 1.5 GLH for directed online assessment.", category: "Training & Assessment" },
  { term: "Gullet", definition: "The curved recess between the cutting edge and the depth gauge of a cutter tooth. The gullet provides space for sawdust to escape as the tooth cuts. A correctly formed gullet is maintained during sharpening; incorrect filing can distort the gullet shape and reduce cutting efficiency.", category: "Chain & Bar" },

  // H
  { term: "HAVS (Hand-Arm Vibration Syndrome)", definition: "A permanent, disabling condition caused by prolonged exposure to vibration transmitted through the hands and arms. Symptoms include numbness, tingling, pain, and blanching (whitening) of the fingers. Governed by the Control of Vibration at Work Regulations 2005.", category: "Health & Safety" },
  { term: "Hazard", definition: "Anything that has the potential to cause harm. In chainsaw operations, hazards include the rotating chain, kickback, falling timber, uneven ground, noise, vibration, exhaust fumes, and biological agents.", category: "Risk Management" },
  { term: "High screw (H screw)", definition: "The carburettor adjustment screw that controls the fuel mixture delivered at high engine speeds (full throttle). Turning it clockwise leans the mixture; anti-clockwise richens it. Incorrect adjustment at high speed can cause engine seizure.", category: "Chainsaw Components" },
  { term: "HSE (Health and Safety Executive)", definition: "The UK's national regulator for workplace health, safety, and welfare. Produces statutory codes of practice, guidance documents (including the AFAG series), and enforces health and safety legislation.", category: "Legislation & Standards" },
  { term: "HSE INDG317", definition: "HSE leaflet 'Chainsaws at work' — a free guide that introduces the key legal requirements for safe chainsaw use in the workplace, including the requirement for operators to be trained and competent.", category: "Legislation & Standards" },
  { term: "HT lead", definition: "High-tension lead — the wire carrying high-voltage current from the ignition coil to the spark plug. A cracked, damaged, or incorrectly connected HT lead causes misfiring or complete failure to start. Should be inspected as part of routine maintenance.", category: "Chainsaw Components" },

  // I
  { term: "Idle", definition: "The engine speed at which the chainsaw runs when the throttle is fully released. At correct idle speed, the clutch should be disengaged so the chain does not rotate. Idle speed is set using the idle (T) screw on the carburettor.", category: "Chainsaw Components" },
  { term: "Idle screw (T screw)", definition: "The carburettor adjustment screw that sets the engine's tick-over (idle) speed. Turning it clockwise increases idle speed; anti-clockwise reduces it. Must be set so the engine runs reliably without the chain rotating.", category: "Chainsaw Components" },
  { term: "IIRSM", definition: "International Institute of Risk and Safety Management. An independent educational charity established in 1975, dedicated to advancing standards in risk, health, and safety management. This course is submitted for IIRSM eLearning Course Approval.", category: "Industry Bodies" },
  { term: "Inertia brake", definition: "A chain brake activation mechanism that responds to the sudden rotational deceleration of the bar during a kickback event, using a weighted flyweight mechanism to engage the brake independently of any hand or arm contact.", category: "Chainsaw Components" },
  { term: "Inspection checklist (pre-start)", definition: "A systematic check of the chainsaw and associated equipment carried out before starting work each day (pre-start) and before beginning each cutting session (pre-use). Covers all safety-critical components including the chain brake, bar, chain, fuel/oil, and PPE.", category: "Maintenance" },

  // K
  { term: "Kerf", definition: "The slot or groove cut by the chainsaw chain as it passes through the wood. The width of the kerf equals the cutting width of the chain (determined by the gauge and cutter profile).", category: "Cutting Techniques" },
  { term: "Kickback", definition: "A sudden, violent rotational movement of the chainsaw bar upward and toward the operator, caused by contact between an object and the nose of the bar. One of the most dangerous chainsaw hazards; chain brakes and anti-kickback features are specifically designed to mitigate this risk.", category: "Health & Safety" },

  // L
  { term: "LANTRA", definition: "The Sector Skills Council for the environmental and land-based sector in the UK. Oversees vocational qualifications in arboriculture, forestry, horticulture, agriculture, and related disciplines.", category: "Industry Bodies" },
  { term: "Likelihood", definition: "In a risk assessment, an estimate of the probability that a hazardous event will occur. Combined with severity to produce an overall risk rating.", category: "Risk Management" },
  { term: "Limbs / Branches", definition: "Secondary growth extending from the main stem (trunk) of a tree. When de-limbing a felled tree, each limb must be assessed individually for tension and compression before cutting, and the operator must be positioned to avoid being struck by the limb as it falls.", category: "Environment & Site" },
  { term: "LOLER", definition: "Lifting Operations and Lifting Equipment Regulations 1998. Applies to lifting operations in arboricultural and forestry contexts, such as the use of aerial work platforms or rigging and lowering systems.", category: "Legislation & Standards" },
  { term: "Lone working", definition: "Working without colleagues or supervision in a location where assistance may not be readily available. Lone working is a significant hazard in chainsaw operations and requires specific emergency planning, including regular check-in procedures.", category: "Health & Safety" },
  { term: "Long log", definition: "A large section of timber cut from a stem that is still attached to the root plate. Long logs present specific hazards during cutting due to the complex tension and compression forces acting along their length.", category: "Environment & Site" },
  { term: "Low screw (L screw)", definition: "The carburettor adjustment screw that controls fuel mixture at low engine speeds (tick-over and acceleration). Incorrect low-speed adjustment causes poor acceleration, stalling, or chain creep at idle.", category: "Chainsaw Components" },

  // M
  { term: "Manual handling", definition: "Any activity requiring the use of physical force to lift, lower, push, pull, carry, or otherwise move a load. Covered by the Manual Handling Operations Regulations 1992. In chainsaw work, relevant activities include moving felled timber, fuel, and equipment.", category: "Health & Safety" },
  { term: "Mixed fuel", definition: "See Fuel/oil mix.", category: "Maintenance" },

  // N
  { term: "Needle bearing", definition: "A type of roller bearing using thin cylindrical rollers (needles) that allow smooth rotation with minimal friction. Used in the clutch assembly and small-end of the connecting rod. Failure of needle bearings causes increased friction, noise, and eventual seizure.", category: "Chainsaw Components" },
  { term: "Needle valve", definition: "A carburettor component that controls fuel flow into the fuel chamber. Operates in conjunction with the diaphragm to maintain correct fuel delivery under varying engine loads.", category: "Chainsaw Components" },
  { term: "NOS (National Occupational Standards)", definition: "Statements of the standards of performance individuals must achieve in their work, together with specifications of the underpinning knowledge and understanding required. The content of this course is independently mapped to UK NOS for Chainsaw Operations.", category: "Training & Assessment" },
  { term: "Noise at work", definition: "Exposure to high noise levels is governed by the Control of Noise at Work Regulations 2005. Chainsaws typically produce noise levels of 100–115 dB(A) — well above the Lower Exposure Action Value of 80 dB(A). Hearing protection (minimum SNR 27dB) is mandatory.", category: "Health & Safety" },
  { term: "Nose sprocket", definition: "A small sprocket fitted at the tip of some guide bars to assist chain movement around the nose and reduce friction and heat buildup. Nose sprockets must be greased regularly through the lubrication point on the bar nose.", category: "Chainsaw Components" },
  { term: "NPTC", definition: "National Proficiency Tests Council. The City & Guilds business unit responsible for practical land-based skills qualifications in the UK. Issues the practical chainsaw certificates (NPTC 0039-20) required for professional chainsaw use.", category: "Training & Assessment" },
  { term: "NPTC 0039-20", definition: "The City & Guilds NPTC qualification standard covering Chainsaw Maintenance and Cross Cutting at Ground Level. This is the practical qualification required by UK legislation for professional chainsaw operators. The theoretical content of this course is independently mapped to NPTC 0039-20 unit parameters.", category: "Training & Assessment" },

  // O
  { term: "Oil filter", definition: "A filter that removes debris from the bar and chain oil before it reaches the oil pump. A blocked oil filter reduces oil flow to the chain, accelerating wear on the bar and chain.", category: "Chainsaw Components" },
  { term: "Oil pump", definition: "The mechanism that delivers bar and chain lubricating oil from the oil tank to the guide bar groove and chain during operation. Most modern chainsaws have an adjustable automatic oil pump. Insufficient oil delivery causes rapid bar and chain wear and overheating.", category: "Chainsaw Components" },
  { term: "Oil tank", definition: "The reservoir that stores bar and chain lubricating oil, separate from the fuel tank. Should be filled at the same time as the fuel tank so that both run out at similar rates. Capacity is typically slightly less than the fuel tank.", category: "Chainsaw Components" },
  { term: "Oiling system", definition: "The automatic or manual system that delivers bar and chain oil to the guide bar groove and chain during operation, lubricating the chain and reducing wear. A separate oil reservoir to the fuel tank. Oil flow rate is adjustable on many professional machines.", category: "Chainsaw Components" },
  { term: "OSH (Occupational Safety and Health)", definition: "The multidisciplinary field concerned with the safety, health, and welfare of people at work. Sometimes written as OHS.", category: "Health & Safety" },

  // P
  { term: "Pawl", definition: "A component of the recoil starter mechanism that engages with the flywheel during starting, transferring the pulling force to rotate the engine. The pawl disengages automatically once the engine fires and the flywheel exceeds pull-cord speed.", category: "Chainsaw Components" },
  { term: "Personal Protective Equipment (PPE)", definition: "Clothing or equipment designed to protect the wearer from risk of injury or illness. For chainsaw operators, mandatory PPE includes chainsaw chaps or trousers, chainsaw boots, a forestry helmet with integrated face shield and ear defenders, cut-resistant gloves, and high-visibility vest (where required by site rules).", category: "PPE" },
  { term: "Pitch (chain pitch)", definition: "See Chain pitch.", category: "Chain & Bar" },
  { term: "Piston stop", definition: "A tool inserted into the spark plug hole to prevent piston movement during maintenance operations such as removing the flywheel or clutch. Using a piston stop avoids damage to engine components during high-torque disassembly.", category: "Maintenance" },
  { term: "Pre-start checks", definition: "Safety inspections carried out before starting a chainsaw at the beginning of a work session. Cover visual examination of all safety features, fuel and oil levels, chain tension and sharpness, and PPE condition. Distinct from pre-use checks.", category: "Maintenance" },
  { term: "Pre-use checks", definition: "Safety procedures carried out immediately before beginning a cutting operation, including a functional test of the chain brake, throttle lockout, and chain stop. Must be repeated each time the saw is picked up after a break.", category: "Maintenance" },
  { term: "Pulling chain", definition: "The bottom section of the chain travelling along the underside of the guide bar, which pulls the saw body toward the timber during cutting. Understanding pulling and pushing chain behaviour is important for controlling the saw during cross-cutting and rip cutting.", category: "Chain & Bar" },
  { term: "Pushing chain", definition: "The top section of the chain travelling along the upper side of the guide bar, which pushes the saw body away from the timber. The direction of chain movement determines the forces acting on the operator during different cutting techniques.", category: "Chain & Bar" },
  { term: "PUWER", definition: "Provision and Use of Work Equipment Regulations 1998. Requires that work equipment (including chainsaws) is suitable, maintained, and used only by people with adequate training and instruction. Regulation 9 specifically requires adequate training for chainsaw operators.", category: "Legislation & Standards" },
  { term: "PWA (Progressive Web Application)", definition: "A web application that uses modern browser capabilities to deliver an app-like experience, including offline functionality, home screen installation, and push notifications. The chainsawcourses.com platform is delivered as a PWA.", category: "Platform & Technology" },

  // R
  { term: "Rakers", definition: "See Depth gauge.", category: "Chain & Bar" },
  { term: "Recoil assembly", definition: "The starter mechanism that winds the pull cord back onto its spool after each starting attempt, ready for the next pull. Consists of a return spring, spool, and cord. A broken recoil spring prevents the cord from rewinding.", category: "Chainsaw Components" },
  { term: "Reduction cut", definition: "A cut made to reduce the size or length of a piece of timber, typically to make it easier to handle, move, or process further. Must be planned carefully to manage tension and compression forces in the timber.", category: "Cutting Techniques" },
  { term: "RIDDOR", definition: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013. Requires employers to report specified workplace injuries, occupational diseases, and dangerous occurrences to the HSE. Chainsaw injuries resulting in over-7-day incapacitation are reportable.", category: "Legislation & Standards" },
  { term: "Right-hand guard", definition: "The flared section of the rear handle designed to protect the operator's right hand in the event of chain derailment or breakage. Must be intact and undamaged — a missing or cracked right-hand guard is a defect that takes the saw out of service.", category: "Chainsaw Components" },
  { term: "Rim sprocket", definition: "A replaceable sprocket system where the toothed rim is separate from the hub, allowing the rim to be replaced independently without removing the clutch assembly. More common on professional chainsaws.", category: "Chainsaw Components" },
  { term: "Rip cutting (ripping)", definition: "Cutting timber along the grain rather than across it. Used in milling applications. Requires a specially designed ripping chain or modified cutter angles, as standard cross-cutting chains are not optimised for cutting with the grain.", category: "Cutting Techniques" },
  { term: "Risk", definition: "The combination of the likelihood that a hazardous event will occur and the severity of the harm that could result. Risk = Likelihood × Severity.", category: "Risk Management" },
  { term: "Risk assessment", definition: "A systematic process of identifying hazards, evaluating the likelihood and severity of harm, and determining control measures. Under the Management of Health & Safety at Work Regulations 1999, a written risk assessment is required for all significant work activities.", category: "Risk Management" },
  { term: "Rivets", definition: "The metal pins that connect the individual links of the chainsaw chain together. Rivets must not be cracked, bent, or loose. Damaged rivets are a cause of chain breakage and must be identified during pre-start inspection.", category: "Chain & Bar" },
  { term: "Root plate", definition: "The mass of roots and soil attached to an uprooted or windblown tree. Root plates can shift or spring back unpredictably when a windblown tree is processed, creating a serious crushing hazard. Always assess root plate stability before cutting near it.", category: "Environment & Site" },
  { term: "RoSPA", definition: "Royal Society for the Prevention of Accidents. A UK charity dedicated to accident prevention, offering training, qualifications, and course assurance schemes for health and safety training providers.", category: "Industry Bodies" },
  { term: "RPM (Revolutions per minute)", definition: "The number of complete rotations the engine crankshaft makes in one minute. Used to describe engine speed at idle and at full throttle. Maximum safe RPM is specified by the manufacturer; exceeding it through incorrect carburettor adjustment can cause engine damage.", category: "Chainsaw Components" },

  // S
  { term: "Safe system of work", definition: "A formal procedure that results from a systematic examination of a task, identifies all hazards, and defines safe methods to eliminate or minimise risk. A safe system of work should be in place for all chainsaw operations.", category: "Risk Management" },
  { term: "Safety decals", definition: "Labels and pictograms placed on the chainsaw to communicate critical safety information, including kickback warnings, chain brake activation instructions, and PPE requirements. Must not be obscured, damaged, or removed. Replace any missing or illegible decals before use.", category: "Chainsaw Components" },
  { term: "Scabbard", definition: "A protective cover fitted over the guide bar when the chainsaw is not in use, during transport, or during storage. Protects the cutter teeth and prevents accidental contact with the chain. Must always be fitted when the saw is not actively cutting.", category: "Chainsaw Components" },
  { term: "Semi-chisel", definition: "A chain cutter type with rounded corners on the tooth profile, as opposed to the square corners of a full-chisel cutter. More durable and forgiving in dirty, abrasive, or frozen timber; retains its cutting edge longer than full-chisel but cuts slightly less aggressively.", category: "Chain & Bar" },
  { term: "Semi-skip chain", definition: "A chain configuration with an intermediate cutter frequency between standard and full-skip chains. Offers a compromise between cutting efficiency and smoothness for use on mid-length guide bars.", category: "Chain & Bar" },
  { term: "Severity", definition: "In a risk assessment, an estimate of how serious the harm could be if a hazardous event occurs. Combined with likelihood to produce an overall risk rating.", category: "Risk Management" },
  { term: "Sharpening (filing)", definition: "The process of restoring the cutting edge of chainsaw cutter teeth using a round file of the correct diameter. Must be carried out at the correct top plate angle, side plate angle, and depth gauge setting. A correctly sharpened chain cuts efficiently and reduces operator fatigue and kickback risk.", category: "Maintenance" },
  { term: "Shredding", definition: "The systematic removal of small branches during de-limbing, working progressively along the felled tree. Shredding produces brash that must be managed to maintain a clear and safe working area.", category: "Cutting Techniques" },
  { term: "Side plate angle", definition: "The angle of the side cutting edge of the cutter tooth, measured from vertical. Correct side plate angle ensures the cutter engages the timber cleanly and efficiently. Typically 90° (vertical) for most chainsaw chains.", category: "Chain & Bar" },
  { term: "Snedding", definition: "The removal of branches from a felled tree. Carried out systematically from the base towards the top of the tree, working on the trunk side of the branch to protect the operator from the branch movement.", category: "Cutting Techniques" },
  { term: "Spark arrestor", definition: "A fine mesh screen fitted inside the exhaust/muffler that prevents glowing carbon particles (sparks) from exiting the exhaust and igniting dry vegetation or debris. Required by law in some environments. A blocked spark arrestor restricts exhaust flow and reduces engine power.", category: "Chainsaw Components" },
  { term: "Spark plug", definition: "The component that generates the electrical spark to ignite the air-fuel mixture in the engine cylinder. Spark plug condition (gap, colour, deposit type) is a key diagnostic indicator of engine health. Must be the correct grade for the engine and replaced at the intervals specified by the manufacturer.", category: "Chainsaw Components" },
  { term: "Sprocket (drive sprocket)", definition: "The toothed gear driven by the clutch drum that meshes with the drive links of the chain and drives it around the guide bar. Sprocket pitch must match the chain pitch. Worn sprockets accelerate chain wear and should be replaced with the chain.", category: "Chainsaw Components" },
  { term: "Spur sprocket", definition: "A type of drive sprocket that is integrated with the clutch drum as a single fixed unit. Less common than rim sprockets on modern professional chainsaws; the entire clutch drum must be replaced when the sprocket is worn.", category: "Chainsaw Components" },
  { term: "Stanchion", definition: "A stake or prop used to prevent cut rounds of timber from rolling away from the operator after cutting. Particularly important on sloping ground.", category: "Environment & Site" },
  { term: "Stem (trunk)", definition: "The main structural body of a tree, extending from the root collar to the first major branch. During cross-cutting operations, the stem must be assessed for tension, compression, and stability before each cut.", category: "Environment & Site" },
  { term: "Step cut", definition: "A series of overlapping cuts used to allow timber to break or snap in a controlled way, particularly when dealing with large-diameter timber that cannot be cut through in a single pass. Each step removes a section of wood progressively.", category: "Cutting Techniques" },

  // T
  { term: "TDC (Top Dead Centre)", definition: "The position of the piston at the highest point in the cylinder, at the top of its upward stroke. One of two reference points (with BTC) used to describe piston position during the two-stroke combustion cycle.", category: "Chainsaw Components" },
  { term: "Tension (timber tension)", definition: "A timber-cutting condition where the kerf (saw cut) opens as the cut progresses, caused by the timber bending away from the point of cutting. Tensioned timber can cause the chain to snatch and the bar to be thrown. Operators must identify and manage tension before cutting.", category: "Cutting Techniques" },
  { term: "Throttle", definition: "The control used to regulate engine speed by adjusting the position of the butterfly valve in the carburettor. On a chainsaw, the throttle trigger is on the rear handle and can only be activated simultaneously with the throttle lockout.", category: "Chainsaw Components" },
  { term: "Throttle lockout", definition: "See Dead-man's throttle.", category: "Chainsaw Components" },
  { term: "Throwing the chainsaw", definition: "A sudden loss of operator grip or control caused by unexpected timber movement, cutting forces, or kickback, resulting in the saw moving away from its intended cutting path. A significant injury risk; correct work position and two-handed grip are the primary preventive controls.", category: "Health & Safety" },
  { term: "Tie strap", definition: "A chain component that connects the cutter links and drive links together, forming the side of the chain. Tie straps must be checked for cracks, bends, and wear during inspection; damaged tie straps increase the risk of chain breakage.", category: "Chain & Bar" },
  { term: "Timber tongs", definition: "A tool used to grip and lift sections of timber during processing, allowing the operator to reposition logs without placing hands near the cutting zone. Reduces manual handling injury risk when moving heavy rounds.", category: "Equipment & Tools" },
  { term: "Top plate angle", definition: "The angle of the top cutting edge of the cutter tooth, measured from the centre line of the chain. The correct top plate angle (typically 25–35° depending on chain type) determines how aggressively the tooth enters the timber and must be maintained consistently during sharpening.", category: "Chain & Bar" },
  { term: "TQT (Total Qualification Time)", definition: "The total number of hours a typical learner is expected to spend on a qualification, including guided learning, independent study, and assessment. This course has a TQT of 19 hours.", category: "Training & Assessment" },
  { term: "Tuning", definition: "The process of adjusting the carburettor H, L, and idle screws to achieve correct engine performance across the full throttle range. A correctly tuned saw accelerates cleanly, idles without chain rotation, and reaches maximum power under load. Tuning should only be adjusted by a competent person.", category: "Maintenance" },
  { term: "Two-stroke engine", definition: "An internal combustion engine that completes its power cycle in two piston strokes (one revolution of the crankshaft). Used in most conventional petrol chainsaws due to its high power-to-weight ratio. Requires a petrol/oil mix as fuel.", category: "Chainsaw Components" },

  // V
  { term: "Vibration white finger (VWF)", definition: "A specific manifestation of Hand-Arm Vibration Syndrome (HAVS) characterised by blanching (whitening) of the fingers caused by vibration-induced damage to the blood vessels. A permanent and irreversible condition.", category: "Health & Safety" },

  // W
  { term: "Waiver", definition: "A legal document in which a party voluntarily gives up a known right. In the context of this platform, the digital waiver is signed on first login and acknowledges the inherent risks of chainsaw operation and the limitation of the company's liability.", category: "Training & Assessment" },
  { term: "Watermark", definition: "A visible overlay applied to the course video content displaying the learner's name and email address. The watermark repositions every 60 seconds and is designed to deter sharing of video recordings.", category: "Platform & Technology" },
  { term: "WCAG 2.1 AA", definition: "Web Content Accessibility Guidelines version 2.1, Level AA. The internationally recognised standard for web accessibility. The chainsawcourses.com platform is designed to meet WCAG 2.1 AA requirements, ensuring it is usable by people with a range of disabilities.", category: "Platform & Technology" },
  { term: "Wedges", definition: "Tools inserted into a felling or cross-cut to hold the kerf open and prevent the guide bar from being trapped by timber closing under compression. Typically made of plastic or aluminium to avoid chain damage if accidentally contacted during cutting.", category: "Equipment & Tools" },
  { term: "Windblown / Windthrown", definition: "Trees that have been uprooted or snapped by wind. Windblown timber is among the most hazardous to process due to unpredictable stored energy in the root plate and stem. Requires specialist training and a thorough dynamic risk assessment before any cutting begins.", category: "Environment & Site" },
  { term: "Winch", definition: "A mechanical device used to pull or lift heavy loads such as felled timber or stuck machinery. In chainsaw operations, a hand winch or vehicle-mounted winch may be used to assist felling direction or extract timber from difficult terrain.", category: "Equipment & Tools" },
  { term: "Winter / Summer setting", definition: "An adjustment to the carburettor air intake or choke baffle that compensates for seasonal temperature changes in air density. Running a summer setting in cold conditions causes a lean mixture; running a winter setting in warm conditions causes a rich mixture.", category: "Maintenance" },
  { term: "Witness mark", definition: "A mark filed or stamped onto the cutter tooth indicating the correct sharpening angle and the minimum permissible cutter length. When the cutter has been sharpened down to the witness mark, the tooth has reached the end of its service life and the chain must be replaced.", category: "Maintenance" },
  { term: "Work position", definition: "The correct body stance adopted by the operator when using a chainsaw — feet shoulder-width apart, knees slightly bent, saw held firmly with both hands, body positioned to one side of the cutting line. Correct work position maximises control and minimises injury risk in the event of kickback or timber movement.", category: "Health & Safety" },
  { term: "Working corner", definition: "The primary cutting point of the cutter tooth — the corner formed by the junction of the top plate and side plate cutting edges. The working corner does the majority of the cutting work and is the part of the tooth that must be kept sharp.", category: "Chain & Bar" },
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
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/training">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <BookOpen className="w-4 h-4 text-[#e27226]" />
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
