import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, ShieldAlert, CheckCircle2, LogOut, FileText, ExternalLink, ChevronRight, RotateCcw } from "lucide-react";
import { useGetModule, getGetModuleQueryKey, useCompleteVideo, useSaveHeartbeat, getListModulesQueryKey, getGetProgressSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserSession } from "../contexts/UserContext";
import { VimeoPlayer, type VimeoPlayerHandle } from "@/components/VimeoPlayer";
import { useToast } from "@/hooks/use-toast";
import { MODULE_QUESTION_MAP } from "../data/moduleQuestionMap";
import { VOCAL_EXAM_QUESTIONS } from "../data/vocalExamQuestions";
import { getAudioUrl } from "../data/audioFiles";
import { Volume2, VolumeX } from "lucide-react";

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
  const queryClient = useQueryClient();

  const playerRef = useRef<VimeoPlayerHandle>(null);
  const mainRef = useRef<HTMLElement>(null);

  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [canPlay, setCanPlay] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);

  // Voice audio — oral exam questions for this module
  const [currentAudioIdx, setCurrentAudioIdx] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const questionIds = useMemo(() => {
    if (!id) return [] as number[];
    return MODULE_QUESTION_MAP[id] || [];
  }, [id]);

  const audioQuestions = useMemo(() => {
    return questionIds
      .map(qid => VOCAL_EXAM_QUESTIONS.find(q => q.id === qid))
      .filter(Boolean)
      .map(q => ({
        id: q!.id,
        question: q!.question,
        prompt: q!.prompts[0]?.prompt || q!.question,
        audioUrl: getAudioUrl(q!.id),
      }))
      .filter(aq => aq.audioUrl);
  }, [questionIds]);

  const hasAudioQuestions = audioQuestions.length > 0;

  useEffect(() => {
    if (!activationCode || !deviceId) { setLocation("/"); return; }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (!module) return;
    if (module.contentType === "pdf") {
      setCanPlay(true);
    } else if (!canPlay) {
      // Every video requires a click-through warning before playback starts.
      setSafetyModalOpen(true);
    }
  }, [module]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (safetyModalOpen && module?.isHighRisk && countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [safetyModalOpen, countdown, module?.isHighRisk]);

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
    completeVideo.mutate(
      { data: { moduleId: id, deviceId, activationCode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
          void queryClient.refetchQueries({ queryKey: getListModulesQueryKey(), type: "all" });
          void queryClient.refetchQueries({ queryKey: getGetProgressSummaryQueryKey(), type: "all" });
        }
      }
    );
  }, [deviceId, activationCode, id, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToCourse = useCallback(() => {
    sessionStorage.setItem("scrollAfterModule", String(id));
    setLocation("/training");
  }, [id, setLocation]);

  const handleReplay = useCallback(() => {
    setVideoCompleted(false);
    setCurrentAudioIdx(0);
    setIsAudioPlaying(false);
    stopAudio();
    playerRef.current?.replay();
  }, []);

  const handleTimeUpdate = useCallback((_t: number) => {}, []);

  // ── Voice audio helpers ────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsAudioPlaying(false);
  }, []);

  const playAudio = useCallback((url: string, onEnd?: () => void) => {
    stopAudio();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onplay = () => setIsAudioPlaying(true);
    audio.onended = () => {
      setIsAudioPlaying(false);
      audioRef.current = null;
      onEnd?.();
    };
    audio.onerror = () => {
      setIsAudioPlaying(false);
      audioRef.current = null;
      onEnd?.();
    };
    audio.play().catch(() => {
      setIsAudioPlaying(false);
      audioRef.current = null;
      onEnd?.();
    });
  }, [stopAudio]);

  const playAllAudio = useCallback(() => {
    if (audioQuestions.length === 0) return;
    setCurrentAudioIdx(0);
    const playNext = (idx: number) => {
      if (idx >= audioQuestions.length) {
        setIsAudioPlaying(false);
        setCurrentAudioIdx(audioQuestions.length);
        return;
      }
      setCurrentAudioIdx(idx);
      playAudio(audioQuestions[idx].audioUrl!, () => {
        setTimeout(() => playNext(idx + 1), 800);
      });
    };
    playNext(0);
  }, [audioQuestions, playAudio]);

  // Reset audio state when video is not completed
  useEffect(() => {
    if (!videoCompleted) {
      stopAudio();
      setCurrentAudioIdx(0);
    }
  }, [videoCompleted, stopAudio]);

  // Cleanup on unmount
  useEffect(() => () => stopAudio(), [stopAudio]);

  // Scroll video to top of viewport when page loads
  useEffect(() => {
    if (mainRef.current && !isLoading && module) {
      setTimeout(() => {
        mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [isLoading, module]);

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
      <header className="border-b border-border bg-card sticky top-0 z-50 shrink-0">
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

      <main ref={mainRef} className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-6">

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
            {/* Video player */}
            <div className="relative w-full max-w-3xl mx-auto">
              {/* pointer-events-none only when the completion overlay is active (video just ended this session) */}
              {(() => {
                const hasRealVideo = module.vimeoId && module.vimeoId !== "76979871";
                if (canPlay && hasRealVideo) {
                  return (
                    <div>
                      <VimeoPlayer
                        ref={playerRef}
                        vimeoId={module.vimeoId!}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleVideoEnded}
                      />
                    </div>
                  );
                }
                return (
                  <div className="w-full aspect-video flex items-center justify-center bg-secondary/20 border border-border rounded-lg">
                    <div className="text-center font-mono text-muted-foreground uppercase tracking-widest text-xs space-y-1">
                      {safetyModalOpen
                        ? <span>SAFETY ACKNOWLEDGMENT REQUIRED</span>
                        : !hasRealVideo
                          ? <><span>VIDEO NOT YET UPLOADED</span><br /><span className="text-[10px] opacity-60 normal-case tracking-normal">Admin: add this video in Video Settings</span></>
                          : <span>INITIALIZING PLAYER...</span>}
                    </div>
                  </div>
                );
              })()}

              {/* Completion overlay — only shown when video ends in this session */}
              {videoCompleted && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/75 rounded-lg p-4 text-center">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-mono font-bold text-sm uppercase tracking-wide">
                      Well done — video complete!
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 w-full max-w-[260px]">
                    <Button size="sm" variant="ghost" className="font-mono text-white/70 hover:text-white hover:bg-white/10 w-full text-xs gap-1.5" onClick={handleReplay}>
                      <RotateCcw className="w-3 h-3" /> REPLAY VIDEO
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
                {(module.learningOutcome || module.assessmentCriteria) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {module.learningOutcome && (
                      <span className="text-[10px] font-mono uppercase tracking-wide bg-primary/10 text-primary border border-primary/30 rounded px-1.5 py-0.5">
                        {module.learningOutcome}
                      </span>
                    )}
                    {module.assessmentCriteria && (
                      <span className="text-[10px] font-mono uppercase tracking-wide bg-secondary/40 text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        {module.assessmentCriteria}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2 w-full sm:w-auto">
                {(videoCompleted || module.isCompleted) ? (
                  <>
                    {module.isCompleted && (
                      <div className="flex items-center text-primary font-mono font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> VIDEO COMPLETE
                      </div>
                    )}
                    <Button className="w-full sm:w-auto font-mono tracking-widest" asChild>
                      <Link href={`/mock-test?module=${module.id}&title=${encodeURIComponent(module.title)}`}>{module.title} Questions</Link>
                    </Button>
                  </>
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

      {/* Pre-video safety warning modal — shown before every video, click anywhere to dismiss */}
      <Dialog open={safetyModalOpen} onOpenChange={(open) => { if (!open && !canPlay) return; setSafetyModalOpen(open); }}>
        <DialogContent
          className="sm:max-w-md border-destructive/50 bg-background cursor-pointer"
          onClick={() => { if (!module.isHighRisk) handleSafetyAcknowledge(); }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center font-mono text-destructive uppercase tracking-wide text-xl">
              <ShieldAlert className="w-6 h-6 mr-2" /> SAFETY WARNING
            </DialogTitle>
            <DialogDescription className="font-mono text-foreground mt-4 text-sm leading-relaxed">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
                {module.safetyText || "This video contains chainsaw operational content. Always follow the safety guidance in the manual and never attempt techniques shown without proper PPE, training, and supervision."}
              </div>
              {module.isHighRisk
                ? "I acknowledge the risks and confirm I will apply appropriate safety measures."
                : "Click anywhere on this box to confirm you have read this warning and continue."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button className="w-full font-mono font-bold tracking-widest"
              variant={module.isHighRisk && countdown > 0 ? "secondary" : "destructive"}
              disabled={module.isHighRisk && countdown > 0}
              onClick={(e) => { e.stopPropagation(); handleSafetyAcknowledge(); }}>
              {module.isHighRisk && countdown > 0 ? `ACKNOWLEDGE IN ${countdown}s` : "I UNDERSTAND & ACKNOWLEDGE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
