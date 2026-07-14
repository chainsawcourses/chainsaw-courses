import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, Download } from "lucide-react";
import QRCode from "qrcode";
import { useAdminSession } from "../../contexts/AdminContext";

// Default number of sequential modules in the course
const DEFAULT_MODULE_COUNT = 7;

function QrCodeCard({ moduleId, baseUrl }: { moduleId: number; baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${baseUrl.replace(/\/$/, "")}/qr/${moduleId}`;

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
      a.download = `qr-module-${moduleId}.png`;
      a.click();
    } catch {
      // ignore
    }
  };

  return (
    <Card className="border-border bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Module {moduleId}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center bg-white rounded p-2">
          <canvas ref={canvasRef} />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground break-all text-center">{url}</p>
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

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const defaultBase = (() => {
    const base = import.meta.env.BASE_URL ?? "/";
    return `${window.location.origin}${base.replace(/\/$/, "")}`;
  })();

  const [baseUrl, setBaseUrl] = useState(defaultBase);
  const [moduleCount, setModuleCount] = useState(DEFAULT_MODULE_COUNT);

  const moduleIds = Array.from({ length: moduleCount }, (_, i) => i + 1);

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
                QR codes will point to: <span className="text-foreground">{baseUrl.replace(/\/$/, "")}/qr/&lt;module-id&gt;</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Number of modules
              </label>
              <Input
                type="number"
                min={1}
                max={20}
                value={moduleCount}
                onChange={(e) => setModuleCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="font-mono text-sm w-24"
              />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {moduleIds.map((id) => (
            <QrCodeCard key={id} moduleId={id} baseUrl={baseUrl} />
          ))}
        </div>
      </main>
    </div>
  );
}
