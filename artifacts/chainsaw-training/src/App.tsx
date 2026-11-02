import React, { useEffect, useMemo, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "./contexts/UserContext";
import { AdminProvider } from "./contexts/AdminContext";


import NotFound from "@/pages/not-found";
import ShareTarget from "@/pages/ShareTarget";
import Activation from "@/pages/Activation";
import Waiver from "@/pages/Waiver";
import SignedWaiver from "@/pages/SignedWaiver";
import TrainingList from "@/pages/TrainingList";
import TrainingModule from "@/pages/TrainingModule";
import Quiz from "@/pages/Quiz";
import Exam from "@/pages/Exam";
import MockTest from "@/pages/MockTest";
import Inspection from "@/pages/Inspection";
import RiskAssessment from "@/pages/RiskAssessment";
import BiosecurityMap from "@/pages/BiosecurityMap";
import ChainChart from "@/pages/ChainChart";
import News from "@/pages/News";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import LegalDocs from "@/pages/LegalDocs";
import CrossCutSim from "@/pages/CrossCutSim";
import StudentFeedback from "@/pages/StudentFeedback";
import HazardsReference from "@/pages/HazardsReference";
import Glossary from "@/pages/Glossary";
import Resources from "@/pages/Resources";
import ManualFlipbook from "@/pages/ManualFlipbook";

import SpeciesGuide from "@/pages/SpeciesGuide";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import WebsitePurchaseReviewPage from "@/pages/admin/WebsitePurchaseReviewPage";
import StudentDetail from "@/pages/admin/StudentDetail";
import VideoSettings from "@/pages/admin/VideoSettings";
import PdfSettings from "@/pages/admin/PdfSettings";
import Feedback from "@/pages/admin/Feedback";
import Inspections from "@/pages/admin/Inspections";
import RiskAssessments from "@/pages/admin/RiskAssessments";
import AdminNews from "@/pages/admin/News";
import AdminQrCodes from "@/pages/admin/QrCodes";
import WelcomeNoteSettings from "@/pages/admin/WelcomeNote";
import PracticalGateway from "@/pages/PracticalGateway";
import Retailers from "@/pages/Retailers";
import AdminGateway from "@/pages/admin/AdminGateway";
import AdminRetailers from "@/pages/admin/AdminRetailers";
import PolicyDocs from "@/pages/admin/PolicyDocs";
import AdminStats from "@/pages/admin/AdminStats";
import CertificateRegister from "@/pages/admin/CertificateRegister";
import ExamLog from "@/pages/admin/ExamLog";
import AssessmentBank from "@/pages/admin/AssessmentBank";
import ModuleQuizzes from "@/pages/admin/ModuleQuizzes";
import IQALog from "@/pages/admin/IQALog";
import ReasonableAdjustments from "@/pages/admin/ReasonableAdjustments";
import MalpracticeLog from "@/pages/admin/MalpracticeLog";
import QrLanding from "@/pages/QrLanding";
import ExamPreview from "@/pages/ExamPreview";
import CertificatePage from "@/pages/Certificate";
import MockQuestionsAdmin from "@/pages/admin/MockQuestions";
import AdminPreviewLogin from "@/pages/AdminPreviewLogin";
import AccessExpired from "@/pages/AccessExpired";
import Install from "@/pages/Install";
import DownloadApp from "@/pages/DownloadApp";
import InstallPrompt from "@/components/InstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getAppBasePath } from "./lib/routing";
import { useUserSession } from "./contexts/UserContext";
import { IS_DEMO } from "./lib/demo";
import { courseRouteGateDecision, millisecondsUntilAccessExpiry, resolveAccessStatus } from "./lib/accessPolicy";

// Light theme — ensure dark class is removed
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
}

