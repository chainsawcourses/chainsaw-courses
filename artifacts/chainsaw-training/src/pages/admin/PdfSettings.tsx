import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, ArrowLeft, Save, CheckCircle2, FileText, FolderOpen } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

interface PdfModule {
  id: number;
  title: string;
  order: number;
  pdfUrl: string;
  inputValue: string;
  saving: boolean;
  saved: boolean;
}

export default function PdfSettings() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [modules, setModules] = useState<PdfModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isReady && !adminToken) {
      setLocation("/admin");
    }
  }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    fetch("/api/admin/modules", { headers: { admintoken: adminToken } })
      .then((r) => r.json())
      .then((data: { id: number; title: string; order: number; pdfUrl?: string; contentType?: string }[]) => {
        setModules(
          data
            .filter((m) => m.contentType === "pdf")
            .map((m) => ({
              id: m.id,
              title: m.title,
              order: m.order,
              pdfUrl: m.pdfUrl ?? "",
              inputValue: m.pdfUrl ?? "",
              saving: false,
              saved: false,
            }))
        );
        setLoading(false);
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Error", description: "Could not load modules." });
        setLoading(false);
      });
  }, [adminToken]);

  const handleSave = async (moduleId: number) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod || !adminToken) return;

    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, saving: true } : m));

    try {
      const res = await fetch(`/api/admin/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ pdfUrl: mod.inputValue.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      setModules((prev) =>
        prev.map((m) => m.id === moduleId ? { ...m, saving: false, saved: true, pdfUrl: mod.inputValue.trim() } : m)
      );
      setTimeout(() => setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, saved: false } : m)), 3000);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save. Try again." });
      setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, saving: false } : m));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
              <Link href="/admin/dashboard">
                <ArrowLeft className="w-4 h-4 mr-1" /> BACK
              </Link>
            </Button>
            <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
              <FileText className="w-5 h-5 mr-2" /> PDF SETTINGS
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground hidden sm:block">
            <ShieldAlert className="w-3 h-3 inline mr-1" /> ADMIN ONLY
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Upload instructions */}
        <Card className="border-border bg-card/20 border-dashed">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <FolderOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-mono text-sm font-bold text-foreground uppercase tracking-wide">
                  Option A — Upload to this project
                </p>
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  In the Replit file browser (left sidebar), upload your PDF into{" "}
                  <code className="text-primary bg-primary/10 px-1 rounded">
                    artifacts/chainsaw-training/public/pdfs/
                  </code>
                  . Once uploaded, the URL to paste below will be:
                </p>
                <code className="block text-primary text-xs bg-primary/10 p-2 rounded font-mono">
                  /pdfs/your-filename.pdf
                </code>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-mono text-sm font-bold text-foreground uppercase tracking-wide">
                  Option B — Use any public URL
                </p>
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  Paste any publicly accessible PDF link — Google Drive (share → "Anyone with the link"), Dropbox, your own website, or any CDN.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF module list */}
        {loading ? (
          <div className="text-center py-16 font-mono text-muted-foreground animate-pulse">LOADING MODULES...</div>
        ) : modules.length === 0 ? (
          <div className="text-center py-16 font-mono text-muted-foreground">No PDF modules found.</div>
        ) : (
          modules.map((mod) => (
            <Card key={mod.id} className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                  <span className="text-primary opacity-50 text-xs">MODULE {mod.order}</span>
                  <FileText className="w-4 h-4 text-primary opacity-60" />
                  <span>{mod.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. /pdfs/equipment-list.pdf  or  https://..."
                    value={mod.inputValue}
                    onChange={(e) =>
                      setModules((prev) =>
                        prev.map((m) => m.id === mod.id ? { ...m, inputValue: e.target.value, saved: false } : m)
                      )
                    }
                    className="font-mono text-sm bg-background flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(mod.id); }}
                  />
                  <Button
                    onClick={() => handleSave(mod.id)}
                    disabled={mod.saving}
                    className={`font-mono text-xs shrink-0 ${mod.saved ? "bg-green-600 hover:bg-green-600" : ""}`}
                  >
                    {mod.saving ? (
                      "SAVING..."
                    ) : mod.saved ? (
                      <><CheckCircle2 className="w-4 h-4 mr-1" /> SAVED</>
                    ) : (
                      <><Save className="w-4 h-4 mr-1" /> SAVE</>
                    )}
                  </Button>
                </div>
                {mod.pdfUrl && !mod.saved && (
                  <p className="text-xs text-muted-foreground font-mono mt-2 opacity-60 truncate">
                    Current: {mod.pdfUrl}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
