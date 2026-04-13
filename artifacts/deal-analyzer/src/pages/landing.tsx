import { SignIn } from "@clerk/clerk-react";
import { useState } from "react";
import { Building, Zap, Mail, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  disableSignIn?: boolean;
}

export default function LandingPage({ disableSignIn = false }: Props) {
  const [showSignIn, setShowSignIn] = useState(false);

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
          onClick={() => setShowSignIn(true)}
          disabled={disableSignIn}
          variant="outline"
          size="sm"
        >
          Sign in
        </Button>
      </header>

      {/* Sign-in modal overlay */}
      {showSignIn && !disableSignIn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSignIn(false);
          }}
        >
          <SignIn routing="hash" />
        </div>
      )}

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
          onClick={() => setShowSignIn(true)}
          disabled={disableSignIn}
          size="lg"
          className="text-base px-8"
        >
          Sign in to get started
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
