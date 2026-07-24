import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "./contexts/UserContext";
import { AdminProvider } from "./contexts/AdminContext";


import NotFound from "@/pages/not-found";
import Activation from "@/pages/Activation";
import Waiver from "@/pages/Waiver";
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
import Glossary from "@/pages/Glossary";
import Resources from "@/pages/Resources";
import ManualFlipbook from "@/pages/ManualFlipbook";

import SpeciesGuide from "@/pages/SpeciesGuide";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
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
import AdminGateway from "@/pages/admin/AdminGateway";
import PolicyDocs from "@/pages/admin/PolicyDocs";
import AdminStats from "@/pages/admin/AdminStats";
import CertificateRegister from "@/pages/admin/CertificateRegister";
import ExamLog from "@/pages/admin/ExamLog";
import AssessmentBank from "@/pages/admin/AssessmentBank";
import IQALog from "@/pages/admin/IQALog";
import ReasonableAdjustments from "@/pages/admin/ReasonableAdjustments";
import MalpracticeLog from "@/pages/admin/MalpracticeLog";
import QrLanding from "@/pages/QrLanding";
import ExamPreview from "@/pages/ExamPreview";
import AdminPreviewLogin from "@/pages/AdminPreviewLogin";
import AccessExpired from "@/pages/AccessExpired";
import Install from "@/pages/Install";
import InstallPrompt from "@/components/InstallPrompt";
import { useEffect } from "react";
import { useUserSession } from "./contexts/UserContext";

// Light theme — ensure dark class is removed
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
}

// Checks access status on load and redirects if expired.
// Only active when the user is logged in.
function GlobalAccessCheck() {
  const { activationCode, deviceId, userId, setAccessInfo } = useUserSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!activationCode || !deviceId) return;
    const headers: Record<string, string> = {
      "activationCode": activationCode,
      "deviceId": deviceId,
      "Content-Type": "application/json",
    };
    if (userId) headers["userid"] = String(userId);

    fetch("/api/auth/me", { headers })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const status: "active" | "expired" | "unknown" =
          data.accessStatus === "expired" ? "expired" : "active";
        setAccessInfo({
          accessExpiresAt: data.accessExpiresAt ?? null,
          courseCompletedAt: data.courseCompletedAt ?? null,
          accessStatus: status,
        });
        if (status === "expired") {
          navigate("/expired");
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activationCode]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function PageFade({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  return (
    <div key={path} className="page-fade-in">
      {children}
    </div>
  );
}

function Router() {
  return (
    <PageFade>
    <Switch>
      {/* Student Routes */}
      <Route path="/install" component={Install} />
      <Route path="/" component={Activation} />
      <Route path="/waiver" component={Waiver} />
      <Route path="/training" component={TrainingList} />
      <Route path="/training/:moduleId" component={TrainingModule} />
      <Route path="/quiz/:moduleId" component={Quiz} />
      <Route path="/exam" component={Exam} />
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
      <Route path="/manual" component={ManualFlipbook} />
      <Route path="/qr/:moduleId" component={QrLanding} />
      <Route path="/gateway" component={PracticalGateway} />
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
      <Route path="/admin/inspections" component={Inspections} />
      <Route path="/admin/risk-assessments" component={RiskAssessments} />
      <Route path="/admin/news" component={AdminNews} />
      <Route path="/admin/qr-codes" component={AdminQrCodes} />
      <Route path="/admin/welcome-note" component={WelcomeNoteSettings} />
      <Route path="/admin/gateway" component={AdminGateway} />
      <Route path="/admin/policy-docs" component={PolicyDocs} />
      <Route path="/admin/stats" component={AdminStats} />
      <Route path="/admin/certificates" component={CertificateRegister} />
      <Route path="/admin/exam-log" component={ExamLog} />
      <Route path="/admin/assessment-bank" component={AssessmentBank} />
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
    <QueryClientProvider client={queryClient}>
      <UserProvider>
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
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <GlobalAccessCheck />
              <Router />
            </WouterRouter>
            <InstallPrompt />
            <Toaster />
          </TooltipProvider>
        </AdminProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
