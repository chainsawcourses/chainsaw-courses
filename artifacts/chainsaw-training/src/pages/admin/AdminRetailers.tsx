import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pencil, Trash2, Store, FileUp, RefreshCw, AlertTriangle, History, Star, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getRetailerReviewStatus,
  RETAILER_REVIEW_DUE_NOTICE_DAYS,
  RETAILER_REVIEW_INTERVAL_DAYS,
  type RetailerReviewStatus as ReviewStatus,
  type RetailerReviewThreshold,
} from "@workspace/retailer-review-policy";
import { useAdminSession } from "../../contexts/AdminContext";
import { getAdminApiError } from "../../lib/adminApiError";
import { ChainsawLoader } from "@/components/ui/chainsaw-loader";

interface Retailer {
  id: number;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website: string | null;
  logoObjectKey: string | null;
  active: boolean;
  featured: boolean;
  verificationStatus: "pending" | "verified" | "rejected";
  evidenceUrl: string | null;
  lastCheckedAt: string | null;
  reviewDueReminderSentAt: string | null;
  reviewDueReminderFailedAt: string | null;
  reviewOverdueReminderSentAt: string | null;
  reviewOverdueReminderFailedAt: string | null;
  notes: string | null;
}

interface VerificationHistoryEvent {
  id: number;
  retailerId: number;
  priorEvidenceUrl: string | null;
  priorCheckedAt: string | null;
  newEvidenceUrl: string;
  newCheckedAt: string;
  recordedAt: string;
}

interface FeaturedHistoryEvent {
  id: number;
  retailerId: number;
  priorFeatured: boolean;
  newFeatured: boolean;
  actorIdentity: string | null;
  recordedAt: string;
}

interface ReminderAttempt {
  id: number;
  retailerId: number;
  threshold: "due" | "overdue";
  outcome: "sent" | "failed";
  attemptedAt: string;
}

const EMPTY_RETAILER: Omit<Retailer, "id"> = {
  name: "", address: "", town: "", county: "", postcode: "",
  lat: 0, lng: 0, email: "", phone: "", website: "", logoObjectKey: null, active: true, featured: false,
  verificationStatus: "pending", evidenceUrl: "", lastCheckedAt: "",
  reviewDueReminderSentAt: null, reviewDueReminderFailedAt: null,
  reviewOverdueReminderSentAt: null, reviewOverdueReminderFailedAt: null, notes: "",
};

const MAX_RETAILER_LOGO_BYTES = 5 * 1024 * 1024;

function retailerLogoUrl(retailer: Partial<Retailer>): string | null {
  if (!retailer.id || !retailer.logoObjectKey) return null;
  const match = retailer.logoObjectKey.match(/^retailer-logos\/([1-9]\d*)\/([a-f0-9-]{36})$/);
  if (!match || Number(match[1]) !== retailer.id) return null;
  return `/api/retailers/public/logos/${retailer.id}/${match[2]}`;
}

type ReviewFilter = "all" | "due" | "overdue";

function getReviewStatus(retailer: Retailer, now = new Date()): ReviewStatus {
  return getRetailerReviewStatus(retailer, now);
}

function formatReminderDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function useRetailerHistory<T>(
  headers: Record<string, string>,
  path: string,
  connectionError: string,
) {
  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const load = async (nextRetailer: Retailer) => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = ++requestRef.current;
    setRetailer(nextRetailer);
    setItems([]);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/retailers/${nextRetailer.id}/${path}`, {
        headers,
        signal: abortController.signal,
      });
      if (!response.ok) {
        const nextError = await getAdminApiError(response);
        if (requestRef.current === requestId) setError(nextError);
        return;
      }
      const nextItems = await response.json();
      if (requestRef.current === requestId) setItems(nextItems);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      if (requestRef.current === requestId) setError(connectionError);
    } finally {
      if (abortControllerRef.current === abortController) abortControllerRef.current = null;
      if (requestRef.current === requestId) setLoading(false);
    }
  };

  const close = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestRef.current += 1;
    setRetailer(null);
  };

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return { retailer, items, loading, error, load, close };
}

export default function AdminRetailers() {
  const { adminToken } = useAdminSession();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  
  const [editingRetailer, setEditingRetailer] = useState<Partial<Retailer> | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoUpdating, setLogoUpdating] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const [featuredToggleId, setFeaturedToggleId] = useState<number | null>(null);
  const [featuredToggleError, setFeaturedToggleError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [inactiveFeaturedOnly, setInactiveFeaturedOnly] = useState(false);
  const [reverifyingRetailer, setReverifyingRetailer] = useState<Retailer | null>(null);
  const [reverifyEvidenceUrl, setReverifyEvidenceUrl] = useState("");
  const [reverifyError, setReverifyError] = useState("");
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const featuredHistoryPanelRef = useRef<HTMLDivElement>(null);
  const reminderHistoryPanelRef = useRef<HTMLDivElement>(null);
  const reverifyEvidenceInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const localLogoPreviewRef = useRef<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const headers = { admintoken: adminToken ?? "", "Content-Type": "application/json" };
  const clearLocalLogoPreview = () => {
    if (localLogoPreviewRef.current) URL.revokeObjectURL(localLogoPreviewRef.current);
    localLogoPreviewRef.current = null;
    setLocalLogoPreview(null);
  };

  useEffect(() => () => {
    if (localLogoPreviewRef.current) URL.revokeObjectURL(localLogoPreviewRef.current);
  }, []);

  const uploadRetailerLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!editingRetailer?.id) {
      setLogoError("Save the retailer before uploading a logo.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const extensionTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const contentType = file.type || (extension ? extensionTypes[extension] : undefined);
    if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      setLogoError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RETAILER_LOGO_BYTES) {
      setLogoError("The logo must be smaller than 5 MB.");
      return;
    }

    clearLocalLogoPreview();
    const previewUrl = URL.createObjectURL(file);
    localLogoPreviewRef.current = previewUrl;
    setLocalLogoPreview(previewUrl);
    setLogoError("");
    setLogoUpdating(true);
    const retailerId = editingRetailer.id;
    try {
      const request = await fetch(`/api/admin/retailers/${retailerId}/logo-upload`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: file.name, size: file.size, contentType }),
      });
      if (!request.ok) throw new Error(await getAdminApiError(request));
      const { uploadURL, objectKey } = await request.json() as { uploadURL: string; objectKey: string };
      const upload = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!upload.ok) throw new Error("The image upload failed. Please try again.");

      const assignment = await fetch(`/api/admin/retailers/${retailerId}/logo`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ objectKey }),
      });
      if (!assignment.ok) throw new Error(await getAdminApiError(assignment));
      const result = await assignment.json() as { logoObjectKey: string | null };
      setEditingRetailer((current) => current?.id === retailerId
        ? { ...current, logoObjectKey: result.logoObjectKey }
        : current);
      setRetailers((current) => current.map((retailer) => retailer.id === retailerId
        ? { ...retailer, logoObjectKey: result.logoObjectKey }
        : retailer));
      clearLocalLogoPreview();
    } catch (error) {
      clearLocalLogoPreview();
      setLogoError(error instanceof Error ? error.message : "The logo could not be uploaded.");
    } finally {
      setLogoUpdating(false);
    }
  };

  const removeRetailerLogo = async () => {
    if (!editingRetailer?.id || !editingRetailer.logoObjectKey) return;
    const retailerId = editingRetailer.id;
    setLogoError("");
    setLogoUpdating(true);
    try {
      const response = await fetch(`/api/admin/retailers/${retailerId}/logo`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ objectKey: null }),
      });
      if (!response.ok) throw new Error(await getAdminApiError(response));
      const result = await response.json() as { logoObjectKey: string | null };
      setEditingRetailer((current) => current?.id === retailerId
        ? { ...current, logoObjectKey: result.logoObjectKey }
        : current);
      setRetailers((current) => current.map((retailer) => retailer.id === retailerId
        ? { ...retailer, logoObjectKey: result.logoObjectKey }
        : retailer));
      clearLocalLogoPreview();
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : "The logo could not be removed.");
    } finally {
      setLogoUpdating(false);
    }
  };
  const {
    retailer: historyRetailer,
    items: verificationHistory,
    loading: historyLoading,
    error: historyError,
    load: showVerificationHistory,
    close: closeVerificationHistory,
  } = useRetailerHistory<VerificationHistoryEvent>(
    headers,
    "verification-history",
    "The verification history could not be loaded. Please check your connection and try again.",
  );
  const {
    retailer: featuredHistoryRetailer,
    items: featuredHistory,
    loading: featuredHistoryLoading,
    error: featuredHistoryError,
    load: showFeaturedHistory,
    close: closeFeaturedHistory,
  } = useRetailerHistory<FeaturedHistoryEvent>(
    headers,
    "featured-history",
    "The featured history could not be loaded. Please check your connection and try again.",
  );
  const {
    retailer: reminderHistoryRetailer,
    items: reminderAttempts,
    loading: reminderHistoryLoading,
    error: reminderHistoryError,
    load: showReminderHistory,
    close: closeReminderHistory,
  } = useRetailerHistory<ReminderAttempt>(
    headers,
    "reminder-attempts",
    "The reminder attempt history could not be loaded. Please check your connection and try again.",
  );

  const loadRetailers = async () => {
    if (!adminToken) return;
    try {
      const r = await fetch("/api/admin/retailers", { headers });
      if (r.ok) {
        setRetailers(await r.json());
        setLoadError("");
      } else {
        setLoadError(await getAdminApiError(r));
      }
    } catch {
      setLoadError("The retailer directory could not be loaded. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRetailers();
  }, [adminToken]);

  const saveRetailer = async () => {
    if (!editingRetailer) return;
    if (!String(editingRetailer.name ?? "").trim()) {
      setSaveError("Please enter a retailer name.");
      return;
    }

    setSaveError("");
    setSaving(true);
    try {
      const isNew = !editingRetailer.id;
      const url = isNew ? "/api/admin/retailers" : `/api/admin/retailers/${editingRetailer.id}`;
      const method = isNew ? "POST" : "PUT";
      
      const payload = { ...editingRetailer };
      delete payload.logoObjectKey;
      // Normalise empty dates/urls
      if (!payload.lastCheckedAt) payload.lastCheckedAt = null;
      if (!payload.evidenceUrl) payload.evidenceUrl = null;
      if (!payload.website) payload.website = null;
      
      const r = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (r.ok) {
        clearLocalLogoPreview();
        setEditingRetailer(null);
        setLogoError("");
        setSaveError("");
        await loadRetailers();
        return;
      }
      setSaveError(await getAdminApiError(r));
    } catch {
      setSaveError("The retailer could not be saved. Please check your connection and try again.");
    } finally { setSaving(false); }
  };

  const toggleFeatured = async (retailer: Retailer) => {
    setFeaturedToggleError("");
    setFeaturedToggleId(retailer.id);
    try {
      const response = await fetch(`/api/admin/retailers/${retailer.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...retailer, featured: !retailer.featured }),
      });
      if (!response.ok) {
        setFeaturedToggleError(await getAdminApiError(response));
        return;
      }
      const updatedRetailer = await response.json() as Retailer;
      setRetailers((current) => current.map((item) =>
        item.id === updatedRetailer.id ? updatedRetailer : item,
      ));
    } catch {
      setFeaturedToggleError("Featured status could not be updated. Please check your connection and try again.");
    } finally {
      setFeaturedToggleId(null);
    }
  };

  const deleteRetailer = async (id: number) => {
    if (!confirm("Permanently delete this retailer? This cannot be undone.")) return;
    setDeleteError("");
    try {
      const response = await fetch(`/api/admin/retailers/${id}`, { method: "DELETE", headers });
      if (!response.ok) {
        setDeleteError(await getAdminApiError(response));
        return;
      }
      await loadRetailers();
    } catch {
      setDeleteError("The retailer could not be deleted. Please check your connection and try again.");
    }
  };

  const startReverification = (retailer: Retailer) => {
    setReverifyError("");
    setReverifyEvidenceUrl(retailer.evidenceUrl ?? retailer.website ?? "");
    setReverifyingRetailer(retailer);
  };

  useEffect(() => {
    if (reverifyingRetailer) reverifyEvidenceInputRef.current?.focus();
  }, [reverifyingRetailer]);

  const reverifyRetailer = async () => {
    if (!reverifyingRetailer) return;
    setReverifyError("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/retailers/${reverifyingRetailer.id}/reverify`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ evidenceUrl: reverifyEvidenceUrl }),
      });
      if (!response.ok) {
        setReverifyError(await getAdminApiError(response));
        return;
      }
      setReverifyingRetailer(null);
      await loadRetailers();
    } catch {
      setReverifyError("The verification could not be saved. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (historyRetailer) historyPanelRef.current?.focus();
  }, [historyRetailer]);

  useEffect(() => {
    if (featuredHistoryRetailer) featuredHistoryPanelRef.current?.focus();
  }, [featuredHistoryRetailer]);

  useEffect(() => {
    if (reminderHistoryRetailer) reminderHistoryPanelRef.current?.focus();
  }, [reminderHistoryRetailer]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminToken) return;
    
    setImporting(true);
    setImportResults(null);
    try {
      const text = await file.text();
      let rows;
      try {
        rows = JSON.parse(text);
      } catch (err) {
        alert("Invalid JSON file.");
        setImporting(false);
        return;
      }
      
      if (!Array.isArray(rows)) {
        alert("JSON must be an array of retailer objects.");
        setImporting(false);
        return;
      }

      const res = await fetch("/api/admin/retailers/import", {
        method: "POST",
        headers,
        body: JSON.stringify({ rows }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(`Import failed: ${data.error || res.statusText}`);
      } else {
        setImportResults(data);
        await loadRetailers();
      }
    } catch (err) {
      alert("Error reading file.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const reviewCounts = retailers.reduce((counts, retailer) => {
    const status = getReviewStatus(retailer);
    const reviewThreshold: RetailerReviewThreshold | null =
      status === "due" || status === "overdue" ? status : null;
    if (reviewThreshold) counts[reviewThreshold] += 1;
    return counts;
  }, { due: 0, overdue: 0 });
  const featuredCount = retailers.filter((retailer) => retailer.featured).length;
  const inactiveFeaturedCount = retailers.filter((retailer) => !retailer.active && retailer.featured).length;

  useEffect(() => {
    if (inactiveFeaturedCount === 0) setInactiveFeaturedOnly(false);
  }, [inactiveFeaturedCount]);

  const toggleInactiveFeaturedView = () => {
    setSearch("");
    setReviewFilter("all");
    setFeaturedOnly(false);
    setInactiveFeaturedOnly((current) => !current);
  };

  const filteredRetailers = retailers.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.postcode.toLowerCase().includes(search.toLowerCase());
    const status = getReviewStatus(r);
    return matchesSearch
      && (reviewFilter === "all" || status === reviewFilter)
      && (!featuredOnly || r.featured)
      && (!inactiveFeaturedOnly || (!r.active && r.featured));
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Link>
          </Button>
          <span className="font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-[#e27226]" /> Retailer Directory
          </span>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4 pb-20">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <input 
             aria-label="Search retailers"
            type="text" 
            placeholder="Search name or postcode..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImport}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="font-mono tracking-widest text-xs gap-1.5" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <ChainsawLoader className="w-3.5 h-3.5" /> : <FileUp className="w-3.5 h-3.5" />}
              Import JSON
            </Button>
            <Button size="sm" className="font-mono tracking-widest text-xs gap-1.5" onClick={() => { clearLocalLogoPreview(); setLogoError(""); setSaveError(""); setEditingRetailer({ ...EMPTY_RETAILER }); }}>
              <Plus className="w-3.5 h-3.5" /> Add Retailer
            </Button>
          </div>
        </div>

        <Card className={reviewCounts.overdue ? "border-red-500/40" : "border-border"}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-widest">Verification review queue</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verified active retailers are due for review after {RETAILER_REVIEW_INTERVAL_DAYS} days. A warning appears {RETAILER_REVIEW_DUE_NOTICE_DAYS} days beforehand.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Filter retailer verification reviews">
              {([
                ["all", `All (${retailers.length})`],
                ["due", `Due soon (${reviewCounts.due})`],
                ["overdue", `Overdue (${reviewCounts.overdue})`],
              ] as [ReviewFilter, string][]).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={reviewFilter === value ? "default" : "outline"}
                  aria-pressed={reviewFilter === value}
                  onClick={() => setReviewFilter(value)}
                  className="font-mono text-xs"
                >
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={featuredOnly ? "default" : "outline"}
                aria-pressed={featuredOnly}
                onClick={() => setFeaturedOnly((current) => !current)}
                className="font-mono text-xs"
              >
                <Star className="w-3.5 h-3.5 mr-1 fill-current" />
                Featured ({featuredCount})
              </Button>
            </div>
          </CardContent>
        </Card>

        {inactiveFeaturedCount > 0 && (
          <Card
            role="region"
            aria-labelledby="inactive-featured-warning-title"
            className="border-red-500/50 bg-red-500/5"
            data-testid="warning-inactive-featured"
          >
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="min-w-0">
                    <p id="inactive-featured-warning-title" className="font-mono text-xs font-bold uppercase tracking-widest text-red-700">
                      {inactiveFeaturedCount} inactive {inactiveFeaturedCount === 1 ? "retailer is" : "retailers are"} still featured
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Review these retailers to remove featured priority or make them active again.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={inactiveFeaturedOnly ? "default" : "outline"}
                  aria-pressed={inactiveFeaturedOnly}
                  onClick={toggleInactiveFeaturedView}
                  className="w-full shrink-0 font-mono text-xs sm:w-auto"
                  data-testid="button-filter-inactive-featured"
                >
                  {inactiveFeaturedOnly ? "Show all retailers" : `Review affected (${inactiveFeaturedCount})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {importResults && (
          <Card className="border-blue-500/30 bg-blue-50/10">
            <CardHeader className="py-3 px-4 flex flex-row justify-between items-center border-b border-border/50">
              <CardTitle className="font-mono text-xs uppercase">Import Results</CardTitle>
              <Button variant="ghost" size="sm" className="h-6" onClick={() => setImportResults(null)}>Dismiss</Button>
            </CardHeader>
            <CardContent className="p-4 font-mono text-sm space-y-2">
              <div className="flex gap-4 text-xs">
                <span className="font-bold">Total: {importResults.summary.total}</span>
                <span className="text-green-600 font-bold">Created: {importResults.summary.created}</span>
                <span className="text-amber-600 font-bold">Duplicates: {importResults.summary.duplicate}</span>
                <span className="text-red-600 font-bold">Errors: {importResults.summary.error}</span>
              </div>
              <div className="max-h-40 overflow-y-auto mt-2 space-y-1 text-xs bg-black/5 p-2 rounded">
                {importResults.results.map((r: any, i: number) => (
                  <div key={i} className={`flex gap-2 ${r.status === 'error' ? 'text-red-600' : r.status === 'duplicate' ? 'text-amber-600' : 'text-green-600'}`}>
                    <span className="w-12 text-muted-foreground shrink-0">Row {r.row}</span>
                    <span className="uppercase tracking-widest w-20 shrink-0">{r.status}</span>
                    <span>{r.error || (r.retailer ? `${r.retailer.name} (${r.retailer.postcode})` : "")}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {editingRetailer && (
          <Card className="border-[#e27226]/30 bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-mono font-bold text-xs uppercase tracking-widest">{editingRetailer.id ? "Edit Retailer" : "New Retailer"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["name", "Retailer Name"], ["address", "Address"], ["town", "Town"],
                  ["county", "County"], ["postcode", "Postcode"], ["email", "Email"],
                  ["phone", "Phone"], ["website", "Website (optional)"],
                ] as [keyof Retailer, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label htmlFor={`retailer-${field}`} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                      {label}{field === "name" || field === "postcode" ? " *" : ""}
                    </label>
                    <input
                      id={`retailer-${field}`}
                      value={(editingRetailer[field] as string) ?? ""}
                      onChange={e => { setSaveError(""); setEditingRetailer(prev => ({ ...prev!, [field]: e.target.value })); }}
                      className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="retailer-lat" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Latitude (optional)</label>
                  <input id="retailer-lat" type="number" step="0.0001" value={editingRetailer.lat || ""} onChange={e => { setSaveError(""); setEditingRetailer(prev => ({ ...prev!, lat: e.target.value === "" ? undefined : Number(e.target.value) })); }} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label htmlFor="retailer-lng" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Longitude (optional)</label>
                  <input id="retailer-lng" type="number" step="0.0001" value={editingRetailer.lng || ""} onChange={e => { setSaveError(""); setEditingRetailer(prev => ({ ...prev!, lng: e.target.value === "" ? undefined : Number(e.target.value) })); }} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono" />
                </div>
                {!editingRetailer.id && (
                  <>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Verification Status</label>
                      <select value={editingRetailer.verificationStatus ?? "pending"} onChange={e => setEditingRetailer(prev => ({ ...prev!, verificationStatus: e.target.value as Retailer["verificationStatus"] }))} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono">
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Evidence URL</label>
                      <input
                        value={editingRetailer.evidenceUrl ?? ""}
                        onChange={e => setEditingRetailer(prev => ({ ...prev!, evidenceUrl: e.target.value }))}
                        className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                        placeholder="e.g. https://..."
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Last Checked At</label>
                      <input
                        type="date"
                        value={editingRetailer.lastCheckedAt ? editingRetailer.lastCheckedAt.split('T')[0] : ""}
                        onChange={e => setEditingRetailer(prev => ({ ...prev!, lastCheckedAt: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                        className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 pt-6">
                  <input id="retailer-active" type="checkbox" checked={editingRetailer.active ?? true} onChange={e => setEditingRetailer(prev => ({ ...prev!, active: e.target.checked }))} className="accent-[#e27226]" />
                  <label htmlFor="retailer-active" className="font-mono text-xs">Active (visible on map)</label>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="retailer-featured" type="checkbox" checked={editingRetailer.featured ?? false} onChange={e => setEditingRetailer(prev => ({ ...prev!, featured: e.target.checked }))} className="accent-[#e27226]" />
                  <label htmlFor="retailer-featured" className="font-mono text-xs">Featured retailer</label>
                </div>
              </div>
              <section aria-label="Retailer logo" className="space-y-3 rounded border border-border p-3">
                <div>
                  <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest">Retailer Logo</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPEG, or WebP up to 5 MB. Logo changes save immediately.
                  </p>
                </div>
                {!editingRetailer.id ? (
                  <p className="text-xs text-muted-foreground">Save this retailer before uploading a logo.</p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/30 p-2">
                      {(localLogoPreview || retailerLogoUrl(editingRetailer)) ? (
                        <img
                          src={localLogoPreview || retailerLogoUrl(editingRetailer) || ""}
                          alt={`Logo for ${editingRetailer.name || "retailer"}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-center font-mono text-[10px] text-muted-foreground">No logo uploaded</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        aria-label="Choose retailer logo image"
                        onChange={uploadRetailerLogo}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        disabled={logoUpdating}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {logoUpdating ? <ChainsawLoader className="mr-1 h-3.5 w-3.5" /> : null}
                        {editingRetailer.logoObjectKey ? "Replace logo" : "Upload logo"}
                      </Button>
                      {editingRetailer.logoObjectKey && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs text-destructive"
                          disabled={logoUpdating}
                          onClick={() => void removeRetailerLogo()}
                        >
                          Remove logo
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {logoError && (
                  <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                    {logoError}
                  </p>
                )}
              </section>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Internal Notes</label>
                <textarea value={editingRetailer.notes ?? ""} onChange={e => setEditingRetailer(prev => ({ ...prev!, notes: e.target.value }))} rows={2} className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm resize-none" />
              </div>
              {saveError && (
                <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {saveError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="font-mono tracking-widest text-xs" disabled={logoUpdating} onClick={() => { clearLocalLogoPreview(); setLogoError(""); setSaveError(""); setEditingRetailer(null); }}>Cancel</Button>
                <Button size="sm" className="font-mono tracking-widest text-xs" disabled={saving || logoUpdating} onClick={saveRetailer}>
                  {saving ? <ChainsawLoader className="w-3.5 h-3.5 mr-1" /> : null} Save Retailer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {reverifyingRetailer && (
          <Card className="border-amber-500/40">
            <CardContent className="p-4">
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void reverifyRetailer(); }}>
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-widest">Re-verify {reverifyingRetailer.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Saving records today as the checked date and leaves all other retailer details unchanged.</p>
              </div>
              <div>
                <label htmlFor="reverify-evidence-url" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Current evidence URL *</label>
                <input
                  ref={reverifyEvidenceInputRef}
                  id="reverify-evidence-url"
                  type="url"
                  required
                  value={reverifyEvidenceUrl}
                  onChange={(event) => { setReverifyError(""); setReverifyEvidenceUrl(event.target.value); }}
                  className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                  placeholder="https://..."
                />
              </div>
              {reverifyError && <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{reverifyError}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setReverifyingRetailer(null)} disabled={saving}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving || !reverifyEvidenceUrl.trim()}>
                  {saving ? <ChainsawLoader className="w-3.5 h-3.5 mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                  Confirm re-verification
                </Button>
              </div>
              </form>
            </CardContent>
          </Card>
        )}

        {historyRetailer && (
          <Card
            ref={historyPanelRef}
            tabIndex={-1}
            role="region"
            aria-labelledby="verification-history-title"
            className="border-[#e27226]/30 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="verification-history-title" className="font-mono font-bold text-xs uppercase tracking-widest">Verification history: {historyRetailer.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Past evidence records are read-only.</p>
                </div>
                <Button variant="outline" size="sm" onClick={closeVerificationHistory}>Close</Button>
              </div>
              {historyLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><ChainsawLoader className="w-3.5 h-3.5" /> Loading history…</div>}
              {historyError && (
                <div role="alert" className="space-y-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">{historyError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void showVerificationHistory(historyRetailer)}
                    disabled={historyLoading}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Retry verification history
                  </Button>
                </div>
              )}
              {!historyLoading && !historyError && verificationHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">No re-verification history has been recorded yet.</p>
              )}
              {!historyLoading && verificationHistory.length > 0 && (
                <ol className="space-y-3">
                  {verificationHistory.map((event) => (
                    <li key={event.id} className="rounded border border-border p-3 text-xs">
                      <p className="font-mono font-bold">{new Date(event.recordedAt).toLocaleString()}</p>
                      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <dt className="font-mono uppercase tracking-widest text-[10px] text-muted-foreground">Prior evidence</dt>
                          <dd className="mt-1 break-all">
                            {event.priorEvidenceUrl ? <a className="underline" href={event.priorEvidenceUrl} target="_blank" rel="noreferrer">{event.priorEvidenceUrl}</a> : "None recorded"}
                          </dd>
                          <dd className="text-muted-foreground mt-1">{event.priorCheckedAt ? `Checked ${new Date(event.priorCheckedAt).toLocaleString()}` : "No prior checked date"}</dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-widest text-[10px] text-muted-foreground">New evidence</dt>
                          <dd className="mt-1 break-all"><a className="underline" href={event.newEvidenceUrl} target="_blank" rel="noreferrer">{event.newEvidenceUrl}</a></dd>
                          <dd className="text-muted-foreground mt-1">Checked {new Date(event.newCheckedAt).toLocaleString()}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {featuredHistoryRetailer && (
          <Card
            ref={featuredHistoryPanelRef}
            tabIndex={-1}
            role="region"
            aria-labelledby="featured-history-title"
            className="border-[#e27226]/30 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="featured-history-title" className="font-mono font-bold text-xs uppercase tracking-widest">Featured history: {featuredHistoryRetailer.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Featured-status changes are read-only and separate from verification evidence.</p>
                </div>
                <Button variant="outline" size="sm" onClick={closeFeaturedHistory}>Close</Button>
              </div>
              {featuredHistoryLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><ChainsawLoader className="w-3.5 h-3.5" /> Loading history…</div>}
              {featuredHistoryError && (
                <div role="alert" className="space-y-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">{featuredHistoryError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void showFeaturedHistory(featuredHistoryRetailer)}
                    disabled={featuredHistoryLoading}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Retry featured history
                  </Button>
                </div>
              )}
              {!featuredHistoryLoading && !featuredHistoryError && featuredHistory.length === 0 && (
                <p className="text-sm text-muted-foreground">No featured-status changes have been recorded yet.</p>
              )}
              {!featuredHistoryLoading && featuredHistory.length > 0 && (
                <ol className="space-y-3">
                  {featuredHistory.map((event) => (
                    <li key={event.id} className="rounded border border-border p-3 text-xs">
                      <p className="font-mono font-bold">{new Date(event.recordedAt).toLocaleString()}</p>
                      <p className="mt-1 text-muted-foreground">
                        Changed by <span className="font-semibold text-foreground">{event.actorIdentity ?? "Not recorded"}</span>
                      </p>
                      <dl className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <dt className="font-mono uppercase tracking-widest text-[10px] text-muted-foreground">Prior state</dt>
                          <dd className="mt-1 font-semibold">{event.priorFeatured ? "Featured" : "Not featured"}</dd>
                        </div>
                        <div>
                          <dt className="font-mono uppercase tracking-widest text-[10px] text-muted-foreground">New state</dt>
                          <dd className="mt-1 font-semibold">{event.newFeatured ? "Featured" : "Not featured"}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {reminderHistoryRetailer && (
          <Card
            ref={reminderHistoryPanelRef}
            tabIndex={-1}
            role="region"
            aria-labelledby="reminder-history-title"
            className="border-[#e27226]/30 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="reminder-history-title" className="font-mono font-bold text-xs uppercase tracking-widest">Reminder attempts: {reminderHistoryRetailer.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Every due and overdue delivery attempt is retained as read-only history.</p>
                </div>
                <Button variant="outline" size="sm" onClick={closeReminderHistory}>Close</Button>
              </div>
              {reminderHistoryLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><ChainsawLoader className="w-3.5 h-3.5" /> Loading attempts…</div>}
              {reminderHistoryError && (
                <div role="alert" className="space-y-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">{reminderHistoryError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void showReminderHistory(reminderHistoryRetailer)} disabled={reminderHistoryLoading}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry reminder history
                  </Button>
                </div>
              )}
              {!reminderHistoryLoading && !reminderHistoryError && reminderAttempts.length === 0 && (
                <p className="text-sm text-muted-foreground">No reminder attempts have been recorded yet.</p>
              )}
              {!reminderHistoryLoading && reminderAttempts.length > 0 && (
                <ol className="space-y-2">
                  {reminderAttempts.map((attempt) => (
                    <li key={attempt.id} className="flex flex-col gap-1 rounded border border-border p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-mono font-bold">{new Date(attempt.attemptedAt).toLocaleString()}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="uppercase">{attempt.threshold}</Badge>
                        <Badge variant="outline" className={attempt.outcome === "sent" ? "border-green-600 text-green-700" : "border-red-500 text-red-700"}>
                          {attempt.outcome === "sent" ? "Sent" : "Failed"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        )}

        {loadError && (
          <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {loadError}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {deleteError}
          </p>
        )}
        {featuredToggleError && (
          <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
            {featuredToggleError}
          </p>
        )}

        {loading ? <div className="flex justify-center py-10"><ChainsawLoader className="w-6 h-6 text-muted-foreground" /></div> : (
          <div className="space-y-2">
            {filteredRetailers.length === 0 && <p className="font-mono text-xs text-muted-foreground text-center py-8">No retailers found.</p>}
            {filteredRetailers.map(r => {
              const reviewStatus = getReviewStatus(r);
              const isInactiveFeatured = !r.active && r.featured;
              return (
              <Card
                key={r.id}
                data-testid={`card-retailer-${r.id}`}
                className={`${isInactiveFeatured ? "border-red-500/60 bg-red-500/5" : reviewStatus === "overdue" ? "border-red-500/50 bg-red-500/5" : reviewStatus === "due" ? "border-amber-500/50 bg-amber-500/5" : "border-border"} ${!r.active && !isInactiveFeatured ? "opacity-50" : ""}`}
              >
                <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${r.verificationStatus === 'verified' ? 'bg-green-500' : r.verificationStatus === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm flex flex-wrap items-center gap-2">
                        <span className="break-words">{r.name}</span>
                        {isInactiveFeatured ? (
                          <Badge variant="outline" className="h-auto min-h-4 whitespace-normal border-red-500 py-0 text-[9px] text-red-700" data-testid={`status-inactive-featured-${r.id}`}>
                            <AlertTriangle className="mr-1 h-2.5 w-2.5 shrink-0" />INACTIVE BUT FEATURED
                          </Badge>
                        ) : (
                          <>
                            {r.featured && <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#e27226] text-[#b94f0c]"><Star className="w-2.5 h-2.5 mr-1 fill-current" />FEATURED</Badge>}
                            {!r.active && <Badge variant="outline" className="text-[9px] py-0 h-4 border-red-500 text-red-600">INACTIVE</Badge>}
                          </>
                        )}
                        {reviewStatus === "due" && <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-600 text-amber-700">DUE SOON</Badge>}
                        {reviewStatus === "overdue" && <Badge variant="outline" className="text-[9px] py-0 h-4 border-red-500 text-red-600">OVERDUE</Badge>}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{r.town}, {r.county} · {r.postcode}</div>
                      {(r.reviewDueReminderSentAt || r.reviewOverdueReminderSentAt || r.reviewDueReminderFailedAt || r.reviewOverdueReminderFailedAt) && (
                        <dl role="group" aria-label={`Reminder history for ${r.name}`} className="mt-1 flex flex-col gap-0.5 font-mono text-[10px] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-3">
                          {r.reviewDueReminderSentAt && (
                            <div className="flex gap-1">
                              <dt>Due reminder:</dt>
                              <dd className="font-semibold text-foreground">{formatReminderDate(r.reviewDueReminderSentAt)}</dd>
                            </div>
                          )}
                          {r.reviewOverdueReminderSentAt && (
                            <div className="flex gap-1">
                              <dt>Overdue reminder:</dt>
                              <dd className="font-semibold text-foreground">{formatReminderDate(r.reviewOverdueReminderSentAt)}</dd>
                            </div>
                          )}
                          {r.reviewDueReminderFailedAt && (
                            <div className="flex flex-wrap gap-x-1 text-red-700">
                              <dt className="font-semibold">Due reminder failed:</dt>
                              <dd>{formatReminderDate(r.reviewDueReminderFailedAt)}</dd>
                            </div>
                          )}
                          {r.reviewOverdueReminderFailedAt && (
                            <div className="flex flex-wrap gap-x-1 text-red-700">
                              <dt className="font-semibold">Overdue reminder failed:</dt>
                              <dd>{formatReminderDate(r.reviewOverdueReminderFailedAt)}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
                    <div className="hidden sm:flex flex-col items-end text-[9px] font-mono">
                      {r.lastCheckedAt && <span className="text-muted-foreground">Checked: {new Date(r.lastCheckedAt).toLocaleDateString()}</span>}
                      {r.verificationStatus === 'verified' && <span className="text-green-600 font-bold uppercase">Verified</span>}
                      {r.verificationStatus === 'pending' && <span className="text-amber-600 font-bold uppercase">Pending</span>}
                      {r.verificationStatus === 'rejected' && <span className="text-red-600 font-bold uppercase">Rejected</span>}
                    </div>
                    {(reviewStatus === "due" || reviewStatus === "overdue") && (
                      <Button variant="outline" size="sm" className="h-7 px-2 font-mono text-[10px]" onClick={() => startReverification(r)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Re-verify
                      </Button>
                    )}
                    <Button aria-label={`View verification history for ${r.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => showVerificationHistory(r)}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button aria-label={`View reminder attempt history for ${r.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => showReminderHistory(r)}>
                      <Mail className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      aria-label={r.featured ? `Remove ${r.name} from featured retailers` : `Mark ${r.name} as featured`}
                      aria-pressed={r.featured}
                      title={r.featured ? "Featured retailer" : "Mark as featured"}
                      variant="ghost"
                      size="sm"
                      className={`h-7 w-7 p-0 ${r.featured ? "text-[#e27226]" : "text-muted-foreground"}`}
                      disabled={featuredToggleId === r.id}
                      onClick={() => void toggleFeatured(r)}
                    >
                      {featuredToggleId === r.id
                        ? <ChainsawLoader className="h-3.5 w-3.5" />
                        : <Star className={`h-4 w-4 ${r.featured ? "fill-current" : ""}`} />}
                    </Button>
                    <Button aria-label={`View featured history for ${r.name}`} title="View featured history" variant="ghost" size="sm" className="relative h-7 w-7 p-0" onClick={() => showFeaturedHistory(r)}>
                      <History className="h-3.5 w-3.5" />
                      <Star className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 fill-background text-[#e27226]" />
                    </Button>
                    <Button aria-label={`Edit ${r.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { clearLocalLogoPreview(); setLogoError(""); setSaveError(""); setEditingRetailer({ ...r }); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button aria-label={`Permanently delete ${r.name}`} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteRetailer(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}