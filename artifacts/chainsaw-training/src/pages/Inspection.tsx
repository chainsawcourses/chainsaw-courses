import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, XCircle, MinusCircle, AlertTriangle, History, Loader2, FileDown, ClipboardCopy, Edit2, X,
} from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { copyInspectionText, type InspectionExportData } from "../lib/exportPrint";

const BASE = import.meta.env.BASE_URL as string;

const bingAudio = new Audio("/audio/ding.wav");
bingAudio.load();

function playBing() {
  try {
    bingAudio.currentTime = 0;
    bingAudio.play().catch(() => { /* silent fail */ });
  } catch {
    // audio not available — silent fail
  }
}
import { useSubmitInspection, useListMyInspections, getListMyInspectionsQueryKey, usePatchInspection } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Status = "pass" | "fail" | "na";

interface ChecklistItem {
  id: string;
  label: string;
}

const PRE_START_ITEMS: ChecklistItem[] = [
  { id: "chain-tension", label: "Chain tension is correct (snug against bar, moves freely by hand)" },
  { id: "chain-sharp", label: "Chain is sharp and undamaged, with no missing or broken teeth" },
  { id: "chain-brake", label: "Chain brake engages and disengages correctly" },
  { id: "bar-condition", label: "Guide bar is straight, undamaged, and groove is clean" },
  { id: "oiler", label: "Chain oiler is functioning and reservoir is topped up" },
  { id: "fuel-mix", label: "Fuel is correctly mixed and tank is not overfilled (or battery fully charged)" },
  { id: "air-filter", label: "Air filter is clean and correctly seated" },
  { id: "handguard", label: "Front and rear handguards are present and undamaged" },
  { id: "chain-catcher", label: "Chain catcher is present and secure" },
  { id: "muffler", label: "Exhaust / spark arrestor is secure and undamaged" },
  { id: "anti-vibration", label: "Anti-vibration mounts are intact and not perished" },
  { id: "controls", label: "Throttle, throttle lock, and on/off switch operate freely" },
];

const PRE_USE_ITEMS: ChecklistItem[] = [
  { id: "chain-brake", label: "Chain brake — engages and releases correctly (push bar forward, check chain stops; pull back to release)" },
  { id: "on-off-switch", label: "On/off switch — operates correctly and cuts engine immediately when switched off" },
  { id: "chain-creep", label: "Chain creep — chain does not move at idle; adjust chain tension if creep is present" },
  { id: "oiling", label: "Oiling — oil is reaching the bar and chain (hold over stump/timber or light surface and check spray pattern)" },
];

const buildInitialItems = (): Record<string, Status> => {
  const map: Record<string, Status> = {};
  [...PRE_START_ITEMS, ...PRE_USE_ITEMS].forEach((item) => {
    map[item.id] = "na";
  });
  return map;
};

