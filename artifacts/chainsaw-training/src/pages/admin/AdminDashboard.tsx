import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Award, BarChart2, Biohazard, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, ExternalLink, FileText, Infinity, KeyRound, LogOut, MapPin, MessageSquare, Newspaper, Pause, Play, Plus, QrCode, Search, ShieldCheck, Star, Trash2, Users, Users2, Video, X, XCircle } from "lucide-react";
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

  type AccessCode = {
    id: number; code: string; isUsed: boolean; isUnlimited: boolean;
    allModulesUnlocked: boolean; isPaused: boolean; notes: string | null;
    assignedTo: string | null; createdAt: string; userCount: number;
  };
  type BackupLog = { id: number; testedAt: string; testedBy: string; outcome: string; notes: string | null; createdAt: string };
  type BackupExport = { id: number; title: string; sheetUrl: string; folderId: string | null; rowCount: number; exportedAt: string };
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [accessCodesLoading, setAccessCodesLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [dataBackupOpen, setDataBackupOpen] = useState(true);
  const [accessCodesOpen, setAccessCodesOpen] = useState(true);
  const [studentRosterOpen, setStudentRosterOpen] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null); // code being edited
  const [editingNameValue, setEditingNameValue] = useState("");

  const handleSaveAssignedTo = async (code: string) => {
    if (!adminToken) return;
    const trimmed = editingNameValue.trim();
    try {
      const res = await fetch(`/api/admin/codes/${code}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ assignedTo: trimmed || null }),
      });
      if (res.ok) {
        setAccessCodes((prev) => prev.map((c) => c.code === code ? { ...c, assignedTo: trimmed || null } : c));
      }
    } finally {
      setEditingName(null);
    }
  };

  const fetchAccessCodes = useCallback(async () => {
    if (!adminToken) return;
    setAccessCodesLoading(true);
    try {
      const res = await fetch("/api/admin/codes", { headers: { admintoken: adminToken } });
      if (res.ok) setAccessCodes(await res.json());
    } finally {
      setAccessCodesLoading(false);
    }
  }, [adminToken]);

  const handleDeleteCode = async (code: string) => {
    if (!adminToken) return;
    if (!window.confirm(`Delete code "${code}"? This cannot be undone.`)) return;
    setDeleteLoading(code);
    try {
      const res = await fetch(`/api/admin/codes/${code}`, {
        method: "DELETE",
        headers: { admintoken: adminToken },
      });
      if (res.ok) {
        setAccessCodes((prev) => prev.filter((c) => c.code !== code));
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleTogglePause = async (code: string, currentlyPaused: boolean) => {
    if (!adminToken) return;
    setPauseLoading(code);
    try {
      const res = await fetch(`/api/admin/codes/${code}/pause`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ paused: !currentlyPaused }),
      });
      if (res.ok) {
        setAccessCodes((prev) => prev.map((c) => c.code === code ? { ...c, isPaused: !currentlyPaused } : c));
      }
    } finally {
      setPauseLoading(null);
    }
  };

  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [backupLogsLoading, setBackupLogsLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<BackupExport[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logTestedAt, setLogTestedAt] = useState(new Date().toISOString().slice(0, 10));
  const [logTestedBy, setLogTestedBy] = useState("");
  const [logOutcome, setLogOutcome] = useState<"pass" | "fail">("pass");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [hideTestUsers, setHideTestUsers] = useState(false);

  const TEST_DOMAINS = ["@bob.com", "@test.com", "@amy.com", "@lemon.com", "@bb.com", "@aa.com", "@chainsawcourses.com"];
  const isTestUser = (email: string) => TEST_DOMAINS.some((d) => email.toLowerCase().endsWith(d));

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

  const fetchExportHistory = useCallback(async () => {
    if (!adminToken) return;
    setExportHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/backup/exports", { headers: { admintoken: adminToken } });
      if (res.ok) setExportHistory(await res.json());
    } finally {
      setExportHistoryLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { if (adminToken) { fetchBackupLogs(); fetchExportHistory(); fetchAccessCodes(); } }, [adminToken, fetchBackupLogs, fetchExportHistory, fetchAccessCodes]);


  const handleExport = async () => {
    if (!adminToken) return;
    setExportLoading(true);
    try {
      const res = await fetch("/api/admin/backup/export", { headers: { admintoken: adminToken } });
      if (res.status === 401) { alert("Admin session expired — please log out and back in."); return; }
      if (!res.ok) { const body = await res.json().catch(() => ({})) as { error?: string }; alert(`Export failed: ${body.error ?? res.statusText}`); return; }
      const { url } = await res.json() as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
      fetchExportHistory();
    } catch (err) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
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
          fetchAccessCodes();
        },
      }
    );
  };

  const filteredRoster = students?.filter((s) => {
    if (hideTestUsers && isTestUser(s.email)) return false;
    return (
      s.fullName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      s.activationCode?.toLowerCase().includes(rosterSearch.toLowerCase())
    );
  });

  const testUserCount = students?.filter((s) => isTestUser(s.email)).length ?? 0;

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
      <header className="border-b border-border bg-card/50 fixed top-0 left-0 right-0 z-50 w-full">
        {/* Row 1 — brand + primary actions */}
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> OVERSEER
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="font-mono text-xs bg-primary text-primary-foreground"
              onClick={() => window.open(`${import.meta.env.BASE_URL}admin-preview?token=${encodeURIComponent(adminToken ?? "")}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> APP PREVIEW
            </Button>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="font-mono text-xs">
              <LogOut className="w-4 h-4 mr-1" /> LOGOUT
            </Button>
          </div>
        </div>
        {/* Row 2 — navigation links */}
        <div className="border-t border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto">
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
          </div>
        </div>
        {/* Row 3 — EQA / quality features */}
        <div className="border-t border-border bg-orange-50/40">
          <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto">
            <span className="font-mono text-xs text-muted-foreground mr-1">EQA:</span>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/policy-docs"><FileText className="w-3.5 h-3.5 mr-1" /> POLICY DOCS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/stats"><BarChart2 className="w-3.5 h-3.5 mr-1" /> STATISTICS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/certificates"><Award className="w-3.5 h-3.5 mr-1" /> CERT REGISTER</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/exam-log"><BookOpen className="w-3.5 h-3.5 mr-1" /> FINAL EXAM LOG</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/assessment-bank"><ClipboardList className="w-3.5 h-3.5 mr-1" /> FINAL EXAM BANK</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/module-quizzes"><ClipboardList className="w-3.5 h-3.5 mr-1" /> MODULE QUIZZES</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/mock-questions"><ClipboardCheck className="w-3.5 h-3.5 mr-1" /> MOCK QUESTIONS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/iqa"><ShieldCheck className="w-3.5 h-3.5 mr-1" /> IQA LOG</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/reasonable-adjustments"><Users2 className="w-3.5 h-3.5 mr-1" /> ADJUSTMENTS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/malpractice"><AlertTriangle className="w-3.5 h-3.5 mr-1" /> MALPRACTICE</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 pt-[140px]">

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
              <div className="text-3xl font-black font-mono">{stats?.totalLearners || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.activeLearners || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.totalLearners ? Math.round(((stats.completedLearners ?? 0) / stats.totalLearners) * 100) : 0}%</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Waivers Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.waiversSigned ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Data & Backup */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <button className="flex items-center gap-2 text-left group" onClick={() => setDataBackupOpen((v) => !v)}>
              <div>
                <CardTitle className="font-mono uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Data &amp; Backup
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Export learner data · View Replit DB backups · Log quarterly restoration tests
                </p>
              </div>
              {dataBackupOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />}
            </button>
            {dataBackupOpen && <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-9 font-mono text-xs"
                onClick={handleExport}
                disabled={exportLoading}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                {exportLoading ? "PREPARING…" : "BACKUP ALL DATA"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 font-mono text-xs"
                asChild
              >
                <a href={exportHistory.find(e => e.folderId)?.folderId ? `https://drive.google.com/drive/folders/${exportHistory.find(e => e.folderId)!.folderId}` : "https://drive.google.com/drive/search?q=Chainsaw+Courses+User+Backup"} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> BACKUP FOLDER
                </a>
              </Button>
              <Button
                size="sm"
                className="h-9 font-mono text-xs"
                onClick={() => { setLogDialogOpen(true); setLogTestedAt(new Date().toISOString().slice(0, 10)); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> LOG RESTORE TEST
              </Button>
            </div>}
          </CardHeader>
          {dataBackupOpen && (
            <CardContent className="p-0 space-y-0">

            {/* Export History */}
            <div className="px-6 pt-4 pb-2">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Export History</p>
              {exportHistoryLoading ? (
                <div className="py-4 text-center text-muted-foreground font-mono text-sm">LOADING…</div>
              ) : exportHistory.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground font-mono text-xs">
                  No exports yet. Click "BACKUP DATA" to create your first export.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/30">
                      <TableRow className="border-border">
                        <TableHead className="font-mono text-xs">DATE</TableHead>
                        <TableHead className="font-mono text-xs">TITLE</TableHead>
                        <TableHead className="font-mono text-xs">LEARNERS</TableHead>
                        <TableHead className="font-mono text-xs">DRIVE FOLDER</TableHead>
                        <TableHead className="font-mono text-xs">OPEN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportHistory.map((exp) => (
                        <TableRow key={exp.id} className="border-border hover:bg-secondary/10">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {new Date(exp.exportedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{exp.title}</TableCell>
                          <TableCell className="font-mono text-xs">{exp.rowCount}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {exp.folderId ? (
                              <a
                                href={`https://drive.google.com/drive/folders/${exp.folderId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> FOLDER
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={exp.sheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-mono text-xs flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> SHEET
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="border-t border-border mx-6" />

            {/* Restoration Test Logs */}
            <div className="px-6 pt-4 pb-0">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Restoration Tests</p>
            </div>
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
                      <TableHead className="font-mono text-xs">ASSIGNED TO</TableHead>
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
          )}
        </Card>

        {/* Access Codes */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <button className="flex items-center gap-2 text-left group" onClick={() => setAccessCodesOpen((v) => !v)}>
              <div>
                <CardTitle className="font-mono uppercase tracking-widest flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" /> Access Codes
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Manage unlimited/reviewer codes · Pause to block access instantly
                </p>
              </div>
              {accessCodesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />}
            </button>
            {accessCodesOpen && <Button size="sm" onClick={() => { setCreateCodeOpen(true); setGeneratedCode(""); }} className="h-9 font-mono text-xs">
              <Plus className="w-4 h-4 mr-1" /> NEW CODE
            </Button>}
          </CardHeader>
          {accessCodesOpen && (
            <CardContent className="p-0">
            {accessCodesLoading ? (
              <div className="py-8 text-center text-muted-foreground font-mono text-sm">LOADING…</div>
            ) : accessCodes.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-mono text-xs">No codes yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow className="border-border">
                      <TableHead className="font-mono text-xs">CODE</TableHead>
                      <TableHead className="font-mono text-xs">TYPE</TableHead>
                      <TableHead className="font-mono text-xs">USERS</TableHead>
                      <TableHead className="font-mono text-xs">ASSIGNED TO</TableHead>
                      <TableHead className="font-mono text-xs">STATUS</TableHead>
                      <TableHead className="font-mono text-xs text-right">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessCodes.map((c) => (
                      <TableRow key={c.id} className={`border-border hover:bg-secondary/10 ${c.isPaused ? "opacity-50" : ""}`}>
                        <TableCell className="font-mono text-sm font-bold tracking-wider">{c.code}</TableCell>
                        <TableCell>
                          {c.isUnlimited ? (
                            <Badge variant="outline" className="font-mono text-[10px] rounded-none text-purple-600 border-purple-500 flex items-center gap-1 w-fit">
                              <Infinity className="w-3 h-3" /> UNLIMITED
                            </Badge>
                          ) : c.isUsed ? (
                            <Badge variant="outline" className="font-mono text-[10px] rounded-none text-muted-foreground flex items-center gap-1 w-fit">USED</Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-[10px] rounded-none text-green-600 border-green-500 flex items-center gap-1 w-fit">UNUSED</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.userCount}</TableCell>
                        <TableCell className="text-xs max-w-[160px]">
                          {editingName === c.code ? (
                            <input
                              autoFocus
                              className="w-full bg-secondary/40 border border-border rounded px-1.5 py-0.5 font-mono text-xs outline-none focus:border-primary"
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              onBlur={() => handleSaveAssignedTo(c.code)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSaveAssignedTo(c.code); if (e.key === "Escape") setEditingName(null); }}
                            />
                          ) : (
                            <button
                              className="text-left w-full truncate hover:text-foreground transition-colors group"
                              onClick={() => { setEditingName(c.code); setEditingNameValue(c.assignedTo ?? ""); }}
                              title="Click to edit"
                            >
                              {c.assignedTo ? (
                                <span className="font-medium text-foreground">{c.assignedTo}</span>
                              ) : (
                                <span className="text-muted-foreground/50 group-hover:text-muted-foreground italic">unassigned</span>
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.isPaused ? (
                            <Badge variant="outline" className="font-mono text-[10px] rounded-none text-destructive border-destructive flex items-center gap-1 w-fit">
                              <Pause className="w-3 h-3" /> PAUSED
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-mono text-[10px] rounded-none text-green-600 border-green-600 flex items-center gap-1 w-fit">
                              <Play className="w-3 h-3" /> ACTIVE
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={c.isPaused ? "default" : "outline"}
                              className={`font-mono text-xs h-7 ${c.isPaused ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : "text-destructive border-destructive hover:bg-destructive/10"}`}
                              disabled={pauseLoading === c.code}
                              onClick={() => handleTogglePause(c.code, c.isPaused)}
                            >
                              {pauseLoading === c.code ? "…" : c.isPaused ? "RESUME" : "PAUSE"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="font-mono text-xs h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={deleteLoading === c.code}
                              onClick={() => handleDeleteCode(c.code)}
                              title="Delete code"
                            >
                              {deleteLoading === c.code ? "…" : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          )}
        </Card>

        {/* Students Table */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <button className="flex items-center gap-2 text-left group" onClick={() => setStudentRosterOpen((v) => !v)}>
              <CardTitle className="font-mono uppercase tracking-widest">Student Roster</CardTitle>
              {studentRosterOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />}
            </button>
            {studentRosterOpen && <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter roster..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="pl-9 h-9 font-mono text-xs bg-background"
                />
              </div>
              {testUserCount > 0 && (
                <Button
                  size="sm"
                  variant={hideTestUsers ? "default" : "outline"}
                  onClick={() => setHideTestUsers((v) => !v)}
                  className="h-9 font-mono text-xs"
                >
                  {hideTestUsers ? `TEST HIDDEN (${testUserCount})` : `HIDE TEST (${testUserCount})`}
                </Button>
              )}
              <Button size="sm" onClick={() => { setCreateCodeOpen(true); setGeneratedCode(""); }} className="h-9 font-mono text-xs">
                <Plus className="w-4 h-4 mr-1" /> NEW CODE
              </Button>
            </div>}
          </CardHeader>
          {studentRosterOpen && (
            <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {filteredRoster?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO RECORDS FOUND</div>
              )}
              {filteredRoster?.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-2">
                      {student.fullName}
                      {isTestUser(student.email) && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-500 text-[9px] font-mono rounded-none py-0 shrink-0">TEST</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-mono text-[10px] opacity-60">{student.activationCode || "—"}</span>
                      <span className="text-muted-foreground">·</span>
                      {student.waiverSigned ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] font-mono rounded-none py-0">SIGNED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-mono rounded-none py-0">MISSING</Badge>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{student.completedModules}/{student.totalModules}</span>
                      {(student.totalQuizAttempts ?? 0) > 0 && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{student.totalQuizAttempts} quiz attempts</span>
                        </>
                      )}
                      {(student.feedbackCount ?? 0) > 0 && (
                        <Link href={`/admin/feedback?student=${encodeURIComponent(student.fullName)}`} className="flex items-center gap-0.5 text-primary font-mono text-[10px]">
                          <Star className="w-2.5 h-2.5 fill-primary" /> {student.feedbackCount} feedback
                        </Link>
                      )}
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
                    <TableHead className="font-mono text-xs text-center">QUIZ ATTEMPTS</TableHead>
                    <TableHead className="font-mono text-xs text-center">FEEDBACK</TableHead>
                    <TableHead className="font-mono text-xs text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoster?.map((student) => (
                    <TableRow key={student.id} className={`border-border hover:bg-secondary/10 ${isTestUser(student.email) ? "opacity-70" : ""}`}>
                      <TableCell>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {student.fullName}
                          {isTestUser(student.email) && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500 text-[9px] font-mono rounded-none py-0">TEST</Badge>
                          )}
                        </div>
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
                          <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] font-mono rounded-none">SIGNED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-mono rounded-none">MISSING</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {(student.totalQuizAttempts ?? 0) > 0 ? (
                          <span className="font-bold">{student.totalQuizAttempts}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {(student.feedbackCount ?? 0) > 0 ? (
                          <Button size="sm" variant="outline" className="font-mono text-[10px] h-6 px-2 text-primary border-primary/40 hover:bg-primary/10" asChild>
                            <Link href={`/admin/feedback?student=${encodeURIComponent(student.fullName)}`}>
                              <Star className="w-3 h-3 mr-1 fill-primary" />{student.feedbackCount}
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs font-mono">—</span>
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
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground font-mono text-sm">
                        NO RECORDS FOUND
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          )}
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