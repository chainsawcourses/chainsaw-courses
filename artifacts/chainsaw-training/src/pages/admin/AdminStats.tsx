import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Award, BarChart2, BookOpen, CheckCircle2, Users } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface Stats {
  totalLearners: number; activeLearners: number; completedLearners: number;
  certificatesIssued: number; totalExamAttempts: number; passRate: number; averagePassScore: number;
  moduleStats: { moduleId: number; title: string; order: number; videoCompleted: number; quizPassed: number | null }[];
  recentActivity: { type: string; userId: number; fullName: string; passed: boolean; score: number; at: string }[];
}

function StatCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg flex-shrink-0" style={{ background: color + "18" }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminStats() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/stats", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const ORANGE = "#e27226";

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
          <span className="font-semibold text-sm">Statistics & Reporting</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {stats && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Total Learners" value={stats.totalLearners} icon={<Users className="w-4 h-4" />} color={ORANGE} />
              <StatCard label="Active Learners" value={stats.activeLearners} sub="access not expired" icon={<CheckCircle2 className="w-4 h-4" />} color="#16a34a" />
              <StatCard label="Certificates Issued" value={stats.certificatesIssued} icon={<Award className="w-4 h-4" />} color="#7c3aed" />
              <StatCard label="Exam Attempts" value={stats.totalExamAttempts} icon={<BookOpen className="w-4 h-4" />} color="#0ea5e9" />
              <StatCard label="Exam Pass Rate" value={`${stats.passRate}%`} sub="of all attempts" icon={<BarChart2 className="w-4 h-4" />} color={ORANGE} />
              <StatCard label="Avg. Pass Score" value={`${stats.averagePassScore}%`} sub="passing attempts only" icon={<BarChart2 className="w-4 h-4" />} color="#16a34a" />
            </div>

            {/* Module funnel */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">Module Completion Funnel</h2>
              <div className="space-y-2">
                {(stats.moduleStats ?? []).map(m => {
                  const maxVal = stats.totalLearners || 1;
                  const vidPct = Math.round((m.videoCompleted / maxVal) * 100);
                  const qzPct = m.quizPassed !== null ? Math.round((m.quizPassed / maxVal) * 100) : null;
                  return (
                    <div key={m.moduleId} className="bg-white rounded-lg border border-border px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-xs font-medium text-foreground truncate">{m.title}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground flex-shrink-0">
                          <span>▶ {m.videoCompleted}</span>
                          {m.quizPassed !== null && <span>✓ {m.quizPassed}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 h-1.5">
                        <div className="flex-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${vidPct}%`, background: ORANGE }} />
                        </div>
                        {qzPct !== null && (
                          <div className="flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${qzPct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block" style={{ background: ORANGE }} /> Video watched</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full inline-block bg-green-500" /> Quiz passed</span>
              </div>
            </section>

            {/* Recent activity */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 pb-2 border-b border-border">Recent Exam Activity</h2>
              <div className="space-y-1">
                {(stats.recentActivity ?? []).map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-lg border border-border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-sm font-bold text-foreground">{a.score}%</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {a.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
