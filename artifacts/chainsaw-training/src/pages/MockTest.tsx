import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, Send, ArrowLeft, Bot, User, ClipboardList } from "lucide-react";
import { useGetChatHistory, useSendAiMessage, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

const TOTAL_QUESTIONS = 29;

function parseQuestionNumber(content: string): number | null {
  const match = content.match(/QUESTION\s+(\d+)\s+OF\s+\d+/i);
  return match ? parseInt(match[1], 10) : null;
}

export default function MockTest() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName } = useUserSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history, isLoading: isHistoryLoading, refetch } = useGetChatHistory({
    query: { queryKey: getGetChatHistoryQueryKey(), enabled: !!activationCode && !!deviceId }
  });

  const sendMessage = useSendAiMessage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (history) {
      setMessages(history.map((m) => ({ role: m.role, content: m.content })));
    }
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentQuestion = useMemo(() => {
    const examinerMessages = messages.filter((m) => m.role === "assistant");
    let last: number | null = null;
    for (const m of examinerMessages) {
      const q = parseQuestionNumber(m.content);
      if (q !== null) last = q;
    }
    return last;
  }, [messages]);

  const examStarted = messages.length > 0;
  const examComplete = currentQuestion === TOTAL_QUESTIONS &&
    messages.some((m) => m.role === "assistant" && m.content.toLowerCase().includes("examination complete"));

  const handleSend = (text?: string) => {
    const userMsg = text ?? input;
    if (!userMsg.trim() || !deviceId || !activationCode) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    sendMessage.mutate(
      { data: { message: userMsg, deviceId, activationCode } },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
          refetch();
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "system", content: "Error: Failed to connect to examiner." },
          ]);
        },
      }
    );
  };

  const handleBeginExam = () => {
    handleSend("Begin the examination.");
  };

  if (isHistoryLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center font-mono text-primary uppercase">
        Initializing Examiner...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-2" /> EXIT
            </Link>
          </Button>
          <div className="font-mono text-sm font-bold uppercase flex items-center">
            <Bot className="w-4 h-4 mr-2 text-primary" /> NPTC ORAL EXAM
          </div>
          <div className="font-mono text-xs text-muted-foreground tabular-nums w-[80px] text-right">
            {currentQuestion !== null
              ? `${currentQuestion} / ${TOTAL_QUESTIONS}`
              : examStarted
              ? "—"
              : ""}
          </div>
        </div>
        <div className="bg-primary/10 border-b border-primary/20 p-2 text-center text-xs font-mono text-primary flex items-center justify-center uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3 mr-2" />
          {TOTAL_QUESTIONS} oral questions · NPTC 0039-20 schedule · in order
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col max-w-4xl mx-auto w-full">
        <div className="space-y-6 pb-24">
          {!examStarted && (
            <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="font-mono font-black uppercase tracking-widest text-lg">
                  NPTC Oral Examination
                </h2>
                <p className="text-muted-foreground font-mono text-sm max-w-sm">
                  {TOTAL_QUESTIONS} verbal questions from the official City &amp; Guilds 0039-20
                  assessment schedule, asked in order. Answer each question as you would in a
                  real NPTC assessment.
                </p>
              </div>
              <Button
                size="lg"
                className="font-mono font-black uppercase tracking-widest px-10"
                onClick={handleBeginExam}
                disabled={sendMessage.isPending}
              >
                Begin Exam
              </Button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg p-4 font-mono text-sm leading-relaxed border ${
                  msg.role === "user"
                    ? "bg-primary/10 border-primary/20 text-foreground ml-4"
                    : msg.role === "system"
                    ? "bg-destructive/10 border-destructive/20 text-destructive"
                    : "bg-card border-border text-foreground mr-4"
                }`}
              >
                <div className="flex items-center mb-2 opacity-50 text-xs font-bold tracking-widest uppercase">
                  {msg.role === "user" ? (
                    <User className="w-3 h-3 mr-1" />
                  ) : msg.role === "assistant" ? (
                    <Bot className="w-3 h-3 mr-1" />
                  ) : null}
                  {msg.role === "user"
                    ? fullName || "CANDIDATE"
                    : msg.role === "assistant"
                    ? "EXAMINER"
                    : "SYSTEM"}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {examStarted && !examComplete && (
        <div className="p-4 bg-card/80 backdrop-blur-sm border-t border-border shrink-0 sticky bottom-0">
          <div className="max-w-4xl mx-auto flex flex-col gap-2">
            {currentQuestion !== null && (
              <div className="font-mono text-xs text-muted-foreground text-right">
                Answering question {currentQuestion} of {TOTAL_QUESTIONS}
              </div>
            )}
            <div className="relative flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your answer here… (Enter to submit, Shift+Enter for new line)"
                className="font-mono text-sm resize-none min-h-[56px] max-h-[200px] pr-14 bg-card/50"
                disabled={sendMessage.isPending}
                rows={2}
              />
              <Button
                size="icon"
                className="absolute right-2 bottom-2 h-10 w-10"
                onClick={() => handleSend()}
                disabled={!input.trim() || sendMessage.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {examComplete && (
        <div className="p-6 bg-primary/5 border-t border-primary/20 text-center font-mono shrink-0">
          <p className="text-primary font-black uppercase tracking-widest text-sm mb-2">
            Examination Complete
          </p>
          <p className="text-muted-foreground text-xs">All {TOTAL_QUESTIONS} oral questions answered.</p>
        </div>
      )}
    </div>
  );
}
