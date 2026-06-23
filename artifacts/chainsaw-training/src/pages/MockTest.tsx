import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ClipboardList, CheckCircle, XCircle, ChevronRight, RotateCcw } from "lucide-react";
import { MOCK_EXAM_QUESTIONS } from "../data/mockExamQuestions";

type Phase = "intro" | "quiz" | "result";

const PASS_THRESHOLD = 0.8;

export default function MockTest() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(MOCK_EXAM_QUESTIONS.length).fill(null)
  );

  const total = MOCK_EXAM_QUESTIONS.length;
  const question = MOCK_EXAM_QUESTIONS[currentIndex];
  const isLast = currentIndex === total - 1;
  const passed = score / total >= PASS_THRESHOLD;

  const handleConfirm = () => {
    if (selected === null) return;
    const correct = selected === question.correctIndex;
    setConfirmed(true);
    setScore((s) => (correct ? s + 1 : s));
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = selected;
      return next;
    });
  };

  const handleNext = () => {
    if (isLast) {
      setPhase("result");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setConfirmed(false);
    }
  };

  const handleRestart = () => {
    setPhase("intro");
    setCurrentIndex(0);
    setSelected(null);
    setConfirmed(false);
    setScore(0);
    setAnswers(Array(MOCK_EXAM_QUESTIONS.length).fill(null));
  };

  const optionLabels = ["A", "B", "C", "D"] as const;

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
          <div className="font-mono text-sm font-bold uppercase">
            NPTC MOCK EXAM
          </div>
          {phase === "quiz" ? (
            <div className="font-mono text-xs text-muted-foreground tabular-nums">
              {currentIndex + 1} / {total}
            </div>
          ) : (
            <div className="w-[48px]" />
          )}
        </div>

        {/* Progress bar */}
        {phase === "quiz" && (
          <div className="h-1 bg-border">
            <div
              className="h-1 bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex + (confirmed ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 max-w-2xl mx-auto w-full">

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="font-mono font-black uppercase tracking-widest text-lg">
                NPTC Oral Mock Exam
              </h2>
              <p className="text-muted-foreground font-mono text-sm max-w-sm">
                {total} multiple-choice questions from the City &amp; Guilds 0039-20
                assessment schedule. Pass mark is {PASS_THRESHOLD * 100}%.
              </p>
            </div>
            <Button
              size="lg"
              className="font-mono font-black uppercase tracking-widest px-10"
              onClick={() => setPhase("quiz")}
            >
              Begin Exam
            </Button>
          </div>
        )}

        {/* ── QUIZ ── */}
        {phase === "quiz" && (
          <div className="w-full py-6 space-y-6">
            {/* Question */}
            <div className="space-y-1">
              <p className="font-mono text-xs text-primary uppercase tracking-widest">
                Question {currentIndex + 1} of {total}
              </p>
              <h2 className="font-mono font-bold text-base leading-snug">
                {question.question}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {question.options.map((opt, i) => {
                const isSelected = selected === i;
                const isCorrect = i === question.correctIndex;

                let borderClass = "border-border";
                let bgClass = "bg-card/50";
                let textClass = "text-foreground";

                if (confirmed) {
                  if (isCorrect) {
                    borderClass = "border-green-500";
                    bgClass = "bg-green-500/10";
                    textClass = "text-green-400";
                  } else if (isSelected && !isCorrect) {
                    borderClass = "border-destructive";
                    bgClass = "bg-destructive/10";
                    textClass = "text-destructive";
                  } else {
                    borderClass = "border-border";
                    bgClass = "bg-card/30";
                    textClass = "text-muted-foreground";
                  }
                } else if (isSelected) {
                  borderClass = "border-primary";
                  bgClass = "bg-primary/10";
                }

                return (
                  <button
                    key={i}
                    disabled={confirmed}
                    onClick={() => setSelected(i)}
                    className={`w-full text-left rounded-lg border p-4 flex items-start gap-3 transition-all duration-150 ${borderClass} ${bgClass} ${confirmed ? "cursor-default" : "hover:border-primary/50 hover:bg-primary/5"}`}
                  >
                    <span className={`font-mono font-black text-xs shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center border ${confirmed && isCorrect ? "border-green-500 text-green-400" : confirmed && isSelected ? "border-destructive text-destructive" : isSelected ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                      {optionLabels[i]}
                    </span>
                    <span className={`font-mono text-sm leading-snug ${textClass}`}>
                      {opt}
                    </span>
                    {confirmed && isCorrect && (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 ml-auto mt-0.5" />
                    )}
                    {confirmed && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-destructive shrink-0 ml-auto mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {confirmed && (
              <Card className="border-border bg-card/40">
                <CardContent className="p-4 space-y-1">
                  <p className={`font-mono text-xs font-black uppercase tracking-widest ${selected === question.correctIndex ? "text-green-400" : "text-destructive"}`}>
                    {selected === question.correctIndex ? "✓ Correct" : "✗ Incorrect"}
                  </p>
                  <p className="font-mono text-sm text-muted-foreground leading-snug">
                    {question.explanation}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              {!confirmed ? (
                <Button
                  className="flex-1 font-mono font-black uppercase tracking-widest"
                  disabled={selected === null}
                  onClick={handleConfirm}
                >
                  Confirm Answer
                </Button>
              ) : (
                <Button
                  className="flex-1 font-mono font-black uppercase tracking-widest"
                  onClick={handleNext}
                >
                  {isLast ? "See Results" : "Next Question"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "result" && (
          <div className="w-full py-6 space-y-6">
            <div className="text-center space-y-3">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${passed ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {passed
                  ? <CheckCircle className="w-10 h-10 text-green-500" />
                  : <XCircle className="w-10 h-10 text-destructive" />}
              </div>
              <h2 className="font-mono font-black uppercase tracking-widest text-xl">
                {passed ? "PASS" : "NOT YET"}
              </h2>
              <p className="font-mono text-3xl font-black tabular-nums">
                {score} / {total}
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {Math.round((score / total) * 100)}% — pass mark is {PASS_THRESHOLD * 100}%
              </p>
            </div>

            {/* Per-question review */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Review</p>
              {MOCK_EXAM_QUESTIONS.map((q, i) => {
                const correct = answers[i] === q.correctIndex;
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-3 flex items-start gap-3 ${correct ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}
                  >
                    {correct
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                    <div className="space-y-1 min-w-0">
                      <p className="font-mono text-xs font-bold leading-snug">{q.question}</p>
                      {!correct && (
                        <p className="font-mono text-xs text-muted-foreground leading-snug">
                          <span className="text-green-400">Correct: </span>
                          {q.options[q.correctIndex]}
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
