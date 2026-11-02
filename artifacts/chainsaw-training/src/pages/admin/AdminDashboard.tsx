import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Award, BarChart2, Biohazard, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, ExternalLink, FileText, History, Infinity, KeyRound, LogOut, MapPin, MessageSquare, Newspaper, Pause, Play, Plus, QrCode, Search, ShieldCheck, Star, Trash2, Users, Users2, Video, X, XCircle } from "lucide-react";
import {
  useGetAdminStats,
  useListStudents,
  useCreateActivationCode,
  useListAllInspections,
  useListAllRiskAssessments,
  useListNewsItems,
  useGetBillingAlerts,
  useGetBillingSupportNotifications,
  useGetAssessmentMediaCleanupHealth,
  getGetBillingAlertsQueryKey,
  getGetBillingSupportNotificationsQueryKey,
  getGetAssessmentMediaCleanupHealthQueryKey,
  getGetAdminStatsQueryKey,
  getListStudentsQueryKey,
  getListAllInspectionsQueryKey,
  getListAllRiskAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { appPath } from "../../lib/routing";
import AdminReadError from "./AdminReadError";

type SearchCategory = "students" | "inspections" | "risk" | "news";

interface SearchResult {
  category: SearchCategory;
  id: number | string;
  primary: string;
  secondary?: string;
  href: string;
  badge?: string;
}

function deliveryLabel(status: string | null): string {
  if (!status) return "Not recorded";
  return status.replaceAll("_", " ").toUpperCase();
}

function deliveryIsFailed(status: string | null, error: string | null): boolean {
  return status === "failed" || error?.toLowerCase().includes("exhaust") === true;
}

function DeliveryOutcome({
  label,
  status,
  error,
  at,
}: {
  label: string;
  status: string | null;
  error: string | null;
  at: string | null;
}) {
  const failed = deliveryIsFailed(status, error);
  const sent = status === "sent";

  return (
    <div
      className={`min-w-0 border px-3 py-2 ${
        failed
          ? "border-destructive/60 bg-destructive/10"
          : sent
            ? "border-emerald-600/30 bg-emerald-50/40"
            : "border-border bg-background/60"
      }`}
      data-testid={`status-billing-${label.toLowerCase()}-${deliveryLabel(status).toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <Badge
          variant="outline"
          className={`rounded-none font-mono text-[9px] ${
            failed
              ? "border-destructive text-destructive"
              : sent
                ? "border-emerald-600 text-emerald-700"
                : "text-muted-foreground"
          }`}
        >
          {deliveryLabel(status)}
        </Badge>
        {at && <span className="ml-auto font-mono text-[9px] text-muted-foreground">{new Date(at).toLocaleString("en-GB")}</span>}
      </div>
      {error && (
        <p className={`mt-1 break-words font-mono text-[10px] ${failed ? "font-bold text-destructive" : "text-muted-foreground"}`}>
          {error.replaceAll("_", " ").toUpperCase()}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady, clearToken } = useAdminSession();
  const requestedTab = new URLSearchParams(useSearch()).get("tab");
  const activeTab = ["subscription-alerts", "billing-email-history", "replacement-code-requests"].includes(requestedTab ?? "")
    ? requestedTab
    : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const enabled = !!adminToken;
  const [billingDeliveryFilter, setBillingDeliveryFilter] = useState("");
  const [billingIncidentFilter, setBillingIncidentFilter] = useState("");
  const billingHistoryFilters = {
    ...(billingDeliveryFilter ? { deliveryOutcome: billingDeliveryFilter as "delivered" | "failed_or_exhausted" | "pending" } : {}),
    ...(billingIncidentFilter ? { incidentStatus: billingIncidentFilter as "open" | "resolved" } : {}),
  };
  const billingHistoryIsFiltered = billingDeliveryFilter !== "" || billingIncidentFilter !== "";

  const { data: stats, isError: statsError, refetch: refetchStats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey(), enabled } });
  const { data: students, isError: studentsError, isLoading: studentsLoading, refetch: refetchStudents } = useListStudents({ query: { queryKey: getListStudentsQueryKey(), enabled } });
  const { data: inspections, isError: inspectionsError, refetch: refetchInspections } = useListAllInspections({ query: { queryKey: getListAllInspectionsQueryKey(), enabled } });
  const { data: riskAssessments, isError: risksError, refetch: refetchRisks } = useListAllRiskAssessments({ query: { queryKey: getListAllRiskAssessmentsQueryKey(), enabled } });
  const { data: newsItems } = useListNewsItems();
  const { data: billingAlerts } = useGetBillingAlerts({
    query: {
      queryKey: getGetBillingAlertsQueryKey(),
      enabled,
      refetchInterval: 60_000,
    },
  });
  const {
    data: billingNotificationHistory,
    isLoading: billingNotificationHistoryLoading,
    isError: billingNotificationHistoryFailed,
  } = useGetBillingSupportNotifications(billingHistoryFilters, {
    query: {
      queryKey: getGetBillingSupportNotificationsQueryKey(billingHistoryFilters),
      enabled,
      refetchInterval: 60_000,
    },
  });
  const { data: mediaCleanupHealth } = useGetAssessmentMediaCleanupHealth({
    query: {
      queryKey: getGetAssessmentMediaCleanupHealthQueryKey(),
      enabled,
      refetchInterval: 60_000,
    },
  });

  const createCode = useCreateActivationCode();

  const [globalSearch, setGlobalSearch] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  type CodeResetRequest = {
    id: number;
    email: string;
    status: "pending" | "completed";
    supportEmailStatus: "pending" | "sent" | "failed";
    issuedCode: string | null;
    requestedAt: string;
    completedAt: string | null;
  };
  const [codeResetRequests, setCodeResetRequests] = useState<CodeResetRequest[]>([]);
  const [selectedResetCodes, setSelectedResetCodes] = useState<Record<number, string>>({});
  const [sendingResetRequestId, setSendingResetRequestId] = useState<number | null>(null);

  type AccessCode = {
    id: number; code: string; isUsed: boolean; isUnlimited: boolean;
    allModulesUnlocked: boolean; isPaused: boolean; notes: string | null;
    assignedTo: string | null; createdAt: string; userCount: number;
  };
  type BackupLog = { id: number; testedAt: string; testedBy: string; outcome: string; notes: string | null; createdAt: string };
  type BackupExport = { id: number; title: string; sheetUrl: string; folderId: string | null; rowCount: number; exportedAt: string };
  type BackupStatus = {
    state: "running" | "succeeded" | "failed";
    startedAt: string;
    source?: "manual" | "scheduled";
    error?: string;
    result?: {
      progress?: string;
      updatedAt?: string;
      format?: "encrypted" | "readable";
      url: string; folderId?: string; rootFolderId?: string; title: string; at: string; sha256?: string;
      counts: {
        tables: number; records: number; learners: number; certificates: number;
        inspections: number; risks: number; waivers?: number; assessmentMedia?: number; retailerLogos?: number;
      };
      categories?: Array<{
        key: string; label: string; title: string; url: string; folderId: string; sha256?: string;
        counts?: { tables: number; records: number; documents?: number };
      }>;
      documentFolders?: Array<{ key: string; label: string; folderId: string; count: number }>;
    };
    latestReadable?: {
      at: string; url: string; title: string; folderId: string; rootFolderId?: string;
      categories?: Array<{ key: string; label: string; title: string; url: string; folderId: string }>;
      documentFolders?: Array<{ key: string; label: string; folderId: string; count: number }>;
    } | null;
  };
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [accessCodesLoading, setAccessCodesLoading] = useState(false);
  const [pauseLoading, setPauseLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [dataBackupOpen, setDataBackupOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
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

  const fetchCodeResetRequests = useCallback(async () => {
    if (!adminToken) return;
    const response = await fetch("/api/admin/code-reset-requests", {
      headers: { admintoken: adminToken },
    });
    if (response.ok) setCodeResetRequests(await response.json() as CodeResetRequest[]);
  }, [adminToken]);

  const handleSendResetCode = async (request: CodeResetRequest) => {
    if (!adminToken) return;
    const code = selectedResetCodes[request.id];
    if (!code) return;
    setSendingResetRequestId(request.id);
    try {
      const response = await fetch(`/api/admin/code-reset-requests/${request.id}/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ code }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        alert(result.error ?? "The code could not be emailed.");
        return;
      }
      alert(result.message ?? `Code emailed to ${request.email}`);
      setSelectedResetCodes((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      await fetchCodeResetRequests();
      await fetchAccessCodes();
    } finally {
      setSendingResetRequestId(null);
    }
  };

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
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupStatusError, setBackupStatusError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!adminToken) { setBackupStatus(null); return; }
    let active = true;
    let lastState: BackupStatus["state"] | undefined;
    const update = async () => {
      try {
        const res = await fetch("/api/admin/backup/status", { headers: { admintoken: adminToken }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error("Backup status is temporarily unavailable");
        if (res.ok && active) {
          setBackupStatusError(null);
          const status = await res.json() as BackupStatus | null;
          setBackupStatus(status);
          if (lastState === "running" && status?.state !== "running") setExportLoading(false);
          if (status?.state === "succeeded" && lastState !== "succeeded") void fetchExportHistory();
          lastState = status?.state;
        }
      } catch {
        if (active) setBackupStatusError("Cannot refresh backup status. Retrying automatically; this does not mean the backup has stopped.");
      }
    };
    void update();
    const interval = window.setInterval(() => { void update(); }, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [adminToken, fetchExportHistory]);

  useEffect(() => {
    if (adminToken) {
      fetchBackupLogs();
      fetchExportHistory();
      fetchAccessCodes();
      fetchCodeResetRequests();
    }
  }, [adminToken, fetchBackupLogs, fetchExportHistory, fetchAccessCodes, fetchCodeResetRequests]);

  const handleExport = async () => {
    if (!adminToken) return;
    setExportLoading(true);
    try {
      const res = await fetch("/api/admin/backup/export", { method: "POST", headers: { admintoken: adminToken } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; run?: BackupStatus };
        if (res.status === 409 && body.run) {
          setBackupStatus(body.run);
          return;
        }
        setBackupStatus({ state: "failed", startedAt: new Date().toISOString(), error: body.error ?? `Backup could not start (${res.status})` });
        return;
      }
      setBackupStatus(await res.json() as BackupStatus);
    } catch (err) {
      setBackupStatus({ state: "failed", startedAt: new Date().toISOString(), error: `Backup could not start: ${err instanceof Error ? err.message : String(err)}` });
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

  const lastBackup = exportHistory.reduce<BackupExport | null>((latest, current) => {
    if (!current.title.endsWith(".backup.enc")) return latest;
    if (!latest || new Date(current.exportedAt).getTime() > new Date(latest.exportedAt).getTime()) {
      return current;
    }
    return latest;
  }, null);
  const lastBackupDate = backupStatus?.state === "succeeded" && backupStatus.result?.at
    ? backupStatus.result.at
    : lastBackup?.exportedAt;

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
      <header className="border-b border-border bg-card/50 w-full">
        {/* Row 1 — brand + primary actions */}
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> OVERSEER
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="font-mono text-xs bg-primary text-primary-foreground px-2 sm:px-3"
              onClick={() => window.open(`${appPath("admin-preview")}?token=${encodeURIComponent(adminToken ?? "")}`, "_blank")}
              data-testid="button-admin-app-preview"
              aria-label="Open app preview"
            >
              <ExternalLink className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">APP PREVIEW</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={handleLogout} className="font-mono text-xs px-2 sm:px-3" data-testid="button-admin-logout" aria-label="Log out">
              <LogOut className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">LOGOUT</span>
            </Button>
          </div>
        </div>
        {/* Navigation row 1 */}
        <div className="border-t border-border bg-muted/30">
          <nav aria-label="Admin settings" className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-center gap-1.5">
            <Button variant={activeTab ? "outline" : "default"} size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/dashboard" aria-current={!activeTab ? "page" : undefined}>DASHBOARD</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/videos"><Video className="w-3.5 h-3.5 mr-1" /> VIDEO SETTINGS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/pdfs"><FileText className="w-3.5 h-3.5 mr-1" /> PDF SETTINGS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/feedback"><Star className="w-3.5 h-3.5 mr-1" /> FEEDBACK</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-auto min-h-7 max-w-full py-1 whitespace-normal" asChild>
              <Link href="/admin/website-purchase-review"><MessageSquare className="w-3.5 h-3.5 mr-1 shrink-0" /> WEBSITE PURCHASE EMAIL REVIEW</Link>
            </Button>
            <Button variant={activeTab === "subscription-alerts" ? "default" : "outline"} size="sm" className="font-mono text-xs h-auto min-h-7 max-w-full py-1 whitespace-normal" asChild>
              <Link href="/admin/dashboard?tab=subscription-alerts" aria-current={activeTab === "subscription-alerts" ? "page" : undefined}><AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" /> SUBSCRIPTION ALERTS</Link>
            </Button>
            <Button variant={activeTab === "billing-email-history" ? "default" : "outline"} size="sm" className="font-mono text-xs h-auto min-h-7 max-w-full py-1 whitespace-normal" asChild>
              <Link href="/admin/dashboard?tab=billing-email-history" aria-current={activeTab === "billing-email-history" ? "page" : undefined}><History className="w-3.5 h-3.5 mr-1 shrink-0" /> BILLING EMAIL HISTORY</Link>
            </Button>
            <Button variant={activeTab === "replacement-code-requests" ? "default" : "outline"} size="sm" className="font-mono text-xs h-auto min-h-7 max-w-full py-1 whitespace-normal" asChild>
              <Link href="/admin/dashboard?tab=replacement-code-requests" aria-current={activeTab === "replacement-code-requests" ? "page" : undefined}><KeyRound className="w-3.5 h-3.5 mr-1 shrink-0" /> REPLACEMENT CODE REQUESTS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/inspections"><ClipboardCheck className="w-3.5 h-3.5 mr-1" /> INSPECTIONS</Link>
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-xs h-7" asChild>
              <Link href="/admin/risk-assessments"><MapPin className="w-3.5 h-3.5 mr-1" /> RISK ASSESSMENTS</Link>
            </Button>
          </nav>
        </div>
        {/* Navigation row 2 */}
        <div className="border-t border-border bg-muted/30">
          <nav aria-label="Admin content and directories" className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-center gap-1.5">
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
              <Link href="/admin/retailers"><MapPin className="w-3.5 h-3.5 mr-1" /> RETAILERS</Link>
            </Button>
          </nav>
        </div>
        {/* Navigation row 3 — EQA / quality features */}
        <div className="border-t border-border bg-orange-50/40">
          <nav aria-label="EQA and quality" className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center justify-center gap-1.5">
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
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {!activeTab && <>
        {mediaCleanupHealth?.warning && (
          <div
            role="alert"
            className="border border-amber-600 bg-amber-50 px-4 py-3 text-amber-950"
            data-testid="warning-assessment-media-cleanup"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold uppercase tracking-wide">Assessment media cleanup needs attention</p>
                <p className="mt-1 font-mono text-xs">
                  Automated cleanup has failed {mediaCleanupHealth.consecutiveFailures} times in a row. Check App Storage and database availability before unused uploads accumulate.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-amber-800">
                  {mediaCleanupHealth.lastFailureAt && (
                    <span>Last failure: {new Date(mediaCleanupHealth.lastFailureAt).toLocaleString("en-GB")}</span>
                  )}
                  {mediaCleanupHealth.lastSuccessAt && (
                    <span>Last success: {new Date(mediaCleanupHealth.lastSuccessAt).toLocaleString("en-GB")}</span>
                  )}
                  <span>Last removal count: {mediaCleanupHealth.lastRemovedCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {statsError && <AdminReadError subject="dashboard statistics" retry={() => void refetchStats()} />}
        {inspectionsError && <AdminReadError subject="inspection search results" retry={() => void refetchInspections()} />}
        {risksError && <AdminReadError subject="risk assessment search results" retry={() => void refetchRisks()} />}
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-secondary/20">
            <button
              type="button"
              className="w-full text-left rounded-lg hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="View student roster"
              onClick={() => {
                setStudentRosterOpen(true);
                document.getElementById("student-roster")?.scrollIntoView({ block: "start" });
              }}
            >
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{statsError || !stats ? "—" : stats.totalLearners}</div>
            </CardContent>
            </button>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{statsError || !stats ? "—" : stats.activeLearners}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{statsError || !stats ? "—" : `${stats.totalLearners ? Math.round(((stats.completedLearners ?? 0) / stats.totalLearners) * 100) : 0}%`}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Waivers Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{statsError || !stats ? "—" : stats.waiversSigned}</div>
            </CardContent>
          </Card>
        </div>

        </>}

        {activeTab === "subscription-alerts" && <Card id="subscription-alerts" className={`border-border ${billingAlerts && billingAlerts.length > 0 ? "border-amber-500/60 bg-amber-50/30" : "bg-card/30"}`}>
          <CardHeader className="pb-3">
            <CardTitle className="font-mono uppercase tracking-widest flex items-center gap-2 text-sm">
              <AlertTriangle className={`w-4 h-4 ${billingAlerts && billingAlerts.length > 0 ? "text-amber-600" : "text-primary"}`} />
              Subscription Alerts
              <Badge variant="outline" className="ml-auto rounded-none font-mono text-[10px]">
                {billingAlerts?.length ?? 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!billingAlerts || billingAlerts.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">No outstanding delivery or expiry alerts.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {billingAlerts.map((alert) => {
                  const supportNotification = (alert as typeof alert & {
                    supportNotification?: {
                      status: string;
                      deliveryStatus: string;
                      deliveryError: string | null;
                    } | null;
                  }).supportNotification;
                  return (
                  <div key={alert.id} className="border-b border-border/60 last:border-0 pb-3 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <Badge variant="outline" className={`rounded-none font-mono text-[9px] w-fit ${alert.severity === "high" ? "text-destructive border-destructive" : "text-amber-700 border-amber-600"}`}>
                        {alert.type.replaceAll("_", " ").toUpperCase()}
                      </Badge>
                      <span className="font-mono text-xs font-bold">{alert.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground sm:ml-auto">{new Date(alert.createdAt).toLocaleString("en-GB")}</span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{alert.description}</p>
                    {supportNotification?.deliveryStatus === "failed" && (
                      <p className="mt-2 border border-destructive/40 bg-destructive/5 px-2 py-1 font-mono text-[10px] text-destructive">
                        SUPPORT EMAIL FAILED — {supportNotification.deliveryError?.replaceAll("_", " ").toUpperCase() ?? "DELIVERY ERROR"}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px]">
                      {alert.userId !== null && (
                        <Link href={`/admin/students/${alert.userId}`} className="text-primary hover:underline">
                          OPEN LEARNER {alert.userId}
                        </Link>
                      )}
                      {alert.providerEventId && (
                        <span className="text-muted-foreground break-all">EVENT {alert.providerEventId}</span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        }

        {activeTab === "billing-email-history" && <Card id="billing-email-history" className="border-border bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono uppercase tracking-widest flex flex-wrap items-center gap-2 text-sm">
              <History className="h-4 w-4 text-primary" />
              Billing Email History
              <Badge variant="outline" className="ml-auto rounded-none font-mono text-[10px]" data-testid="status-billing-history-count">
                {billingNotificationHistory?.length ?? 0}
              </Badge>
            </CardTitle>
            <p className="font-mono text-[11px] text-muted-foreground">
              Opening and recovery email outcomes for current and resolved subscription incidents.
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-3 border border-border bg-background/40 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="min-w-0 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Delivery outcome
                <select
                  value={billingDeliveryFilter}
                  onChange={(event) => setBillingDeliveryFilter(event.target.value)}
                  className="mt-1 h-10 w-full min-w-0 border border-input bg-background px-3 font-mono text-xs text-foreground"
                  data-testid="select-billing-history-delivery"
                >
                  <option value="">All outcomes</option>
                  <option value="failed_or_exhausted">Failed or exhausted</option>
                  <option value="delivered">Delivered</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <label className="min-w-0 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Incident status
                <select
                  value={billingIncidentFilter}
                  onChange={(event) => setBillingIncidentFilter(event.target.value)}
                  className="mt-1 h-10 w-full min-w-0 border border-input bg-background px-3 font-mono text-xs text-foreground"
                  data-testid="select-billing-history-incident"
                >
                  <option value="">All incidents</option>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full rounded-none font-mono text-xs uppercase lg:w-auto"
                disabled={!billingHistoryIsFiltered}
                onClick={() => {
                  setBillingDeliveryFilter("");
                  setBillingIncidentFilter("");
                }}
                data-testid="button-reset-billing-history"
              >
                Reset filters
              </Button>
            </div>
            {billingNotificationHistoryLoading ? (
              <p className="font-mono text-xs text-muted-foreground" data-testid="status-billing-history-loading">Loading delivery history…</p>
            ) : billingNotificationHistoryFailed ? (
              <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive" data-testid="status-billing-history-error">
                Billing email history could not be loaded.
              </p>
            ) : !billingNotificationHistory || billingNotificationHistory.length === 0 ? (
              <div className="border border-dashed border-border px-3 py-4 font-mono text-xs text-muted-foreground" data-testid="status-billing-history-empty">
                {billingHistoryIsFiltered ? (
                  <>
                    <p>No billing emails match these filters.</p>
                    <button
                      type="button"
                      className="mt-2 font-bold uppercase text-primary hover:underline"
                      onClick={() => {
                        setBillingDeliveryFilter("");
                        setBillingIncidentFilter("");
                      }}
                    >
                      Show complete recent history
                    </button>
                  </>
                ) : (
                  <p>No billing emails have been recorded yet.</p>
                )}
              </div>
            ) : (
              <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1" data-testid="list-billing-history">
                {billingNotificationHistory.map((notification) => {
                  const hasFailedDelivery =
                    deliveryIsFailed(notification.openDeliveryStatus, notification.openDeliveryError) ||
                    deliveryIsFailed(notification.resolutionDeliveryStatus, notification.resolutionDeliveryError);
                  return (
                    <article
                      key={notification.notificationId}
                      className={`border p-3 sm:p-4 ${
                        hasFailedDelivery
                          ? "border-destructive/60 bg-destructive/5"
                          : notification.status === "resolved"
                            ? "border-border bg-secondary/10"
                            : "border-amber-500/50 bg-amber-50/20"
                      }`}
                      data-testid={`card-billing-history-${notification.notificationId}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`rounded-none font-mono text-[9px] ${
                                notification.status === "resolved"
                                  ? "border-emerald-600 text-emerald-700"
                                  : "border-amber-600 text-amber-700"
                              }`}
                            >
                              {notification.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="rounded-none font-mono text-[9px]">
                              {notification.alertType.replaceAll("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          <h3 className="mt-2 break-words font-mono text-xs font-bold">{notification.title}</h3>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground sm:text-right">
                          <div>Opened {new Date(notification.openedAt).toLocaleString("en-GB")}</div>
                          {notification.resolvedAt && <div>Resolved {new Date(notification.resolvedAt).toLocaleString("en-GB")}</div>}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <DeliveryOutcome
                          label="Opening"
                          status={notification.openDeliveryStatus}
                          error={notification.openDeliveryError}
                          at={notification.openedAt}
                        />
                        <DeliveryOutcome
                          label="Resolution"
                          status={notification.resolutionDeliveryStatus}
                          error={notification.resolutionDeliveryError}
                          at={notification.resolvedAt}
                        />
                      </div>

                      {notification.learnerId !== null && (
                        <Link
                          href={`/admin/students/${notification.learnerId}`}
                          className="mt-3 inline-flex font-mono text-[10px] text-primary hover:underline"
                          data-testid={`link-billing-history-learner-${notification.notificationId}`}
                        >
                          OPEN LEARNER {notification.learnerId}
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        }
        {!activeTab && <>
        {/* Data & Backup */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <button
              type="button"
              aria-expanded={dataBackupOpen}
              aria-controls="admin-data-backup-content"
              className="flex items-center gap-2 text-left group"
              onClick={() => setDataBackupOpen((v) => !v)}
            >
              <div>
                <CardTitle className="font-mono uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Data &amp; Backup
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Daily at 06:00 UK · Readable Google Drive backups · Quarterly restoration tests
                </p>
              </div>
              {dataBackupOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />}
            </button>
            {dataBackupOpen && <div className="flex gap-2 flex-wrap">
              <span
                className="h-9 flex items-center px-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                title={lastBackupDate ? new Date(lastBackupDate).toLocaleString("en-GB") : "No backup has been created yet"}
              >
                Last backed up: {lastBackupDate
                  ? new Date(lastBackupDate).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Never"}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-9 font-mono text-xs"
                onClick={handleExport}
                disabled={exportLoading || backupStatus?.state === "running"}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                {backupStatus?.state === "running" ? "BACKUP RUNNING…" : exportLoading ? "STARTING BACKUP…" : "BACKUP ALL DATA"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 font-mono text-xs"
                asChild
              >
                <a
                  href={backupStatus?.state === "succeeded" && backupStatus.result?.rootFolderId
                    ? `https://drive.google.com/drive/folders/${backupStatus.result.rootFolderId}`
                    : lastBackup?.folderId
                      ? `https://drive.google.com/drive/folders/${lastBackup.folderId}`
                      : backupStatus?.state === "succeeded" && backupStatus.result?.folderId
                        ? `https://drive.google.com/drive/folders/${backupStatus.result.folderId}`
                        : "https://drive.google.com/drive/search?q=Chainsaw+Courses+User+Backup"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
          <CardContent id="admin-data-backup-content" hidden={!dataBackupOpen} className="p-0 space-y-0">
            <div className="px-6 pt-4 text-xs font-mono space-y-2" role="status" aria-live="polite">
              {backupStatusError && <p className="text-destructive">{backupStatusError}</p>}
              {backupStatus?.state === "running" && <p>{backupStatus.source === "scheduled" ? "The automatic daily readable backup is running. This can take several minutes; you can leave this page and return." : "Creating readable spreadsheets and documents in Google Drive. This can take several minutes; keep this page open until it finishes."}</p>}
              {backupStatus?.state === "running" && (
                <p className="break-words">
                  {backupStatus.result?.progress ?? "Reading records and preparing Google Drive folders"}
                  {backupStatus.result?.updatedAt && <> — last updated {new Date(backupStatus.result.updatedAt).toLocaleTimeString("en-GB")}</>}
                  <br />Started {new Date(backupStatus.startedAt).toLocaleString("en-GB")}. Status refreshes every five seconds.
                </p>
              )}
              {backupStatus?.state === "failed" && (
                <div className="space-y-2">
                  <p className="text-destructive">
                    {backupStatus.source === "scheduled" ? "Automatic daily backup failed" : "Backup failed"}
                    {" "}({new Date(backupStatus.startedAt).toLocaleString("en-GB")}): {backupStatus.error ?? "No verified file was saved."} You can retry.
                  </p>
                  {backupStatus.latestReadable && (
                    <div className="space-y-1 rounded border border-border p-3">
                      <p>
                        Latest successful readable backup: {new Date(backupStatus.latestReadable.at).toLocaleString("en-GB")}.
                        {" "}Use these links instead of older .backup.enc archives.
                      </p>
                      <a className="text-primary underline break-all" href={backupStatus.latestReadable.url} target="_blank" rel="noopener noreferrer">
                        Open full database Google Sheet
                      </a>
                      {!!backupStatus.latestReadable.categories?.length && (
                        <ul className="list-disc pl-5 space-y-1">
                          {backupStatus.latestReadable.categories.map((category) => (
                            <li key={category.key}>
                              <div className="flex flex-wrap gap-x-3">
                                <a className="text-primary underline break-all" href={category.url} target="_blank" rel="noopener noreferrer">
                                  Open {category.label} Google Sheet
                                </a>
                                <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${category.folderId}`} target="_blank" rel="noopener noreferrer">
                                  Open {category.label} folder
                                </a>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!!backupStatus.latestReadable.documentFolders?.length && (
                        <ul className="list-disc pl-5 space-y-1">
                          {backupStatus.latestReadable.documentFolders.map((folder) => (
                            <li key={folder.key}>
                              <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${folder.folderId}`} target="_blank" rel="noopener noreferrer">
                                Open {folder.label} files ({folder.count})
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
              {backupStatus?.state === "succeeded" && backupStatus.result && (
                <div className="space-y-1">
                  <p>
                    {backupStatus.result.format === "readable"
                      ? "Verified readable backup saved"
                      : "Previous encrypted backup saved"}
                    {" "}{new Date(backupStatus.result.at).toLocaleString("en-GB")} in Chainsaw Courses User Backup / Weekly Backup.
                  </p>
                  <div className="flex flex-wrap gap-x-3">
                    {(backupStatus.result.rootFolderId || lastBackup?.folderId) && (
                      <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${backupStatus.result.rootFolderId || lastBackup?.folderId}`} target="_blank" rel="noopener noreferrer">
                        Open Chainsaw Courses User Backup folder
                      </a>
                    )}
                    {backupStatus.result.folderId && (
                      <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${backupStatus.result.folderId}`} target="_blank" rel="noopener noreferrer">
                        Open Weekly Backup folder
                      </a>
                    )}
                  </div>
                  <br />
                  {backupStatus.result.format === "readable" ? (
                    <>
                      <a className="text-primary underline break-all" href={backupStatus.result.url} target="_blank" rel="noopener noreferrer">
                        Open full database Google Sheet
                      </a>
                      <p>
                        {backupStatus.result.counts.tables} tables · {backupStatus.result.counts.records} records · {backupStatus.result.counts.learners} learners · {backupStatus.result.counts.certificates} certificate PDFs · {backupStatus.result.counts.waivers ?? 0} waiver records · {backupStatus.result.counts.inspections} inspection PDFs · {backupStatus.result.counts.risks} risk assessment PDFs
                      </p>
                      <p>{backupStatus.result.counts.assessmentMedia ?? 0} assessment media files and {backupStatus.result.counts.retailerLogos ?? 0} retailer logos copied from App Storage.</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      This older .backup.enc file remains encrypted and is not previewable in Drive. Click “BACKUP ALL DATA” after publishing the readable backup update to create viewable spreadsheets and PDFs.
                    </p>
                  )}
                  {!!backupStatus.result.categories?.length && (
                    <ul className="list-disc pl-5 space-y-1">
                      {backupStatus.result.categories.map((category) => (
                        <li key={category.key}>
                           <div className="flex flex-wrap gap-x-3">
                             <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${category.folderId}`} target="_blank" rel="noopener noreferrer">
                                Open {category.label} folder
                             </a>
                              {backupStatus.result?.format === "readable" ? (
                                <a className="text-primary underline break-all" href={category.url} target="_blank" rel="noopener noreferrer">
                                  Open {category.label} Google Sheet
                                </a>
                              ) : (
                                <a className="text-primary underline break-all" href={category.url} target="_blank" rel="noopener noreferrer">
                                  Open legacy encrypted {category.label} archive
                                </a>
                              )}
                           </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {backupStatus.result.format === "readable" && !!backupStatus.result.documentFolders?.length && (
                    <ul className="list-disc pl-5 space-y-1">
                      {backupStatus.result.documentFolders.map((folder) => (
                        <li key={folder.key}>
                          <a className="text-primary underline break-all" href={`https://drive.google.com/drive/folders/${folder.folderId}`} target="_blank" rel="noopener noreferrer">
                            Open {folder.label} files ({folder.count})
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {backupStatus === null && lastBackup && (
                <a className="text-primary underline break-all" href={lastBackup.sheetUrl} target="_blank" rel="noopener noreferrer">
                  Open latest verified backup file in Google Drive ({new Date(lastBackup.exportedAt).toLocaleString("en-GB")})
                </a>
              )}
              <p className="text-muted-foreground">Automated backups target 06:00 UK. An authorised Google Apps Script trigger checks every 15 minutes from 06:00, waking the API even while idle; it must be installed separately. Routine backup status appears here without start/completion emails. Without an external trigger, Autoscale can delay a run until the API next starts.</p>
              <p><a className="text-primary underline" href={`${import.meta.env.BASE_URL}docs/google-backup-trigger.gs`} download="google-backup-trigger.gs">Download Google daily-backup script</a></p>
              <p className="text-muted-foreground">New exports are unencrypted Google Sheets and ordinary files so they can be opened directly. They contain personal learner data, so keep the Drive folders restricted to authorised staff. Existing .backup.enc files are unchanged. Certificate PDFs are regenerated from issued records; the exact original issued PDF is not stored separately. Database tables share one consistent snapshot; documents and media are copied afterwards. Assessment media and retailer logos from App Storage are included, but Firebase-hosted course media is not.</p>
              <p className="text-muted-foreground">Portable Export contains JSON data, a PostgreSQL recovery script, checksums and import instructions for another project. Download the document folders too. Destination software may need field mapping; application code and credentials must be configured separately.</p>
              <p className="text-muted-foreground">Backups now update existing files in place: unchanged documents are skipped, new records get one file, and progress is updated without dated duplicates. No second document copy is made in Weekly Backup. These files show the latest data, not separate historical snapshots. Older files are kept unchanged.</p>
            </div>

            {/* Export History */}
            <div className="px-6 pt-4 pb-2">
              <button
                type="button"
                aria-expanded={exportHistoryOpen}
                aria-controls="admin-export-history"
                className="flex w-full items-center justify-between gap-3 py-2 text-left font-mono text-xs font-bold uppercase tracking-widest text-foreground"
                onClick={() => setExportHistoryOpen((open) => !open)}
              >
                <span>Export History ({exportHistory.length}; older exports may not include every table)</span>
                {exportHistoryOpen
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {exportHistoryOpen && (
              <div id="admin-export-history">
              {exportHistoryLoading ? (
                <div className="py-4 text-center text-muted-foreground font-mono text-sm">LOADING…</div>
              ) : exportHistory.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground font-mono text-xs">
                  No exports yet. Click "BACKUP ALL DATA" to create your first export.
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
                              <ExternalLink className="w-3 h-3" /> {exp.title.endsWith(".backup.enc") ? "FILE" : "SHEET"}
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
        </Card>

        </>}

        {activeTab === "replacement-code-requests" && <Card id="replacement-code-requests" className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 font-mono text-sm uppercase tracking-widest">
                <KeyRound className="h-4 w-4 text-primary" />
                Replacement code requests
              </CardTitle>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Create a normal unused code, then select and email it here.
              </p>
            </div>
            <Button size="sm" onClick={() => { setCreateCodeOpen(true); setGeneratedCode(""); }} className="h-9 font-mono text-xs">
              <Plus className="w-4 h-4 mr-1" /> NEW CODE
            </Button>
            <Badge variant="outline" className="rounded-none font-mono text-[10px]">
              {codeResetRequests.filter((request) => request.status === "pending").length} PENDING
            </Badge>
          </CardHeader>
          <CardContent>
            {codeResetRequests.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">No replacement code requests.</p>
            ) : (
              <div className="space-y-3">
                {codeResetRequests.map((request) => (
                  <div key={request.id} className="border border-border bg-background/50 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all font-mono text-sm font-bold">{request.email}</span>
                          <Badge
                            variant="outline"
                            className={`rounded-none font-mono text-[9px] ${
                              request.status === "pending" ? "border-amber-600 text-amber-700" : "border-green-600 text-green-700"
                            }`}
                          >
                            {request.status.toUpperCase()}
                          </Badge>
                          {request.supportEmailStatus === "failed" && (
                            <Badge variant="outline" className="rounded-none border-destructive font-mono text-[9px] text-destructive">
                              SUPPORT EMAIL FAILED
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          Requested {new Date(request.requestedAt).toLocaleString("en-GB")}
                          {request.issuedCode ? ` · Sent ${request.issuedCode}` : ""}
                        </p>
                      </div>
                      {request.status === "pending" && (
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                          <select
                            aria-label={`Activation code for ${request.email}`}
                            value={selectedResetCodes[request.id] ?? ""}
                            onChange={(event) => setSelectedResetCodes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))}
                            className="h-10 min-w-52 border border-input bg-background px-3 font-mono text-xs"
                          >
                            <option value="">Select unused code</option>
                            {accessCodes
                              .filter((code) => !code.isUsed && !code.isUnlimited && !code.isPaused && !code.assignedTo)
                              .map((code) => (
                                <option key={code.id} value={code.code}>{code.code}</option>
                              ))}
                          </select>
                          <Button
                            type="button"
                            className="h-10 font-mono text-xs font-bold"
                            disabled={!selectedResetCodes[request.id] || sendingResetRequestId === request.id}
                            onClick={() => handleSendResetCode(request)}
                          >
                            {sendingResetRequestId === request.id ? "SENDING…" : "EMAIL CODE"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        }
        {!activeTab && <>
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
        <Card id="student-roster" className="border-border bg-card/30 scroll-mt-4">
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
            {studentsError && <AdminReadError subject="the student roster" retry={() => void refetchStudents()} />}
            {studentsLoading && <div className="p-4 font-mono text-sm text-muted-foreground">Loading student roster…</div>}
            {!studentsLoading && !studentsError && students?.length === 0 && <div className="p-4 font-mono text-sm text-muted-foreground">No learners recorded yet.</div>}
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-border">
              {!studentsError && filteredRoster?.length === 0 && students && students.length > 0 && (
                <div className="text-center py-8 text-muted-foreground font-mono text-sm">NO RECORDS MATCH THE FILTER</div>
              )}
              {filteredRoster?.map((student) => (
                <div key={student.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate flex items-center gap-2">
                      <Link href={`/admin/students/${student.id}`} className="truncate text-primary hover:underline focus-visible:underline">
                        {student.fullName}
                      </Link>
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
                          <Link href={`/admin/students/${student.id}`} className="text-primary hover:underline focus-visible:underline">
                            {student.fullName}
                          </Link>
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
                  {!studentsError && filteredRoster?.length === 0 && students && students.length > 0 && (
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
        </>}
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