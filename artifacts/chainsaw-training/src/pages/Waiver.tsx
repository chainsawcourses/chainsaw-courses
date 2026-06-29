import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSignWaiver } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { SignatureCanvas, SignaturePadRef } from "@/components/SignaturePad";
import { CheckCircle2, Circle } from "lucide-react";

const CLAUSES = [
  {
    id: "c1",
    number: "1",
    title: "Inherent Risk",
    text: "I acknowledge that operating a chainsaw is an inherently dangerous activity that involves significant risk of severe injury, amputation, or death. I understand these risks and accept them voluntarily.",
  },
  {
    id: "c2",
    number: "2",
    title: "Supplementary Material",
    text: "I understand that this digital training platform is supplementary educational material and DOES NOT replace practical, hands-on assessment by a certified NPTC/Lantra instructor. This course alone does not qualify me to operate a chainsaw professionally.",
  },
  {
    id: "c3",
    number: "3",
    title: "Personal Protective Equipment",
    text: "I agree to always wear appropriate Personal Protective Equipment (PPE) conforming to current UK HSE guidelines when operating a chainsaw, including but not limited to: chainsaw-resistant trousers, safety helmet with visor and hearing protection, chainsaw-resistant gloves, and appropriate protective footwear.",
  },
  {
    id: "c4",
    number: "4",
    title: "Medical Fitness",
    text: "I confirm that I am medically fit to undertake training and operate machinery, and I am not under the influence of any medication, drugs, or alcohol that could impair my judgment or physical abilities.",
  },
  {
    id: "c5",
    number: "5",
    title: "Personal Responsibility",
    text: "I accept full responsibility for my own safety and the safety of those around me when applying the techniques demonstrated in this manual. I will not attempt any chainsaw operation without adequate supervision until formally qualified.",
  },
  {
    id: "c6",
    number: "6",
    title: "Limitation of Liability",
    text: "The creators, producers, and distributors of the Chainsaw Courses Professional Training App accept no liability for any injury, loss, or damage resulting directly or indirectly from the use of the information contained within this platform.",
  },
];

export default function Waiver() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { deviceId, activationCode } = useUserSession();
  const signWaiver = useSignWaiver();

  const [countdown, setCountdown] = useState(3);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [finalAgreed, setFinalAgreed] = useState(false);
  const signatureRef = useRef<SignaturePadRef>(null);

  const allClausesChecked = CLAUSES.every((c) => checked[c.id]);
  const canSign = allClausesChecked && finalAgreed;

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSign = () => {
    if (!canSign) {
      toast({
        title: "All items required",
        description: "Please tick every clause and the final agreement box.",
        variant: "destructive",
      });
      return;
    }

    if (signatureRef.current?.isEmpty()) {
      toast({
        title: "Signature Required",
        description: "Please sign in the box provided.",
        variant: "destructive",
      });
      return;
    }

    if (!deviceId || !activationCode) return;

    const signatureData = signatureRef.current?.toDataURL() || "";

    signWaiver.mutate(
      { data: { deviceId, activationCode, signatureData, agreedToTerms: true } },
      {
        onSuccess: () => setLocation("/training"),
        onError: () =>
          toast({ title: "Error", description: "Failed to submit waiver.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Chainsaw Courses"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">
                Chainsaw Courses
              </h1>
              <p className="text-muted-foreground uppercase tracking-widest text-xs">
                Professional Training Portal
              </p>
            </div>
          </div>
          <h2 className="text-xl font-black font-mono tracking-tighter text-destructive uppercase">
            Mandatory Liability Waiver
          </h2>
          <p className="text-muted-foreground uppercase tracking-wider text-xs mt-1 font-mono">
            Read each clause carefully — tick to confirm, then sign below
          </p>
        </div>

        {/* Clauses */}
        <div className="space-y-3 mb-4">
          {CLAUSES.map((clause) => {
            const isChecked = !!checked[clause.id];
            return (
              <Card
                key={clause.id}
                className={`border transition-colors duration-200 ${
                  isChecked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card/50"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    {/* Clause number + status icon */}
                    <div className="shrink-0 mt-0.5">
                      {isChecked ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        Clause {clause.number} — {clause.title}
                      </p>
                      <p className="font-mono text-sm leading-relaxed text-foreground/80 mb-3">
                        {clause.text}
                      </p>

                      {/* Per-clause checkbox */}
                      <div
                        className="flex items-center gap-2 cursor-pointer select-none"
                        onClick={() => toggle(clause.id)}
                      >
                        <Checkbox
                          id={clause.id}
                          checked={isChecked}
                          onCheckedChange={() => toggle(clause.id)}
                        />
                        <label
                          htmlFor={clause.id}
                          className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer"
                        >
                          I have read and understand this clause
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Final agreement + signature — dimmed until all clauses checked */}
        <Card
          className={`border transition-opacity duration-300 ${
            allClausesChecked ? "opacity-100" : "opacity-40 pointer-events-none"
          }`}
        >
          <CardContent className="p-5 space-y-5">
            {/* Final checkbox */}
            <div
              className="flex items-start gap-3 cursor-pointer select-none"
              onClick={() => allClausesChecked && setFinalAgreed((v) => !v)}
            >
              <Checkbox
                id="final"
                checked={finalAgreed}
                onCheckedChange={(v) => setFinalAgreed(v === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="final"
                className="text-sm font-mono leading-snug text-foreground cursor-pointer"
              >
                I confirm I have read and understood all clauses of this liability waiver in full, and I agree to be bound by its terms.
              </label>
            </div>

            {/* Signature */}
            <div>
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-foreground block mb-2">
                Digital Signature
              </label>
              <SignatureCanvas ref={signatureRef} />
              <div className="flex justify-end mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 font-mono text-xs text-muted-foreground"
                  onClick={() => signatureRef.current?.clear()}
                >
                  Clear Signature
                </Button>
              </div>
            </div>

            <Button
              className="w-full h-14 font-mono font-bold tracking-widest text-sm"
              disabled={countdown > 0 || !canSign || signWaiver.isPending}
              onClick={handleSign}
              variant={countdown > 0 || !canSign ? "secondary" : "default"}
            >
              {countdown > 0
                ? `Please wait (${countdown})`
                : signWaiver.isPending
                ? "Submitting…"
                : "Sign & Continue"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs font-mono text-muted-foreground/50 mt-4 uppercase tracking-widest">
          This waiver is stored securely and can be reviewed from your training dashboard.
        </p>
      </div>
    </div>
  );
}
