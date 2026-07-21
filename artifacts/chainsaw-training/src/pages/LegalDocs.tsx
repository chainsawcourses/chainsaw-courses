import React from "react";
import { FileText, Download, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const docs = [
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
];

export default function LegalDocs() {
  const [, navigate] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground px-6 py-5">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 mb-3 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-xl font-black uppercase tracking-widest">Legal Documents</h1>
        <p className="text-sm opacity-75 mt-1">Overleaf Publishers Ltd — Chainsaw Courses</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <p className="text-sm text-muted-foreground mb-6">
          The following policy documents are published by Overleaf Publishers Ltd in relation to the
          Chainsaw Courses vocational training platform. Click <strong>Download PDF</strong> to open
          or save each document.
        </p>

        {docs.map((doc) => {
          const url = `${base}/pdfs/${doc.file}`;
          return (
            <div
              key={doc.file}
              className="border border-border rounded-lg p-5 flex items-start gap-4 bg-card"
            >
              <div className="shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-sm text-foreground leading-tight">{doc.title}</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{doc.description}</p>
                <span className="text-xs text-muted-foreground/60 mt-1 block">{doc.pages} · Version 1.0 · July 2026</span>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </a>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground pt-4 text-center">
          For any queries regarding these documents contact{" "}
          <a href="mailto:info@chainsawcourses.com" className="text-primary hover:underline">
            info@chainsawcourses.com
          </a>
        </p>
      </div>
    </div>
  );
}
