import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Award } from "lucide-react";
import { useGetExam, useSubmitExam, ExamResult, getGetExamQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

export default function Exam() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  const { data: exam, isLoading, error } = useGetExam({
    query: { queryKey: getGetExamQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const submitExam = useSubmitExam();

  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);

  if (!activationCode || !deviceId) {
    setLocation("/");
    return null;
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
                  <RotateCcw className="mr-2 w-4 h-4" /> RETAKE EXAM
                </Button>
              ) : (
                <Button asChild className="w-full h-14 font-mono font-bold tracking-widest">
                  <Link href="/training">BACK TO TRAINING</Link>
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
