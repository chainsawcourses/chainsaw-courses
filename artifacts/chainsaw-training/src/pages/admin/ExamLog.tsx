import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ChevronDown, ChevronUp, Download } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";

interface ExamAttempt {
  id: number; userId: number; fullName: string; email: string;
  score: number; passed: boolean; totalQuestions: number;
  attemptedAt: string; attemptNumber: number;
}

interface StudentRow {
  userId: number; fullName: string; email: string;
  attempts: ExamAttempt[];
  passes: number; fails: number; bestScore: number; latestAt: string;
}

export default function ExamLog() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pass" | "fail">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => { if (isReady && !adminToken) setLocation("/admin"); }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/exam-log", { headers: { admintoken: adminToken } })
      .then(r => r.json()).then(setAttempts).catch(() => {}).finally(() => setLoading(false));
  }, [adminToken]);

  // Group attempts by student
  const students: StudentRow[] = (() => {
    const map = new Map<number, StudentRow>();
    // Sort all attempts oldest→newest so attemptNumber is meaningful
    const sorted = [...attempts].sort((a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime());
    for (const a of sorted) {
      if (!map.has(a.userId)) {
        map.set(a.userId, { userId: a.userId, fullName: a.fullName, email: a.email, attempts: [], passes: 0, fails: 0, bestScore: 0, latestAt: a.attemptedAt });
      }
      const row = map.get(a.userId)!;
      row.attempts.push(a);
      if (a.passed) row.passes++; else row.fails++;
      if (a.score > row.bestScore) row.bestScore = a.score;
      if (new Date(a.attemptedAt) > new Date(row.latestAt)) row.latestAt = a.attemptedAt;
    }
    // Sort students by most recent attempt descending
    return [...map.values()].sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  })();

  const filtered = students.filter(s => {
    if (filter === "pass" && s.passes === 0) return false;
    if (filter === "fail" && s.fails === 0) return false;
    if (search && !s.fullName.toLowerCase().includes(search.toLowerCase()) && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleExpand = (userId: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filtered.map(s => s.userId)));
  const collapseAll = () => setExpanded(new Set());

  const exportCsv = () => {
    const header = ["Student", "Email", "Date", "Score", "Result", "Attempt #", "Total Questions"];
    const rows = attempts
      .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
      .map(a => [
        a.fullName, a.email,
        new Date(a.attemptedAt).toLocaleDateString("en-GB"),
        `${a.score}%`, a.passed ? "Pass" : "Fail",
        a.attemptNumber, a.totalQuestions,
      ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = `final-exam-log-${new Date().toISOString().slice(0, 10)}.csv`;
    el.click();
  };

  const totalAttempts = filtered.reduce((n, s) => n + s.attempts.length, 0);

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
          <span className="font-semibold text-sm flex-1">Final Exam Log</span>
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-medium" style={{ background: "#e27226" }}>
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Controls */}
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
                {f === "all" ? "All" : f === "pass" ? "Has Passed" : "Has Failed"}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground ml-auto">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""} · {totalAttempts} attempt{totalAttempts !== 1 ? "s" : ""}
          </p>
          {filtered.length > 0 && (
            <div className="flex gap-1.5">
              <button onClick={expandAll} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">expand all</button>
              <span className="text-muted-foreground/40">·</span>
              <button onClick={collapseAll} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">collapse all</button>
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No results found.</div>
        )}

        {/* Student rows */}
        <div className="space-y-2">
          {filtered.map(s => {
            const isOpen = expanded.has(s.userId);
            const sortedAttempts = [...s.attempts].sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime());
            return (
              <div key={s.userId} className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Student header — clickable to expand */}
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/10 transition-colors text-left"
                  onClick={() => toggleExpand(s.userId)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                      {s.attempts.length} attempt{s.attempts.length !== 1 ? "s" : ""}
                    </span>
                    {s.passes > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                        {s.passes} PASS{s.passes !== 1 ? "ES" : ""}
                      </span>
                    )}
                    {s.fails > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-600">
                        {s.fails} FAIL{s.fails !== 1 ? "S" : ""}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      Best: <span className="font-semibold text-foreground">{s.bestScore}%</span>
                    </span>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  </div>
                </button>

                {/* Expanded attempts */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border/60">
                    {sortedAttempts.map((a, i) => (
                      <div key={a.id} className="px-4 py-2.5 flex items-center gap-4 bg-secondary/5">
                        <div className="w-6 text-center text-xs font-mono text-muted-foreground flex-shrink-0">
                          #{sortedAttempts.length - i}
                        </div>
                        <div className="flex-1 text-xs text-muted-foreground">
                          {new Date(a.attemptedAt).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-right flex-shrink-0">
                          <span className="font-bold text-foreground">{a.score}%</span>
                          <span className="text-muted-foreground ml-1">/ {a.totalQuestions}q</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${a.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {a.passed ? "PASS" : "FAIL"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
