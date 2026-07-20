import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Star } from "lucide-react";
import { useGetQuiz, useSubmitQuiz, useSubmitModuleFeedback, QuizResult, getGetQuizQueryKey, getListModulesQueryKey, getGetProgressSummaryQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { APPLAUSE_URL, DISAPPOINTMENT_URL } from "../data/audioFiles";

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
  const submitFeedback = useSubmitModuleFeedback();

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const applausePlayedRef = useRef(false);
  const disappointmentPlayedRef = useRef(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  // Play applause on pass, disappointment on fail
  useEffect(() => {
    if (result && result.passed && !applausePlayedRef.current) {
      applausePlayedRef.current = true;
      try {
        const audio = new Audio(APPLAUSE_URL);
        audio.volume = 0.7;
        audio.play().catch((e) => { console.warn("Applause audio failed to play:", e); });
      } catch (e) {
        console.warn("Applause audio error:", e);
      }
    }
    if (result && !result.passed && !disappointmentPlayedRef.current) {
      disappointmentPlayedRef.current = true;
      try {
        const audio = new Audio(DISAPPOINTMENT_URL);
        audio.volume = 0.7;
        audio.play().catch((e) => { console.warn("Disappointment audio failed to play:", e); });
      } catch (e) {
        console.warn("Disappointment audio error:", e);
      }
    }
    if (result) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (!result) {
      applausePlayedRef.current = false;
      disappointmentPlayedRef.current = false;
    }
  }, [result]);

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
                You need {result.passingScore}% to pass. Please review the module and try again.
              </p>
            )}
            {result.passed && (
              <p className="text-sm text-primary font-mono mb-8">
                You scored above the {result.passingScore}% pass mark. Well done — the next module is now unlocked.
              </p>
            )}

            {result.passed && !feedbackSent && (
              <div className="w-full mb-8 p-4 rounded-lg border border-border bg-secondary/20 text-left">
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Quick feedback on this module (optional)
                </p>
                <div className="flex gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setFeedbackRating(n)}>
                      <Star className={`w-6 h-6 ${n <= feedbackRating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Any comments? (optional)"
                  className="w-full text-sm font-mono p-2 rounded border border-border bg-background mb-3 resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="font-mono text-xs"
                  disabled={feedbackRating === 0 || submitFeedback.isPending || !deviceId || !activationCode}
                  onClick={() => {
                    if (!deviceId || !activationCode) return;
                    submitFeedback.mutate(
                      { moduleId: id, data: { deviceId, activationCode, rating: feedbackRating, comment: feedbackComment || undefined } },
                      { onSuccess: () => setFeedbackSent(true) }
                    );
                  }}
                >
                  {submitFeedback.isPending ? "SUBMITTING..." : "SUBMIT FEEDBACK"}
                </Button>
              </div>
            )}
            {result.passed && feedbackSent && (
              <p className="text-xs font-mono text-primary mb-8 uppercase tracking-widest">Thanks for your feedback!</p>
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
                <Button
                  className="w-full h-14 font-mono font-bold tracking-widest"
                  onClick={() => {
                    sessionStorage.setItem("scrollAfterModule", String(id));
                    setLocation("/training");
                  }}
                >
                  CONTINUE TRAINING
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
    <div className="min-h-screen flex flex-col pt-[68px]">
      <header className="border-b-2 border-primary/40 bg-card fixed top-0 left-0 right-0 z-10">
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

      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pt-4 pb-4">
        <div className="flex flex-col">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
            80% required to pass — unlimited retries available
          </p>

          <h2 className="text-xl sm:text-2xl font-bold font-mono leading-tight mb-4">
            {currentQuestion.question}
          </h2>

          <div className="space-y-2">
            {currentQuestion.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all font-mono text-sm ${
                  currentAnswer === idx
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-start">
                  <div className={`shrink-0 w-5 h-5 mr-3 mt-0.5 rounded-full border-2 flex items-center justify-center ${
                    currentAnswer === idx ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {currentAnswer === idx && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                  </div>
                  <div>{opt}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 shrink-0 flex justify-end">
          <Button
            size="lg"
            className="h-12 px-8 font-mono font-bold tracking-widest"
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
