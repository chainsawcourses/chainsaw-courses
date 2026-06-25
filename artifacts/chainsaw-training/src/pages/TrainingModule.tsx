import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, ShieldAlert, CheckCircle2, LogOut, FileText, ExternalLink, ChevronRight } from "lucide-react";
import { useGetModule, getGetModuleQueryKey, useCompleteVideo, useSaveHeartbeat } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { VimeoPlayer } from "@/components/VimeoPlayer";
import { useToast } from "@/hooks/use-toast";

export default function TrainingModule() {
  const { moduleId } = useParams();
  const id = moduleId ? parseInt(moduleId) : 0;

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { activationCode, deviceId, clearSession } = useUserSession();

  const { data: module, isLoading } = useGetModule(id, {
    query: { queryKey: getGetModuleQueryKey(id), enabled: !!activationCode && !!deviceId && !!id }
  });

  const completeVideo = useCompleteVideo();
  const saveHeartbeat = useSaveHeartbeat();

  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [canPlay, setCanPlay] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);

  useEffect(() => {
    if (!activationCode || !deviceId) { setLocation("/"); return; }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (!module) return;
    if (module.contentType === "pdf") {
      setCanPlay(true);
    } else if (module.isHighRisk && !canPlay) {
      setSafetyModalOpen(true);
    } else if (!module.isHighRisk) {
      setCanPlay(true);
    }
  }, [module]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (safetyModalOpen && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [safetyModalOpen, countdown]);

  const handleSafetyAcknowledge = () => { setSafetyModalOpen(false); setCanPlay(true); };

  // Heartbeat for video modules
  useEffect(() => {
    if (!canPlay || !deviceId || !activationCode || module?.contentType === "pdf") return;
    const interval = setInterval(() => {
      saveHeartbeat.mutate({ data: { moduleId: id, timestamp: 0, deviceId, activationCode } });
    }, 30000);
    return () => clearInterval(interval);
  }, [canPlay, deviceId, activationCode, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVideoEnded = useCallback(() => {
    setVideoCompleted(true);
    if (!deviceId || !activationCode) return;
    completeVideo.mutate({ data: { moduleId: id, deviceId, activationCode } });
  }, [deviceId, activationCode, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToCourse = useCallback(() => {
    sessionStorage.setItem("scrollAfterModule", String(id));
    setLocation("/training");
  }, [id, setLocation]);

  const handleTimeUpdate = useCallback((_t: number) => {}, []);

  if (isLoading || !module) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-primary font-mono tracking-widest uppercase">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        Loading...
      </div>
    );
  }

  const isPdf = module.contentType === "pdf";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
            <Link href="/training"><ArrowLeft className="w-4 h-4 mr-2" /> BACK</Link>
          </Button>
          <div className="font-mono text-sm font-bold uppercase truncate max-w-[50vw]">{module.title}</div>
          <Button variant="ghost" size="sm" className="font-mono text-xs text-muted-foreground hover:text-destructive w-[80px]"
            onClick={() => { clearSession(); window.location.href = import.meta.env.BASE_URL; }}>
            <LogOut className="w-3 h-3 mr-1" /> LOG OUT
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-6">

        {/* ── PDF MODULE ── */}
        {isPdf && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12 text-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-12 h-12 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-mono uppercase tracking-wider mb-2">{module.title}</h2>
              <p className="text-muted-foreground max-w-md">{module.description}</p>
            </div>

            {module.pdfUrl ? (
              <Button size="lg" className="font-mono tracking-widest gap-2" asChild>
                <a href={module.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> OPEN PDF DOCUMENT
                </a>
              </Button>
            ) : (
              <div className="px-6 py-4 border border-border rounded-lg bg-secondary/20 font-mono text-sm text-muted-foreground">
                PDF document coming soon — admin can upload via the dashboard.
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm text-primary uppercase tracking-wider">Module automatically marked complete</span>
            </div>

            <Button variant="outline" className="font-mono tracking-widest gap-1" asChild>
              <Link href="/training">
                BACK TO COURSE <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* ── VIDEO MODULE ── */}
        {!isPdf && (
          <>
            {/* Video player — capped height so info panel stays visible without scrolling */}
            <div className="relative w-full max-w-3xl mx-auto" style={{ maxHeight: "38vh" }}>
              {/* pointer-events-none when overlay is active so iframe doesn't swallow clicks */}
              {canPlay && module.vimeoId ? (
                <div className={(videoCompleted || module.isCompleted) ? "pointer-events-none" : ""}>
                  <VimeoPlayer
                    vimeoId={module.vimeoId}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnded}
                  />
                </div>
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-secondary/20 border border-border rounded-lg">
                  <div className="text-center font-mono text-muted-foreground uppercase tracking-widest text-xs">
                    {safetyModalOpen ? "SAFETY ACKNOWLEDGMENT REQUIRED" : "INITIALIZING PLAYER..."}
                  </div>
                </div>
              )}

              {/* Completion overlay — shown when video ends */}
              {(videoCompleted || module.isCompleted) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 rounded-lg p-4 text-center">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-mono font-bold text-sm uppercase tracking-wide">
                      {module.quizPassed ? "Module Complete" : "Well done — module complete!"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 w-full max-w-[220px]">
                    {!module.quizPassed && (
                      <Button size="sm" className="font-mono tracking-widest w-full" asChild>
                        <Link href={`/quiz/${module.id}`}>TAKE QUIZ</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="font-mono tracking-widest w-full bg-black/40 border-white/30 text-white hover:bg-white/10 hover:text-white" asChild>
                      <Link href={`/mock-test?module=${module.id}`}>ASSESSMENT QUESTIONS</Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="font-mono text-white/70 hover:text-white hover:bg-white/10 w-full text-xs" onClick={handleBackToCourse}>
                      ← BACK TO COURSE
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Module info panel */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/30 p-5 rounded-lg border border-border">
              <div>
                <h2 className="text-lg font-bold font-mono uppercase mb-1">{module.title}</h2>
                <p className="text-muted-foreground text-sm max-w-2xl">{module.description}</p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2 w-full sm:w-auto">
                {module.quizPassed ? (
                  <>
                    <div className="flex items-center text-primary font-mono font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> QUIZ PASSED
                    </div>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto font-mono tracking-widest text-xs" asChild>
                      <Link href={`/mock-test?module=${module.id}`}>ASSESSMENT QUESTIONS</Link>
                    </Button>
                  </>
                ) : (videoCompleted || module.isCompleted) ? (
                  <Button className="w-full sm:w-auto font-mono tracking-widest" asChild>
                    <Link href={`/quiz/${module.id}`}>TAKE QUIZ</Link>
                  </Button>
                ) : (
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider text-right">
                    Watch video<br />to continue
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* High-risk safety modal */}
      <Dialog open={safetyModalOpen} onOpenChange={(open) => { if (!open && !canPlay) return; setSafetyModalOpen(open); }}>
        <DialogContent className="sm:max-w-md border-destructive/50 bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center font-mono text-destructive uppercase tracking-wide text-xl">
              <ShieldAlert className="w-6 h-6 mr-2" /> MANDATORY SAFETY BRIEFING
            </DialogTitle>
            <DialogDescription className="font-mono text-foreground mt-4 text-sm leading-relaxed">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                {module.safetyText || "This module demonstrates high-risk operational techniques. Failure to apply proper safety protocols may result in severe injury or death."}
              </div>
              I acknowledge the risks and confirm I will apply appropriate safety measures.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button className="w-full font-mono font-bold tracking-widest"
              variant={countdown > 0 ? "secondary" : "destructive"}
              disabled={countdown > 0}
              onClick={handleSafetyAcknowledge}>
              {countdown > 0 ? `ACKNOWLEDGE IN ${countdown}s` : "I UNDERSTAND & ACKNOWLEDGE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
