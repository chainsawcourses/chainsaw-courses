import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetModule, getGetModuleQueryKey } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, ExternalLink } from "lucide-react";

export default function QrLanding() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [, setLocation] = useLocation();
  const { activationCode, deviceId } = useUserSession();

  const id = parseInt(moduleId ?? "", 10);
  const isAuthenticated = !!activationCode && !!deviceId;

  const { data: module, isLoading, isError } = useGetModule(id, {
    query: { queryKey: getGetModuleQueryKey(id), enabled: isAuthenticated && !isNaN(id) },
  });

  // If authenticated and module is unlocked, redirect straight to the training page
  useEffect(() => {
    if (module && !module.isLocked) {
      setLocation(`/training/${id}`);
    }
  }, [module, id, setLocation]);

  // ── Not activated ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 pt-16 text-center">
        <div className="max-w-md w-full space-y-8">
          {/* Logo area */}
          <div className="space-y-3">
            <img
              src="/logo.png?v=4"
              alt="Chainsaw Courses"
              className="h-20 w-auto object-contain mx-auto"
            />
            <h1 className="text-2xl font-black font-mono tracking-tight uppercase">
              Chainsaw Courses
            </h1>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              This video is part of the IIRSM-approved chainsaw safety certification course.
            </p>
          </div>

          {/* CTA card */}
          <div className="border border-border rounded-lg bg-card/60 p-6 space-y-4">
            <p className="text-sm font-mono text-foreground">
              Get the full interactive learning experience here
            </p>
            <a
              href="https://www.chainsawcourses.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 w-full justify-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              www.chainsawcourses.com
            </a>
          </div>

          {/* Already purchased? */}
          <div className="text-xs text-muted-foreground font-mono space-y-1">
            <p>Already purchased the course?</p>
            <button
              onClick={() => setLocation("/")}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              Activate your access code here
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Shared header for all authenticated states ────────────────────────────
  const AuthHeader = () => (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="flex items-center justify-center gap-2 mb-1">
        <img
          src="/logo.png?v=4"
          alt="Chainsaw Courses"
          className="h-14 w-auto object-contain"
        />
        <h1 className="text-xl font-black tracking-tighter text-primary uppercase leading-none">
          Chainsaw Courses
        </h1>
      </div>
      <p className="uppercase tracking-widest text-xs mt-1 text-muted-foreground font-bold">
        Chainsaw Maintenance &amp; Cross Cutting
      </p>
    </div>
  );

  // ── Authenticated: loading ─────────────────────────────────────────────────
  if (isLoading || (!module && !isError)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 pt-16">
        <AuthHeader />
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Authenticated: module not found ───────────────────────────────────────
  if (isError || !module) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 pt-16 text-center">
        <AuthHeader />
        <div className="max-w-md w-full space-y-4">
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
            Module not found
          </p>
          <Button onClick={() => setLocation("/training")} className="font-mono text-xs uppercase tracking-widest">
            Go to my training
          </Button>
        </div>
      </div>
    );
  }

  // ── Authenticated: module unlocked (brief redirect flash) ─────────────────
  if (!module.isLocked) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 pt-16">
        <AuthHeader />
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Authenticated: module is locked ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 pt-16 text-center">
      <AuthHeader />
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/60 border border-border">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-black font-mono uppercase tracking-tight">
            {module.title}
          </h2>
          <p className="text-muted-foreground font-mono text-sm leading-relaxed">
            Module not accessible yet. Please complete the previous modules in order to unlock this video.
          </p>
        </div>

        <div className="border border-border rounded-lg bg-card/60 p-6 space-y-3">
          <Button
            onClick={() => setLocation("/training")}
            className="w-full font-mono font-bold uppercase tracking-widest"
          >
            Go to my training dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
