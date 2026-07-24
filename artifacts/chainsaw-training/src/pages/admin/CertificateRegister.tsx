import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface CertRecord {
  id: number; fullName: string; email: string; activationCode: string;
  courseCompletedAt: string; certificateIssuedAt: string | null;
  examScore: number | null; accessExpiresAt: string | null;
}

export default function CertificateRegister() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [certs, setCerts] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/certificates", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setCerts).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const filtered = certs.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.activationCode.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const header = ["Name", "Email", "Activation Code", "Certificate Issued", "Exam Score", "Access Expires"];
    const rows = certs.map(c => [
      c.fullName, c.email, c.activationCode,
      c.certificateIssuedAt ? new Date(c.certificateIssuedAt).toLocaleDateString("en-GB") : "",
      c.examScore !== null ? `${c.examScore}%` : "",
      c.accessExpiresAt ? new Date(c.accessExpiresAt).toLocaleDateString("en-GB") : "Unlimited",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `certificate-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/admin/dashboard">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />Dashboard
            </button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-semibold text-sm flex-1">Certificate Register</span>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ background: "#e27226" }}
          >
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email or code…"
            className="border border-border rounded-lg px-3 py-2 text-sm w-64 bg-white focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#e27226" } as React.CSSProperties}
          />
          <p className="text-sm text-muted-foreground">{filtered.length} certificate{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No certificates issued yet.</div>
        )}

        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{c.fullName}</p>
                <p className="text-xs text-muted-foreground">{c.email} · {c.activationCode}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                <div className="text-right">
                  <p className="font-medium text-foreground">{c.certificateIssuedAt ? new Date(c.certificateIssuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                  <p>Issued</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{c.examScore !== null ? `${c.examScore}%` : "—"}</p>
                  <p>Score</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{c.accessExpiresAt ? new Date(c.accessExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Unlimited"}</p>
                  <p>Access expires</p>
                </div>
              </div>
              <Link href={`/admin/students/${c.id}`}>
                <button className="text-xs px-2.5 py-1 rounded border border-border bg-muted hover:bg-muted/70 transition-colors">View</button>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
