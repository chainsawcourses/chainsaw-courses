import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, ShieldAlert } from "lucide-react";
import { useGetHazardsReference } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function riskBand(likelihood: number, severity: number) {
  const score = likelihood * severity;
  if (score >= 15) return { label: "High", className: "bg-red-100 text-red-700 border-red-200" };
  if (score >= 8) return { label: "Medium", className: "bg-amber-100 text-amber-800 border-amber-200" };
  return { label: "Low", className: "bg-green-100 text-green-700 border-green-200" };
}

export default function HazardsReference() {
  const { data, isLoading, isError, refetch } = useGetHazardsReference();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="app-header sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" asChild className="font-mono text-xs uppercase tracking-widest">
            <Link href="/training"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-black uppercase tracking-widest">Hazards &amp; Risks</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Phone-friendly reference</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {isLoading && (
          <div className="flex min-h-64 items-center justify-center text-primary">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        )}

        {isError && (
          <Card className="border-destructive">
            <CardContent className="space-y-3 p-5 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
              <p className="font-mono text-sm text-muted-foreground">The hazards reference could not be loaded.</p>
              <Button size="sm" onClick={() => void refetch()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <Card className="border-primary bg-primary/5">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h1 className="font-mono text-base font-black uppercase tracking-wide">{data.title}</h1>
                    <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{data.intro}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {data.hazards.length} common hazards and control measures
            </p>

            <div className="space-y-3">
              {data.hazards.map((hazard, index) => {
                const score = hazard.likelihood * hazard.severity;
                const band = riskBand(hazard.likelihood, hazard.severity);
                return (
                  <Card key={`${hazard.label}-${index}`} className="overflow-hidden border-border">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3 border-b border-border bg-muted/30 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary font-mono text-xs font-black text-primary-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h2 className="font-mono text-xs font-black uppercase leading-snug text-foreground">{hazard.label}</h2>
                          <span className={`mt-2 inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${band.className}`}>
                            {band.label} · L{hazard.likelihood} × S{hazard.severity} = {score}
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Control measures</p>
                        <p className="mt-1.5 font-mono text-xs leading-relaxed text-foreground">{hazard.controlMeasures}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <p className="flex items-center gap-2 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
              For personal reference only. Assess conditions on site before every operation.
            </p>
          </>
        )}
      </main>
    </div>
  );
}