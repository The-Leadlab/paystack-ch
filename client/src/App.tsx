import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeToggle from "./components/ThemeToggle";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { LanguageProvider } from "./cafe/context/LanguageContext";
import { AuthProvider } from "./cafe/context/AuthContext";
import Home from "./pages/Home";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import AdminSignInPage from "./pages/AdminSignInPage";
import OperatorGatePage from "./pages/OperatorGatePage";
import StartTrialPage from "./pages/StartTrialPage";
import AliGatePage from "./pages/AliGatePage";
import AliLabPage from "./pages/AliLabPage";
import { DashboardLoadingShell } from "./cafe/components/DashboardLoadingShell";
import { SeoHead } from "./components/SeoHead";

const PlatformPage = lazy(() => import("./pages/PlatformPage"));

/** Applies café dashboard colour tokens (.cafe-shell) from restored index.css */
function CafeShellRoute() {
  const { theme } = useTheme();
  return (
    <div
      className={`min-h-[100dvh] min-h-screen cafe-shell overscroll-y-contain ${theme === "dark" ? "cafe-theme-dark" : "cafe-theme-light"}`}
    >
      <Suspense fallback={<DashboardLoadingShell />}>
        <PlatformPage />
      </Suspense>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/sign-in"} component={SignInPage} />
      <Route path={"/sign-up"} component={SignUpPage} />
      <Route path={"/admin"} component={AdminSignInPage} />
      <Route path={"/operator"} component={OperatorGatePage} />
      <Route path={"/start-trial"} component={StartTrialPage} />
      <Route path={"/login"} component={SignInPage} />
      <Route path={"/signup"} component={SignUpPage} />
      <Route path={"/app"} component={CafeShellRoute} />
      <Route path={"/ali-gate"} component={AliGatePage} />
      <Route path={"/ali/:featureId"} component={AliLabPage} />
      <Route path={"/ali"} component={AliLabPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <SeoHead />
              <Toaster />
              <Router />
              <ThemeToggle />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
