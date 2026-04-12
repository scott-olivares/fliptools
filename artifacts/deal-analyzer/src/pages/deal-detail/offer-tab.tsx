import { useState, useEffect, useRef } from "react";
import {
  useGetOfferAnalysis,
  useSaveOfferAnalysis,
  useUpdateDeal,
} from "@workspace/api-client-react";
import type { DealDetail } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SignalBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Save,
  AlertTriangle,
  Info,
  CheckCircle,
} from "lucide-react";

function FieldInfo({ tip }: { tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex items-center cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Info className="w-3.5 h-3.5 shrink-0" />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[220px] text-xs leading-relaxed"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

type NumField = number | "";

const n = (v: NumField): number => (v === "" ? 0 : v);

const parseField = (raw: string): NumField =>
  raw === "" ? "" : parseFloat(raw) || 0;

function formatSaveDate(date: string | Date): string {
  const d = new Date(date);
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

export default function OfferTab({ deal }: { deal: DealDetail }) {
  const queryClient = useQueryClient();
  const { data: serverAnalysis, isLoading } = useGetOfferAnalysis(deal.id);
  const saveMutation = useSaveOfferAnalysis();
  const updateDeal = useUpdateDeal();

  // Current deal ARV — always use this, never the stale saved value
  const currentArv = deal.arvOverride || deal.arvEstimate || 0;

  // Track whether we've initialized to prevent re-running effect on every render
  const hasInitialized = useRef(false);
  const lastServerAnalysisId = useRef<number | null>(null);

  const [arv, setArv] = useState<NumField>(currentArv);
  const [rehab, setRehab] = useState<NumField>(0);
  const [closing, setClosing] = useState<NumField>(0);
  const [holding, setHolding] = useState<NumField>(0);
  const [selling, setSelling] = useState<NumField>(0);
  const [other, setOther] = useState<NumField>(0);
  const [profit, setProfit] = useState<NumField>(0);
  const [targetReturn, setTargetReturn] = useState<NumField>(9);
  const [purchasePrice, setPurchasePrice] = useState<NumField>("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showStaleArvWarning, setShowStaleArvWarning] = useState(false);

  useEffect(() => {
    // Only run initialization once when serverAnalysis first loads or changes ID
    const analysisChanged = serverAnalysis?.id !== lastServerAnalysisId.current;
    if (!hasInitialized.current || analysisChanged) {
      // Always initialize ARV from the current deal — never from the saved analysis
      setArv(currentArv);

      if (serverAnalysis) {
        // Restore cost inputs from saved analysis
        setRehab(serverAnalysis.rehabCost);
        setClosing(serverAnalysis.closingCosts);
        setHolding(serverAnalysis.holdingCosts);
        setSelling(serverAnalysis.sellingCosts);
        setOther(serverAnalysis.otherCosts);
        setProfit(serverAnalysis.desiredProfitAmount);
        setTargetReturn(serverAnalysis.targetReturnPct);
        setPurchasePrice(serverAnalysis.purchasePrice ?? "");
        setLastSavedAt(serverAnalysis.updatedAt);
        lastServerAnalysisId.current = serverAnalysis.id;

        // Warn if the ARV has changed significantly since last save
        const savedArv = serverAnalysis.arv;
        const diff = Math.abs(currentArv - savedArv);
        setShowStaleArvWarning(diff > 1000);
      } else if (!hasInitialized.current) {
        // No saved analysis — pre-fill sensible defaults from current ARV (only on first load)
        const baseArv = currentArv;
        setClosing(Math.round(baseArv * 0.02));
        setSelling(Math.round(baseArv * 0.06));
        setProfit(Math.round(baseArv * 0.09));
        setShowStaleArvWarning(false);
      }

      hasInitialized.current = true;
    }

    // Update ARV and stale warning if deal ARV changes (but don't reset all fields)
    if (hasInitialized.current && !analysisChanged) {
      setArv(currentArv);
      if (serverAnalysis) {
        const savedArv = serverAnalysis.arv;
        const diff = Math.abs(currentArv - savedArv);
        setShowStaleArvWarning(diff > 1000);
      }
    }
  }, [serverAnalysis, currentArv]);

  const totalCosts = n(rehab) + n(closing) + n(holding) + n(selling) + n(other);
  const maxOffer = n(arv) - totalCosts - n(profit);
  const gapToAsking = deal.askingPrice - maxOffer;

  const actualPurchase = purchasePrice !== "" ? n(purchasePrice) : maxOffer;
  const projectedProfitAmount = n(arv) - actualPurchase - totalCosts;
  const projectedReturnPct =
    actualPurchase > 0 ? (projectedProfitAmount / actualPurchase) * 100 : 0;

  const isFarApart = maxOffer < deal.askingPrice - 100000;

  const derivedSignal =
    projectedReturnPct >= 15
      ? "strong_candidate"
      : projectedReturnPct >= n(targetReturn)
        ? "close_review_manually"
        : "likely_pass";

  const handleSave = () => {
    saveMutation.mutate(
      {
        id: deal.id,
        data: {
          arv: n(arv),
          rehabCost: n(rehab),
          closingCosts: n(closing),
          holdingCosts: n(holding),
          sellingCosts: n(selling),
          otherCosts: n(other),
          desiredProfitAmount: n(profit),
          targetReturnPct: n(targetReturn),
          purchasePrice: purchasePrice !== "" ? n(purchasePrice) : null,
        },
      },
      {
        onSuccess: (data) => {
          updateDeal.mutate({
            id: deal.id,
            data: { maxOffer, projectedReturn: projectedReturnPct },
          });
          setLastSavedAt(data.updatedAt);
          setShowStaleArvWarning(false);
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${deal.id}/offer`],
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${deal.id}`],
          });
          queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
        },
      },
    );
  };

  if (isLoading)
    return (
      <div className="p-8 text-center animate-pulse">Loading calculator...</div>
    );

  const hasSavedAnalysis = !!serverAnalysis;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5 text-primary" /> Calculator Inputs
          </CardTitle>
          {/* Provenance label */}
          <p className="text-xs text-muted-foreground mt-1">
            {hasSavedAnalysis
              ? `Loaded from saved analysis · Last saved ${lastSavedAt ? formatSaveDate(lastSavedAt) : "—"}`
              : "Pre-filled from ARV estimate — not yet saved"}
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  After Repair Value
                </Label>
                <FieldInfo tip="Estimated market value once fully renovated. Pulled from the ARV Engine — adjust there first, or type directly here." />
              </div>
              <CurrencyInput
                value={arv}
                onChange={setArv}
                className="text-lg font-semibold border-primary/20 bg-primary/5"
              />
              {showStaleArvWarning && serverAnalysis && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  ARV updated since last save (
                  {formatCurrency(serverAnalysis.arv)} →{" "}
                  {formatCurrency(currentArv)})
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Rehab Budget
                </Label>
                <FieldInfo tip="Total cost to renovate the property to sellable condition — materials, labor, permits, everything." />
              </div>
              <CurrencyInput value={rehab} onChange={setRehab} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Closing Costs (Buy)
                </Label>
                <FieldInfo tip="Costs at purchase close: title, escrow, lender fees, recording. Typically 1–3% of purchase price." />
              </div>
              <CurrencyInput value={closing} onChange={setClosing} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Holding Costs
                </Label>
                <FieldInfo tip="Ongoing costs while you own it: loan interest, taxes, insurance, utilities. Multiply monthly cost by expected hold time." />
              </div>
              <CurrencyInput value={holding} onChange={setHolding} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Selling Costs
                </Label>
                <FieldInfo tip="Costs to sell the finished property: agent commissions, seller-paid closing, staging. Typically 6–8% of ARV." />
              </div>
              <CurrencyInput value={selling} onChange={setSelling} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Other / Contingency
                </Label>
                <FieldInfo tip="Buffer for surprises — permit overruns, hidden damage, scope creep. 5–10% of rehab budget is a common rule of thumb." />
              </div>
              <CurrencyInput value={other} onChange={setOther} />
            </div>
          </div>

          <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Target Margins</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Desired Profit ($)</Label>
                  <FieldInfo tip="Minimum dollar profit you need from this deal. Subtracted directly from ARV to set your max offer ceiling." />
                </div>
                <CurrencyInput value={profit} onChange={setProfit} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Target Return (%)</Label>
                  <FieldInfo tip="Minimum ROI you'll accept. Affects the signal badge only — it does not change your max offer number." />
                </div>
                <Input
                  type="number"
                  value={targetReturn}
                  onChange={(e) => setTargetReturn(parseField(e.target.value))}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-4">
              <h4 className="font-semibold text-sm text-primary">
                Scenario Testing
              </h4>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Override Purchase Price</Label>
                  <FieldInfo tip="Test what your ROI looks like if you pay a different price — e.g. what if they counter at $350k? Leave blank to use Max Offer." />
                </div>
                <CurrencyInput
                  value={purchasePrice}
                  placeholder={
                    maxOffer > 0
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(maxOffer)
                      : "$0"
                  }
                  onChange={setPurchasePrice}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave blank to use Max Offer.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-primary shadow-md overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-primary flex items-center gap-1.5">
              Maximum Allowable Offer
              <FieldInfo tip="The most you can pay and still hit your profit target. Formula: ARV − Rehab − Closing − Holding − Selling − Other − Desired Profit." />
            </CardDescription>
            <CardTitle className="text-5xl font-display tracking-tighter pt-2">
              {formatCurrency(maxOffer)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 mt-4 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-muted-foreground">Asking Price</span>
                <span className="font-mono">
                  {formatCurrency(deal.askingPrice)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-muted-foreground">Gap to Asking</span>
                <span className="font-mono font-medium text-destructive">
                  {formatCurrency(gapToAsking)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 font-semibold text-primary bg-primary/5 px-2 -mx-2 rounded">
                <span>Projected ROI</span>
                <span className="font-mono text-lg">
                  {formatPercent(projectedReturnPct)}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <SignalBadge signal={derivedSignal} />
            </div>

            {isFarApart && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Your MAO is more than $100k below asking. Significant
                  negotiation required.
                </p>
              </div>
            )}

            {/* Save button — lives inside the summary card */}
            <div className="mt-6 border-t pt-4">
              <Button
                size="lg"
                className="w-full shadow-lg"
                onClick={handleSave}
                isLoading={saveMutation.isPending || updateDeal.isPending}
              >
                {saveMutation.isPending ? (
                  <>Saving...</>
                ) : lastSavedAt ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" /> Update Analysis
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Save Offer Strategy
                  </>
                )}
              </Button>
              {lastSavedAt && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Last saved {formatSaveDate(lastSavedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
