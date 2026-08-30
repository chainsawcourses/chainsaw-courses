import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download, ExternalLink, FolderOpen, Loader2 } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { downloadPdf } from "../../lib/downloadPdf";

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
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Per-row Drive save state
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedUrls, setSavedUrls] = useState<Record<number, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  // Bulk export state
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ saved: number; errors: string[]; folderUrl: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const handleSaveToDrive = async (userId: number) => {
    if (!adminToken || savingId !== null) return;
    setSavingId(userId);
    setSaveErrors(prev => { const n = { ...prev }; delete n[userId]; return n; });
    try {
      const res = await fetch(`/api/admin/certificate/${userId}/save-to-drive`, {
        method: "POST",
        headers: { admintoken: adminToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSavedUrls(prev => ({ ...prev, [userId]: data.url }));
    } catch (e) {
      setSaveErrors(prev => ({ ...prev, [userId]: e instanceof Error ? e.message : "Save failed" }));
    } finally {
      setSavingId(null);
    }
  };

  const handleDownload = async (certificate: CertRecord) => {
    if (!adminToken || downloadingId !== null) return;
    setDownloadingId(certificate.id);
    try {
      const safeName = certificate.fullName.replace(/[^a-z0-9]+/gi, "_");
      await downloadPdf(
        `/api/admin/certificate/${certificate.id}`,
        `Certificate_${safeName}.pdf`,
        { headers: { admintoken: adminToken } },
      );
    } catch (error) {
      setSaveErrors(prev => ({
        ...prev,
        [certificate.id]: error instanceof Error ? error.message : "Download failed",
      }));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportToDrive = async () => {
    if (!adminToken || exporting) return;
    setExporting(true);
    setExportResult(null);
    setExportError(null);
    try {
      const res = await fetch("/api/admin/certificates/export-to-drive", {
        method: "POST",
        headers: { admintoken: adminToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setExportResult(data);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
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
            onClick={handleExportToDrive}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-60"
            style={{ background: "#e27226" }}
          >
            {exporting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Exporting…</>
              : <><FolderOpen className="w-3.5 h-3.5" />Export Certificates</>}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Export result banner */}
        {exportResult && (
          <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-start justify-between gap-3">
            <div className="text-sm font-mono space-y-1">
              <p className="font-semibold">
                Export complete — {exportResult.saved} certificate{exportResult.saved !== 1 ? "s" : ""} saved to Drive
              </p>
              {exportResult.errors.length > 0 && (
                <p className="text-xs text-destructive">{exportResult.errors.length} failed: {exportResult.errors.slice(0, 2).join("; ")}{exportResult.errors.length > 2 ? "…" : ""}</p>
              )}
              <a
                href={exportResult.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs hover:underline"
                style={{ color: "#e27226" }}
              >
                <ExternalLink className="w-3 h-3" /> Open User Certificates folder
              </a>
            </div>
            <button onClick={() => setExportResult(null)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
          </div>
        )}
        {exportError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-destructive font-mono">{exportError}</span>
            <button onClick={() => setExportError(null)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
          </div>
        )}

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
                {/* Drive save result */}
                {savedUrls[c.id] && (
                  <a href={savedUrls[c.id]} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs mt-0.5 hover:underline"
                    style={{ color: "#e27226" }}>
                    <ExternalLink className="w-3 h-3" /> Saved to Drive
                  </a>
                )}
                {saveErrors[c.id] && (
                  <p className="text-xs text-destructive mt-0.5">{saveErrors[c.id]}</p>
                )}
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
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`/api/admin/certificate/${c.id}?token=${encodeURIComponent(adminToken ?? "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2.5 py-1 rounded border border-border bg-muted hover:bg-muted/70 transition-colors"
                >
                  View
                </a>
                <button
                  onClick={() => void handleDownload(c)}
                  disabled={downloadingId !== null}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border bg-muted hover:bg-muted/70 transition-colors disabled:opacity-50"
                  title="Download certificate PDF"
                >
                  {downloadingId === c.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Download className="w-3 h-3" />}
                  {downloadingId === c.id ? "Saving…" : "Download"}
                </button>
                <button
                  onClick={() => handleSaveToDrive(c.id)}
                  disabled={savingId !== null}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border bg-muted hover:bg-muted/70 transition-colors disabled:opacity-50"
                  title="Save PDF to Google Drive › User Certificates"
                >
                  {savingId === c.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <FolderOpen className="w-3 h-3" />}
                  {savingId === c.id ? "Saving…" : "Drive"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
