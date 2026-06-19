import { Switch, Route, Router as WouterRouter } from "wouter";
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
import MockTest from "@/pages/MockTest";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import StudentDetail from "@/pages/admin/StudentDetail";

// Ensure tailwind generates the dark class by adding it to html
if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Student Routes */}
      <Route path="/" component={Activation} />
      <Route path="/waiver" component={Waiver} />
      <Route path="/training" component={TrainingList} />
      <Route path="/training/:moduleId" component={TrainingModule} />
      <Route path="/quiz/:moduleId" component={Quiz} />
      <Route path="/mock-test" component={MockTest} />

      {/* Admin Routes */}
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/students/:id" component={StudentDetail} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <AdminProvider>
          <TooltipProvider>
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
