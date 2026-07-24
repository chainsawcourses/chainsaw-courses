import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface BankData {
  totalQuestions: number; activeQuestions: number; inactiveQuestions: number;
  byLearningOutcome: { learningOutcome: string; total: number; active: number }[];
  byAssessmentCriteria: { assessmentCriteria: string; total: number; active: number }[];
}

export default function AssessmentBank() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [data, setData] = useState<BankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lo" | "ac">("lo");

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/assessment-bank", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const ORANGE = "#e27226";
  const rows = tab === "lo" ? (data?.byLearningOutcome ?? []) : (data?.byAssessmentCriteria ?? []);
  const labelKey = tab === "lo" ? "learningOutcome" : "assessmentCriteria";

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
          <span className="font-semibold text-sm">Assessment Bank</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Questions", value: data.totalQuestions },
                { label: "Active in Bank", value: data.activeQuestions },
                { label: "Inactive / Draft", value: data.inactiveQuestions },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-border p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <strong>IIRSM guidance:</strong> A minimum bank of 3× the drawn question count is recommended to prevent memorisation. Your exam draws 45 questions — ideally 135+ active questions in the bank.
              {data.activeQuestions < 135 && <span className="font-semibold"> Current active count ({data.activeQuestions}) is below this threshold.</span>}
            </div>

            {/* Tab switch */}
            <div className="flex gap-1">
              {([["lo", "By Learning Outcome"], ["ac", "By Assessment Criteria"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${tab === key ? "text-white border-transparent" : "border-border bg-white text-muted-foreground"}`}
                  style={tab === key ? { background: ORANGE } : {}}>
                  {label}
                </button>
              ))}
            </div>

            {/* Distribution table */}
            <div className="space-y-1.5">
              {(rows as ({ total: number; active: number } & Record<string, string | number>)[]).map((r, i) => {
                const pct = data.totalQuestions > 0 ? Math.round((r.active / data.totalQuestions) * 100) : 0;
                return (
                  <div key={i} className="bg-white rounded-xl border border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm text-foreground font-medium flex-1 min-w-0">{String(r[labelKey])}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground flex-shrink-0">
                        <span><span className="font-semibold text-foreground">{r.active}</span> active</span>
                        <span><span className="font-semibold text-foreground">{r.total}</span> total</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ORANGE }} />
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No questions have learning outcome tags yet.</p>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
