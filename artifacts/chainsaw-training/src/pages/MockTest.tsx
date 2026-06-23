import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Send, ArrowLeft, Bot, User } from "lucide-react";
import { useGetChatHistory, useSendAiMessage, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

export default function MockTest() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName } = useUserSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history, isLoading: isHistoryLoading, refetch } = useGetChatHistory({
    query: { queryKey: getGetChatHistoryQueryKey(), enabled: !!activationCode && !!deviceId }
  });
  
  const sendMessage = useSendAiMessage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (history) {
      setMessages(history.map(m => ({ role: m.role, content: m.content })));
    }
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !deviceId || !activationCode) return;
    
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    sendMessage.mutate(
      {
        data: {
          message: userMsg,
          deviceId,
          activationCode
        }
      },
      {
        onSuccess: (data) => {
          setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
          refetch();
        },
        onError: () => {
          setMessages(prev => [...prev, { role: "system", content: "Error: Failed to connect to examiner." }]);
        }
      }
    );
  };

  if (isHistoryLoading) {
    return <div className="min-h-screen flex justify-center items-center font-mono text-primary uppercase">Initializing Examiner...</div>;
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
            <Bot className="w-4 h-4 mr-2 text-primary" /> AI EXAMINER
          </div>
          <div className="w-[80px]" />
        </div>
        <div className="bg-primary/10 border-b border-primary/20 p-2 text-center text-xs font-mono text-primary flex items-center justify-center uppercase tracking-wider">
          <ShieldAlert className="w-3 h-3 mr-2" />
          This AI only answers chainsaw safety questions from the official manual.
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col max-w-4xl mx-auto w-full">
        <div className="space-y-6 pb-20">
          {messages.length === 0 && (
            <div className="text-center py-20 text-muted-foreground font-mono text-sm opacity-50">
              Session initialized. The examiner is ready for your questions.
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-4 font-mono text-sm leading-relaxed border ${
                msg.role === 'user' 
                  ? 'bg-primary/10 border-primary/20 text-foreground ml-4' 
                  : msg.role === 'system'
                    ? 'bg-destructive/10 border-destructive/20 text-destructive'
                    : 'bg-card border-border text-foreground mr-4'
              }`}>
                <div className="flex items-center mb-2 opacity-50 text-xs font-bold tracking-widest uppercase">
                  {msg.role === 'user' ? <User className="w-3 h-3 mr-1"/> : msg.role === 'assistant' ? <Bot className="w-3 h-3 mr-1"/> : null}
                  {msg.role === 'user' ? fullName || 'OPERATOR' : msg.role === 'assistant' ? 'EXAMINER' : 'SYSTEM'}
                </div>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      <div className="p-4 bg-card/80 backdrop-blur-sm border-t border-border shrink-0 sticky bottom-0">
        <div className="max-w-4xl mx-auto relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask a question about chainsaw safety..."
            className="h-14 font-mono pr-14 bg-card/50"
            disabled={sendMessage.isPending}
          />
          <Button 
            size="icon"
            className="absolute right-2 h-10 w-10" 
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
