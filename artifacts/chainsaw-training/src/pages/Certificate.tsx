import { useRef, useState } from "react";
import { useUserSession } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Loader2, FileCheck } from "lucide-react";

// iOS Safari cannot render PDFs inline in iframes — it shows a broken "view / Open" picker.
// The Download button works fine on iOS 13+, so we skip the iframe on iOS entirely.
const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function CertificatePage() {
  const { activationCode, deviceId } = useUserSession();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // Direct URL usable as iframe src — credentials in query params so iOS Safari
  // can load it without needing blob/data URIs (which iOS cannot render in iframes)
  const viewUrl = activationCode && deviceId
    ? `/api/certificate/view?code=${encodeURIComponent(activationCode)}&device=${encodeURIComponent(deviceId)}`
    : null;

  const handleDownload = async () => {
    if (!activationCode || !deviceId || downloading) return;
    setDownloading(true);
    try {
      // Revoke any previous blob to avoid leaks
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      const res = await fetch("/api/certificate?download=1", {
        headers: { activationcode: activationCode, deviceid: deviceId },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      // Appended-anchor pattern — triggers real download on desktop, Android, iOS 13+
      const a = document.createElement("a");
      a.href = url;
      a.download = "Chainsaw_Certificate.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      }, 30000);
    } catch {
      alert("Could not download certificate — please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
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

      {isIOS ? (
        /* iOS can't render PDFs in iframes — show a download prompt instead */
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <FileCheck className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">
              Certificate Ready
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tap <strong>Download</strong> above to save your certificate as a PDF.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Loading overlay — shown until iframe fires onLoad */}
          {!iframeLoaded && (
            <div className="absolute inset-0 top-[53px] flex flex-col items-center justify-center gap-3 bg-background z-10 pointer-events-none">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
                Generating certificate…
              </p>
            </div>
          )}

          {/* PDF iframe — real HTTP URL works on non-iOS browsers */}
          {viewUrl && (
            <iframe
              src={viewUrl}
              className="flex-1 w-full border-none"
              title="Your Certificate"
              onLoad={() => setIframeLoaded(true)}
            />
          )}
        </>
      )}
    </div>
  );
}
