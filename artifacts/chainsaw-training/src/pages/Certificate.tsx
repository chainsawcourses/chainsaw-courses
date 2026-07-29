import { useEffect, useRef, useState } from "react";
import { useUserSession } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Loader2 } from "lucide-react";

export default function CertificatePage() {
  const { activationCode, deviceId } = useUserSession();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activationCode || !deviceId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/certificate", {
          headers: { activationcode: activationCode, deviceid: deviceId },
        });
        if (!res.ok) throw new Error("Failed");
        const blob = await res.blob();

        // Blob URL used for download
        blobUrlRef.current = URL.createObjectURL(blob);

        // Data URI for iframe (works on iOS Safari where blob: iframes are blocked)
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!cancelled) {
            setDataUrl(reader.result as string);
            setLoading(false);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [activationCode, deviceId]);

  const handleDownload = () => {
    const url = blobUrlRef.current;
    if (!url) return;
    // Appended-anchor pattern — works on desktop, Android, and iOS 13+
    const a = document.createElement("a");
    a.href = url;
    a.download = "Chainsaw_Certificate.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          disabled={!blobUrlRef.current && !dataUrl}
          className="font-mono text-xs uppercase tracking-widest gap-1.5 h-8"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </Button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Generating certificate…
          </p>
        </div>
      )}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="font-mono text-sm text-destructive uppercase tracking-widest">
            Could not load certificate
          </p>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="font-mono text-xs uppercase tracking-widest"
          >
            Go Back
          </Button>
        </div>
      )}
      {dataUrl && (
        <iframe
          src={dataUrl}
          className="flex-1 w-full border-none"
          title="Your Certificate"
        />
      )}
    </div>
  );
}
