import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Mic, MicOff, Volume2, VolumeX, CheckCircle,
  XCircle, ChevronRight, RotateCcw, ClipboardList, AlertCircle, Keyboard,
  BookOpen, ChevronDown, ChevronUp
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useSearch } from "wouter";
import { VOCAL_EXAM_QUESTIONS, type VocalPrompt } from "../data/vocalExamQuestions";
import { MODULE_QUESTION_MAP } from "../data/moduleQuestionMap";
import { useUserSession } from "../contexts/UserContext";

interface HazardRef {
  id: number;
  category: string;
  hazard: string;
  controlMeasure: string;
  orderIdx: number;
}

const HAZARD_QUESTION_MAP: Record<number, "site" | "chainsaw" | "job"> = {
  2: "site",
  3: "chainsaw",
  4: "job",
};

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

const FIREBASE_AUDIO_BASE =
  "https://firebasestorage.googleapis.com/v0/b/chainsaw-courses.firebasestorage.app/o";

const AUDIO_FILES: Record<number, string> = {
  1:  "1riskassessment.wav",
  2:  "2site hazards.wav",
  3:  "3chainsaw hazrds.wav",
  4:  "4job to be done.wav",
  5:  "5emergency information.wav",
  6:  "6health safety.wav",
  7:  "7puwer.wav",
  8:  "8industry guidance.wav",
  9:  "9manufacturers spec.wav",
  10: "10safety features.wav",
  11: "11broken or faulty.wav",
  12: "12battery advantages.wav",
  13: "13battery disadvantages.wav",
  14: "14battery maintenance.wav",
  15: "15take off top cover.wav",
  16: "16whats this copy 3.wav",
  17: "17whatdo.wav",
  18: "18.maintainit.wav",
  19: "19whats this copy 2.wav",
  20: "20whatdo copy.wav",
  21: "21spark maintainit.wav",
  22: "22cooling.wav",
  23: "23maintain cooling.wav",
  24: "24whats this copy.wav",
  25: "25whatdo copy 2.wav",
  26: "26.maintainit copy.wav",
  27: "27fuel filter.wav",
  28: "28oil filter.wav",
  29: "29take off recoil.wav",
  30: "30recoildamage.wav",
  31: "31take off side cover.wav",
  32: "32whats this.wav",
  33: "33whatdo sprocketwav.wav",
  34: "34wear damage.wav",
  35: "35remove sprocket.wav",
  36: "36chain brake.wav",
  37: "37whatdo.wav",
  38: "38wear damage chain brake.wav",
  39: "39guidebar.wav",
  40: "40guidebar problems.wav",
  41: "41barmaintain.wav",
  42: "42 reassemble.wav",
  43: "43vice.wav",
  44: "44chain id.wav",
  45: "45replace chain.wav",
  46: "46cutterprofile.wav",
  47: "47cutterprofile2.wav",
  48: "48cutterprofileuses.wav",
  49: "49topplate.wav",
  50: "50file size.wav",
  51: "51where sharpening.wav",
  52: "52whats this depth gauge.wav",
  53: "53whatdo.wav",
  54: "54 depth gauge setting.wav",
  55: "55cutters.wav",
  56: "56wornchain.wav",
  57: "57waste.wav",
  58: "58 distance xcut.wav",
  59: "59bio security.wav",
  60: "60environment.wav",
  61: "61compression.wav",
  62: "62compression.wav",
  63: "63stuck.wav",
  64: "64oversized.wav",
  65: "65hightension.wav",
  66: "66borecut.wav",
  67: "67move safely.wav",
  68: "68ergonmic.wav",
  69: "69timberstack.wav",
  70: "70timberstack2.wav",
  71: "71prestart.wav",
  72: "72preuse.wav",
  73: "73summary1.wav",
  74: "74prep.wav",
  75: "75goodluck.wav",
};

