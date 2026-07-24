import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface ExamAttempt {
  id: number; userId: number; fullName: string; email: string;
  score: number; passed: boolean; totalQuestions: number;
  attemptedAt: string; attemptNumber: number;
}

export default function ExamLog() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pass" | "fail">("all");
  const [search, setSearch] = useState("");

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/exam-log", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setAttempts).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  const filtered = attempts.filter(a => {
    if (filter === "pass" && !a.passed) return false;
    if (filter === "fail" && a.passed) return false;
    if (search && !a.fullName.toLowerCase().includes(search.toLowerCase()) && !a.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportCsv = () => {
    const header = ["Date", "Student", "Email", "Score", "Passed", "Attempt #", "Total Questions"];
    const rows = filtered.map(a => [
      new Date(a.attemptedAt).toLocaleDateString("en-GB"),
      a.fullName, a.email, `${a.score}%`, a.passed ? "Yes" : "No",
      a.attemptNumber, a.totalQuestions,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `exam-log-${new Date().toISOString().slice(0, 10)}.csv`;
    el.click();
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
          <span className="font-semibold text-sm flex-1">Exam Attempt Log</span>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: "#e27226" }}>
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student…"
            className="border border-border rounded-lg px-3 py-2 text-sm w-52 bg-white focus:outline-none"
          />
          <div className="flex gap-1">
            {(["all", "pass", "fail"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${filter === f ? "text-white border-transparent" : "border-border bg-white text-muted-foreground"}`}
                style={filter === f ? { background: "#e27226" } : {}}>
                {f === "all" ? "All" : f === "pass" ? "Passes" : "Fails"}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground ml-auto">{filtered.length} attempt{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No attempts found.</div>}

        <div className="space-y-1.5">
          {filtered.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{a.fullName}</p>
                <p className="text-xs text-muted-foreground">{a.email}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                <div className="text-right">
                  <p className="font-medium text-foreground text-xs">{new Date(a.attemptedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  <p>Date</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{a.score}%</p>
                  <p>Score</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">#{a.attemptNumber}</p>
                  <p>Attempt</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {a.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
