import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Biohazard, CheckCircle2, GripVertical, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_INTRO = "Thank you for purchasing the course. Here's a quick guide to help you get started.";
const DEFAULT_STEPS = [
  "Work through the 7 training modules in order — each one unlocks after you watch the video and pass the quiz (80% to pass).",
  "Use the AI Mock Test when you're ready to practise for the written exam.",
  "The Inspection Checklist and Risk Assessment are standalone tools for your real-world use.",
  "The Biosecurity Map, Chain Chart, Species Guide, and Cross-Cut Simulator are all available from the main menu.",
  "Check the News section for the latest chainsaw safety updates and industry guidance.",
];

interface WelcomeConfig {
  intro: string;
  steps: string[];
}

export default function WelcomeNote() {
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();

  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isReady && !adminToken) setLocation("/admin");
  }, [isReady, adminToken, setLocation]);

  useEffect(() => {
    fetch("/api/config/welcome-note")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { value: string } | null) => {
        if (data?.value) {
          try {
            const parsed: WelcomeConfig = JSON.parse(data.value);
            if (parsed.intro) setIntro(parsed.intro);
            if (Array.isArray(parsed.steps)) setSteps(parsed.steps);
          } catch {
            // use defaults
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!adminToken) return;
    setSaving(true);
    const value = JSON.stringify({ intro, steps });
    try {
      const res = await fetch("/api/admin/config/welcome-note", {
        method: "PUT",
        headers: { "Content-Type": "application/json", admintoken: adminToken },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Saved", description: "Welcome note updated successfully." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const updateStep = (i: number, val: string) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? val : s)));

  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, idx) => idx !== i));

  const addStep = () =>
    setSteps((prev) => [...prev, ""]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="font-mono text-xs" asChild>
              <Link href="/admin/dashboard">
                <ArrowLeft className="w-4 h-4 mr-1" /> BACK
              </Link>
            </Button>
            <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
              <MessageSquare className="w-5 h-5 mr-2" /> WELCOME NOTE
            </div>
          </div>
          <div className="text-xs font-mono text-muted-foreground hidden sm:block">
            <Biohazard className="w-3 h-3 inline mr-1" /> ADMIN ONLY
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <p className="text-muted-foreground text-sm font-mono">
          Edit the message students see the first time they open the training after signing their waiver. Changes take effect immediately for any student who hasn't yet dismissed the modal.
        </p>

        {loading ? (
          <div className="text-center py-16 font-mono text-muted-foreground animate-pulse">LOADING...</div>
        ) : (
          <>
            <Card className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-widest">Intro Text</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={intro}
                  onChange={(e) => { setIntro(e.target.value); setSaved(false); }}
                  rows={3}
                  className="font-mono text-sm bg-background resize-none"
                  placeholder="Short introductory paragraph shown under the Welcome! heading…"
                />
              </CardContent>
            </Card>

            <Card className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm uppercase tracking-widest">Steps / Bullet Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
                    <span className="text-primary font-mono text-sm mt-2 shrink-0">{i + 1}.</span>
                    <Input
                      value={step}
                      onChange={(e) => { updateStep(i, e.target.value); setSaved(false); }}
                      className="font-mono text-sm bg-background flex-1"
                      placeholder={`Step ${i + 1}…`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { removeStep(i); setSaved(false); }}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addStep}
                  className="font-mono text-xs mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" /> ADD STEP
                </Button>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className={`font-mono text-xs ${saved ? "bg-green-600 hover:bg-green-600" : ""}`}
              >
                {saving ? "SAVING..." : saved ? (
                  <><CheckCircle2 className="w-4 h-4 mr-1" /> SAVED</>
                ) : (
                  <><Save className="w-4 h-4 mr-1" /> SAVE CHANGES</>
                )}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
