import { useLayoutEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useActivateCode, useCreateCodeResetRequest } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { isAppleNative } from "../lib/appleStore";
import AppleAccess from "@/components/AppleAccess";

const formSchema = z.object({
  code: z.string().min(1, "Activation code is required"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
});

function normalizePurchaseCode(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/[.,;:]+$/g, "")
    .trim()
    .toUpperCase();
}

export default function Activation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { deviceId, activationCode, bondedLearner, resumeSession, setSession } = useUserSession();
  const [isResuming, setIsResuming] = useState(false);
  const [activatingNewPurchase, setActivatingNewPurchase] = useState(false);
  const [resetRequestOpen, setResetRequestOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [appleNative] = useState(isAppleNative);

  // Redirect synchronously before the first paint so returning users never see
  // the activation form, even for a single frame. useLayoutEffect fires after
  // DOM mutation but before the browser paints — zero visible gap.
  useLayoutEffect(() => {
    if (activationCode) {
      setLocation("/training");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activateCode = useActivateCode();
  const createResetRequest = useCreateCodeResetRequest();

  function handleResetRequest() {
    const email = resetEmail.trim();
    if (!z.string().email().safeParse(email).success) {
      toast({
        variant: "destructive",
        title: "Enter a valid email",
        description: "Use the email address connected to your purchase.",
      });
      return;
    }
    createResetRequest.mutate(
      { data: { email } },
      {
        onSuccess: (response) => {
          toast({ title: "Request sent", description: response.message });
          setResetEmail("");
          setResetRequestOpen(false);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Request not sent",
            description: "Please check your connection and try again.",
          });
        },
      },
    );
  }

  async function handleContinue() {
    if (!bondedLearner || !deviceId || isResuming) return;
    setIsResuming(true);
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          activationcode: bondedLearner.activationCode,
          deviceid: deviceId,
          userid: String(bondedLearner.userId),
        },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as
          | { error?: string; message?: string }
          | null;
        if (response.status === 403 && error?.error === "access_paused") {
          toast({
            variant: "destructive",
            title: "Access unavailable",
            description: error.message || "You no longer have access to this app.",
          });
          setIsResuming(false);
          return;
        }
        throw new Error("Bonded session could not be verified");
      }
      const learner = await response.json() as { waiverSigned?: boolean };
      await resumeSession();
      setLocation(learner.waiverSigned ? "/training" : "/waiver");
    } catch {
      toast({
        variant: "destructive",
        title: "Could not continue",
        description: "Please check your connection and try again. Your bonded learner account is still saved on this device.",
      });
      setIsResuming(false);
    }
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      fullName: "",
      email: "",
    },
  });

  function handleNewPurchase() {
    if (!bondedLearner) return;
    form.reset({
      code: "",
      fullName: bondedLearner.fullName,
      email: bondedLearner.email,
    });
    setActivatingNewPurchase(true);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!deviceId) return;
    const normalizedCode = normalizePurchaseCode(values.code);
    
    activateCode.mutate(
      {
        data: {
          code: normalizedCode,
          deviceId: deviceId,
          fullName: values.fullName,
          email: values.email,
        },
      },
      {
        onSuccess: async (res) => {
          try {
            await setSession({
              activationCode: normalizedCode,
              fullName: values.fullName,
              email: values.email,
              userId: res.userId,
              enrollmentId: res.enrollmentId ?? null,
            });
          } catch {
            toast({
              variant: "destructive",
              title: "Secure session could not be saved",
              description: "Your licence was accepted, but this device could not save your session. Please contact support before trying the code again.",
            });
            return;
          }
          
          if (res.waiverRequired) {
            setLocation("/waiver");
          } else {
            setLocation("/training");
          }
        },
        onError: (err) => {
          const status = (err as any)?.status;
          const data = (err as any)?.data as
            | { message?: string; error?: string }
            | undefined;
          toast({
            variant: "destructive",
            title: "Activation Failed",
            description:
              data?.message ||
              data?.error ||
              (err instanceof Error && err.message
                ? err.message.replace(/^Request failed(?: \(\d+\))?:\s*/i, "")
                : "") ||
              (status === 409
                ? "This code is already linked to another device. Go to the Admin Panel to reset it."
                : "Activation could not be completed. Please try again."),
          });
        },
      }
    );
  }

  // Don't render the form while a session is being restored — prevents a
  // one-frame flash of the activation screen before the redirect fires.
  if (activationCode) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center overflow-y-auto px-3 py-4 sm:min-h-screen sm:p-4">
      <div className="w-full max-w-md">
        <div className="mb-3 text-center sm:mb-4">
          <div className="flex items-center justify-center gap-1.5 mb-1 sm:gap-2">
            <img
              src={`${import.meta.env.BASE_URL}logo.png?v=4`}
              alt="Chainsaw Courses"
              className="h-10 w-auto object-contain sm:h-14"
            />
            <h1 className="text-lg font-black tracking-tighter text-primary uppercase leading-none sm:text-xl">
              Chainsaw Courses
            </h1>
          </div>
          <p className="uppercase tracking-widest text-[10px] mt-1 text-muted-foreground font-bold leading-tight text-center sm:text-xs">
            Chainsaw Maintenance &amp; Cross Cutting
          </p>
        </div>
        
        <Card className="border-border bg-card/80 backdrop-blur-sm">
          {bondedLearner && !activatingNewPurchase ? (
            <>
              <CardHeader className="space-y-1 text-center border-b border-border p-4 pb-3 sm:p-6 sm:pb-4">
                <CardTitle className="text-lg font-mono uppercase tracking-wide sm:text-xl">Welcome Back</CardTitle>
                <CardDescription className="font-mono text-xs">
                  This learner account is bonded to this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <p className="mb-4 text-center text-sm font-semibold text-foreground sm:mb-6">
                  {bondedLearner.fullName}
                </p>
                <Button
                  type="button"
                  className="h-12 w-full font-mono text-sm font-bold tracking-widest sm:h-14"
                  disabled={isResuming}
                  onClick={handleContinue}
                >
                  {isResuming ? "CHECKING ACCESS..." : `CONTINUE AS ${bondedLearner.fullName.toUpperCase()}`}
                </Button>
                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    New course
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full font-mono text-xs font-bold uppercase tracking-widest sm:h-12"
                  disabled={isResuming}
                  onClick={handleNewPurchase}
                >
                  {appleNative ? "Sign in as a different learner" : "Activate a new purchase"}
                </Button>
                <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                  {appleNative
                    ? "Verify another learner's email to move their course to this device."
                    : "Start a new refresher course while keeping your previous training and certificates."}
                </p>
              </CardContent>
            </>
          ) : appleNative ? (
            <>
              <CardHeader className="space-y-1 text-center border-b border-border p-4 pb-3 sm:p-6 sm:pb-4">
                <CardTitle className="text-lg font-mono uppercase tracking-wide sm:text-xl">Course Access</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Buy the course in the app, or sign in if you are an existing customer.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <AppleAccess hasBondedLearner={!!bondedLearner} />
                {bondedLearner && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3 w-full font-mono text-xs font-bold uppercase tracking-widest"
                    onClick={() => setActivatingNewPurchase(false)}
                    data-testid="button-back-bonded"
                  >
                    Back to {bondedLearner.fullName}
                  </Button>
                )}
              </CardContent>
            </>
          ) : (
            <>
          <CardHeader className="space-y-1 text-center border-b border-border p-4 mb-3 pb-3 sm:p-6 sm:mb-4 sm:pb-4">
            <CardTitle className="text-lg font-mono uppercase tracking-wide sm:text-xl">
              {activatingNewPurchase ? "Activate New Purchase" : "System Activation"}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {activatingNewPurchase
                ? "Enter the new purchase code for your next refresher course."
                : "Enter your access credentials to unlock the training modules."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Purchase Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. CHT-XYZ-123" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                           className="font-mono bg-secondary/50 border-input h-10 sm:h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Full Legal Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
                          {...field} 
                           className="bg-secondary/50 border-input h-10 sm:h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="john@example.com" 
                          type="email"
                          {...field} 
                           className="bg-secondary/50 border-input h-10 sm:h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                   className="w-full h-12 font-mono font-bold tracking-widest text-sm sm:h-14"
                  disabled={activateCode.isPending}
                >
                  {activateCode.isPending ? "ACTIVATING..." : "ACTIVATE"}
                </Button>
                {activatingNewPurchase && bondedLearner && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full font-mono text-xs font-bold uppercase tracking-widest"
                    disabled={activateCode.isPending}
                    onClick={() => setActivatingNewPurchase(false)}
                  >
                    Back to {bondedLearner.fullName}
                  </Button>
                )}
              </form>
            </Form>
             {!activatingNewPurchase && (
               <div className="mt-5 border-t border-border pt-4">
                 {!resetRequestOpen ? (
                   <Button
                     type="button"
                     variant="ghost"
                     className="w-full font-mono text-xs font-bold uppercase tracking-widest"
                     onClick={() => setResetRequestOpen(true)}
                   >
                     Need a replacement code?
                   </Button>
                 ) : (
                   <div className="space-y-3">
                     <div>
                       <label htmlFor="reset-email" className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                         Purchase email
                       </label>
                       <Input
                         id="reset-email"
                         type="email"
                         autoComplete="email"
                         value={resetEmail}
                         onChange={(event) => setResetEmail(event.target.value)}
                         placeholder="john@example.com"
                         className="mt-2 h-11 bg-secondary/50"
                       />
                     </div>
                     <p className="text-xs leading-relaxed text-muted-foreground">
                       Send us a request and we will email you a new code after checking your purchase.
                     </p>
                     <div className="grid grid-cols-2 gap-2">
                       <Button
                         type="button"
                         variant="outline"
                         disabled={createResetRequest.isPending}
                         onClick={() => setResetRequestOpen(false)}
                       >
                         Cancel
                       </Button>
                       <Button
                         type="button"
                         disabled={createResetRequest.isPending}
                         onClick={handleResetRequest}
                       >
                         {createResetRequest.isPending ? "Sending…" : "Send request"}
                       </Button>
                     </div>
                   </div>
                 )}
               </div>
             )}
          </CardContent>
            </>
          )}
        </Card>
        
        <div className="mt-5 shrink-0 text-center text-xs text-muted-foreground font-mono sm:mt-8">
          <p className="break-all opacity-50">DEVICE ID: {deviceId || "INITIALISING..."}</p>
          <p className="mt-1 opacity-50">AUTHORISATION REQUIRED</p>
          <Link href="/admin" className="mt-4 inline-block text-primary hover:underline opacity-70 hover:opacity-100 transition-opacity">
            → Admin Panel
          </Link>
          <img
            src={`${import.meta.env.BASE_URL}iirsm-horizontal-logo-transparent.png?v=1`}
            alt="IIRSM Approved Course"
            className="mx-auto mt-5 h-auto w-36 max-w-full object-contain opacity-90 sm:w-44"
          />
        </div>
      </div>
    </div>
  );
}
