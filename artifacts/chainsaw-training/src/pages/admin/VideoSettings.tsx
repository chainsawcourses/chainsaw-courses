import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, ArrowLeft, Save, CheckCircle2, Video, Play, ChevronUp, ChevronDown } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

const PLACEHOLDER_ID = "76979871";

function buildPreviewUrl(vimeoId: string): string {
  const slash = vimeoId.indexOf("/");
  const id = slash === -1 ? vimeoId : vimeoId.slice(0, slash);
  const hash = slash === -1 ? "" : vimeoId.slice(slash + 1);
  const params = new URLSearchParams({ title: "0", byline: "0", portrait: "0", controls: "1" });
  if (hash) params.set("h", hash);
  return `https://player.vimeo.com/video/${id}?${params}`;
}

interface ModuleVideo {
  id: number;
  title: string;
  order: number;
  vimeoId: string;
  inputValue: string;
  saving: boolean;
  saved: boolean;
  previewOpen: boolean;
}

function extractVimeoId(input: string): string {
  const trimmed = input.trim();

  // Already just a number or number/hash
  if (/^\d+(\/[a-f0-9]+)?$/.test(trimmed)) return trimmed;

  // Embed URL: player.vimeo.com/video/1234567890?h=abcdef1234
  const embedMatch = trimmed.match(/player\.vimeo\.com\/video\/(\d+)(?:\?h=([a-f0-9]+))?/);
  if (embedMatch) return embedMatch[2] ? `${embedMatch[1]}/${embedMatch[2]}` : embedMatch[1];

  // Private link: vimeo.com/1234567890/abcdef1234
  const privateMatch = trimmed.match(/vimeo\.com\/(\d+)\/([a-f0-9]{8,})/);
  if (privateMatch) return `${privateMatch[1]}/${privateMatch[2]}`;

  // Public URL: vimeo.com/123456789 or vimeo.com/channels/x/123456789
  const publicMatch = trimmed.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/);
  if (publicMatch) return publicMatch[1];

  return trimmed;
}

export default function VideoSettings() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();
  const [modules, setModules] = useState<ModuleVideo[]>([]);
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
      .then((data: { id: number; title: string; order: number; vimeoId: string }[]) => {
        setModules(
          data
            .filter((m) => (m as { contentType?: string }).contentType !== "pdf")
            .map((m) => ({
              ...m,
              inputValue: m.vimeoId === PLACEHOLDER_ID ? "" : m.vimeoId,
              saving: false,
              saved: false,
              previewOpen: false,
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

    const vimeoId = extractVimeoId(mod.inputValue);
    if (!vimeoId) {
      toast({ variant: "destructive", title: "Missing link", description: "Please paste a Vimeo link first." });
      return;
    }

    setModules((prev) => prev.map((m) => m.id === moduleId ? { ...m, saving: true } : m));

    try {
      const res = await fetch(`/api/admin/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ vimeoId }),
      });
      if (!res.ok) throw new Error("Save failed");
      setModules((prev) =>
        prev.map((m) => m.id === moduleId ? { ...m, saving: false, saved: true, vimeoId } : m)
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
              <Video className="w-5 h-5 mr-2" /> VIDEO SETTINGS
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground hidden sm:block">
            <ShieldAlert className="w-3 h-3 inline mr-1" /> ADMIN ONLY
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="mb-6 space-y-2">
          <p className="text-muted-foreground text-sm font-mono">
            Paste a Vimeo link for each module and click SAVE. For best results, use the <strong className="text-foreground">embed code URL</strong> from Vimeo (contains a hash like <code className="text-primary">?h=abc123</code>).
          </p>
          <p className="text-muted-foreground text-xs font-mono">
            In Vimeo: open your video → Share → Embed → copy the <code className="text-primary">src="..."</code> URL from the iframe code. This includes the required privacy hash.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 font-mono text-muted-foreground animate-pulse">LOADING MODULES...</div>
        ) : (
          modules.map((mod) => (
            <Card key={mod.id} className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
                  <span className="text-primary opacity-50 text-xs">MODULE {mod.order}</span>
                  <span>{mod.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. https://player.vimeo.com/video/123456789?h=abc123def0"
                    value={mod.inputValue}
                    onChange={(e) =>
                      setModules((prev) =>
                        prev.map((m) => m.id === mod.id ? { ...m, inputValue: e.target.value, saved: false, previewOpen: false } : m)
                      )
                    }
                    className="font-mono text-sm bg-background flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(mod.id); }}
                  />
                  <Button
                    onClick={() => handleSave(mod.id)}
                    disabled={mod.saving || !mod.inputValue.trim()}
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

                {/* Preview / status row */}
                {mod.vimeoId && mod.vimeoId !== PLACEHOLDER_ID ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-mono opacity-60">
                        Current: vimeo.com/{mod.vimeoId}
                      </p>
                      <button
                        onClick={() => setModules((prev) => prev.map((m) => m.id === mod.id ? { ...m, previewOpen: !m.previewOpen } : m))}
                        className="flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                      >
                        {mod.previewOpen ? <><ChevronUp className="w-3 h-3" /> HIDE PREVIEW</> : <><Play className="w-3 h-3" /> TEST PREVIEW</>}
                      </button>
                    </div>
                    {mod.previewOpen && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <iframe
                          key={mod.vimeoId}
                          src={buildPreviewUrl(mod.vimeoId)}
                          className="w-full aspect-video"
                          allow="autoplay; fullscreen"
                          allowFullScreen
                          title={`Preview: ${mod.title}`}
                        />
                        <p className="text-[10px] font-mono text-muted-foreground text-center py-1 bg-muted/30">
                          If the video shows a Vimeo error, go to Vimeo → Privacy → "Where can this be embedded?" → set to <strong>Anywhere</strong>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-500/80 font-mono">No video uploaded yet</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
