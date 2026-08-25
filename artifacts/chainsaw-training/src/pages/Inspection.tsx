import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, XCircle, MinusCircle, AlertTriangle, History, Loader2, FileDown, ClipboardCopy, Copy, Edit2, X,
} from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { copyInspectionText, type InspectionExportData } from "../lib/exportPrint";
import { deliverPdf } from "../lib/pdfDownload";
import { playCompletionDing, primeCompletionDing } from "../lib/completionSound";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

const BASE = import.meta.env.BASE_URL as string;
import { useSubmitInspection, useListMyInspections, getListMyInspectionsQueryKey, usePatchInspection } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Status = "pass" | "fail" | "na";

interface ChecklistItem {
  id: string;
  label: string;
}

const PPE_ITEMS: ChecklistItem[] = [
  { id: "ppe-helmet",   label: "Safety helmet with integral face visor — present, undamaged, and CE/UKCA marked (EN 397 + EN 1731, Class 1 or 3)" },
  { id: "ppe-hearing",  label: "Hearing protection — present and CE/UKCA marked (EN 352-1, SNR ≥ 27 dB)" },
  { id: "ppe-gloves",   label: "Chainsaw protective gloves — present and undamaged (EN 388 / ISO 11393-4)" },
  { id: "ppe-trousers", label: "Chainsaw protective trousers — correct type (Type A or C), undamaged (EN ISO 11393-2)" },
  { id: "ppe-boots",    label: "Chainsaw safety boots or gaiters — correct class, undamaged (EN ISO 17249 Class 1 or 2)" },
  { id: "ppe-hiviz",    label: "High-visibility vest or jacket — present (EN ISO 20471 Class 2+)" },
  { id: "ppe-firstaid", label: "First aid kit — accessible on site (BS 8599-1)" },
];

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
  [...PPE_ITEMS, ...PRE_START_ITEMS, ...PRE_USE_ITEMS].forEach((item) => {
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
  const { toast } = useToast();
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
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [newRecordMode, setNewRecordMode] = useState(false);
  const exportCardRef = useRef<HTMLDivElement>(null);

  const savePreparedPdf = async (blob: Blob, filename: string) => {
    try {
      const result = await deliverPdf(blob, filename);
      if (result === "shared") {
        toast({ title: "PDF shared or saved" });
      } else if (result === "downloaded") {
        toast({
          title: "PDF download started",
          description: "The file should appear in your device Downloads folder.",
        });
      } else {
        toast({ title: "PDF download cancelled" });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Could not save PDF",
        description: "Please try again.",
      });
    }
  };

  const downloadPdf = async (id: number) => {
    toast({
      title: "Preparing PDF",
      description: "Your checklist PDF is being downloaded…",
    });
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
      const filename = `inspection-${id}.pdf`;
      toast({
        title: "PDF ready",
        description: "Tap Save PDF to choose where to save it or which PDF app to use.",
        action: (
          <ToastAction altText="Choose where to save the PDF" onClick={() => void savePreparedPdf(blob, filename)}>
            Save PDF
          </ToastAction>
        ),
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not download PDF",
        description: "Please try again.",
      });
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
        setDuplicateMode(false);
        setNewRecordMode(false);
        setEditingOriginalDate(null);
        playCompletionDing();
        queryClient.setQueryData<Array<typeof data> | undefined>(
          getListMyInspectionsQueryKey(),
          (current) => {
            if (!current) return [data];
            const existingIndex = current.findIndex((record) => record.id === data.id);
            return existingIndex === -1
              ? [data, ...current]
              : current.map((record) => (record.id === data.id ? data : record));
          }
        );
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
        setDuplicateMode(false);
        setNewRecordMode(false);
        playCompletionDing();
        queryClient.setQueryData<Array<typeof data> | undefined>(
          getListMyInspectionsQueryKey(),
          (current) => {
            if (!current) return [data];
            const existingIndex = current.findIndex((record) => record.id === data.id);
            return existingIndex === -1
              ? [data, ...current]
              : current.map((record) => (record.id === data.id ? data : record));
          }
        );
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
      enabled: !!deviceId && !!activationCode,
    },
  });

  const hasSavedInspection = (history.data?.length ?? 0) > 0;

  const loadForEdit = (record: NonNullable<typeof history.data>[number], duplicate = false) => {
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
    setEditingId(duplicate ? null : record.id);
    setEditingOriginalDate(record.createdAt);
    setDuplicateMode(duplicate);
    setNewRecordMode(false);
    setSubmitted(null);
    setExportRecord(null);
    setShowHistory(false);
  };

  const startNewChecklist = () => {
    setSawIdentifier("");
    setItems(buildInitialItems());
    setNotes({});
    setEditingId(null);
    setEditingOriginalDate(null);
    setDuplicateMode(false);
    setNewRecordMode(true);
    setSubmitted(null);
    setExportRecord(null);
    setShowHistory(false);
  };

  const handleSubmit = () => {
    if (!deviceId || !activationCode) return;
    primeCompletionDing();
    const payload = [...PPE_ITEMS, ...PRE_START_ITEMS, ...PRE_USE_ITEMS].map((item) => ({
      id: item.id,
      label: item.label,
      section: PPE_ITEMS.some((p) => p.id === item.id) ? "PPE"
        : PRE_START_ITEMS.some((p) => p.id === item.id) ? "Pre-Start" : "Pre-Use",
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
          duplicate: duplicateMode || newRecordMode || undefined,
          items: payload,
        },
      });
    }
  };

  if (!activationCode || !deviceId) return null;

  const renderSection = (title: string, sectionItems: ChecklistItem[]) => (
    <Card className="border-border bg-card/60">
      <CardContent className="min-w-0 p-4 space-y-4">
        <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary break-words">{title}</h2>
        {sectionItems.map((item) => (
          <div key={item.id} className="border-b border-border/60 last:border-b-0 pb-3 last:pb-0">
            <p className="font-mono text-xs text-foreground mb-2 break-words">{item.label}</p>
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
        <div className="max-w-3xl mx-auto px-4 min-h-14 py-2 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 text-center">
            <ClipboardCheck className="w-4 h-4 text-[#e27226]" />
            <span className="font-mono font-bold uppercase tracking-wide text-xs leading-tight break-words">Inspection Checklist</span>
          </div>
          <div className="w-16 sm:w-20 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 min-w-0 max-w-3xl w-full mx-auto px-4 py-6 space-y-6 pb-36 sm:pb-28">
        <div>
          <h1 className="font-black tracking-tighter text-lg uppercase text-primary mb-1">
            PPE, Pre-Start &amp; Pre-Use Checklist
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
            Verify PPE compliance, then run through the standard pre-start and pre-use chainsaw safety checks. This is a personal record — it does not unlock or affect your course progress.
          </p>
        </div>

        {showHistory ? (
          <Card className="border-border bg-card/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 font-mono font-bold uppercase tracking-widest text-xs text-primary break-words">Your Inspection History</h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-[10px] uppercase tracking-wide h-auto min-h-7 max-w-full px-2 shrink-0 whitespace-normal text-center"
                  onClick={() => setShowHistory(false)}
                >
                  Back to Checklist
                </Button>
              </div>
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
                  <div key={record.id} className="min-w-0 border rounded p-3 space-y-1.5 border-border">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 font-mono text-[11px] text-muted-foreground break-words">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
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
                      <p className="font-mono text-[11px] text-foreground break-words">Saw: {record.sawIdentifier}</p>
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
                        onClick={() => loadForEdit(record, true)}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wide h-7 px-2"
                        disabled={isDownloading}
                        onClick={handleDownload}
                      >
                        {isDownloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <FileDown className="w-3 h-3 mr-1" />}
                        {isDownloading ? "PDF downloading…" : "PDF"}
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
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory(true)}
                className="font-mono text-xs uppercase tracking-widest"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                Checklist History
              </Button>
            </div>
            {(editingId !== null || duplicateMode) && editingOriginalDate && (
              <Card className="border-amber-500 bg-amber-500/10">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Edit2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="font-mono text-xs text-amber-700 truncate">
                      {duplicateMode
                        ? `Creating a copy of the inspection from ${new Date(editingOriginalDate).toLocaleString()} — save to create a separate record.`
                        : `Editing inspection from ${new Date(editingOriginalDate).toLocaleString()} — save to update record.`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0 h-7 px-2"
                    onClick={() => {
                      setEditingId(null);
                      setEditingOriginalDate(null);
                      setDuplicateMode(false);
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

            {renderSection("PPE Verification", PPE_ITEMS)}
            {renderSection("Pre-Start Checks", PRE_START_ITEMS)}
            {renderSection("Pre-Use / On-Site Checks", PRE_USE_ITEMS)}
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowHistory(true)}
                className="font-mono text-xs uppercase tracking-widest"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                Checklist History
              </Button>
            </div>

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
                      disabled={pdfDownloading}
                      onClick={() => {
                        setPdfDownloading(true);
                        void downloadPdf(exportRecord.id!).finally(() => setPdfDownloading(false));
                      }}
                    >
                      {pdfDownloading
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
                      {pdfDownloading ? "PDF downloading…" : "Download PDF"}
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
          <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 font-mono text-[10px] text-muted-foreground uppercase tracking-widest break-words sm:w-auto">
              {failedCount > 0
                ? `${failedCount} failed`
                : uncheckedCount > 0
                  ? `${uncheckedCount} not checked`
                  : "All items checked"}
            </span>
            <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
              {(hasSavedInspection || exportRecord !== null || newRecordMode) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startNewChecklist}
                  disabled={submitInspection.isPending || patchInspection.isPending}
                  className="w-full justify-center font-mono text-xs uppercase tracking-widest px-3 sm:w-auto"
                >
                  New Checklist
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={submitInspection.isPending || patchInspection.isPending}
                className="w-full justify-center font-mono text-sm uppercase tracking-widest px-5 sm:w-auto"
              >
                {(submitInspection.isPending || patchInspection.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                )}
                {newRecordMode
                  ? "Save New Checklist"
                  : duplicateMode
                    ? "Create Duplicate"
                    : editingId !== null || hasSavedInspection
                      ? "Update Checklist"
                      : "Save Checklist"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
