import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, Download, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { useAdminSession } from "../../contexts/AdminContext";

interface ModuleItem {
  id: number;
  title: string;
  order: number;
}

function QrCodeCard({
  module,
  baseUrl,
}: {
  module: ModuleItem;
  baseUrl: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${baseUrl.replace(/\/$/, "")}/qr/${module.id}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  const handleDownload = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeName = module.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      a.download = `qr-${safeName}.png`;
      a.click();
    } catch {
      // ignore
    }
  };

  return (
    <Card className="border-border bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground leading-snug">
          {module.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center bg-white rounded p-2">
          <canvas ref={canvasRef} />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground break-all text-center">
          {url}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          className="w-full font-mono text-xs uppercase tracking-widest"
        >
          <Download className="w-3.5 h-3.5 mr-2" /> Download PNG
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminQrCodes() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    if (!adminToken) return;
    setLoading(true);
    fetch("/api/admin/modules", { headers: { admintoken: adminToken } })
      .then((r) => r.json())
      .then((data: ModuleItem[]) => {
        const EXCLUDE_IDS = [8, 11]; // Equipment List, Hazards & Risks
        const sorted = [...data]
          .filter((m) => !EXCLUDE_IDS.includes(m.id))
          .sort((a, b) => a.order - b.order);
        setModules(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [adminToken]);

  const [baseUrl, setBaseUrl] = useState(window.location.origin);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> QR CODE GENERATOR
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Config */}
        <Card className="border-border bg-card/30">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-widest">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                App Base URL
              </label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="font-mono text-sm"
                placeholder="https://your-app.replit.app/chainsaw-training"
              />
              <p className="text-xs text-muted-foreground font-mono">
                QR codes will point to:{" "}
                <span className="text-foreground">
                  {baseUrl.replace(/\/$/, "")}/qr/&lt;module-id&gt;
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-secondary/20 border-0">
          <CardContent className="p-4 font-mono text-xs text-muted-foreground space-y-1">
            <p className="font-bold text-foreground uppercase tracking-widest">How to use</p>
            <p>Each QR code links to the course app. When a student scans it:</p>
            <ul className="list-disc list-inside space-y-0.5 pl-2">
              <li>If they have not purchased → they see a prompt to buy at chainsawcourses.com</li>
              <li>If they have purchased and the module is unlocked → they are taken straight to the video</li>
              <li>If they have purchased but the module is still locked → they are told to complete earlier modules first</li>
            </ul>
            <p className="pt-1">Download each QR code as a high-resolution PNG (600×600 px) for placing in the manual.</p>
          </CardContent>
        </Card>

        {/* QR grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground font-mono text-sm">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading modules…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <QrCodeCard key={mod.id} module={mod} baseUrl={baseUrl} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
