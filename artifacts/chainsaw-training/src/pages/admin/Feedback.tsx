import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, Search, Star, X } from "lucide-react";
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

  const [search, setSearch] = useState("");

  const avgRating = feedback && feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? feedback?.filter((f) =>
        f.moduleTitle.toLowerCase().includes(q) ||
        (f.comment ?? "").toLowerCase().includes(q) ||
        (f.studentName ?? "").toLowerCase().includes(q)
      )
    : feedback;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> MODULE FEEDBACK
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by module, student or comment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <p className="text-center text-muted-foreground font-mono text-sm py-8">
            {q ? `No results for "${search}"` : "No feedback submitted yet"}
          </p>
        )}

        <div className="space-y-3">
          {filtered?.map((f) => (
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
