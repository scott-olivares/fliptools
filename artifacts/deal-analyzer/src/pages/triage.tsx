import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronDown,
  Mail,
  RefreshCw,
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  useGetTriageDeals,
  useGetTriageStats,
} from "@workspace/api-client-react";
import type { TriageDeal } from "@workspace/api-client-react";

const INTAKE_EMAIL = "fliptools.intake@gmail.com";

// ─── Gap badge ────────────────────────────────────────────────────────────────
// gap = askingPrice - maxOffer
// Negative = asking is BELOW max offer → great deal (green)
// Positive = asking is ABOVE max offer → gap to close (red)
function GapBadge({ gap }: { gap: number | null | undefined }) {
  if (gap == null) return <span className="text-slate-400 text-sm">—</span>;
  const isGood = gap <= 0;
  const label = `${isGood ? "-" : "+"}${formatCurrency(Math.abs(gap))}`;
  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold",
        isGood ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {label}
    </span>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: string | null | undefined }) {
  if (!level || level === "high") return null;
  return (
    <Badge
      variant={level === "low" ? "destructive" : "warning"}
      className="text-xs"
    >
      {level === "low" ? "Low conf." : "Med conf."}
    </Badge>
  );
}

// ─── Status pill for rows still processing ────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Loader2 className="w-3 h-3 animate-spin" />
        Queued
      </span>
    );
  if (status === "processing")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Loader2 className="w-3 h-3 animate-spin" />
        Analyzing...
      </span>
    );
  return null;
}

