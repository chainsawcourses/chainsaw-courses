import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";
import { useGetQuiz, useSubmitQuiz, QuizResult, getGetQuizQueryKey, getListModulesQueryKey, getGetProgressSummaryQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { APPLAUSE_URL } from "../data/audioFiles";

export default function Quiz() {
  const { moduleId } = useParams();
  const id = moduleId ? parseInt(moduleId) : 0;
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();
  const queryClient = useQueryClient();

  const { data: quiz, isLoading } = useGetQuiz(id, {
    query: { queryKey: getGetQuizQueryKey(id), enabled: !!activationCode && !!deviceId && !!id }
  });

  const submitQuiz = useSubmitQuiz();

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const applauseRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  if (isLoading || !quiz) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-primary font-mono tracking-widest uppercase">Loading Assessment...</div>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === questions.length - 1;
  const progress = (currentQuestionIdx / questions.length) * 100;

  const handleSelectOption = (optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionIdx }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIdx(idx => idx + 1);
    }
  };

  const handleSubmit = () => {
    if (!deviceId || !activationCode) return;

    const formattedAnswers = Object.entries(answers).map(([qId, optIdx]) => ({
      questionId: parseInt(qId),
      selectedOption: optIdx
    }));

    submitQuiz.mutate(
      {
        moduleId: id,
        data: {
          deviceId,
          activationCode,
          answers: formattedAnswers
        }
      },
      {
        onSuccess: (data) => {
          setResult(data);
          if (data.passed) {
            queryClient.invalidateQueries({ queryKey: getListModulesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
            // Force immediate refetch so the next module unlock is visible
            void queryClient.refetchQueries({ queryKey: getListModulesQueryKey(), type: "all" });
            void queryClient.refetchQueries({ queryKey: getGetProgressSummaryQueryKey(), type: "all" });
            // Play applause sound
            try {
              const audio = new Audio(APPLAUSE_URL);
              audio.volume = 0.7;
              audio.play().catch(() => {});
              applauseRef.current = audio;
            } catch {
              // ignore audio errors
            }
          }
        }
      }
    );
  };

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center flex flex-col items-center">
            {result.passed ? (
              <CheckCircle2 className="w-20 h-20 text-primary mb-6" />
            ) : (
              <XCircle className="w-20 h-20 text-destructive mb-6" />
            )}

            <h1 className="text-3xl font-black font-mono uppercase tracking-wide mb-2">
              {result.passed ? "Module Passed" : "Assessment Failed"}
            </h1>

            <p className="text-muted-foreground font-mono mb-2">
              You scored {result.correct} out of {result.total} ({result.score}%)
            </p>

            {!result.passed && (
              <p className="text-sm text-muted-foreground font-mono mb-8">
                You must answer all questions correctly to proceed. Please review the module and try again.
              </p>
            )}
            {result.passed && (
              <p className="text-sm text-primary font-mono mb-8">
                You answered every question correctly. Well done — the next module is now unlocked.
              </p>
            )}

            <div className="flex gap-4 w-full">
              {!result.passed ? (
                <Button
                  onClick={() => {
                    setResult(null);
                    setCurrentQuestionIdx(0);
                    setAnswers({});
                  }}
                  className="w-full h-14 font-mono font-bold tracking-widest"
                >
                  <RotateCcw className="mr-2 w-4 h-4" /> RETRY ASSESSMENT
                </Button>
              ) : (
                <Button asChild className="w-full h-14 font-mono font-bold tracking-widest">
                  <Link href="/training">CONTINUE TRAINING</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentAnswer = answers[currentQuestion.id];
  const canProceed = currentAnswer !== undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            {quiz.moduleTitle}
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
            100% required to pass — all questions must be answered correctly
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
            disabled={!canProceed || submitQuiz.isPending}
            onClick={handleNext}
          >
            {submitQuiz.isPending ? "SUBMITTING..." : isLastQuestion ? "SUBMIT ASSESSMENT" : "NEXT QUESTION"}
            {!isLastQuestion && !submitQuiz.isPending && <ArrowRight className="ml-2 w-4 h-4" />}
          </Button>
        </div>
      </main>
    </div>
  );
}
