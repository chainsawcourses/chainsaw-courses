import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Mic, MicOff, Volume2, VolumeX, CheckCircle,
  XCircle, ChevronRight, RotateCcw, ClipboardList, AlertCircle
} from "lucide-react";
import { VOCAL_EXAM_QUESTIONS, type VocalPrompt } from "../data/vocalExamQuestions";

type Phase = "intro" | "prompt" | "prompt-review" | "results";

interface PromptResult {
  transcript: string;
  matched: boolean[];
  passed: boolean;
}

interface QuestionResult {
  promptResults: PromptResult[];
  passed: boolean;
}

function matchKeyPoints(transcript: string, prompt: VocalPrompt): boolean[] {
  const lower = transcript.toLowerCase();
  return prompt.keyPoints.map((kp) =>
    kp.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
}

const hasSpeechRecognition = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasSpeechSynthesis = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

const TOTAL = VOCAL_EXAM_QUESTIONS.length;

export default function MockTest() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [promptIdx, setPromptIdx] = useState(0);

  // Results per question
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  // Accumulate prompt results for the current question
  const currentPromptResultsRef = useRef<PromptResult[]>([]);
  // The result just submitted (for the review screen)
  const [lastPromptResult, setLastPromptResult] = useState<PromptResult | null>(null);

  // Speech
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const finalTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);

  const question = VOCAL_EXAM_QUESTIONS[questionIdx];
  const prompt = question.prompts[promptIdx];
  const totalPrompts = question.prompts.length;
  const isMultiPrompt = totalPrompts > 1;

  // Running question count (1-indexed position considering all prompts)
  const overallProgress = questionIdx + 1;

  // ── TTS ──────────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!hasSpeechSynthesis()) return;
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-GB";
    utter.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang === "en-GB" && v.name.toLowerCase().includes("female")) ||
      voices.find((v) => v.lang === "en-GB") ||
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [stopSpeaking]);

  // ── Auto-read prompt when entering prompt phase ───────────────────────
  useEffect(() => {
    if (phase === "prompt") {
      finalTranscriptRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setMicError(null);
      setLastPromptResult(null);

      const q = VOCAL_EXAM_QUESTIONS[questionIdx];
      const p = q.prompts[promptIdx];
      const prefix =
        isMultiPrompt
          ? `Part ${promptIdx + 1} of ${totalPrompts}. `
          : `Question ${questionIdx + 1} of ${TOTAL}. `;
      speakText(prefix + p.prompt);
    }
    if (phase !== "prompt") stopSpeaking();
  }, [phase, questionIdx, promptIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      stopSpeaking();
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, [stopSpeaking]);

  // ── Speech Recognition — fresh-session pattern (no duplicates) ─────────
  const startRecording = useCallback(() => {
    if (!hasSpeechRecognition()) {
      setMicError("Speech recognition is not supported. Please use Chrome or Edge.");
      return;
    }
    stopSpeaking();
    setMicError(null);
    isRecordingRef.current = true;
    setIsRecording(true);

    const doStart = () => {
      const Recognition =
        window.SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition })
          .webkitSpeechRecognition;
      const rec = new Recognition();
      rec.continuous = false;       // one session at a time — no duplicate results
      rec.interimResults = true;
      rec.lang = "en-GB";
      rec.maxAlternatives = 1;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptRef.current +=
              (finalTranscriptRef.current ? " " : "") + text;
            setTranscript(finalTranscriptRef.current);
          } else {
            interim = text;
          }
        }
        setInterimTranscript(interim);
      };

      rec.onend = () => {
        setInterimTranscript("");
        // Auto-restart while user is still in recording mode
        if (isRecordingRef.current) {
          setTimeout(() => {
            if (isRecordingRef.current) doStart();
          }, 200);
        } else {
          setIsRecording(false);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" is normal during a pause — let onend restart
        if (event.error === "not-allowed") {
          isRecordingRef.current = false;
          setIsRecording(false);
          setMicError("Microphone access was denied. Please allow microphone access and try again.");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          isRecordingRef.current = false;
          setIsRecording(false);
          setMicError(`Microphone error: ${event.error}. Please try again.`);
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        isRecordingRef.current = false;
        setIsRecording(false);
        setMicError("Could not start the microphone. Please refresh and try again.");
      }
    };

    doStart();
  }, [stopSpeaking]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ── Submit answer ─────────────────────────────────────────────────────
  const submitAnswer = useCallback((skipAnswer = false) => {
    stopRecording();
    const fullTranscript = skipAnswer
      ? ""
      : (finalTranscriptRef.current + " " + interimTranscript).trim();

    const matched = matchKeyPoints(fullTranscript, prompt);
    const matchedCount = matched.filter(Boolean).length;
    const passed = matchedCount >= prompt.threshold;
    const result: PromptResult = { transcript: fullTranscript, matched, passed };

    currentPromptResultsRef.current = [...currentPromptResultsRef.current, result];
    setLastPromptResult(result);
    setPhase("prompt-review");
  }, [stopRecording, interimTranscript, prompt]);

  // ── Next: advance to next prompt or next question ─────────────────────
  const handleNext = useCallback(() => {
    const q = VOCAL_EXAM_QUESTIONS[questionIdx];

    if (promptIdx + 1 < q.prompts.length) {
      // More prompts for this question
      setPromptIdx((i) => i + 1);
      setPhase("prompt");
    } else {
      // All prompts done — finalise this question
      const allResults = currentPromptResultsRef.current;
      const qPassed = allResults.every((r) => r.passed);
      const qResult: QuestionResult = { promptResults: allResults, passed: qPassed };
      const newQResults = [...questionResults, qResult];
      setQuestionResults(newQResults);
      currentPromptResultsRef.current = [];

      if (questionIdx + 1 >= TOTAL) {
        setPhase("results");
      } else {
        setQuestionIdx((i) => i + 1);
        setPromptIdx(0);
        setPhase("prompt");
      }
    }
  }, [questionIdx, promptIdx, questionResults]);

  // ── Restart ───────────────────────────────────────────────────────────
  const handleRestart = useCallback(() => {
    stopSpeaking();
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    currentPromptResultsRef.current = [];
    finalTranscriptRef.current = "";
    setPhase("intro");
    setQuestionIdx(0);
    setPromptIdx(0);
    setQuestionResults([]);
    setTranscript("");
    setInterimTranscript("");
    setLastPromptResult(null);
    setMicError(null);
    setIsRecording(false);
  }, [stopSpeaking]);

  // ── Derived ───────────────────────────────────────────────────────────
  const passCount = questionResults.filter((r) => r.passed).length;
  const allPassed = questionResults.length === TOTAL && questionResults.every((r) => r.passed);

  // Progress bar width
  const progressPct =
    phase === "results"
      ? 100
      : ((questionIdx + (phase === "prompt-review" && promptIdx + 1 === totalPrompts ? 1 : 0)) / TOTAL) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-2" />EXIT
            </Link>
          </Button>
          <div className="font-mono text-sm font-bold uppercase tracking-widest">NPTC MOCK EXAM</div>
          {(phase === "prompt" || phase === "prompt-review") ? (
            <div className="font-mono text-xs text-muted-foreground tabular-nums">
              Q{overallProgress}/{TOTAL}
            </div>
          ) : (
            <div className="w-[48px]" />
          )}
        </div>
        {(phase === "prompt" || phase === "prompt-review") && (
          <div className="h-1 bg-border">
            <div
              className="h-1 bg-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="font-mono font-black uppercase tracking-widest text-lg">
                NPTC Oral Exam Practice
              </h2>
              <p className="text-muted-foreground font-mono text-sm leading-relaxed">
                {TOTAL} questions from the City &amp; Guilds 0039-20 assessment schedule.
                Each question is read aloud. Speak your answer clearly, then submit.
                Key points are revealed after each answer.
              </p>
              <p className="text-muted-foreground font-mono text-xs opacity-60">
                Microphone required · Chrome or Edge recommended
              </p>
            </div>
            {!hasSpeechRecognition() && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-left max-w-sm">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-destructive">
                  Speech recognition is not supported in this browser. Please use Chrome or Edge.
                </p>
              </div>
            )}
            <Button
              size="lg"
              className="font-mono font-black uppercase tracking-widest px-10"
              onClick={() => setPhase("prompt")}
            >
              Begin Exam
            </Button>
          </div>
        )}

        {/* ── PROMPT (recording) ── */}
        {phase === "prompt" && (
          <div className="py-6 space-y-5">
            {/* Question header (for multi-part, show the parent question) */}
            {isMultiPrompt && (
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-0.5">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Question {questionIdx + 1}</p>
                <p className="font-mono text-sm font-semibold text-muted-foreground leading-snug">{question.question}</p>
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              {isMultiPrompt && (
                <p className="font-mono text-xs text-primary uppercase tracking-widest">
                  Part {promptIdx + 1} of {totalPrompts}
                </p>
              )}
              {!isMultiPrompt && (
                <p className="font-mono text-xs text-primary uppercase tracking-widest">
                  Question {questionIdx + 1} of {TOTAL}
                </p>
              )}
              <h2 className="font-mono font-bold text-base leading-snug">{prompt.prompt}</h2>
              <div className="flex gap-2 pt-1">
                {!isSpeaking ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5"
                    onClick={() => speakText(prompt.prompt)}
                  >
                    <Volume2 className="w-3 h-3" />Read again
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5"
                    onClick={stopSpeaking}
                  >
                    <VolumeX className="w-3 h-3" />Stop
                  </Button>
                )}
              </div>
            </div>

            {/* Live transcript */}
            <div className="rounded-lg border border-border bg-card/40 min-h-[120px] p-4">
              {(transcript || interimTranscript) ? (
                <p className="font-mono text-sm leading-relaxed">
                  <span className="text-foreground">{transcript}</span>
                  {interimTranscript && (
                    <span className="text-muted-foreground/50"> {interimTranscript}</span>
                  )}
                </p>
              ) : (
                <p className="font-mono text-sm text-muted-foreground/40 italic">
                  {isRecording ? "Listening… speak your answer" : "Your answer will appear here"}
                </p>
              )}
            </div>

            {/* Mic error */}
            {micError && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="font-mono text-xs text-destructive">{micError}</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              {!isRecording ? (
                <Button
                  className="flex-1 font-mono font-black uppercase tracking-widest gap-2"
                  onClick={startRecording}
                >
                  <Mic className="w-4 h-4" />
                  {transcript ? "Record More" : "Start Recording"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="flex-1 font-mono font-black uppercase tracking-widest gap-2 animate-pulse"
                  onClick={stopRecording}
                >
                  <MicOff className="w-4 h-4" />Stop Recording
                </Button>
              )}
              <Button
                variant="outline"
                className="font-mono font-black uppercase tracking-widest"
                disabled={(!transcript && !interimTranscript) || isRecording}
                onClick={() => submitAnswer(false)}
              >
                Submit
              </Button>
            </div>

            {/* Skip */}
            <div className="text-center">
              <button
                className="font-mono text-xs text-muted-foreground/40 underline hover:text-muted-foreground"
                onClick={() => submitAnswer(true)}
              >
                Skip this {isMultiPrompt ? "part" : "question"}
              </button>
            </div>
          </div>
        )}

        {/* ── PROMPT REVIEW ── */}
        {phase === "prompt-review" && lastPromptResult && (
          <div className="py-6 space-y-5">
            {/* Context header */}
            {isMultiPrompt && (
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-0.5">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Question {questionIdx + 1}</p>
                <p className="font-mono text-sm font-semibold text-muted-foreground leading-snug">{question.question}</p>
              </div>
            )}

            <div className="space-y-1">
              {isMultiPrompt && (
                <p className="font-mono text-xs text-primary uppercase tracking-widest">
                  Part {promptIdx + 1} of {totalPrompts} — Review
                </p>
              )}
              {!isMultiPrompt && (
                <p className="font-mono text-xs text-primary uppercase tracking-widest">
                  Question {questionIdx + 1} of {TOTAL} — Review
                </p>
              )}
              <p className="font-mono text-sm font-bold leading-snug">{prompt.prompt}</p>
            </div>

            {/* Transcript */}
            <Card className="border-border bg-card/40">
              <CardContent className="p-4 space-y-1">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Your answer</p>
                <p className="font-mono text-sm leading-relaxed">
                  {lastPromptResult.transcript || (
                    <span className="italic text-muted-foreground/50">No answer recorded</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Key points */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Assessment criteria
              </p>
              {prompt.keyPoints.map((kp, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-lg p-3 border text-sm font-mono leading-snug ${
                    lastPromptResult.matched[i]
                      ? "bg-green-500/8 border-green-500/25 text-foreground"
                      : "bg-destructive/5 border-destructive/20 text-muted-foreground"
                  }`}
                >
                  {lastPromptResult.matched[i] ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive/60 shrink-0 mt-0.5" />
                  )}
                  {kp.label}
                </div>
              ))}
            </div>

            {/* Pass/fail for this prompt */}
            <div
              className={`rounded-lg p-4 text-center font-mono font-black uppercase tracking-widest text-sm border ${
                lastPromptResult.passed
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {lastPromptResult.passed
                ? `✓ Passed — ${lastPromptResult.matched.filter(Boolean).length} of ${prompt.keyPoints.length} points covered`
                : `✗ Not yet — ${lastPromptResult.matched.filter(Boolean).length} of ${prompt.keyPoints.length} points covered`}
            </div>

            {/* If this is the last prompt of a multi-part, show overall question result preview */}
            {isMultiPrompt && promptIdx + 1 === totalPrompts && (() => {
              const allSoFar = currentPromptResultsRef.current;
              const qPassed = allSoFar.every((r) => r.passed);
              return (
                <div className={`rounded-lg p-3 text-center font-mono text-xs border ${
                  qPassed
                    ? "bg-green-500/5 border-green-500/20 text-green-400"
                    : "bg-destructive/5 border-destructive/15 text-destructive/80"
                }`}>
                  {qPassed
                    ? `Question ${questionIdx + 1} overall: PASSED all ${totalPrompts} parts`
                    : `Question ${questionIdx + 1} overall: NEEDS WORK — not all parts passed`}
                </div>
              );
            })()}

            <Button
              className="w-full font-mono font-black uppercase tracking-widest"
              onClick={handleNext}
            >
              {promptIdx + 1 < totalPrompts
                ? `Next Part (${promptIdx + 2} of ${totalPrompts})`
                : questionIdx + 1 >= TOTAL
                ? "See Final Results"
                : "Next Question"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-3">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
                allPassed ? "bg-green-500/10" : "bg-destructive/10"
              }`}>
                {allPassed
                  ? <CheckCircle className="w-10 h-10 text-green-500" />
                  : <XCircle className="w-10 h-10 text-destructive" />}
              </div>
              <h2 className="font-mono font-black uppercase tracking-widest text-xl">
                {allPassed ? "All Passed" : "Exam Complete"}
              </h2>
              <p className="font-mono text-3xl font-black tabular-nums">
                {passCount} / {TOTAL}
              </p>
              <p className="font-mono text-sm text-muted-foreground">questions passed</p>
              {!allPassed && (
                <p className="font-mono text-xs text-muted-foreground/60 max-w-xs mx-auto">
                  The real NPTC assessment requires all questions to be passed. Review the missed points below and retake.
                </p>
              )}
            </div>

            {/* Per-question summary */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Question results</p>
              {VOCAL_EXAM_QUESTIONS.map((q, qi) => {
                const qr = questionResults[qi];
                if (!qr) return null;
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-3 space-y-2 ${
                      qr.passed
                        ? "border-green-500/25 bg-green-500/5"
                        : "border-destructive/25 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {qr.passed
                        ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                      <p className="font-mono text-xs font-bold leading-snug">Q{qi + 1}: {q.question}</p>
                    </div>
                    {/* Show failed prompts */}
                    {qr.promptResults.some((pr) => !pr.passed) && (
                      <div className="pl-6 space-y-1">
                        {q.prompts.map((p, pi) => {
                          const pr = qr.promptResults[pi];
                          if (!pr || pr.passed) return null;
                          const missed = p.keyPoints
                            .filter((_, ki) => !pr.matched[ki])
                            .map((kp) => kp.label);
                          return (
                            <div key={pi} className="font-mono text-xs text-muted-foreground">
                              {q.prompts.length > 1 && (
                                <span className="text-destructive/70">Part {pi + 1}: </span>
                              )}
                              Missed: {missed.join("; ")}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full font-mono font-black uppercase tracking-widest"
              onClick={handleRestart}
            >
              <RotateCcw className="w-4 h-4 mr-2" />Retake Exam
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
