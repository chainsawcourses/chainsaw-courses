import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star } from "lucide-react";
import { bioHazardSrc } from "../../lib/customIcons";
import { useListFeedback, getListFeedbackQueryKey } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

export default function Feedback() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) {
      setLocation("/admin");
    }
  }, [isReady, adminToken, setLocation]);

  const { data: feedback, isLoading } = useListFeedback({
    query: { queryKey: getListFeedbackQueryKey(), enabled: !!adminToken },
  });

  const avgRating = feedback && feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <img src={bioHazardSrc} style={{ filter: "brightness(0) invert(0.65)" }} alt="" className="w-5 h-5 mr-2 inline" /> MODULE FEEDBACK
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
            <Star className="w-5 h-5 text-primary fill-primary" />
            <span className="font-mono text-sm">
              {avgRating ? `Average rating: ${avgRating} / 5 across ${feedback?.length} responses` : "No feedback submitted yet"}
            </span>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
        )}

        <div className="space-y-3">
          {feedback?.map((f) => (
            <Card key={f.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-mono">
                  <span>{f.moduleTitle}</span>
                  <span className="flex items-center gap-1 text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < f.rating ? "fill-primary" : "text-muted-foreground"}`} />
                    ))}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm font-mono text-muted-foreground">
                {f.comment ? f.comment : <span className="italic opacity-60">No comment provided</span>}
                <div className="mt-2 text-[10px] uppercase tracking-widest opacity-60">
                  {f.studentName ? `${f.studentName} — ` : ""}{new Date(f.createdAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
