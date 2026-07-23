import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Biohazard, CheckCircle2, ClipboardCheck, Download, ExternalLink, FileText, LogOut, MapPin, MessageSquare, Newspaper, Plus, QrCode, Search, ShieldCheck, Star, Users, Video, X, XCircle } from "lucide-react";
import {
  useGetAdminStats,
  useListStudents,
  useCreateActivationCode,
  useListAllInspections,
  useListAllRiskAssessments,
  useListNewsItems,
  getGetAdminStatsQueryKey,
  getListStudentsQueryKey,
  getListAllInspectionsQueryKey,
  getListAllRiskAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

type SearchCategory = "students" | "inspections" | "risk" | "news";

interface SearchResult {
  category: SearchCategory;
  id: number | string;
  primary: string;
  secondary?: string;
  href: string;
  badge?: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady, clearToken } = useAdminSession();

  const enabled = !!adminToken;

  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), enabled } });
  const { data: students, refetch: refetchStudents } = useListStudents({ query: { queryKey: getListStudentsQueryKey(), enabled } });
  const { data: inspections } = useListAllInspections({ query: { queryKey: getListAllInspectionsQueryKey(), enabled } });
  const { data: riskAssessments } = useListAllRiskAssessments({ query: { queryKey: ["listAllRiskAssessments"], enabled } });
  const { data: newsItems } = useListNewsItems();

  const createCode = useCreateActivationCode();

  const [globalSearch, setGlobalSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  type BackupLog = { id: number; testedAt: string; testedBy: string; outcome: string; notes: string | null; createdAt: string };
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [backupLogsLoading, setBackupLogsLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logTestedAt, setLogTestedAt] = useState(new Date().toISOString().slice(0, 10));
  const [logTestedBy, setLogTestedBy] = useState("");
  const [logOutcome, setLogOutcome] = useState<"pass" | "fail">("pass");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchBackupLogs = useCallback(async () => {
    if (!adminToken) return;
    setBackupLogsLoading(true);
    try {
      const res = await fetch("/api/admin/backup/logs", { headers: { admintoken: adminToken } });
      if (res.ok) setBackupLogs(await res.json());
    } finally {
      setBackupLogsLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { if (adminToken) fetchBackupLogs(); }, [adminToken, fetchBackupLogs]);

  const handleExport = async () => {
    if (!adminToken) return;
    setExportLoading(true);
    try {
      const res = await fetch("/api/admin/backup/export", { headers: { admintoken: adminToken } });
      if (!res.ok) return;
      const { url } = await res.json() as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setExportLoading(false);
    }
  };

  const handleLogSave = async () => {
    if (!adminToken || !logTestedBy.trim()) return;
    setLogSaving(true);
    try {
      const res = await fetch("/api/admin/backup/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ testedAt: new Date(logTestedAt).toISOString(), testedBy: logTestedBy.trim(), outcome: logOutcome, notes: logNotes.trim() || undefined }),
      });
      if (res.ok) {
        setLogDialogOpen(false);
        setLogTestedBy("");
        setLogNotes("");
        setLogOutcome("pass");
        setLogTestedAt(new Date().toISOString().slice(0, 10));
        fetchBackupLogs();
      }
    } finally {
      setLogSaving(false);
    }
  };

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const handleLogout = () => {
    clearToken();
    setLocation("/");
  };

  const handleCreateCode = () => {
    createCode.mutate(
      { data: { code: `CHT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, notes: newCodeNotes } },
      {
        onSuccess: (data) => {
          setGeneratedCode(data.code);
          setNewCodeNotes("");
        },
      }
    );
  };

  const filteredRoster = students?.filter((s) =>
    s.fullName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(rosterSearch.toLowerCase()) ||
    s.activationCode?.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  // Global search across all categories
  const q = globalSearch.trim().toLowerCase();
  const searchResults = useMemo<SearchResult[]>(() => {
    if (q.length < 2) return [];
    const results: SearchResult[] = [];

    // Students
    students?.forEach((s) => {
      if (
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.activationCode?.toLowerCase().includes(q)
      ) {
        results.push({
          category: "students",
          id: s.id,
          primary: s.fullName,
          secondary: s.email,
          href: `/admin/students/${s.id}`,
          badge: `${s.completedModules}/${s.totalModules} modules`,
        });
      }
    });

    // Inspections
    inspections?.forEach((ins) => {
      const sawId = (ins as { sawIdentifier?: string | null }).sawIdentifier ?? "";
      if (
        sawId.toLowerCase().includes(q) ||
        String(ins.id).includes(q)
      ) {
        results.push({
          category: "inspections",
          id: ins.id,
          primary: sawId ? `Saw: ${sawId}` : `Inspection #${ins.id}`,
          secondary: (ins as { hasFailures?: boolean }).hasFailures ? "Has failures" : "All items passed",
          href: "/admin/inspections",
          badge: (ins as { hasFailures?: boolean }).hasFailures ? "FAILURES" : "PASS",
        });
      }
    });

    // Risk Assessments
    riskAssessments?.forEach((ra) => {
      const task = (ra as { taskDescription?: string | null }).taskDescription ?? "";
      const site = (ra as { siteDescription?: string | null }).siteDescription ?? "";
      const address = (ra as { address?: string | null }).address ?? "";
      if (
        task.toLowerCase().includes(q) ||
        site.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q)
      ) {
        results.push({
          category: "risk",
          id: ra.id,
          primary: task || `Assessment #${ra.id}`,
          secondary: address || site || undefined,
          href: "/admin/risk-assessments",
        });
      }
    });

    // News
    newsItems?.forEach((n) => {
      if (
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        (n.feedSource ?? "").toLowerCase().includes(q)
      ) {
        results.push({
          category: "news",
          id: n.id,
          primary: n.title,
          secondary: n.feedSource ?? undefined,
          href: "/admin/news",
          badge: n.status === "pending" ? "PENDING" : undefined,
        });
      }
    });

    return results;
  }, [q, students, inspections, riskAssessments, newsItems]);

  const categoryLabel: Record<SearchCategory, string> = {
    students: "Students",
    inspections: "Inspections",
    risk: "Risk Assessments",
    news: "News",
  };

  const categoryIcon: Record<SearchCategory, React.ReactNode> = {
    students: <Users className="w-3 h-3" />,
    inspections: <ClipboardCheck className="w-3 h-3" />,
    risk: <MapPin className="w-3 h-3" />,
    news: <Newspaper className="w-3 h-3" />,
  };

  const grouped = useMemo(() => {
    const map: Partial<Record<SearchCategory, SearchResult[]>> = {};
    searchResults.forEach((r) => {
      if (!map[r.category]) map[r.category] = [];
      map[r.category]!.push(r);
    });
    return map;
  }, [searchResults]);

  const showResults = q.length >= 2;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        {/* Row 1 — brand + primary actions */}
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> OVERSEER
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="font-mono text-xs bg-primary text-primary-foreground" asChild>
              <a href={`${import.meta.env.BASE_URL}admin-preview`} target="_blank"><ExternalLink className="w-4 h-4 mr-1" /> APP PREVIEW</a>
            </Button>
            <Button size="sm" variant="outline" className="font-mono text-xs" asChild>
              <a href={`${import.meta.env.BASE_URL}exam-preview`} target="_blank"><Star className="w-4 h-4 mr-1" /> EXAM FANFARE</a>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="font-mono text-xs">
              <LogOut className="w-4 h-4 mr-1" /> LOGOUT
            </Button>
          </div>
        </div>
        {/* Row 2 — navigation links */}
        <div className="border-t border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/videos"><Video className="w-3.5 h-3.5 mr-1" /> VIDEO SETTINGS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/pdfs"><FileText className="w-3.5 h-3.5 mr-1" /> PDF SETTINGS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/feedback"><Star className="w-3.5 h-3.5 mr-1" /> FEEDBACK</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/inspections"><ClipboardCheck className="w-3.5 h-3.5 mr-1" /> INSPECTIONS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/risk-assessments"><MapPin className="w-3.5 h-3.5 mr-1" /> RISK ASSESSMENTS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/news"><Newspaper className="w-3.5 h-3.5 mr-1" /> NEWS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/qr-codes"><QrCode className="w-3.5 h-3.5 mr-1" /> QR CODES</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/welcome-note"><MessageSquare className="w-3.5 h-3.5 mr-1" /> WELCOME NOTE</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/gateway"><MapPin className="w-3.5 h-3.5 mr-1" /> GATEWAY</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <a href={`${import.meta.env.BASE_URL}pdfs/IIRSM_Submission_Brief.pdf`} download="IIRSM_Submission_Brief.pdf">
                <FileText className="w-3.5 h-3.5 mr-1" /> IIRSM BRIEF
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Global Search */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across students, inspections, risk assessments, news…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10 pr-10 h-11 font-mono text-sm bg-card"
            />
            {globalSearch && (
              <button
                onClick={() => setGlobalSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showResults && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 border-border shadow-lg max-h-[70vh] overflow-y-auto">
              <CardContent className="p-0">
                {searchResults.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground font-mono text-sm">
                    No results for "{globalSearch}"
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {(Object.keys(grouped) as SearchCategory[]).map((cat) => (
                      <div key={cat}>
                        <div className="px-4 py-2 bg-secondary/30 flex items-center gap-2">
                          {categoryIcon[cat]}
                          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-bold">
                            {categoryLabel[cat]} ({grouped[cat]!.length})
                          </span>
                        </div>
                        {grouped[cat]!.map((result) => (
                          <Link
                            key={`${result.category}-${result.id}`}
                            href={result.href}
                            onClick={() => setGlobalSearch("")}
                            className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-medium truncate">{result.primary}</p>
                              {result.secondary && (
                                <p className="text-xs text-muted-foreground truncate">{result.secondary}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {result.badge && (
                                <Badge variant="outline" className="font-mono text-xs">{result.badge}</Badge>
                              )}
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.totalStudents || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.activeThisWeek || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.completionRate || 0}%</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Waivers Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.waiversSigned || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-mono uppercase tracking-widest">Student Roster</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter roster..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="pl-9 h-9 font-mono text-xs bg-background"
                />
              </div>
              <Button size="sm" onClick={() => { setCreateCodeOpen(true); setGeneratedCode(""); }} className="h-9 font-mono text-xs">
                <Plus className="w-4 h-4 mr-1" /> NEW CODE
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {filteredRoster?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO RECORDS FOUND</div>
              )}
              {filteredRoster?.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{student.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-[10px] opacity-60">{student.activationCode || "—"}</span>
                      <span className="text-muted-foreground">·</span>
                      {student.waiverSigned ? (
                        <Badge variant="outline" className="text-primary border-primary text-[10px] font-mono rounded-none py-0">SIGNED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-mono rounded-none py-0">MISSING</Badge>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{student.completedModules}/{student.totalModules}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="font-mono text-xs h-9 px-4 shrink-0" asChild>
                    <Link href={`/admin/students/${student.id}`}>VIEW</Link>
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-xs">OPERATOR</TableHead>
                    <TableHead className="font-mono text-xs">CODE</TableHead>
                    <TableHead className="font-mono text-xs">PROGRESS</TableHead>
                    <TableHead className="font-mono text-xs">WAIVER</TableHead>
                    <TableHead className="font-mono text-xs text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoster?.map((student) => (
                    <TableRow key={student.id} className="border-border hover:bg-secondary/10">
                      <TableCell>
                        <div className="font-bold text-sm">{student.fullName}</div>
                        <div className="text-xs text-muted-foreground">{student.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs opacity-70">{student.activationCode || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${(student.completedModules / (student.totalModules || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {student.completedModules}/{student.totalModules}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.waiverSigned ? (
                          <Badge variant="outline" className="text-primary border-primary text-[10px] font-mono rounded-none">SIGNED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-mono rounded-none">MISSING</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="font-mono text-xs h-7" asChild>
                          <Link href={`/admin/students/${student.id}`}>VIEW</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRoster?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono text-sm">
                        NO RECORDS FOUND
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Data & Backup */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-mono uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" /> Data &amp; Backup
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Export learner data · Log quarterly restoration tests
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-9 font-mono text-xs"
                onClick={handleExport}
                disabled={exportLoading}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {exportLoading ? "PREPARING…" : "DOWNLOAD CSV"}
              </Button>
              <Button
                size="sm"
                className="h-9 font-mono text-xs"
                onClick={() => { setLogDialogOpen(true); setLogTestedAt(new Date().toISOString().slice(0, 10)); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> LOG RESTORE TEST
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {backupLogsLoading ? (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">LOADING…</div>
            ) : backupLogs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">
                No restoration tests logged yet. Click "Log Restore Test" after each quarterly check.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow className="border-border">
                      <TableHead className="font-mono text-xs">DATE TESTED</TableHead>
                      <TableHead className="font-mono text-xs">TESTED BY</TableHead>
                      <TableHead className="font-mono text-xs">OUTCOME</TableHead>
                      <TableHead className="font-mono text-xs">NOTES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backupLogs.map((log) => (
                      <TableRow key={log.id} className="border-border hover:bg-secondary/10">
                        <TableCell className="font-mono text-xs">
                          {new Date(log.testedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{log.testedBy}</TableCell>
                        <TableCell>
                          {log.outcome === "pass" ? (
                            <Badge variant="outline" className="text-green-600 border-green-600 font-mono text-[10px] rounded-none flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> PASS
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-destructive border-destructive font-mono text-[10px] rounded-none flex items-center gap-1 w-fit">
                              <XCircle className="w-3 h-3" /> FAIL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{log.notes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Backup restoration test log dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest">Log Restoration Test</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Date Tested</label>
              <Input
                type="date"
                value={logTestedAt}
                onChange={(e) => setLogTestedAt(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Tested By</label>
              <Input
                value={logTestedBy}
                onChange={(e) => setLogTestedBy(e.target.value)}
                placeholder="Your name"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLogOutcome("pass")}
                  className={`flex-1 h-9 font-mono text-xs rounded border flex items-center justify-center gap-1.5 transition-colors ${
                    logOutcome === "pass"
                      ? "bg-green-600 text-white border-green-600"
                      : "border-border text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                </button>
                <button
                  type="button"
                  onClick={() => setLogOutcome("fail")}
                  className={`flex-1 h-9 font-mono text-xs rounded border flex items-center justify-center gap-1.5 transition-colors ${
                    logOutcome === "fail"
                      ? "bg-destructive text-white border-destructive"
                      : "border-border text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" /> FAIL
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Notes (optional)</label>
              <Textarea
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="e.g. Restored from 22 Jul backup. Full data verified. RTO ~35 min."
                className="font-mono text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialogOpen(false)} className="font-mono">CANCEL</Button>
            <Button
              onClick={handleLogSave}
              disabled={logSaving || !logTestedBy.trim()}
              className="font-mono font-bold"
            >
              {logSaving ? "SAVING…" : "SAVE ENTRY"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createCodeOpen} onOpenChange={setCreateCodeOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest">Generate Access Code</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {generatedCode ? (
              <div className="text-center p-6 bg-secondary/30 border border-border rounded-md">
                <div className="text-xs text-muted-foreground font-mono mb-2 uppercase">Code Generated Successfully</div>
                <div className="text-2xl font-black font-mono text-primary tracking-widest">{generatedCode}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase">Optional Notes (e.g. Buyer Info)</label>
                <Input
                  value={newCodeNotes}
                  onChange={(e) => setNewCodeNotes(e.target.value)}
                  placeholder="Order #12345"
                  className="font-mono"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {!generatedCode ? (
              <Button onClick={handleCreateCode} disabled={createCode.isPending} className="font-mono w-full font-bold">
                {createCode.isPending ? "GENERATING..." : "GENERATE NOW"}
              </Button>
            ) : (
              <Button onClick={() => setCreateCodeOpen(false)} className="font-mono w-full font-bold">DONE</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
