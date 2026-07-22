import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Award, FileDown, Star } from "lucide-react";
import { useGetExam, useSubmitExam, useSubmitAppFeedback, useGetExamStatus, getGetExamStatusQueryKey, ExamResult, getGetExamQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { DISAPPOINTMENT_URL } from "../data/audioFiles";

const CROWD_APPLAUSE_URL = `${import.meta.env.BASE_URL}crowd-applause.mp3`;

// ─── Confetti ────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  width: number;
  height: number;
  opacity: number;
}

const COLORS = ["#f97316", "#facc15", "#4ade80", "#60a5fa", "#e879f9", "#fb7185", "#34d399", "#f59e0b"];

function createParticle(canvasWidth: number): Particle {
  return {
    x: Math.random() * canvasWidth,
    y: -10 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    width: 8 + Math.random() * 10,
    height: 4 + Math.random() * 6,
    opacity: 1,
  };
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const DURATION = 6000;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn 220 particles in bursts
    for (let i = 0; i < 220; i++) {
      const p = createParticle(canvas.width);
      p.y = -10 - Math.random() * 400;
      particlesRef.current.push(p);
    }

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.opacity > 0.01);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.7) {
          p.opacity -= 0.025;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      if (elapsed < DURATION || particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}

// ─── Certificate download button ─────────────────────────────────────────────

function CertificateButton() {
  const { activationCode, deviceId } = useUserSession();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!activationCode || !deviceId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/certificate", {
        headers: { activationcode: activationCode, deviceid: deviceId },
      });
      if (!res.ok) throw new Error("Failed to generate certificate");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // silent — user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      className="w-full h-14 font-mono font-bold tracking-widest gap-2"
    >
      <FileDown className="w-5 h-5" />
      {loading ? "GENERATING..." : "VIEW CERTIFICATE"}
    </Button>
  );
}