// Checks access status on load and redirects if expired.
// Only active when the user is logged in (skipped entirely in demo mode).
function GlobalAccessCheck() {
  const { activationCode, deviceId, userId, setAccessInfo, clearRejectedSession } = useUserSession();

  useEffect(() => {
    if (IS_DEMO) return;
    if (!activationCode || !deviceId) return;
    const controller = new AbortController();
    let currentLearner = true;
    let latestRequest = 0;
    const headers: Record<string, string> = {
      "activationCode": activationCode,
      "deviceId": deviceId,
      "Content-Type": "application/json",
    };
    if (userId) headers["userid"] = String(userId);

    const refreshAccess = () => {
      const requestNumber = ++latestRequest;
      return fetch("/api/auth/me", { headers, signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          // The server no longer recognises this learner (for example, after
          // an administrator permanently deleted the account). Clear only the
          // rejected learner identity, retain the device ID, and return to
          // activation instead of leaving a broken session that requires an
          // uninstall.
          if (currentLearner && requestNumber === latestRequest) {
            await clearRejectedSession();
            window.location.replace(import.meta.env.BASE_URL);
          }
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        // Do not let an earlier learner's response update the newly activated
        // learner after an account switch.
        if (!data || !currentLearner || requestNumber !== latestRequest) return;
          const status = resolveAccessStatus(
            data.accessStatus === "expired" ? "expired" : "active",
            data.accessExpiresAt ?? null,
          );
        setAccessInfo({
          accessExpiresAt: data.accessExpiresAt ?? null,
          courseCompletedAt: data.courseCompletedAt ?? null,
          accessStatus: status,
          allModulesUnlocked: data.allModulesUnlocked ?? false,
          assignedTo: data.assignedTo ?? null,
          enrollmentId: data.enrollmentId ?? null,
          subscription: data.subscription ?? undefined,
        });
        // Expiry stops course delivery, not a learner's certificate, waiver,
        // or other historical records.
        // Apply reasonable adjustments to the document root for this user
        const adjustments: string[] = data.activeAdjustments ?? [];
        const html = document.documentElement;
        if (adjustments.some(a => a === "Large Print")) {
          html.setAttribute("data-large-print", "true");
        } else {
          html.removeAttribute("data-large-print");
        }
        if (adjustments.some(a => a === "Screen Reader")) {
          html.setAttribute("data-screen-reader", "true");
        } else {
          html.removeAttribute("data-screen-reader");
        }
      })
      .catch(() => {});
    };
    void refreshAccess();
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") void refreshAccess();
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("chainsaw:purchase-updated", refreshOnReturn);
    return () => {
      currentLearner = false;
      controller.abort();
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("chainsaw:purchase-updated", refreshOnReturn);
    };
  // setAccessInfo is intentionally omitted: its identity is captured for this
  // request and adding it would refetch after every access state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activationCode, deviceId, userId]);

  return null;
}

// This synchronous gate covers an installed app launched without a network
// request. Certificate and other historical routes intentionally remain open.
function ProtectedCourseGate({ children }: { children: React.ReactNode }) {
  const { accessExpiresAt, accessStatus } = useUserSession();
  const [path] = useLocation();
  const [tick, setTick] = useState(0);
  const access = { accessExpiresAt, accessStatus };
  // Always evaluate against this render's clock. The tick is only a render
  // trigger; it must not become a timestamp that survives an entitlement or
  // account change.
  const decision = IS_DEMO ? "allow" : courseRouteGateDecision(path, access, Date.now());

  useEffect(() => {
    const recheck = () => setTick((tick) => tick + 1);
    // Read the clock when scheduling as effects may run after the render which
    // received a newly extended entitlement.
    const delay = millisecondsUntilAccessExpiry(access, Date.now());
    // A zero delay means the previous scheduled callback has reached expiry;
    // the in-place expired state is already rendered, so do not schedule a loop.
    const timer = delay === null || delay === 0 ? undefined : window.setTimeout(recheck, delay);
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [accessExpiresAt, accessStatus, tick]);

  // Persisted expiry denies offline content in place. Keeping the requested URL
  // allows a later fresh active /auth/me response (for example an extension)
  // to reveal that original route without requiring relaunch or reactivation.
  if (decision === "expired") return <AccessExpired />;
  if (decision === "hold") return null;
  return <>{children}</>;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry up to 2x on network errors but never on auth (401/403) errors
        retry: (failureCount, error) => {
          if (failureCount >= 2) return false;
          const msg = error instanceof Error ? error.message : "";
          if (msg.includes("401") || msg.includes("403")) return false;
          return true;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
        refetchOnWindowFocus: false,
        staleTime: 30_000, // 30s — prevents redundant re-fetches on tab switch
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// React Query caches are not identity-scoped. Atomically swapping the provider
// means a new learner's first render cannot observe the previous learner's data.
function UserScopedQueryProvider({ children }: { children: React.ReactNode }) {
  const { activationCode, userId } = useUserSession();
  const identity = `${activationCode ?? ""}:${userId ?? ""}`;
  const queryClient = useMemo(createQueryClient, [identity]);

  return <QueryClientProvider key={identity} client={queryClient}>{children}</QueryClientProvider>;
}

function PageFade({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  return (
    <div key={path} className="page-fade-in">
      {children}
    </div>
  );
}

// Android 15+ displays target-SDK 35+ apps edge-to-edge. Capacitor's hosted
// WebView does not consistently expose a CSS safe-area inset, so identify it
// once and let the shared stylesheet reserve room for the system status bar.
function AndroidWebViewInsets() {
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isAndroidWebView =
      /Android/i.test(userAgent) &&
      (/\bwv\b/i.test(userAgent) || /Version\/4\.0/i.test(userAgent) || /Capacitor/i.test(userAgent));

    if (isAndroidWebView) {
      document.documentElement.setAttribute("data-android-webview", "true");
    }

    return () => document.documentElement.removeAttribute("data-android-webview");
  }, []);

  return null;
}

// Returns true when the app is running as an installed app (no browser chrome)
function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  return false;
}

// Returns true when we're in the Replit dev environment or localhost
function isDevEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.includes(".replit.dev") || h.includes(".repl.co");
}

// Returns true if the user has already activated (code stored in localStorage or cookie)
function hasActivationCode(): boolean {
  try {
    if (localStorage.getItem("activationCode")) return true;
    // Cookie fallback (Safari clears localStorage after ~7 days inactivity)
    const match = document.cookie.match(/(?:^|;\s*)activationCode=([^;]+)/);
    return !!match?.[1];
  } catch {
    return false;
  }
}

// Gate: browser visitors see the download page unless they are admin, already
// activated, on a public route, in dev, installed as a PWA, or in demo mode.
function AppGate({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  const isAdmin = path.startsWith("/admin") || path === "/admin-preview";
  const isPublic = path === "/" || path === "/privacy" || path === "/legal";
  if (!isAdmin && !isPublic && !isDevEnvironment() && !isInstalledApp() && !IS_DEMO && !hasActivationCode()) {
    return <DownloadApp />;
  }
  return <>{children}</>;
}

// In demo mode, redirect the root activation page straight to training
function DemoRootRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/training"); }, [navigate]);
  return null;
}

function Router() {
  return (
    <PageFade>
    <Switch>
      {/* Student Routes */}
      <Route path="/share" component={ShareTarget} />
      <Route path="/install" component={Install} />
      {IS_DEMO
        ? <Route path="/" component={DemoRootRedirect} />
        : <Route path="/" component={Activation} />
      }
      <Route path="/waiver" component={Waiver} />
      <Route path="/signed-waiver" component={SignedWaiver} />
      <Route path="/training" component={TrainingList} />
      <Route path="/training/:moduleId" component={TrainingModule} />
      <Route path="/quiz/:moduleId" component={Quiz} />
      <Route path="/exam" component={Exam} />
      <Route path="/certificate" component={CertificatePage} />
      <Route path="/mock-test" component={MockTest} />
      <Route path="/inspection" component={Inspection} />
      <Route path="/risk-assessment" component={RiskAssessment} />
      <Route path="/biosecurity-map" component={BiosecurityMap} />
      <Route path="/chain-chart" component={ChainChart} />
      <Route path="/news" component={News} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/legal" component={LegalDocs} />
      <Route path="/cross-cut-sim" component={CrossCutSim} />
      <Route path="/species-guide" component={SpeciesGuide} />
      <Route path="/glossary" component={Glossary} />
      <Route path="/resources" component={Resources} />
      <Route path="/feedback" component={StudentFeedback} />
      <Route path="/hazards-reference" component={HazardsReference} />
      <Route path="/manual" component={ManualFlipbook} />
      <Route path="/qr/:moduleId" component={QrLanding} />
      <Route path="/gateway" component={PracticalGateway} />
      <Route path="/retailers" component={Retailers} />
      <Route path="/expired" component={AccessExpired} />

      <Route path="/exam-preview" component={ExamPreview} />
      <Route path="/admin-preview" component={AdminPreviewLogin} />

      {/* Admin Routes */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/students/:id" component={StudentDetail} />
      <Route path="/admin/videos" component={VideoSettings} />
      <Route path="/admin/pdfs" component={PdfSettings} />
      <Route path="/admin/feedback" component={Feedback} />
      <Route path="/admin/website-purchase-review" component={WebsitePurchaseReviewPage} />
      <Route path="/admin/inspections" component={Inspections} />
      <Route path="/admin/risk-assessments" component={RiskAssessments} />
      <Route path="/admin/news" component={AdminNews} />
      <Route path="/admin/qr-codes" component={AdminQrCodes} />
      <Route path="/admin/welcome-note" component={WelcomeNoteSettings} />
      <Route path="/admin/gateway" component={AdminGateway} />
      <Route path="/admin/retailers" component={AdminRetailers} />
      <Route path="/admin/policy-docs" component={PolicyDocs} />
      <Route path="/admin/stats" component={AdminStats} />
      <Route path="/admin/certificates" component={CertificateRegister} />
      <Route path="/admin/exam-log" component={ExamLog} />
      <Route path="/admin/assessment-bank" component={AssessmentBank} />
      <Route path="/admin/module-quizzes" component={ModuleQuizzes} />
      <Route path="/admin/mock-questions" component={MockQuestionsAdmin} />
      <Route path="/admin/iqa" component={IQALog} />
      <Route path="/admin/reasonable-adjustments" component={ReasonableAdjustments} />
      <Route path="/admin/malpractice" component={MalpracticeLog} />

      <Route component={NotFound} />
    </Switch>
    </PageFade>
  );
}

function App() {
  return (
    <ErrorBoundary>
    <UserProvider>
      <UserScopedQueryProvider>
        <AdminProvider>
          <TooltipProvider>
            {/* Background image + white wash, behind all content */}
            <div style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
              <img
                src={`${import.meta.env.BASE_URL}bg.jpg`}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.88)" }} />
            </div>
            <WouterRouter base={getAppBasePath()}>
              <AppGate>
                <AndroidWebViewInsets />
                <GlobalAccessCheck />
                <ProtectedCourseGate><Router /></ProtectedCourseGate>
              </AppGate>
            </WouterRouter>
            <InstallPrompt />
            <Toaster />
          </TooltipProvider>
        </AdminProvider>
      </UserScopedQueryProvider>
    </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
