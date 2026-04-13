import { useSignIn } from "@clerk/clerk-react";
import { Building, Zap, Mail, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  disableSignIn?: boolean;
}

export default function LandingPage({ disableSignIn = false }: Props) {
  const { signIn, isLoaded } = useSignIn();

  async function handleSignIn() {
    if (!isLoaded || disableSignIn) return;
    await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/",
    });
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="border-b px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-display font-bold text-xl tracking-tight">
          <div className="bg-primary text-white p-1.5 rounded-lg shadow-sm">
            <Building className="w-5 h-5" />
          </div>
          Deal Analyzer
        </div>
        <Button
          onClick={handleSignIn}
          disabled={!isLoaded || disableSignIn}
          variant="outline"
          size="sm"
        >
          Sign in
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto py-20">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3.5 h-3.5" />
          Built for real estate investors
        </div>

        <h1 className="text-5xl font-display font-bold text-slate-900 leading-tight mb-4">
          Screen deals faster.
          <br />
          <span className="text-primary">Close better ones.</span>
        </h1>

        <p className="text-lg text-slate-500 mb-10 max-w-lg">
          Forward a wholesaler email. Get ARV estimates, max offers, and deal
          signals automatically — no manual data entry required.
        </p>

        <Button
          onClick={handleSignIn}
          disabled={!isLoaded || disableSignIn}
          size="lg"
          className="gap-2 text-base px-8"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="text-xs text-slate-400 mt-4">
          Access by invitation only during beta.
        </p>
      </main>

      {/* Feature highlights */}
      <section className="border-t bg-slate-50 px-6 py-14">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-900">Email intake</h3>
            <p className="text-sm text-slate-500">
              Forward wholesaler emails. Addresses are extracted and analyzed
              automatically.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-900">Instant ARV</h3>
            <p className="text-sm text-slate-500">
              Comparable sales pulled automatically. ARV and max offer
              calculated in seconds.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-900">Deal signals</h3>
            <p className="text-sm text-slate-500">
              Every deal scored as Worth a Look, Close Call, or Too Far Apart —
              no spreadsheets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
