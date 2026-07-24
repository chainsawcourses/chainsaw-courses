import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface PolicyDoc {
  label: string;
  file: string;
}

interface Category {
  heading: string;
  docs: PolicyDoc[];
}

const CATEGORIES: Category[] = [
  {
    heading: "IIRSM Accreditation",
    docs: [
      { label: "IIRSM Submission Brief", file: "IIRSM_Submission_Brief.pdf" },
    ],
  },
  {
    heading: "Training & Assessment",
    docs: [
      { label: "Assessment Policy", file: "Assessment_Policy.pdf" },
      { label: "Appeals Policy", file: "Appeals_Policy.pdf" },
      { label: "Internal Verification Policy", file: "Internal_Verification_Policy.pdf" },
      { label: "Malpractice & Maladministration Policy", file: "Malpractice_and_Maladministration_Policy.pdf" },
      { label: "Reasonable Adjustments Policy", file: "Reasonable_Adjustments_Policy.pdf" },
      { label: "Competence & Training Framework", file: "Competence_and_Training_Framework.pdf" },
    ],
  },
  {
    heading: "Quality Management System (QMS)",
    docs: [
      { label: "Quality Management Policy", file: "Quality_Management_Policy.pdf" },
      { label: "QMS-001 — Document Control & Records Management", file: "QMS-001_Document_Control_and_Records_Management.pdf" },
      { label: "QMS-002 — Management Review Procedure", file: "QMS-002_Management_Review_Procedure.pdf" },
      { label: "QMS-003 — Nonconformance & Corrective Action", file: "QMS-003_Nonconformance_and_Corrective_Action.pdf" },
      { label: "QMS-004 — Internal Audit Procedure", file: "QMS-004_Internal_Audit_Procedure.pdf" },
      { label: "QMS-005 — Supplier & Contractor Evaluation", file: "QMS-005_Supplier_and_Contractor_Evaluation.pdf" },
      { label: "QMS-006 — Business Continuity & Disaster Recovery", file: "QMS-006_Business_Continuity_and_Disaster_Recovery.pdf" },
      { label: "QMS-007 — Risk Register & Management Framework", file: "QMS-007_Risk_Register_and_Management_Framework.pdf" },
      { label: "Internal Audit Procedure", file: "Internal_Audit_Procedure.pdf" },
      { label: "Management Review Procedure", file: "Management_Review_Procedure.pdf" },
      { label: "Nonconformance & Corrective Action", file: "Nonconformance_and_Corrective_Action.pdf" },
      { label: "Document Control & Records Management", file: "Document_Control_and_Records_Management.pdf" },
      { label: "Supplier & Contractor Evaluation", file: "Supplier_and_Contractor_Evaluation.pdf" },
      { label: "Business Continuity & Disaster Recovery", file: "Business_Continuity_and_Disaster_Recovery.pdf" },
      { label: "Risk Register & Management Framework", file: "Risk_Register_and_Management_Framework.pdf" },
    ],
  },
  {
    heading: "Information Security (ISP)",
    docs: [
      { label: "ISP-001 — Information Security Policy", file: "ISP-001_Information_Security_Policy.pdf" },
      { label: "ISP-002 — Access Control Policy", file: "ISP-002_Access_Control_Policy.pdf" },
      { label: "ISP-003 — Data Breach & Incident Response", file: "ISP-003_Data_Breach_and_Incident_Response.pdf" },
      { label: "Information Security Policy", file: "Information_Security_Policy.pdf" },
      { label: "Access Control Policy", file: "Access_Control_Policy.pdf" },
      { label: "Data Breach & Incident Response", file: "Data_Breach_and_Incident_Response.pdf" },
    ],
  },
  {
    heading: "HR & Organisational",
    docs: [
      { label: "Health & Safety Policy", file: "Health_and_Safety_Policy.pdf" },
      { label: "Equality, Diversity & Inclusion Policy", file: "Equality_Diversity_Inclusion_Policy.pdf" },
      { label: "Safeguarding Policy", file: "Safeguarding_Policy.pdf" },
      { label: "Environmental & Sustainability Policy", file: "Environmental_and_Sustainability_Policy.pdf" },
      { label: "Emergency Preparedness & Response", file: "Emergency_Preparedness_and_Response.pdf" },
      { label: "Incident & Near Miss Procedure", file: "Incident_and_Near_Miss_Procedure.pdf" },
      { label: "Complaints Procedure", file: "Complaints_Procedure.pdf" },
    ],
  },
  {
    heading: "Legal & Data",
    docs: [
      { label: "Data Protection Policy", file: "Data_Protection_Policy.pdf" },
      { label: "Terms & Conditions / Liability Waiver", file: "Terms_and_Conditions_Liability_Waiver.pdf" },
      { label: "Refund & Cancellation Policy", file: "Refund_and_Cancellation_Policy.pdf" },
    ],
  },
];

export default function PolicyDocs() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const base = import.meta.env.BASE_URL;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/admin/dashboard">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-semibold text-sm text-foreground">Company Policy Documents</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">Policy Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All generated policy and compliance PDFs. Click <strong>View</strong> to open in browser or <strong>Download</strong> to save.
          </p>
        </div>

        {CATEGORIES.map((cat) => (
          <section key={cat.heading}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">
              {cat.heading}
            </h2>
            <div className="space-y-1">
              {cat.docs.map((doc) => (
                <div
                  key={doc.file}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" style={{ color: "#e27226" }} />
                    <span className="text-sm text-foreground truncate">{doc.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a
                      href={`${base}pdfs/${doc.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border bg-background hover:bg-muted transition-colors text-foreground"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View
                    </a>
                    <a
                      href={`${base}pdfs/${doc.file}`}
                      download={doc.file}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-transparent text-white transition-colors"
                      style={{ background: "#e27226" }}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
