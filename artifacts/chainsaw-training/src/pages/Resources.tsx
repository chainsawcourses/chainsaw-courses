import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, BookOpen, Shield, FileText, Building2, Wrench, AlertTriangle, Library } from "lucide-react";

type Resource = {
  title: string;
  description: string;
  url: string;
  type: string;
};

type Section = {
  id: string;
  label: string;
  icon: React.ReactNode;
  intro: string;
  resources: Resource[];
};

const SECTIONS: Section[] = [
  {
    id: "legislation",
    label: "UK Legislation",
    icon: <Shield className="w-4 h-4 text-primary" />,
    intro: "The following Acts and Regulations form the primary legal framework governing chainsaw use in the UK. Every professional operator should be familiar with these instruments.",
    resources: [
      {
        title: "Health and Safety at Work etc. Act 1974",
        description: "The overarching UK health and safety legislation placing a duty of care on employers and employees. The foundation of all workplace health and safety law.",
        url: "https://www.legislation.gov.uk/ukpga/1974/37/contents",
        type: "Primary Legislation",
      },
      {
        title: "Provision and Use of Work Equipment Regulations 1998 (PUWER)",
        description: "Requires work equipment to be suitable, maintained, and used only by trained and competent persons. Regulation 9 specifically requires adequate training for chainsaw operators.",
        url: "https://www.legislation.gov.uk/uksi/1998/2306/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Management of Health and Safety at Work Regulations 1999",
        description: "Requires employers to carry out risk assessments, plan preventive measures, appoint competent persons, and provide health and safety training. The basis for formal risk assessment obligations.",
        url: "https://www.legislation.gov.uk/uksi/1999/3242/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Personal Protective Equipment at Work Regulations 2022",
        description: "Requires employers to provide suitable PPE for employees exposed to health or safety risks. The 2022 revision extended requirements to cover limb workers and the self-employed.",
        url: "https://www.legislation.gov.uk/uksi/2022/8/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Control of Noise at Work Regulations 2005",
        description: "Sets Lower (80 dB(A)) and Upper (85 dB(A)) Exposure Action Values and an Exposure Limit Value of 87 dB(A). Chainsaws typically operate at 100–115 dB(A) — well above all thresholds.",
        url: "https://www.legislation.gov.uk/uksi/2005/1643/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Control of Vibration at Work Regulations 2005",
        description: "Sets daily vibration exposure action values (2.5 m/s²) and limit values (5 m/s²) for hand-arm vibration. Chainsaw use creates significant HAV exposure and requires active management.",
        url: "https://www.legislation.gov.uk/uksi/2005/1093/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Lifting Operations and Lifting Equipment Regulations 1998 (LOLER)",
        description: "Applies to lifting operations in arboricultural and forestry contexts including aerial work platforms and rope-based access and positioning systems.",
        url: "https://www.legislation.gov.uk/uksi/1998/2307/contents",
        type: "Statutory Instrument",
      },
      {
        title: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 (RIDDOR)",
        description: "Requires employers to report specified workplace injuries, occupational diseases, and dangerous occurrences to the HSE. Chainsaw injuries causing over-7-day incapacitation are reportable.",
        url: "https://www.legislation.gov.uk/uksi/2013/1471/contents",
        type: "Statutory Instrument",
      },
    ],
  },
  {
    id: "hse",
    label: "HSE & FISA Guidance",
    icon: <FileText className="w-4 h-4 text-primary" />,
    intro: "The Health and Safety Executive (HSE) and the Forestry Industry Safety Accord (FISA) are the two principal bodies producing chainsaw and forestry safety guidance in the UK. The old AFAG series has been superseded — current guidance is published jointly by HSE and FISA.",
    resources: [
      {
        title: "HSE — Chainsaws at Work (INDG317)",
        description: "The HSE's introductory guide to the safe use of chainsaws at work. Covers the legal requirements for training, PPE, and risk assessment. Free to download — essential reading for all operators.",
        url: "https://www.hse.gov.uk/pubns/indg317.htm",
        type: "HSE Leaflet",
      },
      {
        title: "HSE — Agriculture, Forestry and Related Industries",
        description: "HSE's main hub for agriculture, forestry, and related industries. Includes current guidance on chainsaw use, PPE selection, noise, vibration, and safe systems of work.",
        url: "https://www.hse.gov.uk/agriculture/",
        type: "HSE Guidance",
      },
      {
        title: "HSE — Noise at Work",
        description: "HSE's main guidance portal for noise at work, including a noise calculator for chainsaw operations and guidance on selecting appropriate hearing protection.",
        url: "https://www.hse.gov.uk/noise/",
        type: "HSE Guidance",
      },
      {
        title: "HSE — Five Steps to Risk Assessment (INDG163)",
        description: "The HSE's clear, practical guide to carrying out a risk assessment using the five-step process. The basis of the Five Steps to Risk Assessment module in this course.",
        url: "https://www.hse.gov.uk/pubns/indg163.pdf",
        type: "HSE Leaflet",
      },
      {
        title: "HSE — Work at Height",
        description: "Guidance on the Work at Height Regulations 2005, relevant to arboricultural operations involving climbing, aerial platforms, or working near excavations.",
        url: "https://www.hse.gov.uk/work-at-height/",
        type: "HSE Guidance",
      },
      {
        title: "HSE — Risk Assessment: A Brief Guide",
        description: "A concise introduction to risk assessment principles including hazard identification, risk rating, and control measures. Complements the HSE five-step approach.",
        url: "https://www.hse.gov.uk/risk/",
        type: "HSE Guidance",
      },
    ],
  },
  {
    id: "qualification",
    label: "Qualifications & Standards",
    icon: <BookOpen className="w-4 h-4 text-primary" />,
    intro: "Completing this theoretical course is a valuable first step. For professional chainsaw use in the UK, a practical NPTC or Lantra qualification is required by law. The following resources will help you find an assessment centre and understand the qualification pathway.",
    resources: [
      {
        title: "City & Guilds",
        description: "City & Guilds NPTC manages the 0039-20 (Chainsaw Maintenance and Cross Cutting) practical qualification. Visit their main website to find qualifications, approved assessment centres, and certification information.",
        url: "https://www.cityandguilds.com/",
        type: "Qualification",
      },
      {
        title: "NPTC Group — Land-Based Qualifications",
        description: "NPTC Group is the awarding organisation for land-based vocational qualifications in the UK, including chainsaw certificates of competence.",
        url: "https://www.nptcgroup.ac.uk/",
        type: "Awarding Body",
      },
      {
        title: "Lantra — Arboriculture Sector",
        description: "Lantra is an alternative awarding body for land-based chainsaw qualifications. Their chainsaw training and assessment programmes are widely recognised by employers and local authorities.",
        url: "https://www.lantra.co.uk/sectors/arboriculture",
        type: "Awarding Body",
      },
      {
        title: "Lantra — Training Finder",
        description: "Find Lantra-approved training providers and assessment centres offering chainsaw qualifications near you.",
        url: "https://www.lantra.co.uk/training",
        type: "Awarding Body",
      },
      {
        title: "IIRSM — eLearning Course Approval Scheme",
        description: "Information on the IIRSM course approval process. This course has been submitted for IIRSM eLearning Course Approval, providing independent quality assurance by a nationally recognised safety body.",
        url: "https://www.iirsm.org/corporates/course-approvals",
        type: "Approval Body",
      },
    ],
  },
  {
    id: "bodies",
    label: "Industry Bodies",
    icon: <Building2 className="w-4 h-4 text-primary" />,
    intro: "The following organisations provide guidance, standards, training resources, and professional support for arboricultural and forestry practitioners in the UK.",
    resources: [
      {
        title: "Arboricultural Association (AA)",
        description: "The UK's leading professional body for arborists and tree surgeons. Provides a register of approved contractors, technical guidance, CPD events, and industry publications.",
        url: "https://www.trees.org.uk/",
        type: "Professional Body",
      },
      {
        title: "Royal Forestry Society (RFS)",
        description: "Promotes the art, science, and practice of forestry and arboriculture. Provides training events, publications, and access to a network of woodland professionals.",
        url: "https://www.rfs.org.uk/",
        type: "Professional Body",
      },
      {
        title: "Forestry England",
        description: "Government body responsible for the protection and expansion of forests and woodlands in England. Produces biosecurity guidance, felling licences, and UK Forestry Standard documents.",
        url: "https://www.forestryengland.uk/",
        type: "Government Body",
      },
      {
        title: "Animal and Plant Health Agency (APHA)",
        description: "Executive agency of Defra responsible for managing statutory plant health obligations including tree disease containment zones (e.g. ash dieback, oak processionary moth).",
        url: "https://www.gov.uk/government/organisations/animal-and-plant-health-agency",
        type: "Government Body",
      },
      {
        title: "RoSPA — Royal Society for the Prevention of Accidents",
        description: "UK charity dedicated to accident prevention. Offers training, occupational safety guidance, and a Course Assurance scheme for training providers.",
        url: "https://www.rospa.com/",
        type: "Professional Body",
      },
      {
        title: "IIRSM — International Institute of Risk and Safety Management",
        description: "An independent educational charity established in 1975, dedicated to advancing standards in risk, health and safety management. This course is submitted for IIRSM eLearning Course Approval.",
        url: "https://www.iirsm.org/",
        type: "Professional Body",
      },
    ],
  },
  {
    id: "equipment",
    label: "Equipment & PPE Standards",
    icon: <Wrench className="w-4 h-4 text-primary" />,
    intro: "Chainsaw PPE must meet specific EN standards to provide effective protection. The following HSE resources cover PPE selection, maintenance, and legal requirements for chainsaw operators.",
    resources: [
      {
        title: "HSE — Personal Protective Equipment at Work",
        description: "HSE's main PPE guidance portal covering employer duties, PPE selection principles, and maintenance requirements under the PPE at Work Regulations 2022. Applies directly to chainsaw operators and their employers.",
        url: "https://www.hse.gov.uk/ppe/",
        type: "HSE Guidance",
      },
      {
        title: "HSE — Agriculture, Forestry & Related Industries (PPE section)",
        description: "HSE guidance specific to chainsaw PPE: choosing the correct class of chainsaw protective trousers (EN ISO 11393), gloves (EN 381-7), forestry helmets (EN 397 / EN 1731 / EN 352), and boot protection standards.",
        url: "https://www.hse.gov.uk/agriculture/",
        type: "HSE Guidance",
      },
    ],
  },
  {
    id: "biosecurity",
    label: "Biosecurity & Tree Health",
    icon: <AlertTriangle className="w-4 h-4 text-primary" />,
    intro: "Operators working across multiple sites have a duty to avoid inadvertently spreading tree pests and diseases. The following resources provide current guidance on UK tree health threats and statutory containment obligations.",
    resources: [
      {
        title: "Forest Research — Tree Pests and Diseases Hub",
        description: "Forest Research's main resource for tree health information, including current outbreak maps, identification guides, and reporting tools for notifiable pests and diseases.",
        url: "https://www.forestresearch.gov.uk/tools-and-resources/fthr/",
        type: "Government Resource",
      },
      {
        title: "TreeAlert — Report a Tree Pest or Disease",
        description: "Forest Research's online reporting tool for suspected tree pests and diseases. Operators who identify signs of a notifiable pest or disease have a responsibility to report it.",
        url: "https://treealert.forestresearch.gov.uk/",
        type: "Reporting Tool",
      },
      {
        title: "Ash Dieback (Hymenoscyphus fraxineus) — Forest Research Guidance",
        description: "Current guidance on ash dieback, the most widespread tree disease affecting UK woodlands. Includes management and felling guidance for affected trees, plus latest research.",
        url: "https://www.forestresearch.gov.uk/tools-and-resources/fthr/tree-pests-and-diseases/ash-dieback/",
        type: "Disease Guidance",
      },
      {
        title: "Oak Processionary Moth (OPM) — Forest Research Guidance",
        description: "OPM caterpillars carry hairs that cause severe irritation to the skin, eyes, and respiratory system. Operators working on or near infested oaks must be aware of the risks and appropriate controls.",
        url: "https://www.forestresearch.gov.uk/tools-and-resources/fthr/tree-pests-and-diseases/oak-processionary-moth/",
        type: "Pest Guidance",
      },
      {
        title: "GOV.UK — Plant Health Controls",
        description: "Official UK Government guidance on plant health controls, statutory pest and disease notifications, and import/movement restrictions. Covers operator obligations when working in or near containment zones.",
        url: "https://www.gov.uk/guidance/plant-health-controls",
        type: "Government Resource",
      },
    ],
  },
];

