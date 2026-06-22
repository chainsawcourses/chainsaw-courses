import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSignWaiver, useGetWaiver } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { SignatureCanvas, SignaturePadRef } from "@/components/SignaturePad";

export default function Waiver() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { deviceId, activationCode } = useUserSession();
  const signWaiver = useSignWaiver();
  
  const [countdown, setCountdown] = useState(3);
  const [agreed, setAgreed] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
      return;
    }
  }, [activationCode, deviceId, setLocation]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setHasScrolledToBottom(true);
      }
    }
  };

  const handleSign = () => {
    if (!agreed) {
      toast({ title: "Agreement Required", description: "You must check the agreement box.", variant: "destructive" });
      return;
    }
    
    if (signatureRef.current?.isEmpty()) {
      toast({ title: "Signature Required", description: "Please sign in the box provided.", variant: "destructive" });
      return;
    }

    if (!deviceId || !activationCode) return;

    const signatureData = signatureRef.current?.toDataURL() || "";

    signWaiver.mutate(
      {
        data: {
          deviceId,
          activationCode,
          signatureData,
          agreedToTerms: true
        }
      },
      {
        onSuccess: () => {
          setLocation("/training");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to submit waiver.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl flex flex-col h-[90vh]">
        <div className="mb-4">
          <h1 className="text-2xl font-black font-mono tracking-tighter text-destructive uppercase">MANDATORY SAFETY WAIVER</h1>
          <p className="text-muted-foreground uppercase tracking-wider text-xs mt-1 font-mono">
            Read carefully before proceeding
          </p>
        </div>
        
        <Card className="flex-1 flex flex-col border-border bg-card/50 overflow-hidden">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm leading-relaxed text-muted-foreground border-b border-border"
          >
            <h2 className="text-foreground font-bold text-base mb-4">UK HEALTH & SAFETY / CHAINSAW OPERATION DISCLAIMER</h2>
            
            <p>1. I acknowledge that operating a chainsaw is an inherently dangerous activity that involves significant risk of severe injury, amputation, or death.</p>
            
            <p>2. I understand that this digital training platform is supplementary educational material and DOES NOT replace practical, hands-on assessment by a certified NPTC/Lantra instructor.</p>
            
            <p>3. I agree to always wear appropriate Personal Protective Equipment (PPE) conforming to current UK HSE guidelines when operating a chainsaw, including but not limited to: chainsaw-resistant trousers, safety helmet with visor and hearing protection, chainsaw-resistant gloves, and appropriate protective footwear.</p>
            
            <p>4. I confirm that I am medically fit to undertake training and operate machinery, and I am not under the influence of any medication, drugs, or alcohol that could impair my judgment or physical abilities.</p>
            
            <p>5. I accept full responsibility for my own safety and the safety of those around me when applying the techniques demonstrated in this manual.</p>
            
            <p>6. The creators, producers, and distributors of the Chainsaw Manual Professional Training App accept no liability for any injury, loss, or damage resulting directly or indirectly from the use of the information contained within this platform.</p>
            
            <div className="h-[20vh]" /> {/* Spacing to ensure scrolling works */}
          </div>
          
          <CardContent className="p-6 bg-secondary/30 shrink-0">
            <div className="mb-6">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-foreground block mb-2">
                Digital Signature
              </label>
              <SignatureCanvas ref={signatureRef} />
              <div className="flex justify-end mt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 font-mono text-xs text-muted-foreground"
                  onClick={() => signatureRef.current?.clear()}
                >
                  CLEAR SIGNATURE
                </Button>
              </div>
            </div>

            <div className="flex items-start space-x-3 mb-6">
              <Checkbox 
                id="terms" 
                checked={agreed}
                onCheckedChange={(c) => setAgreed(c === true)}
                className="mt-1"
              />
              <label 
                htmlFor="terms" 
                className="text-sm font-mono leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground cursor-pointer select-none"
              >
                I confirm that I have read, understood, and agree to the safety disclaimer above.
              </label>
            </div>

            <Button 
              className="w-full h-14 font-mono font-bold tracking-widest text-sm"
              disabled={countdown > 0 || !agreed || signWaiver.isPending}
              onClick={handleSign}
              variant={countdown > 0 ? "secondary" : "default"}
            >
              {countdown > 0 ? `PLEASE WAIT (${countdown})` : signWaiver.isPending ? "SUBMITTING..." : "SIGN & CONTINUE"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
