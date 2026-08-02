import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowLeft, Biohazard, CheckCircle2, ChevronDown, ChevronRight, Download, ExternalLink, HardDrive, Loader2, MapPin, Search, Trash2, X } from "lucide-react";
import { useListAllRiskAssessments, getListAllRiskAssessmentsQueryKey, useDeleteRiskAssessment, useDeleteAllRiskAssessments } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useQueryClient } from "@tanstack/react-query";

function riskBand(rating: number): { label: string; className: string } {
  if (rating >= 15) return { label: "High", className: "text-destructive border-destructive bg-destructive/10" };
  if (rating >= 8)  return { label: "Medium", className: "text-amber-600 border-amber-500 bg-amber-500/10" };
  return                   { label: "Low", className: "text-primary border-primary bg-primary/10" };
}

export default function RiskAssessments() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const { data: assessments, isLoading } = useListAllRiskAssessments({
    query: { queryKey: getListAllRiskAssessmentsQueryKey(), enabled: !!adminToken },
  });

  const deleteOne = useDeleteRiskAssessment();
  const deleteAll = useDeleteAllRiskAssessments();

  const [search, setSearch] = useState("");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Per-record Drive state
  const [driveState, setDriveState] = useState<Map<number, "saving" | "done" | "error">>(new Map());
  const [driveUrls, setDriveUrls]   = useState<Map<number, string>>(new Map());
  // Per-record download state
  const [dlState, setDlState] = useState<Map<number, "downloading" | "done" | "error">>(new Map());
  // Bulk export
  const [bulkState, setBulkState] = useState<"idle" | "exporting" | "done" | "error">("idle");
  const [bulkResult, setBulkResult] = useState<{ saved: number; errors: string[]; folderUrl: string } | null>(null);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDeleteOne = (id: number) => {
    deleteOne.mutate({ id }, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        queryClient.invalidateQueries({ queryKey: getListAllRiskAssessmentsQueryKey() });
      },
    });
  };

  const handleDeleteAll = () => {
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        setConfirmDeleteAll(false);
        queryClient.invalidateQueries({ queryKey: getListAllRiskAssessmentsQueryKey() });
      },
    });
  };

  const handleDownload = async (id: number, studentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!adminToken) return;
    setDlState((prev) => new Map(prev).set(id, "downloading"));
    try {
      const res = await fetch(`/api/admin/risk-assessments/${id}/pdf`, { headers: { admintoken: adminToken } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `risk-assessment-${studentName.replace(/\s+/g, "-")}-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      setDlState((prev) => new Map(prev).set(id, "done"));
    } catch {
      setDlState((prev) => new Map(prev).set(id, "error"));
    }
  };

  const handleSaveToDrive = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!adminToken) return;
    setDriveState((prev) => new Map(prev).set(id, "saving"));
    try {
      const res = await fetch(`/api/admin/risk-assessments/${id}/save-to-drive`, {
        method: "POST", headers: { admintoken: adminToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDriveUrls((prev) => new Map(prev).set(id, data.url));
      setDriveState((prev) => new Map(prev).set(id, "done"));
    } catch {
      setDriveState((prev) => new Map(prev).set(id, "error"));
    }
  };

  const handleExportAll = async () => {
    if (!adminToken) return;
    setBulkState("exporting");
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/risk-assessments/export-to-drive", {
        method: "POST", headers: { admintoken: adminToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      setBulkResult(data);
      setBulkState("done");
    } catch {
      setBulkState("error");
    }
  };

  const highRiskCount = assessments?.filter(
    (a) => Math.max(0, ...a.hazards.map((h) => h.riskRating)) >= 15
  ).length ?? 0;

  const q = search.trim().toLowerCase();
  const filtered = assessments?.filter((r) => {
    const matchesSearch = !q ||
      (r.studentName ?? "").toLowerCase().includes(q) ||
      (r.taskDescription ?? "").toLowerCase().includes(q) ||
      (r.siteDescription ?? "").toLowerCase().includes(q) ||
      (r.address ?? "").toLowerCase().includes(q);
    const matchesFilter = !highRiskOnly || Math.max(0, ...r.hazards.map((h) => h.riskRating)) >= 15;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> RISK ASSESSMENTS
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(assessments?.length ?? 0) > 0 && (
              bulkState === "exporting" ? (
                <Button size="sm" variant="outline" disabled className="font-mono text-xs">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting…
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleExportAll} className="font-mono text-xs">
                  <HardDrive className="w-4 h-4 mr-2" /> Export All to Drive
                </Button>
              )
            )}
            <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
              <Link href="/admin/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" /> BACK
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Bulk export result banner */}
        {bulkState === "done" && bulkResult && (
          <Card className="bg-secondary/20">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-sm">
                <HardDrive className="w-4 h-4 text-primary shrink-0" />
                <span>{bulkResult.saved} assessment{bulkResult.saved !== 1 ? "s" : ""} saved to Drive</span>
                {bulkResult.errors.length > 0 && (
                  <span className="text-destructive text-xs ml-1">({bulkResult.errors.length} failed)</span>
                )}
                <a href={bulkResult.folderUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 ml-1">
                  Open folder <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <button onClick={() => { setBulkState("idle"); setBulkResult(null); }} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
            </CardContent>
          </Card>
        )}
        {bulkState === "error" && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <span className="font-mono text-sm text-destructive">Export failed. Please try again.</span>
              <button onClick={() => setBulkState("idle")} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between gap-4">
          <Card className="bg-secondary/20 flex-1">
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="w-5 h-5" />
              <span className="font-mono text-sm">
                {assessments
                  ? `${assessments.length} assessment${assessments.length === 1 ? "" : "s"} recorded, ${highRiskCount} flagged high-risk`
                  : "No risk assessments submitted yet"}
              </span>
            </CardContent>
          </Card>
          {(assessments?.length ?? 0) > 0 && (
            confirmDeleteAll ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-destructive">Delete all {assessments?.length} records?</span>
                <Button size="sm" variant="destructive" className="font-mono text-xs h-8"
                  onClick={handleDeleteAll} disabled={deleteAll.isPending}>
                  {deleteAll.isPending ? "Deleting…" : "Yes, delete all"}
                </Button>
                <Button size="sm" variant="outline" className="font-mono text-xs h-8"
                  onClick={() => setConfirmDeleteAll(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="font-mono text-xs h-8 text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0"
                onClick={() => setConfirmDeleteAll(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete All
              </Button>
            )
          )}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student, task, site or address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            variant={highRiskOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setHighRiskOnly((v) => !v)}
            className="font-mono text-xs h-10 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> High risk only
          </Button>
        </div>

        {isLoading && (
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <p className="text-center text-muted-foreground font-mono text-sm py-8">
            {q || highRiskOnly ? "No records match your search" : "No risk assessments submitted yet"}
          </p>
        )}

        <div className="space-y-2">
          {filtered?.map((record) => {
            const maxRisk = Math.max(0, ...record.hazards.map((h) => h.riskRating));
            const band = riskBand(maxRisk);
            const isOpen = expanded.has(record.id);
            const isConfirming = confirmDeleteId === record.id;
            const ds  = driveState.get(record.id);
            const du  = driveUrls.get(record.id);
            const dls = dlState.get(record.id);
            return (
              <Card key={record.id} className={maxRisk >= 15 ? "border-destructive/50" : undefined}>
                {/* Summary row */}
                <div className="flex items-center gap-1">
                  <button
                    className="flex-1 text-left px-4 py-3 flex items-center gap-3 min-w-0"
                    onClick={() => toggle(record.id)}
                  >
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="font-mono text-sm font-bold flex-1 truncate">
                      {record.studentName ?? "Unknown student"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground hidden sm:block shrink-0">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </span>
                    <span className={`shrink-0 flex items-center gap-1 text-xs uppercase tracking-widest px-2 py-0.5 rounded border ${band.className}`}>
                      {maxRisk >= 15 ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {band.label}
                    </span>
                  </button>

                  {/* Action buttons */}
                  <div className="px-2 shrink-0 flex items-center gap-1">
                    {/* Download PDF */}
                    <button
                      onClick={(e) => handleDownload(record.id, record.studentName ?? "student", e)}
                      disabled={dls === "downloading"}
                      title={dls === "error" ? "Download failed — retry" : "Download PDF"}
                      className={`p-1.5 rounded transition-colors ${dls === "error" ? "text-destructive hover:text-destructive/80" : dls === "done" ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    >
                      {dls === "downloading"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                    </button>

                    {/* Save to Drive */}
                    {ds === "done" && du ? (
                      <a href={du} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open in Google Drive"
                        className="p-1.5 rounded text-green-600 hover:text-green-700 transition-colors">
                        <HardDrive className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        onClick={(e) => handleSaveToDrive(record.id, e)}
                        disabled={ds === "saving"}
                        title={ds === "error" ? "Drive save failed — retry" : "Save to Google Drive"}
                        className={`p-1.5 rounded transition-colors ${ds === "error" ? "text-destructive hover:text-destructive/80" : "text-muted-foreground hover:text-primary"}`}
                      >
                        {ds === "saving"
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <HardDrive className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Delete control */}
                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 pl-1">
                        <button
                          className="font-mono text-[10px] text-destructive underline underline-offset-2 hover:no-underline"
                          onClick={() => handleDeleteOne(record.id)}
                          disabled={deleteOne.isPending}
                        >
                          {deleteOne.isPending ? "…" : "Confirm"}
                        </button>
                        <span className="text-muted-foreground/40 text-[10px]">·</span>
                        <button
                          className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 hover:no-underline"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-muted-foreground/40 hover:text-destructive transition-colors p-1.5"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(record.id); }}
                        title="Delete this record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <CardContent className="pt-0 pb-4 px-4 text-sm font-mono text-muted-foreground space-y-2 border-t border-border">
                    <div className="text-[10px] uppercase tracking-widest opacity-60 pt-3">
                      {new Date(record.createdAt).toLocaleString()}
                    </div>
                    <p className="text-xs text-foreground">{record.taskDescription}</p>
                    {record.siteDescription && <p className="text-xs">{record.siteDescription}</p>}
                    {record.address && <p className="text-xs">{record.address}</p>}
                    {record.gridReference && <p className="text-xs">Grid ref: {record.gridReference}</p>}
                    <div className="grid sm:grid-cols-2 gap-1.5 pt-2">
                      {record.hazards.map((h) => {
                        const hBand = riskBand(h.riskRating);
                        return (
                          <div key={h.id} className="text-xs border border-border/60 rounded p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-foreground">{h.label}</span>
                              <span className={`shrink-0 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${hBand.className}`}>
                                {hBand.label}
                              </span>
                            </div>
                            {h.controlMeasures && (
                              <p className="text-muted-foreground italic mt-1">{h.controlMeasures}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