// ─── Single triage row ────────────────────────────────────────────────────────
function TriageRow({ deal, dim }: { deal: TriageDeal; dim?: boolean }) {
  const hasDeal = deal.hasDeal;
  const row = (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0",
        "hover:bg-slate-50/80 transition-colors group",
        dim && "opacity-50",
      )}
    >
      {/* Address */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-slate-900 truncate"
          title={deal.address}
        >
          {deal.address}
        </p>
        {deal.triageStatus !== "done" && (
          <StatusPill status={deal.triageStatus} />
        )}
        {deal.triageStatus === "failed" && deal.errorMessage && (
          <p className="text-xs text-rose-600 mt-0.5">{deal.errorMessage}</p>
        )}
      </div>

      {/* ARV */}
      <div className="w-24 text-right hidden sm:block">
        {deal.arvEstimate != null ? (
          <span className="font-mono text-sm text-slate-700">
            {formatCurrency(deal.arvEstimate)}
          </span>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        )}
      </div>

      {/* Gap to asking */}
      <div className="w-24 text-right hidden sm:block">
        <GapBadge gap={deal.gapToAsking} />
      </div>

      {/* Confidence */}
      <div className="w-20 text-right hidden md:block">
        <ConfidenceBadge level={deal.confidenceLevel} />
      </div>

      {/* Arrow */}
      <div className="w-6 flex justify-end">
        {hasDeal ? (
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
        ) : (
          <span className="w-4" />
        )}
      </div>
    </div>
  );

  if (!hasDeal) return row;
  return <Link href={`/deals/${deal.id}`}>{row}</Link>;
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function TriageSection({
  label,
  count,
  deals,
  defaultOpen = true,
  dimRows = false,
  accentClass,
  hint,
}: {
  label: string;
  count: number;
  deals: TriageDeal[];
  defaultOpen?: boolean;
  dimRows?: boolean;
  accentClass: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span
          className={cn("w-2 h-2 rounded-full flex-shrink-0", accentClass)}
        />
        <span className="font-semibold text-slate-800 text-sm flex-1">
          {label}
        </span>
        <span className="text-xs text-slate-500 font-mono mr-2">{count}</span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Column headers — only visible when expanded */}
      {open && (
        <>
          {hint && (
            <p className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
              {hint}
            </p>
          )}
          <div className="flex items-center gap-3 px-4 py-1.5 bg-slate-50 border-t border-slate-100">
            <div className="flex-1 text-xs text-slate-400 uppercase tracking-wide">
              Address
            </div>
            <div className="w-24 text-right text-xs text-slate-400 uppercase tracking-wide hidden sm:block">
              ARV Est.
            </div>
            <div className="w-24 text-right text-xs text-slate-400 uppercase tracking-wide hidden sm:block">
              Gap
            </div>
            <div className="w-20 text-right text-xs text-slate-400 uppercase tracking-wide hidden md:block">
              Confidence
            </div>
            <div className="w-6" />
          </div>
          <div className="bg-white divide-y divide-slate-100">
            {deals.map((d) => (
              <TriageRow key={d.id} deal={d} dim={dimRows} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(INTAKE_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-5">
        <Mail className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        No deals screened yet
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Forward a wholesaler email to get started. Addresses are extracted
        automatically and screened while you work.
      </p>
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-4 py-2.5 w-full max-w-xs">
        <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="font-mono text-sm text-slate-800 flex-1 text-left truncate">
          {INTAKE_EMAIL}
        </span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-primary transition-colors"
          title="Copy email address"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TriageDashboard() {
  // Full deal list: poll every 15s — heavier query, only needed when user is on this page
  const { data, isLoading, error, refetch, isFetching } = useGetTriageDeals({
    query: { refetchInterval: 15_000 } as any,
  });
  // Stats header: poll every 5s — cheap aggregate, drives the badge count
  const { data: stats } = useGetTriageStats({
    query: { refetchInterval: 5_000 } as any,
  });

  const totalDeals =
    (stats?.strong ?? 0) +
    (stats?.closeCall ?? 0) +
    (stats?.likelyPass ?? 0) +
    (stats?.analyzing ?? 0) +
    (stats?.failed ?? 0);

  const hasAnyDeals = totalDeals > 0;

  return (
    <Layout>
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">
            Deal Screener
          </h1>
          <p className="text-muted-foreground mt-1">
            {hasAnyDeals
              ? `${totalDeals} ${totalDeals === 1 ? "property" : "properties"} screened`
              : "Forward wholesaler emails to screen properties automatically"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Intake email copy pill */}
          <IntakeEmailPill />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-rose-600 text-sm mb-4 p-3 bg-rose-50 rounded-lg border border-rose-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load triage data. Check your connection and try refreshing.
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasAnyDeals && <EmptyState />}

      {/* Triage sections */}
      {!isLoading && data && (
        <>
          <TriageSection
            label="Worth a Look"
            count={data.strong.length}
            deals={data.strong}
            defaultOpen={true}
            accentClass="bg-emerald-500"
          />
          <TriageSection
            label="Close Call"
            count={data.closeCall.length}
            deals={data.closeCall}
            defaultOpen={true}
            accentClass="bg-amber-400"
          />
          <TriageSection
            label="Needs Asking Price"
            count={data.needsPrice.length}
            deals={data.needsPrice}
            defaultOpen={true}
            accentClass="bg-violet-400"
            hint="ARV calculated — add asking price to get a signal"
          />
          <TriageSection
            label="Too Far Apart"
            count={data.likelyPass.length}
            deals={data.likelyPass}
            defaultOpen={false}
            dimRows={true}
            accentClass="bg-slate-300"
          />
          <TriageSection
            label="Analyzing..."
            count={data.analyzing.length}
            deals={data.analyzing}
            defaultOpen={true}
            accentClass="bg-blue-400"
          />
          <TriageSection
            label="Could Not Analyze"
            count={data.failed.length}
            deals={data.failed}
            defaultOpen={false}
            accentClass="bg-rose-400"
          />
        </>
      )}
    </Layout>
  );
}

// ─── Inline intake email copy pill ───────────────────────────────────────────
function IntakeEmailPill() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(INTAKE_EMAIL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="hidden md:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors rounded-lg px-3 py-1.5 text-sm"
      title="Copy intake email address"
    >
      <Mail className="w-3.5 h-3.5 text-slate-500" />
      <span className="font-mono text-slate-700">{INTAKE_EMAIL}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate-400" />
      )}
    </button>
  );
}