function StatusButton({
  status,
  target,
  onClick,
  icon: Icon,
  label,
  activeClass,
}: {
  status: Status;
  target: Status;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeClass: string;
}) {
  const active = status === target;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded border font-mono text-[10px] uppercase tracking-widest transition-colors ${
        active ? activeClass : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function Inspection() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName, userId } = useUserSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  const [sawIdentifier, setSawIdentifier] = useState("");
  const [items, setItems] = useState<Record<string, Status>>(buildInitialItems());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{ hasFailures: boolean } | null>(null);
  const [exportRecord, setExportRecord] = useState<InspectionExportData | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOriginalDate, setEditingOriginalDate] = useState<string | null>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);

  const downloadPdf = async (id: number) => {
    try {
      const res = await fetch(`${BASE}api/inspections/${id}/pdf`, {
        headers: {
          deviceid: deviceId ?? "",
          activationcode: activationCode ?? "",
          ...(userId != null ? { userid: String(userId) } : {}),
        },
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inspection-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not download PDF. Please try again.");
    }
  };

  const setStatus = (id: string, status: Status) => {
    setItems((prev) => ({ ...prev, [id]: status }));
    setSubmitted(null);
  };

  const setNote = (id: string, note: string) => {
    setNotes((prev) => ({ ...prev, [id]: note }));
  };

  const failedCount = useMemo(
    () => Object.values(items).filter((s) => s === "fail").length,
    [items]
  );
  const uncheckedCount = useMemo(
    () => Object.values(items).filter((s) => s === "na").length,
    [items]
  );

  const submitInspection = useSubmitInspection({
    mutation: {
      onSuccess: (data) => {
        setSubmitted({ hasFailures: data.hasFailures });
        setExportRecord(data);
        playBing();
        queryClient.invalidateQueries({ queryKey: getListMyInspectionsQueryKey() });
        setTimeout(() => {
          exportCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      },
    },
  });

  const patchInspection = usePatchInspection({
    mutation: {
      onSuccess: (data) => {
        setSubmitted({ hasFailures: data.hasFailures });
        setExportRecord(data);
        setEditingId(null);
        setEditingOriginalDate(null);
        playBing();
        queryClient.invalidateQueries({ queryKey: getListMyInspectionsQueryKey() });
        setTimeout(() => {
          exportCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      },
    },
  });

  const history = useListMyInspections({
    query: {
      queryKey: getListMyInspectionsQueryKey(),
      enabled: showHistory && !!deviceId && !!activationCode,
    },
  });

  const loadForEdit = (record: NonNullable<typeof history.data>[number]) => {
    setSawIdentifier(record.sawIdentifier ?? "");
    const newItems: Record<string, Status> = buildInitialItems();
    const newNotes: Record<string, string> = {};
    for (const item of record.items) {
      if (item.id in newItems) {
        newItems[item.id] = item.status as Status;
        if (item.note) newNotes[item.id] = item.note;
      }
    }
    setItems(newItems);
    setNotes(newNotes);
    setEditingId(record.id);
    setEditingOriginalDate(record.createdAt);
    setSubmitted(null);
    setExportRecord(null);
    setShowHistory(false);
  };

  const handleSubmit = () => {
    if (!deviceId || !activationCode) return;
    const payload = [...PRE_START_ITEMS, ...PRE_USE_ITEMS].map((item) => ({
      id: item.id,
      label: item.label,
      section: PRE_START_ITEMS.some((p) => p.id === item.id) ? "Pre-Start" : "Pre-Use",
      status: items[item.id],
      note: notes[item.id]?.trim() || undefined,
    }));

    if (editingId !== null) {
      patchInspection.mutate({
        id: editingId,
        data: {
          deviceId,
          activationCode,
          sawIdentifier: sawIdentifier.trim() || undefined,
          items: payload,
        },
      });
    } else {
      submitInspection.mutate({
        data: {
          deviceId,
          activationCode,
          sawIdentifier: sawIdentifier.trim() || undefined,
          items: payload,
        },
      });
    }
  };

  if (!activationCode || !deviceId) return null;

  const renderSection = (title: string, sectionItems: ChecklistItem[]) => (
    <Card className="border-border bg-card/60">
      <CardContent className="p-4 space-y-4">
        <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">{title}</h2>
        {sectionItems.map((item) => (
          <div key={item.id} className="border-b border-border/60 last:border-b-0 pb-3 last:pb-0">
            <p className="font-mono text-xs text-foreground mb-2">{item.label}</p>
            <div className="flex flex-wrap gap-2">
              <StatusButton
                status={items[item.id]}
                target="pass"
                onClick={() => setStatus(item.id, "pass")}
                icon={CheckCircle2}
                label="Pass"
                activeClass="border-primary bg-primary/10 text-primary"
              />
              <StatusButton
                status={items[item.id]}
                target="fail"
                onClick={() => setStatus(item.id, "fail")}
                icon={XCircle}
                label="Fail"
                activeClass="border-destructive bg-destructive/10 text-destructive"
              />
              <StatusButton
                status={items[item.id]}
                target="na"
                onClick={() => setStatus(item.id, "na")}
                icon={MinusCircle}
                label="N/A"
                activeClass="border-muted-foreground bg-muted text-foreground"
              />
            </div>
            {items[item.id] === "fail" && (
              <Textarea
                value={notes[item.id] ?? ""}
                onChange={(e) => setNote(item.id, e.target.value)}
                placeholder="Describe the fault..."
                className="mt-2 font-mono text-xs resize-none min-h-[60px] bg-background border-destructive/40"
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">Inspection Checklist</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="font-mono uppercase tracking-widest text-xs text-muted-foreground hover:text-primary"
          >
            <History className="w-3.5 h-3.5 mr-1" />
            History
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-6 pb-28">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary mb-1">
            Pre-Start &amp; Pre-Use Checklist
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Use this checklist before using your chainsaw to run through the standard pre-start and pre-use safety
            checks. This is a personal record only — it does not unlock or affect your course progress.
          </p>
        </div>

        {showHistory ? (
          <Card className="border-border bg-card/60">
            <CardContent className="p-4 space-y-3">
              <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary">Your Inspection History</h2>
              {history.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-mono text-xs">Loading...</span>
                </div>
              )}
              {history.data && history.data.length === 0 && (
                <p className="font-mono text-xs text-muted-foreground">No inspections recorded yet.</p>
              )}
              {history.data?.map((record) => {
                const isDownloading = downloadingId === record.id;
                const handleDownload = () => {
                  setDownloadingId(record.id);
                  void downloadPdf(record.id).finally(() => setDownloadingId(null));
                };
                return (
                  <div key={record.id} className="border rounded p-3 space-y-1.5 border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {record.amendedAt && (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-amber-600 border border-amber-400 rounded px-1.5 py-0.5">amended</span>
                        )}
                        {record.hasFailures ? (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Failures noted
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-widest text-primary flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> All clear
                          </span>
                        )}
                      </div>
                    </div>
                    {record.sawIdentifier && (
                      <p className="font-mono text-[11px] text-foreground">Saw: {record.sawIdentifier}</p>
                    )}
                    {record.amendedAt && (
                      <p className="font-mono text-[10px] text-amber-600">Amended: {new Date(record.amendedAt).toLocaleString()}</p>
                    )}
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        onClick={() => loadForEdit(record)}
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        disabled={isDownloading}
                        onClick={handleDownload}
                      >
                        {isDownloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}
                        {isDownloading ? "Downloading…" : "PDF"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(copyInspectionText({ ...record, studentName: record.studentName || fullName || "" }));
                        }}
                      >
                        <ClipboardCopy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <>
            {editingId !== null && editingOriginalDate && (
              <Card className="border-amber-500 bg-amber-500/10">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Edit2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="font-mono text-xs text-amber-700 truncate">
                      Editing inspection from {new Date(editingOriginalDate).toLocaleString()} — save to update record.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 h-7 px-2"
                    onClick={() => {
                      setEditingId(null);
                      setEditingOriginalDate(null);
                      setSawIdentifier("");
                      setItems(buildInitialItems());
                      setNotes({});
                      setSubmitted(null);
                      setExportRecord(null);
                    }}
                  >
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-border bg-card/60">
              <CardContent className="p-4">
                <label className="font-mono font-semibold uppercase tracking-widest text-xs text-muted-foreground block mb-2">
                  Saw Model / Identifier (optional)
                </label>
                <Input
                  value={sawIdentifier}
                  onChange={(e) => setSawIdentifier(e.target.value)}
                  placeholder="e.g. Husqvarna 550 XP"
                  className="font-mono text-sm bg-background border-border"
                />
              </CardContent>
            </Card>

            {renderSection("Pre-Start Checks", PRE_START_ITEMS)}
            {renderSection("Pre-Use / On-Site Checks", PRE_USE_ITEMS)}

            {submitted && (
              <Card className={submitted.hasFailures ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"}>
                <CardContent className="p-4 flex items-start gap-3">
                  {submitted.hasFailures ? (
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  )}
                  <p className="font-mono text-xs text-foreground">
                    {submitted.hasFailures
                      ? "Inspection recorded with one or more failed items. Do not use the chainsaw until faults are resolved by a competent person."
                      : "Inspection recorded — no faults found. Remember: never operate the saw alone."}
                  </p>
                </CardContent>
              </Card>
            )}

            {exportRecord && (
              <Card ref={exportCardRef} className="border-primary bg-primary/5 shadow-md">
                <CardContent className="p-4 space-y-3">
                  <p className="font-mono font-bold uppercase tracking-widest text-xs text-primary">
                    Export this checklist?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className={`font-mono text-xs uppercase tracking-wide transition-all duration-150 ${
                        pdfDownloading
                          ? "bg-primary text-primary-foreground ring-2 ring-primary/50 shadow-sm"
                          : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                      }`}
                      onClick={() => {
                        setPdfDownloading(true);
                        void downloadPdf(exportRecord.id!).finally(() => setPdfDownloading(false));
                      }}
                    >
                      {pdfDownloading
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
                      {pdfDownloading ? "Downloading…" : "Download PDF"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs uppercase tracking-wide"
                      onClick={() => {
                        navigator.clipboard.writeText(copyInspectionText({ ...exportRecord, studentName: exportRecord.studentName || fullName || "" }));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
                      {copied ? "Copied!" : "Copy as Text"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      {!showHistory && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-card/90 backdrop-blur border-t border-border">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              {failedCount > 0
                ? `${failedCount} failed`
                : uncheckedCount > 0
                  ? `${uncheckedCount} not checked`
                  : "All items checked"}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={submitInspection.isPending || patchInspection.isPending}
              className="font-mono text-sm uppercase tracking-widest px-6"
            >
              {(submitInspection.isPending || patchInspection.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ClipboardCheck className="w-4 h-4 mr-2" />
              )}
              {editingId !== null ? "Update Inspection" : "Save Inspection"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