const TYPE_COLOURS: Record<string, string> = {
  "Primary Legislation": "text-red-500 border-red-500/40",
  "Statutory Instrument": "text-[#e27226] border-[#e27226]/40",
  "HSE Leaflet": "text-blue-500 border-blue-500/40",
  "FISA Guidance": "text-green-600 border-green-600/40",
  "HSE Guidance": "text-blue-500 border-blue-500/40",
  "Qualification": "text-green-500 border-green-500/40",
  "Awarding Body": "text-green-500 border-green-500/40",
  "Approval Body": "text-primary border-primary/40",
  "Professional Body": "text-purple-500 border-purple-500/40",
  "Government Body": "text-[#e27226] border-[#e27226]/40",
  "Government Resource": "text-[#e27226] border-[#e27226]/40",
  "Reporting Tool": "text-yellow-600 border-yellow-600/40",
  "PPE Standard": "text-cyan-500 border-cyan-500/40",
  "Disease Guidance": "text-red-500 border-red-500/40",
  "Pest Guidance": "text-red-500 border-red-500/40",
};

export default function Resources() {
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
          <Library className="w-4 h-4 text-[#e27226]" />
          <span className="font-mono font-black uppercase tracking-widest text-sm">Further Reading & Resources</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Intro */}
        <div className="border-l-2 border-primary pl-4">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Official guidance, legislation, qualification pathways, and industry body resources to support your professional development as a chainsaw operator. All links have been verified and open official sources.
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 opacity-70">
            Links open in a new tab. Overleaf Publishers Ltd is not responsible for the content of external websites.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.id}>
            <div className="flex items-center gap-2 mb-2">
              {section.icon}
              <h2 className="font-mono font-black uppercase tracking-widest text-sm text-foreground">{section.label}</h2>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mb-3 leading-relaxed">{section.intro}</p>

            <div className="space-y-1.5">
              {section.resources.map((r) => (
                <a
                  key={r.title}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <Card className="border-border bg-card/50 hover:border-primary/40 hover:bg-card/70 transition-all duration-150 cursor-pointer">
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono font-bold text-xs uppercase tracking-wide text-foreground group-hover:text-primary transition-colors">{r.title}</span>
                          <Badge
                            variant="outline"
                            className={`font-mono text-[9px] rounded-none py-0 px-1 shrink-0 ${TYPE_COLOURS[r.type] ?? "text-muted-foreground border-muted-foreground/40"}`}
                          >
                            {r.type}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{r.description}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        ))}

        {/* Refresher training note */}
        <div className="border border-primary/30 rounded bg-primary/5 p-4">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-primary mb-2">Refresher Training Recommendation</h3>
          <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
            HSE guidance (INDG317) recommends that chainsaw operators undergo periodic refresher training to maintain their competence. Where an operator has not used a chainsaw regularly, or where there have been changes to relevant legislation or guidance, refresher training should be considered. Employers and self-employed operators are responsible for ensuring their knowledge and skills remain current.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="font-mono text-[9px] text-muted-foreground text-center">
            Resources verified July 2026. Compiled by Overleaf Publishers Ltd with reference to HSE, FISA, and current UK legislation. © 2026 Overleaf Publishers Ltd — chainsawcourses.com
          </p>
        </div>
      </main>
    </div>
  );
}
