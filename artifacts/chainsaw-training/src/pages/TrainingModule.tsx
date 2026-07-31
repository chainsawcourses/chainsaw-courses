import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Biohazard, BookOpen, CheckCircle2, ChevronRight, ExternalLink, FileText, RotateCcw, Scale } from "lucide-react";
import { useGetModule, getGetModuleQueryKey, useCompleteVideo, useSaveHeartbeat, getListModulesQueryKey, getGetProgressSummaryQueryKey, useListModules } from "@workspace/api-client-react";
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
  const { activationCode, deviceId, clearSession, allModulesUnlocked } = useUserSession();

  const { data: module, isLoading } = useGetModule(id, {
    query: { queryKey: getGetModuleQueryKey(id), enabled: !!activationCode && !!deviceId && !!id }
  });

  const { data: allModules } = useListModules({
    query: { queryKey: getListModulesQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  // Next video module after this one (by order), used when there's no quiz
  const nextVideoModule = allModules
    ? allModules
        .filter(m => m.contentType !== "pdf" && m.id !== id)
        .sort((a, b) => a.order - b.order)
        .find(m => m.order > (module?.order ?? 0)) ?? null
    : null;

  const hasQuiz = (module?.quizCount ?? 1) > 0;

  const completeVideo = useCompleteVideo();
  const saveHeartbeat = useSaveHeartbeat();
  const queryClient = useQueryClient();

  const playerRef = useRef<VimeoPlayerHandle>(null);
  const mainRef = useRef<HTMLElement>(null);

  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
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

  // Scroll to very top of page when module loads
  useEffect(() => {
    if (!isLoading && module) {
      window.scrollTo({ top: 0, behavior: "instant" });
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
          <div className="w-[80px]" />
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
            {/* Module info — title + description shown ABOVE the video */}
            <div className="bg-card/30 p-5 rounded-lg border border-border">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
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
                {module.isCompleted && (
                  <div className="flex items-center text-primary font-mono font-bold text-xs shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> COMPLETE
                  </div>
                )}
              </div>
            </div>

            {/* Video player */}
            <div className="relative w-full max-w-3xl mx-auto">
              {(() => {
                const hasRealVideo = module.vimeoId && module.vimeoId !== "76979871";
                if (canPlay && hasRealVideo) {
                  return (
                    <VimeoPlayer
                      ref={playerRef}
                      vimeoId={module.vimeoId!}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={handleVideoEnded}
                      videoWatched={module.isCompleted || videoCompleted}
                      allowSeek={allModulesUnlocked}
                    />
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

              {/* Completion overlay — shown when video ends in this session */}
              {videoCompleted && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/75 rounded-lg p-4 text-center">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-mono font-bold text-sm uppercase tracking-wide">
                      Well done — video complete!
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 w-full max-w-[260px]">
                    <Button
                      size="sm"
                      className="font-mono font-bold tracking-widest w-full gap-1.5"
                      asChild
                    >
                      {hasQuiz ? (
                        <Link href={`/quiz/${module.id}`}>
                          <ChevronRight className="w-3.5 h-3.5" /> TAKE MODULE QUIZ
                        </Link>
                      ) : nextVideoModule ? (
                        <Link href={`/training/${nextVideoModule.id}`}>
                          <ChevronRight className="w-3.5 h-3.5" /> PLAY NEXT VIDEO
                        </Link>
                      ) : (
                        <Link href="/training">
                          <ChevronRight className="w-3.5 h-3.5" /> BACK TO COURSE
                        </Link>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="font-mono text-white/70 hover:text-white hover:bg-white/10 w-full text-xs gap-1.5" onClick={handleReplay}>
                      <RotateCcw className="w-3 h-3" /> REPLAY VIDEO
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Quiz / next-video button — always visible, disabled until video is watched */}
            <div className="flex justify-center max-w-3xl mx-auto w-full">
              {(videoCompleted || module.isCompleted) ? (
                hasQuiz ? (
                  <Button className="w-full font-mono tracking-widest" asChild>
                    <Link href={`/quiz/${module.id}`}>
                      <ChevronRight className="w-4 h-4 mr-1.5" /> TAKE MODULE QUIZ
                    </Link>
                  </Button>
                ) : nextVideoModule ? (
                  <Button className="w-full font-mono tracking-widest" asChild>
                    <Link href={`/training/${nextVideoModule.id}`}>
                      <ChevronRight className="w-4 h-4 mr-1.5" /> PLAY NEXT VIDEO
                    </Link>
                  </Button>
                ) : (
                  <Button className="w-full font-mono tracking-widest" asChild>
                    <Link href="/training">
                      <ChevronRight className="w-4 h-4 mr-1.5" /> BACK TO COURSE
                    </Link>
                  </Button>
                )
              ) : (
                <Button className="w-full font-mono tracking-widest" disabled>
                  {hasQuiz ? "QUIZ LOCKED — WATCH VIDEO FIRST" : "WATCH VIDEO TO CONTINUE"}
                </Button>
              )}
            </div>

            {/* MHOR 1992 supplementary card — shown for the Law & Regulations module (id 13).
                Keyed to the module's stable database id, not free-text fields, so renaming
                the module title or editing assessmentCriteria will not hide this card. */}
            {module.id === 13 && (
              <div className="max-w-3xl mx-auto w-full border border-primary/30 rounded-lg bg-primary/5 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-primary/20 bg-primary/10">
                  <Scale className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Key Regulation — AC 1.5</span>
                  <span className="ml-auto font-mono text-[10px] text-primary/60 uppercase tracking-wide">Manual Handling Operations Regulations 1992</span>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    The <strong className="text-foreground">Manual Handling Operations Regulations 1992 (MHOR 1992)</strong> require employers and employees to avoid hazardous manual handling where reasonably practicable, and to assess and reduce the risk of injury from all manual handling tasks — including <strong className="text-foreground">log lifting, carrying, and timber stacking</strong> during chainsaw operations.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">TILE Framework</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                        <li><span className="font-semibold text-foreground">T</span>ask — what the lift involves (distance, frequency, posture)</li>
                        <li><span className="font-semibold text-foreground">I</span>ndividual — the person's capability and fitness</li>
                        <li><span className="font-semibold text-foreground">L</span>oad — weight, shape, and stability of the log</li>
                        <li><span className="font-semibold text-foreground">E</span>nvironment — ground conditions, slope, and space</li>
                      </ul>
                    </div>

                    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">Log Lifting Rules</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                        <li>Avoid manual lifting — use machinery or mechanical aids where possible</li>
                        <li>Only lift within your personal capability</li>
                        <li>Use timber tongs, hooks, or cant hooks to roll or drag logs</li>
                        <li>Never lift and carry when rolling or dragging is an option</li>
                      </ul>
                    </div>

                    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">Timber Stacking</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                        <li>Manual stacks must not exceed <strong className="text-foreground">1.2 m high</strong></li>
                        <li>On slopes, ensure stacks are braced to prevent rolling</li>
                        <li>Never climb on or stand on a timber stack</li>
                        <li>Machine-assisted stacking: check the rated lifting capacity</li>
                      </ul>
                    </div>

                    <div className="rounded-md border border-border bg-card p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary">Back Injury Risk</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                        <li>Back injury is the most common chainsaw-related musculoskeletal harm</li>
                        <li>Cold muscles and fatigue significantly increase injury risk</li>
                        <li>Always warm up before manual handling activity on site</li>
                        <li>Report near-misses and strain incidents under RIDDOR</li>
                      </ul>
                    </div>
                  </div>

                  <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wide">
                    Reference: Manual Handling Operations Regulations 1992 (SI 1992/2793) · HSE L23 Manual Handling Guidance · Chainsaw Manual pages 19 &amp; 120
                  </p>
                </div>
              </div>
            )}
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
              <Biohazard className="w-6 h-6 mr-2 inline" /> SAFETY WARNING
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
