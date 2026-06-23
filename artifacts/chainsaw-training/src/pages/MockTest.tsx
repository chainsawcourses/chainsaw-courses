import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Mic, MicOff, Volume2, VolumeX, CheckCircle,
  XCircle, ChevronRight, RotateCcw, ClipboardList, AlertCircle
} from "lucide-react";
import { VOCAL_EXAM_QUESTIONS, type VocalQuestion } from "../data/vocalExamQuestions";

type Phase = "intro" | "question" | "reviewing" | "results";

interface QuestionResult {
  transcript: string;
  matched: boolean[];
  passed: boolean;
}

function matchKeyPoints(transcript: string, question: VocalQuestion): boolean[] {
  const lower = transcript.toLowerCase();
  return question.keyPoints.map((kp) =>
    kp.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
}

const hasSpeechRecognition = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

const hasSpeechSynthesis = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

export default function MockTest() {
  const total = VOCAL_EXAM_QUESTIONS.length;

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const finalTranscriptRef = useRef("");

  const question = VOCAL_EXAM_QUESTIONS[currentIndex];

  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((text: string, onEnd?: () => void) => {
    if (!hasSpeechSynthesis()) return;
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-GB";
    utter.rate = 0.88;
    utter.pitch = 1;
    // prefer a UK English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang === "en-GB" && v.name.toLowerCase().includes("female")
    ) || voices.find((v) => v.lang === "en-GB") || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { setIsSpeaking(false); if (onEnd) onEnd(); };
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [stopSpeaking]);

  // Speak question when phase changes to "question"
  useEffect(() => {
    if (phase === "question") {
      const q = VOCAL_EXAM_QUESTIONS[currentIndex];
      setTranscript("");
      setInterimTranscript("");
      finalTranscriptRef.current = "";
      setMicError(null);
      speakText(`Question ${currentIndex + 1} of ${total}. ${q.question}`);
    }
    if (phase !== "question") stopSpeaking();
  }, [phase, currentIndex, total, speakText, stopSpeaking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
    };
  }, [stopSpeaking]);

  const startRecording = useCallback(() => {
    if (!hasSpeechRecognition()) {
      setMicError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    stopSpeaking();

    const Recognition = (window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition);
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsRecording(true);
      setMicError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + text;
        } else {
          interim = text;
        }
      }
      setTranscript(finalTranscriptRef.current);
      setInterimTranscript(interim);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        setMicError("Microphone access was denied. Please allow microphone access and try again.");
      } else if (event.error === "no-speech") {
        setMicError("No speech detected. Please speak clearly and try again.");
      } else {
        setMicError(`Microphone error: ${event.error}. Please try again.`);
      }
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setMicError("Could not start the microphone. Please refresh and try again.");
    }
  }, [stopSpeaking]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const submitAnswer = useCallback(() => {
    stopRecording();
    const fullTranscript = (finalTranscriptRef.current + " " + interimTranscript).trim();
    const matched = matchKeyPoints(fullTranscript || transcript, question);
    const matchedCount = matched.filter(Boolean).length;
    const passed = matchedCount >= question.threshold;
    setResults((prev) => [...prev, { transcript: fullTranscript || transcript, matched, passed }]);
    setPhase("reviewing");
  }, [stopRecording, interimTranscript, transcript, question]);

  const handleNext = () => {
    if (currentIndex + 1 >= total) {
      setPhase("results");
    } else {
      setCurrentIndex((i) => i + 1);
      setPhase("question");
    }
  };

  const handleRestart = () => {
    stopSpeaking();
    recognitionRef.current?.stop();
    setPhase("intro");
    setCurrentIndex(0);
    setTranscript("");
    setInterimTranscript("");
    setResults([]);
    setMicError(null);
    finalTranscriptRef.current = "";
  };

  const passCount = results.filter((r) => r.passed).length;
  const allPassed = results.length === total && results.every((r) => r.passed);
  const currentResult = results[currentIndex];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-2" /> EXIT
            </Link>
          </Button>
          <div className="font-mono text-sm font-bold uppercase">NPTC MOCK EXAM</div>
          {phase === "question" || phase === "reviewing" ? (
            <div className="font-mono text-xs text-muted-foreground tabular-nums">
              {currentIndex + 1} / {total}
            </div>
          ) : (
            <div className="w-[48px]" />
          )}
        </div>
        {(phase === "question" || phase === "reviewing") && (
          <div className="h-1 bg-border">
            <div
              className="h-1 bg-primary transition-all duration-500"
              style={{ width: `${((currentIndex + (phase === "reviewing" ? 1 : 0)) / total) * 100}%` }}
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
              <p className="text-muted-foreground font-mono text-sm">
                {total} questions from the City &amp; Guilds 0039-20 assessment schedule.
                Each question will be read aloud. Speak your answer clearly, then submit.
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
                  Speech recognition is not supported in this browser. Please use Chrome or Edge for the best experience.
                </p>
              </div>
            )}
            <Button
              size="lg"
              className="font-mono font-black uppercase tracking-widest px-10"
              onClick={() => setPhase("question")}
            >
              Begin Exam
            </Button>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === "question" && (
          <div className="py-6 space-y-6">
            {/* Question text + TTS controls */}
            <div className="space-y-3">
              <p className="font-mono text-xs text-primary uppercase tracking-widest">
                Question {currentIndex + 1} of {total}
              </p>
              <h2 className="font-mono font-bold text-base leading-snug">{question.question}</h2>
              <div className="flex gap-2">
                {!isSpeaking ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5"
                    onClick={() => speakText(`${question.question}`)}
                  >
                    <Volume2 className="w-3 h-3" /> Read again
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5"
                    onClick={stopSpeaking}
                  >
                    <VolumeX className="w-3 h-3" /> Stop
                  </Button>
                )}
              </div>
            </div>

            {/* Transcript live view */}
            <div className="rounded-lg border border-border bg-card/40 min-h-[120px] p-4">
              {(transcript || interimTranscript) ? (
                <p className="font-mono text-sm leading-relaxed">
                  <span className="text-foreground">{transcript}</span>
                  {interimTranscript && (
                    <span className="text-muted-foreground/60"> {interimTranscript}</span>
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
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </Button>
              )}
              <Button
                variant="outline"
                className="font-mono font-black uppercase tracking-widest"
                disabled={(!transcript && !interimTranscript) || isRecording}
                onClick={submitAnswer}
              >
                Submit
              </Button>
            </div>

            {/* Skip option (no answer) */}
            <div className="text-center">
              <button
                className="font-mono text-xs text-muted-foreground/50 underline hover:text-muted-foreground"
                onClick={() => {
                  finalTranscriptRef.current = "";
                  setTranscript("");
                  setInterimTranscript("");
                  submitAnswer();
                }}
              >
                Skip this question
              </button>
            </div>
          </div>
        )}

        {/* ── REVIEWING ── */}
        {phase === "reviewing" && currentResult && (
          <div className="py-6 space-y-5">
            <div className="space-y-1">
              <p className="font-mono text-xs text-primary uppercase tracking-widest">
                Question {currentIndex + 1} of {total} — Review
              </p>
              <h2 className="font-mono font-bold text-sm leading-snug text-muted-foreground">
                {question.question}
              </h2>
            </div>

            {/* Transcript */}
            <Card className="border-border bg-card/40">
              <CardContent className="p-4 space-y-1">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Your answer</p>
                <p className="font-mono text-sm leading-relaxed">
                  {currentResult.transcript || <span className="italic text-muted-foreground/50">No answer recorded</span>}
                </p>
              </CardContent>
            </Card>

            {/* Key points */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Assessment criteria
              </p>
              {question.keyPoints.map((kp, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-lg p-3 border text-sm font-mono leading-snug ${
                    currentResult.matched[i]
                      ? "bg-green-500/8 border-green-500/25 text-foreground"
                      : "bg-destructive/5 border-destructive/20 text-muted-foreground"
                  }`}
                >
                  {currentResult.matched[i] ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive/60 shrink-0 mt-0.5" />
                  )}
                  {kp.label}
                </div>
              ))}
            </div>

            {/* Pass/fail for this question */}
            <div className={`rounded-lg p-4 text-center font-mono font-black uppercase tracking-widest text-sm border ${
              currentResult.passed
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}>
              {currentResult.passed
                ? `✓ Passed — ${currentResult.matched.filter(Boolean).length} of ${question.keyPoints.length} points covered`
                : `✗ Not yet — ${currentResult.matched.filter(Boolean).length} of ${question.keyPoints.length} points covered`}
            </div>

            <Button
              className="w-full font-mono font-black uppercase tracking-widest"
              onClick={handleNext}
            >
              {currentIndex + 1 >= total ? "See Final Results" : "Next Question"}
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
                {passCount} / {total}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                questions passed
              </p>
              {!allPassed && (
                <p className="font-mono text-xs text-muted-foreground/60 max-w-xs mx-auto">
                  The real NPTC assessment requires all questions to be passed. Review the questions below and retake the exam.
                </p>
              )}
            </div>

            {/* Per-question summary */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Question results</p>
              {VOCAL_EXAM_QUESTIONS.map((q, i) => {
                const r = results[i];
                if (!r) return null;
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-3 flex items-start gap-3 ${
                      r.passed
                        ? "border-green-500/25 bg-green-500/5"
                        : "border-destructive/25 bg-destructive/5"
                    }`}
                  >
                    {r.passed
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-xs font-bold leading-snug">Q{i + 1}: {q.question}</p>
                      {!r.passed && (
                        <p className="font-mono text-xs text-muted-foreground">
                          Covered {r.matched.filter(Boolean).length} of {q.keyPoints.length} points
                          {" · "}missed:{" "}
                          {q.keyPoints
                            .filter((_, ki) => !r.matched[ki])
                            .map((kp) => kp.label)
                            .join("; ")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              className="w-full font-mono font-black uppercase tracking-widest"
              onClick={handleRestart}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Retake Exam
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
