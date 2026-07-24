import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface Flag {
  type: string; severity: "high" | "medium" | "low";
  userId?: number; fullName?: string; email?: string;
  detail: string; detectedAt: string;
}

interface MalpracticeData { flags: Flag[]; total: number; highCount: number; }

const SEVERITY_CONFIG = {
  high: { label: "HIGH", bg: "bg-red-100", text: "text-red-700", icon: <ShieldAlert className="w-4 h-4 text-red-600" /> },
  medium: { label: "MEDIUM", bg: "bg-amber-100", text: "text-amber-700", icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
  low: { label: "LOW", bg: "bg-blue-100", text: "text-blue-700", icon: <Info className="w-4 h-4 text-blue-500" /> },
};

export default function MalpracticeLog() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [data, setData] = useState<MalpracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/malpractice", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const flags = (data?.flags ?? []).filter(f => filter === "all" || f.severity === filter);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/admin/dashboard">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />Dashboard
            </button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-semibold text-sm">Malpractice & Integrity Flags</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Flags are <strong>automatically computed</strong> from platform data — device resets, high exam attempt counts, multiple learners on one code, and deleted accounts. They are indicators for review, not evidence of malpractice.
        </div>

        {data && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Flags", value: data.total },
              { label: "High Severity", value: data.highCount },
              { label: "Other", value: data.total - data.highCount },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1">
          {(["all", "high", "medium", "low"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors capitalize ${filter === f ? "text-white border-transparent" : "border-border bg-white text-muted-foreground"}`}
              style={filter === f ? { background: f === "high" ? "#dc2626" : f === "medium" ? "#d97706" : f === "low" ? "#2563eb" : "#e27226" } : {}}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && flags.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <p className="text-2xl">✅</p>
            <p className="text-sm text-muted-foreground">No integrity flags detected{filter !== "all" ? ` at ${filter} severity` : ""}.</p>
          </div>
        )}

        <div className="space-y-2">
          {flags.map((f, i) => {
            const cfg = SEVERITY_CONFIG[f.severity];
            return (
              <div key={i} className="bg-white rounded-xl border border-border px-4 py-3 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm text-foreground">{f.type}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  {(f.fullName || f.email) && (
                    <p className="text-xs text-foreground font-medium">{f.fullName}{f.email ? ` · ${f.email}` : ""}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{f.detail}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(f.detectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                {f.userId && (
                  <Link href={`/admin/students/${f.userId}`}>
                    <button className="text-xs px-2.5 py-1 rounded border border-border bg-muted hover:bg-muted/70 transition-colors flex-shrink-0">View</button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
