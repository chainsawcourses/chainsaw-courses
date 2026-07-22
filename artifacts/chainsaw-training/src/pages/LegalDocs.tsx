import React, { useState } from "react";
import { FileText, Download, ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { downloadPdf } from "../lib/downloadPdf";

type Doc = {
  title: string;
  description: string;
  file: string;
  pages: string;
};

type Section = {
  label: string;
  intro: string;
  docs: Doc[];
};

const SECTIONS: Section[] = [
  {
    label: "Student Documents",
    intro: "Documents relating to your rights and obligations as a learner on this platform.",
    docs: [
      {
        title: "Terms & Conditions and Liability Waiver",
        description: "Platform access terms, the seven-clause contractual liability waiver, intellectual property, and governing law.",
        file: "Terms_and_Conditions_Liability_Waiver.pdf",
        pages: "3 pages",
      },
      {
        title: "Refund & Cancellation Policy",
        description: "Cooling-off rights, cancellation before and after activation, technical fault process, and how to request a refund.",
        file: "Refund_and_Cancellation_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Data Protection Policy",
        description: "UK GDPR compliant. What data we collect, why, retention periods, your rights, third-party services, and the ICO.",
        file: "Data_Protection_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Complaints Procedure",
        description: "How to make a complaint, our 3-stage response process, external escalation options including IIRSM and the ICO.",
        file: "Complaints_Procedure.pdf",
        pages: "3 pages",
      },
      {
        title: "Reasonable Adjustments Policy",
        description: "Our commitment to providing equitable access. How to request adjustments for disabilities, learning difficulties, or other needs.",
        file: "Reasonable_Adjustments_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Appeals Policy",
        description: "Grounds for appeal, the three-stage appeals process, timelines, and escalation to IIRSM where appropriate.",
        file: "Appeals_Policy.pdf",
        pages: "3 pages",
      },
    ],
  },
  {
    label: "Quality & Governance Policies",
    intro: "Policies governing how this course is designed, delivered, assessed, and quality-assured. Published in accordance with IIRSM course approval requirements.",
    docs: [
      {
        title: "Health & Safety Policy",
        description: "Our commitment to the health and safety of learners, staff, and stakeholders. Obligations, responsibilities, and review schedule.",
        file: "Health_and_Safety_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Quality Management Policy",
        description: "Our quality management framework covering course design, content review, learner feedback, and continuous improvement.",
        file: "Quality_Management_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Assessment Policy",
        description: "Assessment design principles, validity, reliability, fairness, the 80% pass threshold, unlimited retries, and marking criteria.",
        file: "Assessment_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Internal Verification Policy",
        description: "How assessment materials and learner outcomes are internally verified to ensure consistency, accuracy, and IIRSM alignment.",
        file: "Internal_Verification_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Malpractice & Maladministration Policy",
        description: "Definitions of malpractice, detection mechanisms including device-locking and dynamic watermarking, and sanctions.",
        file: "Malpractice_and_Maladministration_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Equality, Diversity & Inclusion Policy",
        description: "Our commitment to equal opportunity in training and assessment. Protected characteristics, responsibilities, and monitoring.",
        file: "Equality_Diversity_Inclusion_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Safeguarding Policy",
        description: "Safeguarding commitments for adult learners, how to raise a concern, and our designated safeguarding contact.",
        file: "Safeguarding_Policy.pdf",
        pages: "3 pages",
      },
      {
        title: "Environmental & Sustainability Policy",
        description: "Our environmental commitments and sustainability approach. Course materials are available as printed or digital-only — students choose their preferred format at the point of purchase.",
        file: "Environmental_and_Sustainability_Policy.pdf",
        pages: "3 pages",
      },
    ],
  },
];

function DocCard({ doc, base }: { doc: Doc; base: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    const url = `${base}/pdfs/${doc.file}`;
    await downloadPdf(url, doc.file);
    setLoading(false);
  }

  return (
    <div className="border border-border rounded-lg p-4 flex items-start gap-4 bg-card hover:border-primary/30 transition-colors">
      <div className="shrink-0 w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm text-foreground leading-tight">{doc.title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{doc.description}</p>
        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
          {doc.pages} · Version 1.0 · July 2026
        </span>
      </div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="shrink-0 flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {loading ? "…" : "PDF"}
      </button>
    </div>
  );
}

export default function LegalDocs() {
  const [, navigate] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const totalDocs = SECTIONS.reduce((sum, s) => sum + s.docs.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/training")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-mono uppercase tracking-widest font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-500" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Documents Library</span>
          </div>
          <div className="w-14" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <h2 className="font-mono font-black uppercase tracking-widest text-xs text-foreground mb-1">
              {section.label}
            </h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{section.intro}</p>
            <div className="space-y-3">
              {section.docs.map((doc) => (
                <DocCard key={doc.file} doc={doc} base={base} />
              ))}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground pt-2 text-center border-t border-border">
          For any queries regarding these documents contact{" "}
          <a href="mailto:info@chainsawcourses.com" className="text-primary hover:underline">
            info@chainsawcourses.com
          </a>
        </p>
      </div>
    </div>
  );
}
