import { useState } from "react";
import { useUserSession } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { deliverPdf } from "../lib/pdfDownload";
import { useToast } from "@/hooks/use-toast";

export default function CertificatePage() {
  const { activationCode, deviceId } = useUserSession();
  const { toast } = useToast();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Direct URL usable as iframe src — credentials in query params so iOS Safari
  // can load it without needing blob/data URIs (which iOS cannot render in iframes)
  const viewUrl = activationCode && deviceId
    ? `/api/certificate/view?code=${encodeURIComponent(activationCode)}&device=${encodeURIComponent(deviceId)}`
    : null;

  const handleDownload = async () => {
    if (!activationCode || !deviceId || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/certificate?download=1", {
        headers: { activationcode: activationCode, deviceid: deviceId },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const result = await deliverPdf(blob, "Chainsaw_Certificate.pdf");
      if (result === "saved") {
        toast({ title: "Certificate saved", description: "Your certificate was saved to the selected location." });
      } else if (result === "shared") {
        toast({ title: "Certificate ready", description: "Choose a location or app from the share sheet." });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not download certificate", description: "Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <span className="font-mono font-bold text-xs uppercase tracking-widest text-foreground">
          Certificate
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={downloading}
          className="font-mono text-xs uppercase tracking-widest gap-1.5 h-8"
        >
          {downloading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Download className="w-3.5 h-3.5" />}
          Download
        </Button>
      </div>

      {/* Loading overlay — shown until iframe fires onLoad */}
      {!iframeLoaded && (
        <div className="absolute inset-0 top-[53px] flex flex-col items-center justify-center gap-3 bg-background z-10 pointer-events-none">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Generating certificate…
          </p>
        </div>
      )}

      {/* The certificate is shown directly in the page on every device. */}
      {viewUrl && (
        <iframe
          src={viewUrl}
          className="flex-1 w-full border-none"
          title="Your Certificate"
          onLoad={() => setIframeLoaded(true)}
        />
      )}
    </div>
  );
}
