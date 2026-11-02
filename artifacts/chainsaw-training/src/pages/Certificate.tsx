import { useState } from "react";
import { useUserSession } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download } from "lucide-react";
import { deliverPdf } from "../lib/pdfDownload";
import { useToast } from "@/hooks/use-toast";
import { getGetCertificateDetailsQueryKey, useGetCertificateDetails } from "@workspace/api-client-react";
import { CertificateSheet } from "../components/CertificateSheet";
import { ChainsawLoader } from "@/components/ui/chainsaw-loader";
import { useQuery } from "@tanstack/react-query";
import type { CertificateDetails } from "@workspace/api-client-react";

export default function CertificatePage() {
  const { activationCode, deviceId, userId } = useUserSession();
  const isSampleReviewer = activationCode?.trim().toUpperCase() === "APPTEST26";
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const {
    data: realCertificate,
    isLoading,
    isError,
  } = useGetCertificateDetails({
    query: {
      queryKey: getGetCertificateDetailsQueryKey(),
      enabled: !!activationCode && !!deviceId && !isSampleReviewer,
      staleTime: 5 * 60 * 1000,
    },
  });
  const sampleQuery = useQuery({
    queryKey: ["reviewer-sample-certificate", userId],
    enabled: isSampleReviewer && !!activationCode && !!deviceId && !!userId,
    queryFn: async (): Promise<CertificateDetails> => {
      const response = await fetch("/api/certificate/sample/details", {
        headers: { activationcode: activationCode!, deviceid: deviceId!, userid: String(userId) },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Sample certificate unavailable");
      return response.json();
    },
    staleTime: 0,
  });
  const certificate = isSampleReviewer ? sampleQuery.data : realCertificate;
  const certificateLoading = isSampleReviewer ? sampleQuery.isLoading : isLoading;
  const certificateError = isSampleReviewer ? sampleQuery.isError : isError;

  const handleDownload = async () => {
    if (!activationCode || !deviceId || downloading || (isSampleReviewer && !userId)) return;
    setDownloading(true);
    try {
      let res: Response;
      if (isSampleReviewer) {
        res = await fetch("/api/certificate/sample", {
          headers: { activationcode: activationCode, deviceid: deviceId, userid: String(userId) },
          cache: "no-store",
        });
      } else {
        const tokenResponse = await fetch("/api/certificate/access-token", {
          headers: { activationcode: activationCode, deviceid: deviceId },
        });
        if (!tokenResponse.ok) throw new Error("Failed");
        const access = await tokenResponse.json() as { viewUrl: string };
        res = await fetch(access.viewUrl, { referrerPolicy: "no-referrer" });
      }
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const result = await deliverPdf(blob, isSampleReviewer ? "Chainsaw_Sample_Certificate_NOT_VALID.pdf" : "Chainsaw_Certificate.pdf");
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
          disabled={downloading || !certificate}
          className="font-mono text-xs uppercase tracking-widest gap-1.5 h-8"
        >
          {downloading
            ? <ChainsawLoader className="w-3.5 h-3.5" />
            : <Download className="w-3.5 h-3.5" />}
          Download
        </Button>
      </div>

      <main className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6">
        {certificateLoading && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
            <ChainsawLoader className="w-8 h-8 text-primary" />
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
              {isSampleReviewer ? "Loading sample certificate…" : "Generating certificate…"}
            </p>
          </div>
        )}

        {certificateError && (
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
            <CertificateSheet certificate={certificate} sample={isSampleReviewer} />
          </div>
        )}
      </main>
    </div>
  );
}
