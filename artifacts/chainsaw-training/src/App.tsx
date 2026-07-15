import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "./contexts/UserContext";
import { AdminProvider } from "./contexts/AdminContext";
import WelcomeModal from "./components/WelcomeModal";

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
import CrossCutSim from "@/pages/CrossCutSim";

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
import QrLanding from "@/pages/QrLanding";

// Light theme — ensure dark class is removed
if (typeof document !== "undefined") {
  document.documentElement.classList.remove("dark");
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
      <Route path="/cross-cut-sim" component={CrossCutSim} />
      <Route path="/qr/:moduleId" component={QrLanding} />

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
            <WelcomeModal />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AdminProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
