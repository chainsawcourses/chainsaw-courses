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
    title: "Educational Intent Only",
    text: "The materials provided within this course and manual serve strictly as theoretical references and study guides designed to support continuing professional development (CPD). They provide general guidance on best practices but do not, under any circumstances, qualify the user as a trained, competent, or certified chainsaw operator.",
  },
  {
    id: "c2",
    number: "2",
    title: "No Certification Conferred",
    text: "Completion of this online course and/or reading the companion manual does not grant any formal industry certification, practical license, or qualification. Safe and lawful chainsaw operation mandates formal practical training, in-person field supervision by qualified instructors, and verified assessment against official industry standards.",
  },
  {
    id: "c3",
    number: "3",
    title: "Regulatory Compliance",
    text: "It is the sole responsibility of the operator to maintain full compliance with all relevant local and national regulations. This includes, but is not limited to:\n\n• The Health and Safety at Work etc. Act (HSWA) or your regional equivalent.\n• The Provision and Use of Work Equipment Regulations (PUWER) or regional equipment operation laws.\n• Approved arboricultural and forestry codes of practice relevant to your specific jurisdiction.",
  },
  {
    id: "c4",
    number: "4",
    title: "Personal Protection & Absolute Sobriety",
    text: "You are solely responsible for ensuring your own physical safety. This requires the mandatory use of correct, fully certified Personal Protective Equipment (PPE) at all times. You must review all training materials in full prior to handling any machinery. Furthermore, you must never undertake any chainsaw maintenance, starting, or operational activities while fatigued or under the influence of alcohol, drugs, or impairing medications.",
  },
  {
    id: "c5",
    number: "5",
    title: "Exclusion of Liability",
    text: "To the maximum extent permitted by law, you agree that Overleaf Publishers Ltd, its owners, authors, affiliates, and distributors entirely disclaim all liability for:\n\n• Any direct, indirect, or consequential injuries, property damages, or financial losses resulting from the use or application of the techniques demonstrated in this course and manual.\n• Any failure on your part to adhere to established safety procedures, manufacturers' guidelines, legal requirements, or regional best practices.\n• Any subjective misinterpretation or misapplication of the technical information contained within these training materials.",
  },
  {
    id: "c6",
    number: "6",
    title: "Disclaimer of Warranties",
    text: "All educational materials are provided on an \"as is\" basis, without warranties of any kind regarding their absolute accuracy, completeness, or practical effectiveness in the field. We do not guarantee that adherence to this course or manual will prevent workplace accidents or injuries.",
  },
  {
    id: "c7",
    number: "7",
    title: "Prohibition of Lone Working and Mandatory Emergency Supervision",
    text: "The Candidate explicitly acknowledges, warrants, and agrees that:\n\n• No Lone Operation: The Candidate shall never, under any circumstances, start, operate, or practice with a chainsaw alone, whether performing commercial operations, private cutting, or basic practical field exercises.\n\n• Mandatory Second Competent Person: Whenever a chainsaw is in use, a second competent person must be physically present on-site within a direct line of sight and clear audible range. This individual must remain un-engaged from distracting tasks to ensure uninterrupted safety monitoring.\n\n• First Aid Competency Requirement: The required on-site second person must possess active competency in emergency first aid, explicitly capable of identifying and managing catastrophic trauma injuries and severe haemorrhages associated with chainsaw lacerations.\n\n• Emergency Resource Provision: The supervising competent person must have immediate, unobstructed access to an appropriate trauma first aid kit containing wound dressings and a tourniquet, alongside an active communication device to contact regional emergency services.\n\n• Assumption of Liability for Breaches: Any operation of a chainsaw by the Candidate while working alone constitutes a direct and hazardous breach of this Agreement. The Candidate assumes total, exclusive legal liability for all accidents, injuries, or fatalities arising from lone working and completely indemnifies the Company against any ensuing claims.",
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
    window.scrollTo(0, 0);
  }, []);

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

    const signatureData = signatureRef.current?.toDataURL("image/png") || "";
    const clausesSnapshot = JSON.stringify(
      CLAUSES.map((c) => ({ number: c.number, title: c.title, text: c.text }))
    );

    signWaiver.mutate(
      { data: { deviceId, activationCode, signatureData, agreedToTerms: true, clausesSnapshot } },
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