export default function MockTest() {
  const search = useSearch();
  const moduleId = new URLSearchParams(search).get("module");
  const activeQuestions = (() => {
    if (!moduleId) return VOCAL_EXAM_QUESTIONS;
    const id = Number(moduleId);
    const ids = MODULE_QUESTION_MAP[id];
    if (!ids || ids.length === 0) return VOCAL_EXAM_QUESTIONS;
    const idSet = new Set(ids);
    return VOCAL_EXAM_QUESTIONS.filter((q) => idSet.has(q.id));
  })();

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
  const [isGrading, setIsGrading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Typed answer (alternative / supplement to mic)
  const [typedText, setTypedText] = useState("");

  // Hazard reference (Q2/Q3/Q4)
  const { activationCode, deviceId } = useUserSession();
  const [hazardRefs, setHazardRefs] = useState<HazardRef[]>([]);
  const [hazardRefOpen, setHazardRefOpen] = useState(false);
  const [hazardRefLoading, setHazardRefLoading] = useState(false);

  const finalTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const question = activeQuestions[questionIdx];
  const prompt = question.prompts[promptIdx];
  const totalPrompts = question.prompts.length;
  const isMultiPrompt = totalPrompts > 1;

  // Running question count (1-indexed position considering all prompts)
  const overallProgress = questionIdx + 1;

  // Fetch hazard reference when entering review for Q2/Q3/Q4
  useEffect(() => {
    const category = HAZARD_QUESTION_MAP[question.id];
    if (phase !== "prompt-review" || !category || !activationCode || !deviceId) {
      setHazardRefs([]);
      return;
    }
    setHazardRefLoading(true);
    setHazardRefOpen(false);
    fetch(`/api/hazards/${category}`, {
      headers: {
        "activationcode": activationCode,
        "deviceid": deviceId,
      },
    })
      .then((r) => r.json())
      .then((data: HazardRef[]) => setHazardRefs(data))
      .catch(() => setHazardRefs([]))
      .finally(() => setHazardRefLoading(false));
  }, [phase, question.id, activationCode, deviceId]);

  // ── Audio helpers ─────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // TTS fallback
  const speakViaTTS = useCallback((text: string) => {
    if (!hasSpeechSynthesis()) return;
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
  }, []);

  // Play recorded audio file, falling back to TTS if the file doesn't exist yet
  const playPrompt = useCallback((qIdx: number, pIdx: number) => {
    stopSpeaking();
    const q = activeQuestions[qIdx];
    const p = q.prompts[pIdx];
    const filename = AUDIO_FILES[q.id];
    const src = filename
      ? `${FIREBASE_AUDIO_BASE}/${encodeURIComponent(filename)}?alt=media`
      : null;

    if (!src) {
      speakViaTTS(p.prompt);
      return;
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => { setIsSpeaking(false); audioRef.current = null; };
    audio.onerror = () => {
      audioRef.current = null;
      speakViaTTS(p.prompt);
    };
    audio.play().catch(() => {
      audioRef.current = null;
      speakViaTTS(p.prompt);
    });
  }, [stopSpeaking, speakViaTTS]);

  // ── Auto-play prompt when entering prompt phase ───────────────────────
  useEffect(() => {
    if (phase === "prompt") {
      finalTranscriptRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setTypedText("");
      setMicError(null);
      setLastPromptResult(null);
      playPrompt(questionIdx, promptIdx);
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
            setTypedText(prev => (prev ? prev + " " : "") + text);
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

  // ── Submit answer (async: keyword-match first, AI fallback if needed) ──
  const submitAnswer = useCallback(async (skipAnswer = false) => {
    stopRecording();
    const flush = interimTranscript.trim();
    const fullTranscript = skipAnswer
      ? ""
      : (typedText + (flush ? " " + flush : "")).trim();

    // Fast-path: keyword matching
    const keywordMatched = matchKeyPoints(fullTranscript, prompt);
    const keywordPassCount = keywordMatched.filter(Boolean).length;
    const keywordPassed = keywordPassCount >= prompt.threshold;

    let finalMatched = keywordMatched;

    // If keyword matching didn't fully pass AND there's a meaningful answer, ask AI
    if (!keywordPassed && fullTranscript.length > 8 && activationCode && deviceId) {
      setIsGrading(true);
      try {
        const resp = await fetch("/api/ai/grade-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: fullTranscript,
            promptText: prompt.prompt,
            keyPoints: prompt.keyPoints.map((kp) => ({ keywords: kp.keywords })),
            deviceId,
            activationCode,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.matched) && data.matched.length === prompt.keyPoints.length) {
            // Accept a key point if EITHER keyword OR AI says it's covered
            finalMatched = keywordMatched.map((km: boolean, i: number) => km || Boolean(data.matched[i]));
          }
        }
      } catch {
        // Fall back to keyword result silently
      } finally {
        setIsGrading(false);
      }
    }

    const matchedCount = finalMatched.filter(Boolean).length;
    const passed = matchedCount >= prompt.threshold;
    const result: PromptResult = { transcript: fullTranscript, matched: finalMatched, passed };

    currentPromptResultsRef.current = [...currentPromptResultsRef.current, result];
    setLastPromptResult(result);
    setPhase("prompt-review");
  }, [stopRecording, interimTranscript, typedText, prompt, activationCode, deviceId]);

  // ── Submit action (auto-pass, no scoring) ─────────────────────────────
  const submitAction = useCallback(() => {
    stopSpeaking();
    const result: PromptResult = { transcript: "", matched: [], passed: true };
    currentPromptResultsRef.current = [...currentPromptResultsRef.current, result];
    setLastPromptResult(result);
    setPhase("prompt-review");
  }, [stopSpeaking]);

  // ── Next: advance to next prompt or next question ─────────────────────
  const handleNext = useCallback(() => {
    const q = activeQuestions[questionIdx];

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

      if (questionIdx + 1 >= activeQuestions.length) {
        // Exam finished — record result to server if this is a module assessment
        if (moduleId && activationCode && deviceId) {
          const finalPassCount = newQResults.filter((r) => r.passed).length;
          const finalTotal = newQResults.length;
          const overallPassed = finalTotal > 0 && finalPassCount / finalTotal >= 0.8;
          const score = finalTotal > 0 ? Math.round((finalPassCount / finalTotal) * 100) : 0;
          fetch("/api/progress/complete-assessment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleId: Number(moduleId), deviceId, activationCode, passed: overallPassed, score }),
          }).catch(() => {});
        }
        setPhase("results");
      } else {
        setQuestionIdx((i) => i + 1);
        setPromptIdx(0);
        setPhase("prompt");
      }
    }
  }, [questionIdx, promptIdx, questionResults, moduleId, activationCode, deviceId]);

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
    setTypedText("");
    setLastPromptResult(null);
    setMicError(null);
    setIsRecording(false);
  }, [stopSpeaking]);

  // ── Derived ───────────────────────────────────────────────────────────
  const passCount = questionResults.filter((r) => r.passed).length;
  const TOTAL = activeQuestions.length;
  const allPassed = questionResults.length === TOTAL && questionResults.every((r) => r.passed);
  // 80% pass threshold for unlocking the next module
  const overallPassed = questionResults.length === TOTAL && TOTAL > 0 && passCount / TOTAL >= 0.8;

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
          <div className="font-mono text-sm font-bold uppercase tracking-widest">TAKE ASSESSMENT QUIZ</div>
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
                Take Assessment Quiz
              </h2>
              <p className="text-muted-foreground font-mono text-sm leading-relaxed">
                {moduleId
                  ? <>{TOTAL} question{TOTAL !== 1 ? "s" : ""} from this module's section of the NPTC assessment.</>
                  : <>{TOTAL} questions and practical actions from the NPTC assessment schedule.</>
                }{" "}
                Each question is read aloud — speak your answer clearly, then submit.
                Key points are revealed after each answer. Practical actions just require
                a tap to continue.
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
                <p className={`font-mono text-xs uppercase tracking-widest ${prompt.isAction ? "text-amber-500" : "text-primary"}`}>
                  {prompt.isAction ? `Action ${questionIdx + 1} of ${TOTAL}` : `Question ${questionIdx + 1} of ${TOTAL}`}
                </p>
              )}
              <h2 className="font-mono font-bold text-base leading-snug">{prompt.prompt}</h2>
              <div className="flex gap-2 pt-1">
                {!isSpeaking ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs gap-1.5"
                    onClick={() => playPrompt(questionIdx, promptIdx)}
                  >
                    <Volume2 className="w-3 h-3" />Play again
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

            {/* ACTION — no mic, just a continue button */}
            {prompt.isAction ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                  <p className="font-mono text-sm text-amber-400 font-bold uppercase tracking-widest">
                    Practical Action
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    Perform the action, then tap continue when ready.
                  </p>
                </div>
                <Button
                  className="w-full font-mono font-black uppercase tracking-widest"
                  onClick={submitAction}
                >
                  Done — Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            ) : (
              <>
                {/* Single answer box — speech appends here, user can also type */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      {isRecording
                        ? <><Mic className="w-3 h-3 text-primary animate-pulse" />Listening — speak or type</>
                        : <><Keyboard className="w-3 h-3" />Speak or type your answer</>
                      }
                    </p>
                    {typedText && (
                      <button
                        className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground underline"
                        onClick={() => { setTypedText(""); finalTranscriptRef.current = ""; }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <Textarea
                    className="font-mono text-sm resize-none bg-card/40 min-h-[100px]"
                    rows={4}
                    placeholder="Tap 'Start Recording' to speak, or type your key points here…"
                    value={typedText + (interimTranscript ? " " + interimTranscript : "")}
                    onChange={(e) => {
                      const val = interimTranscript
                        ? e.target.value.replace(new RegExp("\\s*" + interimTranscript.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "")
                        : e.target.value;
                      setTypedText(val);
                      finalTranscriptRef.current = val;
                    }}
                  />
                  {interimTranscript && (
                    <p className="font-mono text-[10px] text-muted-foreground/40 italic">
                      Recognising: {interimTranscript}…
                    </p>
                  )}
                </div>

                {/* Mic controls */}
                <div className="flex gap-3">
                  {!isRecording ? (
                    <Button
                      className="flex-1 font-mono font-black uppercase tracking-widest gap-2"
                      onClick={startRecording}
                    >
                      <Mic className="w-4 h-4" />
                      {typedText ? "Record More" : "Start Recording"}
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
                </div>

                {/* Mic error */}
                {micError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="font-mono text-xs text-destructive">{micError}</p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  className="w-full font-mono font-black uppercase tracking-widest"
                  disabled={(!transcript && !interimTranscript && !typedText) || isRecording || isGrading}
                  onClick={() => submitAnswer(false)}
                >
                  {isGrading
                    ? <><span className="animate-pulse">AI Grading…</span></>
                    : "Submit Answer"
                  }
                </Button>

                {/* Skip */}
                <div className="text-center">
                  <button
                    className="font-mono text-xs text-muted-foreground/40 underline hover:text-muted-foreground disabled:opacity-30 disabled:pointer-events-none"
                    disabled={isGrading}
                    onClick={() => submitAnswer(true)}
                  >
                    Skip this {isMultiPrompt ? "part" : "question"}
                  </button>
                </div>
              </>
            )}
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
                <p className={`font-mono text-xs uppercase tracking-widest ${prompt.isAction ? "text-amber-500" : "text-primary"}`}>
                  {prompt.isAction ? `Action ${questionIdx + 1} of ${TOTAL}` : `Question ${questionIdx + 1} of ${TOTAL} — Review`}
                </p>
              )}
              <p className="font-mono text-sm font-bold leading-snug">{prompt.prompt}</p>
            </div>

            {/* ACTION review — simple acknowledgement, no scoring */}
            {prompt.isAction ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                <CheckCircle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <p className="font-mono text-sm text-amber-400 font-bold uppercase tracking-widest">
                  Action Acknowledged
                </p>
              </div>
            ) : (
              <>
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

                {/* Key points — only show correct ones */}
                <div className="space-y-2">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    Points you covered
                  </p>
                  {prompt.keyPoints.filter((_, i) => lastPromptResult.matched[i]).length === 0 ? (
                    <div className="flex items-center gap-2.5 rounded-lg p-3 border border-destructive/20 bg-destructive/5 text-sm font-mono text-muted-foreground">
                      <XCircle className="w-4 h-4 text-destructive/60 shrink-0" />
                      No key points identified in your answer
                    </div>
                  ) : (
                    prompt.keyPoints.map((kp, i) =>
                      lastPromptResult.matched[i] ? (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg p-3 border bg-green-500/8 border-green-500/25 text-foreground text-sm font-mono leading-snug"
                        >
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          {kp.label}
                        </div>
                      ) : null
                    )
                  )}
                </div>

                {/* Hazard reference panel — shown for Q2/Q3/Q4 */}
                {HAZARD_QUESTION_MAP[question.id] && (
                  <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setHazardRefOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="flex items-center gap-2 font-mono text-xs text-blue-400 uppercase tracking-widest font-bold">
                        <BookOpen className="w-4 h-4" />
                        {hazardRefLoading
                          ? "Loading reference list…"
                          : `View full ${HAZARD_QUESTION_MAP[question.id]} hazard reference (${hazardRefs.length})`}
                      </span>
                      {hazardRefOpen ? (
                        <ChevronUp className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </button>
                    {hazardRefOpen && hazardRefs.length > 0 && (
                      <div className="border-t border-blue-500/20 divide-y divide-blue-500/10 max-h-96 overflow-y-auto">
                        {hazardRefs.map((h) => (
                          <div key={h.id} className="px-4 py-3 space-y-1">
                            <p className="font-mono text-xs font-bold text-foreground leading-snug">
                              {h.orderIdx}. {h.hazard}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground leading-snug">
                              ↳ {h.controlMeasure}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
              </>
            )}

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
                overallPassed ? "bg-green-500/10" : "bg-destructive/10"
              }`}>
                {overallPassed
                  ? <CheckCircle className="w-10 h-10 text-green-500" />
                  : <XCircle className="w-10 h-10 text-destructive" />}
              </div>
              <h2 className="font-mono font-black uppercase tracking-widest text-xl">
                {overallPassed ? "Assessment Passed" : "Assessment Incomplete"}
              </h2>
              <p className="font-mono text-3xl font-black tabular-nums">
                {passCount} / {TOTAL}
              </p>
              <p className="font-mono text-sm text-muted-foreground">questions passed</p>
              {overallPassed && moduleId ? (
                <div className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-green-500/10 border border-green-500/25 font-mono text-xs text-green-400 font-bold uppercase tracking-widest">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Next module unlocked
                </div>
              ) : !overallPassed ? (
                <p className="font-mono text-xs text-muted-foreground/60 max-w-xs mx-auto">
                  Score 80% or more to unlock the next module. Review the missed points below and retake.
                </p>
              ) : null}
              {overallPassed && !allPassed && (
                <p className="font-mono text-xs text-muted-foreground/50 max-w-xs mx-auto">
                  Note: the real NPTC exam requires 100%. Keep practising to reach that standard.
                </p>
              )}
            </div>

            {/* Per-question summary */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Question results</p>
              {activeQuestions.map((q, qi) => {
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
                    {/* Show failed prompts (skip action items) */}
                    {qr.promptResults.some((pr, pi) => !pr.passed && !q.prompts[pi]?.isAction) && (
                      <div className="pl-6 space-y-1">
                        {q.prompts.map((p, pi) => {
                          const pr = qr.promptResults[pi];
                          if (!pr || pr.passed || p.isAction) return null;
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