// ─── Exam Result Screen (with post-pass feedback popup) ───────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              n <= (hovered || value) ? "text-primary fill-primary" : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ExamResultScreen({
  result,
  onReset,
  deviceId,
  activationCode,
}: {
  result: ExamResult;
  onReset: () => void;
  deviceId: string;
  activationCode: string;
}) {
  const [showConfetti, setShowConfetti] = useState(result.passed);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);
  const submitFeedback = useSubmitAppFeedback();

  useEffect(() => {
    if (!result.passed) return;
    const t = setTimeout(() => setShowFeedback(true), 1800);
    return () => clearTimeout(t);
  }, [result.passed]);

  const handleFeedbackSubmit = () => {
    if (!rating) return;
    submitFeedback.mutate(
      { data: { deviceId, activationCode, rating, comment: comment || undefined } },
      { onSuccess: () => setFeedbackDone(true) }
    );
  };

  return (
    <>
      {showConfetti && <ConfettiCanvas />}

      {/* Feedback popup */}
      {result.passed && showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm border-border bg-card shadow-2xl">
            <CardContent className="p-6">
              {feedbackDone ? (
                <div className="text-center space-y-3">
                  <div className="text-3xl">🎉</div>
                  <h3 className="font-mono font-black uppercase tracking-widest text-sm">Thank You!</h3>
                  <p className="font-mono text-xs text-muted-foreground">Your feedback has been recorded.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-xs uppercase tracking-widest w-full mt-2"
                    onClick={() => setShowFeedback(false)}
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl mb-1">🎓</div>
                    <h3 className="font-mono font-black uppercase tracking-widest text-sm">How was the course overall?</h3>
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      Share your experience to help us improve
                    </p>
                  </div>
                  <StarRating value={rating} onChange={setRating} />
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Any comments? (optional)"
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="font-mono text-xs uppercase tracking-widest flex-1"
                      onClick={() => setShowFeedback(false)}
                    >
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      className="font-mono text-xs uppercase tracking-widest flex-1"
                      disabled={!rating || submitFeedback.isPending}
                      onClick={handleFeedbackSubmit}
                    >
                      {submitFeedback.isPending ? "Saving..." : "Submit"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center flex flex-col items-center">
            {result.passed ? (
              <Award className="w-20 h-20 text-primary mb-6" />
            ) : (
              <XCircle className="w-20 h-20 text-destructive mb-6" />
            )}

            <h1 className="text-3xl font-black font-mono uppercase tracking-wide mb-2">
              {result.passed ? "Certification Exam Passed" : "Exam Not Passed"}
            </h1>

            <p className="text-muted-foreground font-mono mb-2">
              You scored {result.correct} out of {result.total} ({result.score}%)
            </p>

            {!result.passed && (
              <p className="text-sm text-muted-foreground font-mono mb-8">
                You need {result.passingScore}% to pass. You may retake the exam at any time.
              </p>
            )}
            {result.passed && (
              <p className="text-sm text-primary font-mono mb-8">
                Congratulations — you have met the {result.passingScore}% pass mark for the final summative exam.
              </p>
            )}

            <div className="flex flex-col gap-3 w-full">
              {!result.passed ? (
                <Button
                  onClick={onReset}
                  className="w-full h-14 font-mono font-bold tracking-widest"
                >
                  <RotateCcw className="mr-2 w-4 h-4" /> RETAKE EXAM
                </Button>
              ) : (
                <>
                  <CertificateButton />
                  <Button asChild variant="outline" className="w-full h-12 font-mono font-bold tracking-widest">
                    <Link href="/training">BACK TO TRAINING</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Exam ─────────────────────────────────────────────────────────────────────

export default function Exam() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  const { data: examStatus } = useGetExamStatus({
    query: { queryKey: getGetExamStatusQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const { data: exam, isLoading, error } = useGetExam({
    query: { queryKey: getGetExamQueryKey(), enabled: !!activationCode && !!deviceId && !examStatus?.passed }
  });

  const submitExam = useSubmitExam();

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);

  const applausePlayedRef = useRef(false);
  const disappointmentPlayedRef = useRef(false);

  // Play sounds when result arrives
  useEffect(() => {
    if (!result) return;

    if (result.passed && !applausePlayedRef.current) {
      applausePlayedRef.current = true;
      try {
        const audio = new Audio(CROWD_APPLAUSE_URL);
        audio.volume = 0.7;
        audio.play().catch((e) => console.warn("Applause audio failed:", e));
      } catch (e) {
        console.warn("Applause audio error:", e);
      }
    }

    if (!result.passed && !disappointmentPlayedRef.current) {
      disappointmentPlayedRef.current = true;
      try {
        const audio = new Audio(DISAPPOINTMENT_URL);
        audio.volume = 0.7;
        audio.play().catch((e) => console.warn("Disappointment audio failed:", e));
      } catch (e) {
        console.warn("Disappointment audio error:", e);
      }
    }
  }, [result]);

  const handleReset = useCallback(() => {
    setResult(null);
    setCurrentQuestionIdx(0);
    setAnswers({});
    applausePlayedRef.current = false;
    disappointmentPlayedRef.current = false;
  }, []);

  if (!activationCode || !deviceId) {
    setLocation("/");
    return null;
  }

  // Guard: show completion screen if already passed
  if (examStatus?.passed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <CheckCircle2 className="w-20 h-20 text-green-600 mb-6" />
        <h1 className="text-2xl font-black font-mono uppercase tracking-wide mb-3 text-green-600">
          Exam Already Passed
        </h1>
        <p className="text-muted-foreground font-mono text-sm mb-2 max-w-md">
          You have successfully completed the final summative exam.
        </p>
        {examStatus.bestScore !== null && (
          <p className="text-primary font-mono text-sm font-bold mb-8">
            Best score: {examStatus.bestScore}%
          </p>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <CertificateButton />
          <Button asChild variant="outline" className="w-full h-12 font-mono font-bold tracking-widest">
            <Link href="/training">BACK TO TRAINING</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-primary font-mono tracking-widest uppercase">Loading Final Exam...</div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <XCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-xl font-black font-mono uppercase tracking-wide mb-2">Exam Not Yet Available</h1>
        <p className="text-muted-foreground font-mono text-sm mb-8 max-w-md">
          You must complete every training module and pass all module assessments before the final summative exam unlocks.
        </p>
        <Button asChild className="font-mono tracking-widest">
          <Link href="/training">BACK TO TRAINING</Link>
        </Button>
      </div>
    );
  }

  const questions = exam.questions || [];
  const currentQuestion = questions[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === questions.length - 1;
  const progress = (currentQuestionIdx / questions.length) * 100;

  const handleSelectOption = (optionIdx: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIdx }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIdx((idx) => idx + 1);
    }
  };

  const handleSubmit = () => {
    if (!deviceId || !activationCode) return;

    const formattedAnswers = Object.entries(answers).map(([qId, optIdx]) => ({
      questionId: parseInt(qId),
      selectedOption: optIdx,
    }));

    submitExam.mutate(
      { data: { deviceId, activationCode, answers: formattedAnswers } },
      { onSuccess: (data) => setResult(data) }
    );
  };

  if (result) {
    return (
      <ExamResultScreen
        result={result}
        onReset={handleReset}
        deviceId={deviceId}
        activationCode={activationCode}
      />
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const canProceed = currentAnswer !== undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            Final Summative Exam
          </div>
          <div className="font-mono text-primary font-bold">
            {currentQuestionIdx + 1} / {questions.length}
          </div>
        </div>
        <Progress value={progress} className="h-1 bg-secondary rounded-none" />
      </header>

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
            {exam.passingScore}% required to pass — {exam.totalQuestions} randomized questions
          </p>

          <h2 className="text-2xl sm:text-3xl font-bold font-mono leading-tight mb-8">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 sm:p-6 rounded-lg border-2 transition-all font-mono text-sm sm:text-base ${
                  currentAnswer === idx
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-start">
                  <div className={`shrink-0 w-6 h-6 mr-4 rounded-full border-2 flex items-center justify-center ${
                    currentAnswer === idx ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {currentAnswer === idx && <div className="w-3 h-3 bg-primary rounded-full" />}
                  </div>
                  <div>{opt}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 shrink-0 flex justify-end">
          <Button
            size="lg"
            className="h-14 px-8 font-mono font-bold tracking-widest"
            disabled={!canProceed || submitExam.isPending}
            onClick={handleNext}
          >
            {submitExam.isPending ? "SUBMITTING..." : isLastQuestion ? "SUBMIT EXAM" : "NEXT QUESTION"}
            {!isLastQuestion && !submitExam.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
          </Button>
        </div>
      </main>
    </div>
  );
}
