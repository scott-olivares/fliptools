import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  ClerkLoaded,
  ClerkLoading,
} from "@clerk/clerk-react";
import { useEffect } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import Dashboard from "@/pages/dashboard";
import NewDeal from "@/pages/new-deal";
import DealDetail from "@/pages/deal-detail/index";
import TriageDashboard from "@/pages/triage";
import LandingPage from "@/pages/landing";
import NotFound from "@/pages/not-found";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Wires Clerk's getToken into the API client so every request
// automatically gets an Authorization: Bearer <token> header.
function AuthTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/screener" component={TriageDashboard} />
      <Route path="/deals/new" component={NewDeal} />
      <Route path="/deals/:id" component={DealDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

// If Clerk key is missing entirely (e.g. misconfigured deploy),
// show the landing page rather than a blank screen or crash.
function AppContent() {
  if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY === "pk_test_placeholder") {
    return <LandingPage disableSignIn />;
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      {/* Show landing page while Clerk is initializing — no blank flash */}
      <ClerkLoading>
        <LandingPage disableSignIn />
      </ClerkLoading>

      <ClerkLoaded>
        <SignedOut>
          <LandingPage />
        </SignedOut>
        <SignedIn>
          <AuthTokenBridge />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </SignedIn>
      </ClerkLoaded>

      <Toaster />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
