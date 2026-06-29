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
    title: "Educational Intent",
    text: "I understand that this manual is intended as a core theoretical reference and study guide to support accredited professional development (CPD) training programmes. It provides general guidance on chainsaw maintenance and cross-cutting techniques but does not qualify me as a trained or certified chainsaw operator.",
  },
  {
    id: "c2",
    number: "2",
    title: "No Certification Conferred",
    text: "I acknowledge that completing or reading this manual does not entitle me to any formal industry certification or practical qualification. Safe chainsaw operation strictly requires practical training, physical field supervision, and verified compliance with legal and industry safety standards.",
  },
  {
    id: "c3",
    number: "3",
    title: "Regulatory Compliance",
    text: "I agree to maintain complete compliance with local regulations, including the Health and Safety Law of my country or region (e.g. HSWA), various equipment regulations relating to chainsaw use and operation (e.g. PUWER), and approved Tree Industry Codes of Practice for Chainsaws relevant to my region.",
  },
  {
    id: "c4",
    number: "4",
    title: "Personal Protection",
    text: "I accept that I am solely responsible for ensuring my own safety by wearing correct, certified Personal Protective Equipment (PPE) and following all relevant laws and workplace regulations. I confirm I will read the entire manual in full before operating any chainsaw machinery.",
  },
  {
    id: "c5",
    number: "5",
    title: "Absolute Sobriety",
    text: "I agree not to undertake any chainsaw maintenance or operational activities under the influence of any drugs, alcohol, or impairing medications.",
  },
  {
    id: "c6",
    number: "6",
    title: "Lone Working",
    text: "I understand the significant additional risks of operating a chainsaw as a lone worker. I agree not to operate a chainsaw alone unless a specific lone working risk assessment has been completed, appropriate emergency communication equipment is available, and another person who can summon assistance in the event of an accident has been informed of my location and expected return time, in accordance with HSE lone working guidance.",
  },
  {
    id: "c7",
    number: "7",
    title: "Exclusion of Liability",
    text: "To the fullest extent permitted under law, I agree that Overleaf Publishers Ltd, its owners, authors, affiliates, and distributors are not liable for: injuries, damages, or losses resulting from chainsaw use based on this manual; failure to follow established safety procedures, legal requirements, or regional best practices; or any subjective misinterpretation of the technical information contained in this guide.",
  },
];

export default function Waiver() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { deviceId, activationCode } = useUserSession();
  const signWaiver = useSignWaiver();

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
          {CLAUSES.map((clause, index) => {
            const isChecked = !!checked[clause.id];
            const prevChecked = index === 0 || !!checked[CLAUSES[index - 1].id];
            const isLocked = !prevChecked;
            return (
              <Card
                key={clause.id}
                className={`border transition-all duration-300 ${
                  isLocked
                    ? "opacity-40 pointer-events-none border-border bg-card/50"
                    : isChecked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card/50"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3">
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

                      {/* Per-clause checkbox — onCheckedChange only, no onClick on wrapper */}
                      <div className="flex items-center gap-2 select-none">
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
            <div className="flex items-start gap-3 select-none">
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
              disabled={!canSign || signWaiver.isPending}
              onClick={handleSign}
              variant={!canSign ? "secondary" : "default"}
            >
              {signWaiver.isPending ? "Submitting…" : "Sign & Continue"}
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
