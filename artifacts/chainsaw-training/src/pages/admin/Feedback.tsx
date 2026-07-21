import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, Search, Star, X, MessageSquare } from "lucide-react";
import {
  useListFeedback, getListFeedbackQueryKey,
  useListAppFeedback, getListAppFeedbackQueryKey,
} from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

export default function Feedback() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  const { data: videoFeedback, isLoading: loadingVideo } = useListFeedback({
    query: { queryKey: getListFeedbackQueryKey(), enabled: !!adminToken },
  });

  const { data: courseFeedback, isLoading: loadingCourse } = useListAppFeedback({
    query: { queryKey: getListAppFeedbackQueryKey(), enabled: !!adminToken },
  });

  const [videoSearch, setVideoSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");

  const videoAvg = videoFeedback && videoFeedback.length > 0
    ? (videoFeedback.reduce((s, f) => s + f.rating, 0) / videoFeedback.length).toFixed(1)
    : null;

  const courseAvg = courseFeedback && courseFeedback.length > 0
    ? (courseFeedback.reduce((s, f) => s + f.rating, 0) / courseFeedback.length).toFixed(1)
    : null;

  const vq = videoSearch.trim().toLowerCase();
  const filteredVideo = vq
    ? videoFeedback?.filter((f) =>
        f.moduleTitle.toLowerCase().includes(vq) ||
        (f.comment ?? "").toLowerCase().includes(vq) ||
        (f.studentName ?? "").toLowerCase().includes(vq)
      )
    : videoFeedback;

  const cq = courseSearch.trim().toLowerCase();
  const filteredCourse = cq
    ? courseFeedback?.filter((f) =>
        (f.comment ?? "").toLowerCase().includes(cq) ||
        (f.studentName ?? "").toLowerCase().includes(cq)
      )
    : courseFeedback;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <Biohazard className="w-5 h-5 mr-2 inline" /> FEEDBACK
          </div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <Link href="/admin/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" /> BACK TO DASHBOARD
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* ── Video Feedback ─────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-primary" />
            <h2 className="font-mono font-black uppercase tracking-widest text-base">Video Feedback</h2>
          </div>

          <Card className="bg-secondary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Star className="w-5 h-5 text-primary fill-primary" />
              <span className="font-mono text-sm">
                {videoAvg
                  ? `Average rating: ${videoAvg} / 5 across ${videoFeedback?.length} responses`
                  : "No video feedback submitted yet"}
              </span>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by module, student or comment…"
              value={videoSearch}
              onChange={(e) => setVideoSearch(e.target.value)}
              className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
            />
            {videoSearch && (
              <button onClick={() => setVideoSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingVideo && (
            <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
          )}
          {!loadingVideo && filteredVideo?.length === 0 && (
            <p className="text-center text-muted-foreground font-mono text-sm py-8">
              {vq ? `No results for "${videoSearch}"` : "No video feedback submitted yet"}
            </p>
          )}

          <div className="space-y-3">
            {filteredVideo?.map((f) => (
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
        </section>

        {/* ── Course Feedback ────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-primary" />
            <h2 className="font-mono font-black uppercase tracking-widest text-base">Course Feedback</h2>
          </div>

          <Card className="bg-secondary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm">
                {courseAvg
                  ? `Average rating: ${courseAvg} / 5 across ${courseFeedback?.length} responses`
                  : "No course feedback submitted yet"}
              </span>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student or comment…"
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="pl-10 pr-10 h-10 font-mono text-sm bg-card"
            />
            {courseSearch && (
              <button onClick={() => setCourseSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingCourse && (
            <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading...</div>
          )}
          {!loadingCourse && filteredCourse?.length === 0 && (
            <p className="text-center text-muted-foreground font-mono text-sm py-8">
              {cq ? `No results for "${courseSearch}"` : "No course feedback submitted yet"}
            </p>
          )}

          <div className="space-y-3">
            {filteredCourse?.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-mono">
                    <span className="text-muted-foreground">{f.studentName ?? "Anonymous"}</span>
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
                    {new Date(f.createdAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
