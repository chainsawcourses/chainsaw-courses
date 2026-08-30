import { useState } from "react";
import { useUserSession } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, Loader2 } from "lucide-react";
import { deliverPdf } from "../lib/pdfDownload";
import { useToast } from "@/hooks/use-toast";
import { getGetCertificateDetailsQueryKey, useGetCertificateDetails } from "@workspace/api-client-react";
import { CertificateSheet } from "../components/CertificateSheet";

export default function CertificatePage() {
  const { activationCode, deviceId } = useUserSession();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const {
    data: certificate,
    isLoading,
    isError,
  } = useGetCertificateDetails({
    query: {
      queryKey: getGetCertificateDetailsQueryKey(),
      enabled: !!activationCode && !!deviceId,
      staleTime: 5 * 60 * 1000,
    },
  });

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
      } else if (result === "downloaded") {
        toast({ title: "Certificate download started", description: "Your certificate should appear in Downloads." });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not download certificate", description: "Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-muted/30">
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background">
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

      <main className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6">
        {isLoading && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
              Generating certificate…
            </p>
          </div>
        )}

        {isError && (
          <div className="flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
              Certificate unavailable
            </p>
            <p className="text-sm text-muted-foreground">
              We could not load your certificate. Please go back and try again.
            </p>
          </div>
        )}

        {certificate && (
          <div className="w-full max-w-[595px]">
            <CertificateSheet certificate={certificate} />
          </div>
        )}
      </main>
    </div>
  );
}
