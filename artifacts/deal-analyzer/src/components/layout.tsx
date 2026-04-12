import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Building,
  LayoutDashboard,
  Plus,
  Settings,
  ScanSearch,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetDigestPending,
  useDismissDigest,
  useSessionPing,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Digest banner ────────────────────────────────────────────────────────────
function DigestBanner() {
  const queryClient = useQueryClient();
  const { data } = useGetDigestPending({
    query: { refetchInterval: 60_000 } as any, // re-check every minute
  });
  const dismiss = useDismissDigest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/digest/pending"] });
      },
    },
  });

  if (!data?.hasPending) return null;

  const { totalScreened, worthALook, closeCall } = data;
  const actionable = worthALook + closeCall;

  const message =
    actionable > 0
      ? `${totalScreened} ${totalScreened === 1 ? "property" : "properties"} screened overnight — ${actionable} ${actionable === 1 ? "looks" : "look"} worth reviewing.`
      : `${totalScreened} ${totalScreened === 1 ? "property" : "properties"} screened overnight.`;

  return (
    <div className="bg-primary text-white px-4 py-2.5 flex items-center gap-3">
      <Sparkles className="w-4 h-4 flex-shrink-0 opacity-80" />
      <p className="text-sm flex-1">
        {message}{" "}
        {actionable > 0 && (
          <Link
            href="/screener"
            className="underline underline-offset-2 font-medium hover:opacity-80"
          >
            View in Screener →
          </Link>
        )}
      </p>
      <button
        onClick={() => dismiss.mutate()}
        className="opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const ping = useSessionPing();

  // Record that the user is active. Fires once on mount (page load / navigation).
  useEffect(() => {
    ping.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems = [
    { href: "/", label: "Pipeline", icon: LayoutDashboard },
    { href: "/screener", label: "Screener", icon: ScanSearch },
    { href: "/deals/new", label: "New Deal", icon: Plus },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md">
        {/* Digest banner sits above the nav bar */}
        <DigestBanner />

        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-primary font-display font-bold text-xl tracking-tight"
            >
              <div className="bg-primary text-white p-1.5 rounded-lg shadow-sm">
                <Building className="w-5 h-5" />
              </div>
              Deal Analyzer
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-4 border-l pl-6">
              {navItems.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
              <Settings className="w-4 h-4 text-slate-600" />
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              JD
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
