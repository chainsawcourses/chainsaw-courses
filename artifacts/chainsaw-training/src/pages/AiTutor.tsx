import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, ArrowLeft, Trash2, Bot, User, Sparkles, Loader2
} from "lucide-react";
import { useUserSession } from "../contexts/UserContext";
import { useSendAiMessage } from "@workspace/api-client-react";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function AiTutor() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  const sendMessage = useSendAiMessage({
    mutation: {
      onMutate: () => setIsLoading(true),
      onSettled: () => setIsLoading(false),
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !activationCode || !deviceId || sendMessage.isPending) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    sendMessage.mutate(
      {
        data: {
          message: text,
          deviceId,
          activationCode,
          mode: "tutor",
        },
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, something went wrong. Please try again." },
          ]);
        },
      }
    );
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, activationCode, deviceId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  if (!activationCode || !deviceId) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="font-mono uppercase tracking-widest text-xs">
            <Link href="/training">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold uppercase tracking-widest text-sm">AI Tutor</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="font-mono uppercase tracking-widest text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Clear
          </Button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bot className="w-12 h-12 text-primary/40 mb-4" />
              <h2 className="font-mono font-bold uppercase tracking-widest text-lg mb-2">
                Chainsaw Manual Tutor
              </h2>
              <p className="font-mono text-sm text-muted-foreground max-w-md">
                Ask me anything about chainsaw maintenance, safety, cross-cutting techniques, or legislation.
                I draw my answers exclusively from the course manual.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className="shrink-0 mt-1">
                {msg.role === "user" ? (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
              </div>
              <Card className={`border-border/50 ${msg.role === "user" ? "bg-primary/5" : "bg-card/60"}`}>
                <CardContent className="p-3">
                  <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="shrink-0 mt-1">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              </div>
              <Card className="border-border/50 bg-card/60">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Thinking...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="border-t border-border bg-card/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask about chainsaw maintenance, safety, cross-cutting..."
              className="font-mono text-sm resize-none min-h-[44px] max-h-[160px] bg-background border-border"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
              className="shrink-0 h-auto px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-1 text-center">
            Answers are drawn exclusively from the Chainsaw Maintenance &amp; Cross-cutting training manual.
          </p>
        </div>
      </div>
    </div>
  );
}
