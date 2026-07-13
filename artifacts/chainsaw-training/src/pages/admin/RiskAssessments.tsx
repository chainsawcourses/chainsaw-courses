import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPinned, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useListAllRiskAssessments, getListAllRiskAssessmentsQueryKey } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

function riskBand(rating: number): { label: string; className: string } {
  if (rating >= 15) return { label: "High", className: "text-destructive border-destructive bg-destructive/10" };
  if (rating >= 8) return { label: "Medium", className: "text-amber-600 border-amber-500 bg-amber-500/10" };
  return { label: "Low", className: "text-primary border-primary bg-primary/10" };
}

export default function RiskAssessments() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) {
      setLocation("/admin");
    }
  }, [isReady, adminToken, setLocation]);

  const { data: assessments, isLoading } = useListAllRiskAssessments({
    query: { queryKey: getListAllRiskAssessmentsQueryKey(), enabled: !!adminToken },
  });

  const highRiskCount = assessments?.filter(
    (a) => Math.max(0, ...a.hazards.map((h) => h.riskRating)) >= 15
  ).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <img src="/bio-hazard.png" alt="" className="w-5 h-5 mr-2 inline" /> RISK ASSESSMENTS
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Card className="bg-secondary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <MapPinned className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm">
              {assessments
                ? `${assessments.length} assessment${assessments.length === 1 ? "" : "s"} recorded, ${highRiskCount} flagged high-risk`
                : "No risk assessments submitted yet"}
            </span>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
        )}

        <div className="space-y-3">
          {assessments?.map((record) => {
            const maxRisk = Math.max(0, ...record.hazards.map((h) => h.riskRating));
            const band = riskBand(maxRisk);
            return (
              <Card key={record.id} className={maxRisk >= 15 ? "border-destructive/50" : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-mono">
                    <span>{record.studentName ?? "Unknown student"}</span>
                    <span className={`flex items-center gap-1 text-xs uppercase tracking-widest px-2 py-0.5 rounded border ${band.className}`}>
                      {maxRisk >= 15 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {band.label} risk
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm font-mono text-muted-foreground space-y-2">
                  <div className="text-[10px] uppercase tracking-widest opacity-60">
                    {new Date(record.createdAt).toLocaleString()}
                  </div>
                  <p className="text-xs text-foreground">{record.taskDescription}</p>
                  {record.siteDescription && <p className="text-xs">{record.siteDescription}</p>}
                  {record.address && <p className="text-xs">{record.address}</p>}
                  {record.gridReference && <p className="text-xs">Grid ref: {record.gridReference}</p>}
                  <div className="grid sm:grid-cols-2 gap-1.5 pt-2">
                    {record.hazards.map((h) => {
                      const hBand = riskBand(h.riskRating);
                      return (
                        <div key={h.id} className="text-xs border border-border/60 rounded p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-foreground">{h.label}</span>
                            <span className={`shrink-0 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${hBand.className}`}>
                              {hBand.label}
                            </span>
                          </div>
                          {h.controlMeasures && (
                            <p className="text-muted-foreground italic mt-1">{h.controlMeasures}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
