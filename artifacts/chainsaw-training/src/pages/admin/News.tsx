import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Biohazard, ExternalLink, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { useListNewsItems, useCreateNewsItem, useUpdateNewsItem, useDeleteNewsItem } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useQueryClient } from "@tanstack/react-query";

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

  const { data: items, isLoading } = useListNewsItems();
  const createItem = useCreateNewsItem();
  const updateItem = useUpdateNewsItem();
  const deleteItem = useDeleteNewsItem();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(empty());
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(empty());
    setDialogOpen(true);
  };

  const openEdit = (item: NonNullable<typeof items>[number]) => {
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["listNewsItems"] });

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
      await invalidate();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!adminToken || deleteId === null) return;
    await deleteItem.mutateAsync({ id: deleteId });
    await invalidate();
    setDeleteId(null);
  };

  const valid = form.title.trim() && form.excerpt.trim() && form.url.trim() && form.publishedAt;

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
        <div className="flex items-center justify-between">
          <Card className="bg-secondary/20 flex-1 mr-4">
            <CardContent className="p-4 flex items-center gap-3">
              <Newspaper className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm">
                {isLoading ? "Loading…" : `${items?.length ?? 0} article${items?.length === 1 ? "" : "s"} posted`}
              </span>
            </CardContent>
          </Card>
          <Button onClick={openCreate} className="font-mono text-xs uppercase tracking-widest shrink-0">
            <Plus className="w-4 h-4 mr-2" /> ADD ARTICLE
          </Button>
        </div>

        {!isLoading && items?.length === 0 && (
          <div className="text-muted-foreground text-sm font-mono text-center py-12">
            No articles yet. Click ADD ARTICLE to post the first one.
          </div>
        )}

        <div className="space-y-3">
          {items?.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-16 h-14 object-cover rounded shrink-0 bg-muted"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-sm leading-snug line-clamp-1">{item.title}</p>
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.excerpt}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground font-mono">{formatDate(item.publishedAt)}</span>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
                          >
                            <ExternalLink className="w-3 h-3" /> View article
                          </a>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="font-mono text-xs">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteId(item.id)} className="font-mono text-xs text-destructive hover:text-destructive">
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
      </main>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest text-sm">
              {editingId !== null ? "Edit Article" : "Add Article"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="HSE updates chainsaw guidance…"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Short Summary *</label>
              <Textarea
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                placeholder="1–2 sentence summary of the article…"
                className="font-mono text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Article URL *</label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://www.hse.gov.uk/…"
                className="font-mono text-sm"
                type="url"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Image URL (optional)</label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                className="font-mono text-sm"
                type="url"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Publication Date *</label>
              <Input
                value={form.publishedAt}
                onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                className="font-mono text-sm"
                type="date"
              />
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
    </div>
  );
}
