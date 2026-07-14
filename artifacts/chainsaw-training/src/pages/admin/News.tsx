import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Biohazard, CheckCircle2, ExternalLink, Loader2, Newspaper, Pencil, Plus, RefreshCw, Search, Trash2, X, XCircle } from "lucide-react";
import {
  useListNewsItems,
  useListPendingNewsItems,
  useCreateNewsItem,
  useUpdateNewsItem,
  useDeleteNewsItem,
  useApproveNewsItem,
  useRejectNewsItem,
  useTriggerNewsFetch,
} from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "live" | "pending";

type FormState = {
  title: string;
  excerpt: string;
  url: string;
  imageUrl: string;
  publishedAt: string;
};

const empty = (): FormState => ({
  title: "",
  excerpt: "",
  url: "",
  imageUrl: "",
  publishedAt: new Date().toISOString().slice(0, 10),
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminNews() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const [tab, setTab] = useState<Tab>("live");
  const [search, setSearch] = useState("");

  const { data: liveItems, isLoading: liveLoading } = useListNewsItems();
  const { data: pendingItems, isLoading: pendingLoading } = useListPendingNewsItems();

  const q = search.trim().toLowerCase();
  const filteredLive = q
    ? liveItems?.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.excerpt.toLowerCase().includes(q) ||
        (i.feedSource ?? "").toLowerCase().includes(q)
      )
    : liveItems;
  const filteredPending = q
    ? pendingItems?.filter((i) =>
        i.title.toLowerCase().includes(q) ||
        i.excerpt.toLowerCase().includes(q) ||
        (i.feedSource ?? "").toLowerCase().includes(q)
      )
    : pendingItems;

  const createItem = useCreateNewsItem();
  const updateItem = useUpdateNewsItem();
  const deleteItem = useDeleteNewsItem();
  const approveItem = useApproveNewsItem();
  const rejectItem = useRejectNewsItem();
  const triggerFetch = useTriggerNewsFetch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(empty());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ fetched: number; inserted: number; skipped: number; errors: string[] } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(empty());
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof liveItems>[number]) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      excerpt: item.excerpt,
      url: item.url,
      imageUrl: item.imageUrl ?? "",
      publishedAt: item.publishedAt.slice(0, 10),
    });
    setDialogOpen(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["listNewsItems"] });
    queryClient.invalidateQueries({ queryKey: ["listPendingNewsItems"] });
  };

  const handleSave = async () => {
    if (!adminToken) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      url: form.url.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      publishedAt: new Date(form.publishedAt).toISOString(),
    };
    try {
      if (editingId !== null) {
        await updateItem.mutateAsync({ id: editingId, data: payload });
      } else {
        await createItem.mutateAsync({ data: payload });
      }
      invalidate();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!adminToken || deleteId === null) return;
    await deleteItem.mutateAsync({ id: deleteId });
    invalidate();
    setDeleteId(null);
  };

  const handleApprove = async (id: number) => {
    if (processingId !== null) return;
    setProcessingId(id);
    try {
      await approveItem.mutateAsync({ id });
      invalidate();
    } catch {
      // ignore — server error already logged
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    if (processingId !== null) return;
    setProcessingId(id);
    try {
      await rejectItem.mutateAsync({ id });
      invalidate();
    } catch {
      // ignore — server error already logged
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteAllPending = async () => {
    if (!pendingItems?.length) return;
    setDeleteAllConfirm(false);
    setDeletingAll(true);
    try {
      await Promise.allSettled(pendingItems.map((item) => rejectItem.mutateAsync({ id: item.id })));
      invalidate();
    } finally {
      setDeletingAll(false);
    }
  };

  const handleFetchNow = async () => {
    setFetching(true);
    setFetchResult(null);
    try {
      const result = await triggerFetch.mutateAsync();
      setFetchResult(result);
      invalidate();
    } finally {
      setFetching(false);
    }
  };

  const valid = form.title.trim() && form.excerpt.trim() && form.url.trim() && form.publishedAt;
  const pendingCount = pendingItems?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> NEWS MANAGEMENT
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleFetchNow}
            disabled={fetching}
            className="font-mono text-xs uppercase tracking-widest"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
            {fetching ? "Fetching…" : "Fetch RSS Now"}
          </Button>
          <Button onClick={openCreate} className="font-mono text-xs uppercase tracking-widest">
            <Plus className="w-4 h-4 mr-2" /> Add Manual Article
          </Button>
        </div>

        {/* Fetch result banner */}
        {fetchResult && (
          <Card className="bg-secondary/20">
            <CardContent className="p-4 font-mono text-sm space-y-1">
              <p className="font-bold">RSS Fetch Complete</p>
              <p>Fetched: <span className="text-primary">{fetchResult.fetched}</span> items across all sources</p>
              <p>New (pending review): <span className="text-primary">{fetchResult.inserted}</span></p>
              <p>Skipped (duplicates): {fetchResult.skipped}</p>
              {fetchResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-destructive font-bold">Sources that failed ({fetchResult.errors.length}):</p>
                  {fetchResult.errors.map((e, i) => (
                    <p key={i} className="text-destructive text-xs">{e}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, summary or source…"
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

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setTab("live")}
            className={`font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
              tab === "live" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live ({filteredLive?.length ?? 0})
          </button>
          <button
            onClick={() => setTab("pending")}
            className={`font-mono text-xs uppercase tracking-widest px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
              tab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending Review
            {pendingCount > 0 && (
              <Badge className="h-4 px-1.5 text-xs font-mono">{pendingCount}</Badge>
            )}
          </button>
          {tab === "pending" && pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteAllConfirm(true)}
              disabled={deletingAll || processingId !== null}
              className="ml-auto font-mono text-xs uppercase tracking-widest text-destructive hover:text-destructive border-destructive/40 hover:border-destructive"
            >
              {deletingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              {deletingAll ? "Deleting…" : `Delete All (${pendingCount})`}
            </Button>
          )}
        </div>

        {/* Live articles tab */}
        {tab === "live" && (
          <div className="space-y-3">
            {liveLoading && <p className="text-muted-foreground text-sm font-mono text-center py-8">Loading…</p>}
            {!liveLoading && filteredLive?.length === 0 && (
              <p className="text-muted-foreground text-sm font-mono text-center py-8">
                {q ? `No live articles match "${search}"` : "No live articles yet."}
              </p>
            )}
            {filteredLive?.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="w-16 h-14 object-cover rounded shrink-0 bg-muted"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-sm leading-snug line-clamp-1">{item.title}</p>
                          <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.excerpt}</p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground font-mono">{formatDate(item.publishedAt)}</span>
                            {item.feedSource && (
                              <Badge variant="outline" className="font-mono text-xs">{item.feedSource}</Badge>
                            )}
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
                              <ExternalLink className="w-3 h-3" /> View
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="font-mono text-xs">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteId(item.id)}
                            className="font-mono text-xs text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pending review tab */}
        {tab === "pending" && (
          <div className="space-y-3">
            {pendingLoading && <p className="text-muted-foreground text-sm font-mono text-center py-8">Loading…</p>}
            {!pendingLoading && filteredPending?.length === 0 && (
              <p className="text-muted-foreground text-sm font-mono text-center py-8">
                {q ? `No pending articles match "${search}"` : `No articles pending review. Click "Fetch RSS Now" to pull the latest from all sources.`}
              </p>
            )}
            {filteredPending?.map((item) => (
              <Card key={item.id} className="border-amber-200">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold text-sm leading-snug line-clamp-2">{item.title}</p>
                      <p className="text-muted-foreground text-xs mt-1 line-clamp-3">{item.excerpt}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">{formatDate(item.publishedAt)}</span>
                        {item.feedSource && (
                          <Badge variant="outline" className="font-mono text-xs">{item.feedSource}</Badge>
                        )}
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-mono">
                          <ExternalLink className="w-3 h-3" /> Read article
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleApprove(item.id)}
                        disabled={processingId !== null}
                        className="font-mono text-xs bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
                        {processingId === item.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />} Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(item.id)}
                        disabled={processingId !== null}
                        className="font-mono text-xs text-destructive hover:text-destructive disabled:opacity-50">
                        {processingId === item.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />} Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest text-sm">
              {editingId !== null ? "Edit Article" : "Add Manual Article"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Title *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="HSE updates chainsaw guidance…" className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Short Summary *</label>
              <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="1–2 sentence summary…" className="font-mono text-sm resize-none" rows={3} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Article URL *</label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://…" className="font-mono text-sm" type="url" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Image URL (optional)</label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg" className="font-mono text-sm" type="url" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Publication Date *</label>
              <Input value={form.publishedAt} onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                className="font-mono text-sm" type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="font-mono text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={!valid || saving} className="font-mono text-xs uppercase tracking-widest">
              {saving ? "Saving…" : editingId !== null ? "Save Changes" : "Add Article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest text-sm">Delete Article?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove the article from the news feed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="font-mono text-xs">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete all pending confirmation */}
      <Dialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest text-sm">Delete All Pending?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove all <span className="font-bold text-foreground">{pendingCount}</span> articles
            waiting for review. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllConfirm(false)} className="font-mono text-xs">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAllPending} className="font-mono text-xs uppercase tracking-widest">
              Delete All {pendingCount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
