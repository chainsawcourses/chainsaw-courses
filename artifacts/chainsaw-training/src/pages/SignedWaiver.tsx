import { useMemo, useState } from "react";
import { ChevronLeft, Check, Download, Loader2 } from "lucide-react";
import { getGetWaiverQueryKey, useGetWaiver } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserSession } from "@/contexts/UserContext";
import { deliverPdf } from "@/lib/pdfDownload";
import { WAIVER_CLAUSES } from "./Waiver";

type WaiverClause = {
  number: string;
  title: string;
  text: string;
};

export default function SignedWaiver() {
  const { activationCode, deviceId } = useUserSession();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const { data: waiver, isLoading, isError } = useGetWaiver({
    query: {
      queryKey: getGetWaiverQueryKey(),
      enabled: !!activationCode && !!deviceId,
      staleTime: 5 * 60 * 1000,
    },
  });

  const clauses = useMemo<WaiverClause[]>(() => {
    if (!waiver?.clausesSnapshot) return WAIVER_CLAUSES;
    try {
      const parsed = JSON.parse(waiver.clausesSnapshot);
      return Array.isArray(parsed) ? parsed : WAIVER_CLAUSES;
    } catch {
      return WAIVER_CLAUSES;
    }
  }, [waiver?.clausesSnapshot]);

  const handleDownload = async () => {
    if (!activationCode || !deviceId || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch("/api/waiver/pdf", {
        headers: { activationcode: activationCode, deviceid: deviceId },
      });
      if (!response.ok) throw new Error("Failed to load signed waiver");
      const result = await deliverPdf(
        await response.blob(),
        "Chainsaw-Courses-Signed-Waiver.pdf",
      );
      if (result === "saved") {
        toast({ title: "Waiver saved", description: "Your signed waiver was saved to the selected location." });
      } else if (result === "shared") {
        toast({ title: "Waiver ready", description: "Choose a location or app from the share sheet." });
      } else if (result === "downloaded") {
        toast({ title: "Waiver download started", description: "Your signed waiver should appear in Downloads." });
      }
    } catch {
      toast({ variant: "destructive", title: "Could not download waiver", description: "Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  const signedDate = waiver?.signedAt
    ? new Date(waiver.signedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-muted/30">
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border bg-background px-3 py-3 sm:px-4">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
          Signed Waiver
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          disabled={downloading || !waiver?.signed}
          className="h-8 gap-1.5 px-2 font-mono text-xs uppercase tracking-widest sm:px-3"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>

      <main className="flex flex-1 items-start justify-center overflow-auto p-3 sm:p-6">
        {isLoading && (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Loading signed waiver…</p>
          </div>
        )}

        {(isError || (waiver && !waiver.signed)) && (
          <div className="flex min-h-[60dvh] max-w-sm flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-sm font-bold uppercase tracking-widest">Signed waiver unavailable</p>
            <p className="text-sm text-muted-foreground">We could not load your signed waiver. Please go back and try again.</p>
          </div>
        )}

        {waiver?.signed && (
          <article className="w-full max-w-[760px] overflow-hidden border border-border bg-white text-[#1c1c1c] shadow-xl">
            <div className="border-t-[10px] border-[#e27226] px-5 py-7 sm:px-10 sm:py-10">
              <header className="border-b border-neutral-300 pb-6 text-center">
                <img src={`${import.meta.env.BASE_URL}logo.png?v=20`} alt="Chainsaw Courses" className="mx-auto mb-3 h-14 w-auto" />
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">Chainsaw Maintenance &amp; Cross Cutting</p>
                <h1 className="mt-4 text-xl font-black uppercase tracking-tight sm:text-2xl">Signed Liability Waiver &amp; Agreement</h1>
              </header>

              <section className="grid gap-2 border-b border-neutral-300 py-5 text-sm sm:grid-cols-2">
                <p><strong>Full name:</strong> {waiver.fullName || "—"}</p>
                <p><strong>Email:</strong> {waiver.email || "—"}</p>
                <p className="sm:col-span-2"><strong>Date signed:</strong> {signedDate}</p>
              </section>

              <section className="py-5">
                <h2 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-neutral-600">Agreed clauses</h2>
                <div className="space-y-4">
                  {clauses.map((clause) => (
                    <div key={clause.number} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-green-600 text-green-700">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wide">{clause.number}. {clause.title}</h3>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-700 sm:text-sm">{clause.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-neutral-300 pt-5">
                <h2 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-neutral-600">Digital signature</h2>
                <div className="flex min-h-28 max-w-md items-center justify-center border border-neutral-300 bg-neutral-50 p-3">
                  {waiver.signatureData
                    ? <img src={waiver.signatureData} alt={`Signature of ${waiver.fullName || "learner"}`} className="max-h-24 max-w-full object-contain" />
                    : <span className="text-sm text-neutral-500">Signature held on file</span>}
                </div>
                <p className="mt-3 text-xs text-neutral-500">Signed electronically on {signedDate}</p>
              </section>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}