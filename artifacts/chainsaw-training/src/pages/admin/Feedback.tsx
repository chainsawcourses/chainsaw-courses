import { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, Search, Star, X, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import {
  useListFeedback, getListFeedbackQueryKey,
  useListAppFeedback, getListAppFeedbackQueryKey,
} from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

type Tab = "by-student" | "by-module" | "course";

export default function Feedback() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const { data: videoFeedback, isLoading: loadingVideo } = useListFeedback({
    query: { queryKey: getListFeedbackQueryKey(), enabled: !!adminToken },
  });

  const { data: courseFeedback, isLoading: loadingCourse } = useListAppFeedback({
    query: { queryKey: getListAppFeedbackQueryKey(), enabled: !!adminToken },
  });

  // Read ?student= param from roster link — pre-fills search and opens by-student tab
  const studentParam = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("student") ?? "";
  }, [search]);

  const [activeTab, setActiveTab] = useState<Tab>(studentParam ? "by-student" : "by-module");
  const [studentSearch, setStudentSearch] = useState(studentParam);
  const [courseSearch, setCourseSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (studentParam) {
      setStudentSearch(studentParam);
      setActiveTab("by-student");
    }
  }, [studentParam]);

  const videoAvg = videoFeedback && videoFeedback.length > 0
    ? (videoFeedback.reduce((s, f) => s + f.rating, 0) / videoFeedback.length).toFixed(1)
    : null;

  const courseAvg = courseFeedback && courseFeedback.length > 0
    ? (courseFeedback.reduce((s, f) => s + f.rating, 0) / courseFeedback.length).toFixed(1)
    : null;

  // ── By Module grouping ─────────────────────────────────────────────────────
  const moduleGroups = useMemo(() => {
    if (!videoFeedback) return [];
    const map = new Map<number, { moduleId: number; moduleTitle: string; entries: typeof videoFeedback }>();
    for (const f of videoFeedback) {
      if (!map.has(f.moduleId)) {
        map.set(f.moduleId, { moduleId: f.moduleId, moduleTitle: f.moduleTitle, entries: [] });
      }
      map.get(f.moduleId)!.entries.push(f);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        avg: g.entries.reduce((s, e) => s + e.rating, 0) / g.entries.length,
        count: g.entries.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [videoFeedback]);

  // ── By Student grouping ────────────────────────────────────────────────────
  const studentGroups = useMemo(() => {
    if (!videoFeedback) return [];
    const map = new Map<string, { studentName: string; entries: typeof videoFeedback }>();
    for (const f of videoFeedback) {
      const name = f.studentName ?? "Unknown";
      if (!map.has(name)) map.set(name, { studentName: name, entries: [] });
      map.get(name)!.entries.push(f);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        avg: g.entries.reduce((s, e) => s + e.rating, 0) / g.entries.length,
        count: g.entries.length,
      }))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [videoFeedback]);

  const sq = studentSearch.trim().toLowerCase();
  const filteredStudentGroups = sq
    ? studentGroups.filter((g) =>
        g.studentName.toLowerCase().includes(sq) ||
        g.entries.some((e) =>
          e.moduleTitle.toLowerCase().includes(sq) ||
          (e.comment ?? "").toLowerCase().includes(sq)
        )
      )
    : studentGroups;

  const cq = courseSearch.trim().toLowerCase();
  const filteredCourse = cq
    ? courseFeedback?.filter((f) =>
        (f.comment ?? "").toLowerCase().includes(cq) ||
        (f.studentName ?? "").toLowerCase().includes(cq)
      )
    : courseFeedback;

  const toggleModule = (id: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStudent = (name: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const expandAllStudents = () => setExpandedStudents(new Set(filteredStudentGroups.map((g) => g.studentName)));
  const collapseAllStudents = () => setExpandedStudents(new Set());

  const Stars = ({ rating, size = "w-3.5 h-3.5" }: { rating: number; size?: string }) => (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
      ))}
    </span>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 fixed top-0 left-0 right-0 z-50 w-full">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> FEEDBACK
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-t border-border">
          <div className="max-w-5xl mx-auto px-4 flex gap-1 py-1.5">
            {(["by-module", "by-student", "course"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {tab === "by-module" ? "By Module" : tab === "by-student" ? "By Student" : "Overall Course Feedback"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6 pt-[110px]">

        {/* ── BY MODULE ──────────────────────────────────────────────────── */}
        {activeTab === "by-module" && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-primary" />
              <h2 className="font-mono font-black uppercase tracking-widest text-base">Feedback by Module</h2>
              <span className="font-mono text-xs text-muted-foreground">{moduleGroups.length} modules with responses</span>
            </div>

            <Card className="bg-secondary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <span className="font-mono text-sm">
                  {videoAvg
                    ? `Overall average: ${videoAvg} / 5 across ${videoFeedback?.length} responses`
                    : "No video feedback submitted yet"}
                </span>
              </CardContent>
            </Card>

            {loadingVideo && (
              <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
            )}
            {!loadingVideo && moduleGroups.length === 0 && (
              <p className="text-center text-muted-foreground font-mono text-sm py-8">No video feedback submitted yet</p>
            )}

            <div className="space-y-3">
              {moduleGroups.map((group) => {
                const isExpanded = expandedModules.has(group.moduleId);
                return (
                  <Card key={group.moduleId} className="overflow-hidden">
                    <button className="w-full text-left" onClick={() => toggleModule(group.moduleId)}>
                      <CardHeader className="pb-3 hover:bg-secondary/10 transition-colors">
                        <CardTitle className="flex items-center justify-between text-sm font-mono gap-3">
                          <span className="truncate">{group.moduleTitle}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <Stars rating={Math.round(group.avg)} />
                            <span className="text-muted-foreground text-xs">{group.avg.toFixed(1)} · {group.count} {group.count === 1 ? "response" : "responses"}</span>
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </button>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-3 border-t border-border divide-y divide-border">
                        {group.entries.map((e) => (
                          <div key={e.id} className="py-3 first:pt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs font-bold">{e.studentName ?? "Anonymous"}</span>
                              <Stars rating={e.rating} size="w-3 h-3" />
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">
                              {e.comment ?? <span className="italic opacity-60">No comment</span>}
                            </p>
                            <div className="text-[10px] font-mono text-muted-foreground/60 mt-1 uppercase tracking-widest">
                              {new Date(e.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── BY STUDENT ─────────────────────────────────────────────────── */}
        {activeTab === "by-student" && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-primary" />
              <h2 className="font-mono font-black uppercase tracking-widest text-base">Feedback by Student</h2>
              <span className="font-mono text-xs text-muted-foreground">{studentGroups.length} students</span>
            </div>

            <Card className="bg-secondary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <span className="font-mono text-sm">
                  {videoAvg
                    ? `Average rating: ${videoAvg} / 5 across ${videoFeedback?.length} responses`
                    : "No video feedback submitted yet"}
                </span>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name, module or comment…"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
                />
                {studentSearch && (
                  <button onClick={() => setStudentSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {filteredStudentGroups.length > 0 && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={expandAllStudents} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors font-mono">expand all</button>
                  <span className="text-muted-foreground/40">·</span>
                  <button onClick={collapseAllStudents} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors font-mono">collapse all</button>
                </div>
              )}
            </div>

            {loadingVideo && (
              <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
            )}
            {!loadingVideo && filteredStudentGroups.length === 0 && (
              <p className="text-center text-muted-foreground font-mono text-sm py-8">
                {sq ? `No results for "${studentSearch}"` : "No video feedback submitted yet"}
              </p>
            )}

            <div className="space-y-2">
              {filteredStudentGroups.map((g) => {
                const isOpen = expandedStudents.has(g.studentName);
                const sortedEntries = [...g.entries].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                return (
                  <Card key={g.studentName} className="overflow-hidden">
                    {/* Student header */}
                    <button
                      className="w-full text-left hover:bg-secondary/10 transition-colors"
                      onClick={() => toggleStudent(g.studentName)}
                    >
                      <CardHeader className="py-3">
                        <CardTitle className="flex items-center justify-between text-sm font-mono gap-3">
                          <span className="font-bold">{g.studentName}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <Stars rating={Math.round(g.avg)} size="w-3 h-3" />
                            <span className="text-muted-foreground text-xs">
                              {g.avg.toFixed(1)} avg · {g.count} {g.count === 1 ? "response" : "responses"}
                            </span>
                            {isOpen
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </button>

                    {/* Expanded video feedback entries */}
                    {isOpen && (
                      <CardContent className="pt-0 pb-3 border-t border-border divide-y divide-border/60">
                        {sortedEntries.map((e) => (
                          <div key={e.id} className="py-3 first:pt-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs font-semibold text-foreground truncate">{e.moduleTitle}</p>
                              <p className="text-sm text-muted-foreground font-mono mt-0.5">
                                {e.comment ? e.comment : <span className="italic opacity-60">No comment</span>}
                              </p>
                              <div className="text-[10px] font-mono text-muted-foreground/60 mt-1 uppercase tracking-widest">
                                {new Date(e.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <Stars rating={e.rating} size="w-3 h-3" />
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── OVERALL COURSE FEEDBACK ─────────────────────────────────────── */}
        {activeTab === "course" && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-primary" />
              <h2 className="font-mono font-black uppercase tracking-widest text-base">Overall Course Feedback</h2>
            </div>

            <Card className="bg-secondary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span className="font-mono text-sm">
                  {courseAvg
                    ? `Average rating: ${courseAvg} / 5 across ${courseFeedback?.length} responses`
                    : "No course feedback submitted yet"}
                </span>
              </CardContent>
            </Card>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student or comment…"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
              />
              {courseSearch && (
                <button onClick={() => setCourseSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {loadingCourse && (
              <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
            )}
            {!loadingCourse && filteredCourse?.length === 0 && (
              <p className="text-center text-muted-foreground font-mono text-sm py-8">
                {cq ? `No results for "${courseSearch}"` : "No course feedback submitted yet"}
              </p>
            )}

            <div className="space-y-3">
              {filteredCourse?.map((f) => (
                <Card key={f.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-mono">
                      <span className="text-muted-foreground">{f.studentName ?? "Anonymous"}</span>
                      <span className="flex items-center gap-1 text-primary">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < f.rating ? "fill-primary" : "text-muted-foreground"}`} />
                        ))}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm font-mono text-muted-foreground">
                    {f.comment ? f.comment : <span className="italic opacity-60">No comment provided</span>}
                    <div className="mt-2 text-[10px] uppercase tracking-widest opacity-60">
                      {new Date(f.createdAt).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
