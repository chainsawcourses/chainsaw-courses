import { useState } from "react";
import { Link } from "wouter";
import { Star, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubmitAppFeedback } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

export default function StudentFeedback() {
  const { deviceId, activationCode } = useUserSession();
  const submitFeedback = useSubmitAppFeedback();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!rating || !deviceId || !activationCode) return;
    submitFeedback.mutate(
      { data: { deviceId, activationCode, rating, comment: comment || undefined } },
      { onSuccess: () => setSubmitted(true) }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="font-mono text-xs">
            <Link href="/training"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
          <Star className="w-4 h-4 text-orange-500" />
          <span className="font-mono font-bold uppercase tracking-widest text-sm">Course Feedback</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-border bg-card/80">
          <CardContent className="p-8">
            {submitted ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-14 h-14 text-primary mx-auto" />
                <h2 className="font-mono font-black uppercase tracking-widest text-lg">Thank You</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Your feedback has been recorded and helps us improve the course.
                </p>
                <Button asChild variant="outline" className="font-mono text-xs uppercase tracking-widest mt-4">
                  <Link href="/training">Back to Training</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="font-mono font-black uppercase tracking-widest text-base mb-1">How was the course overall?</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    Your feedback helps us improve the learning experience for future students.
                  </p>
                </div>

                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Overall Rating</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHovered(n)}
                        onMouseLeave={() => setHovered(0)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-9 h-9 transition-colors ${
                            n <= (hovered || rating)
                              ? "text-primary fill-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Comments (optional)</div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What worked well? What could be improved?"
                    rows={4}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!rating || submitFeedback.isPending}
                  className="w-full font-mono uppercase tracking-widest"
                >
                  {submitFeedback.isPending ? "Submitting..." : "Submit Feedback"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
