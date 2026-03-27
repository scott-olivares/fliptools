import { useState, useEffect } from "react";
import { useGetOfferAnalysis, useSaveOfferAnalysis, useUpdateDeal } from "@workspace/api-client-react";
import type { DealDetail } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignalBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type NumField = number | "";

const n = (v: NumField): number => v === "" ? 0 : v;

const parseField = (raw: string): NumField =>
  raw === "" ? "" : (parseFloat(raw) || 0);

export default function OfferTab({ deal }: { deal: DealDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: serverAnalysis, isLoading } = useGetOfferAnalysis(deal.id);
  const saveMutation = useSaveOfferAnalysis();
  const updateDeal = useUpdateDeal();

  const [arv, setArv] = useState<NumField>(deal.arvOverride || deal.arvEstimate || 0);
  const [rehab, setRehab] = useState<NumField>(0);
  const [closing, setClosing] = useState<NumField>(0);
  const [holding, setHolding] = useState<NumField>(0);
  const [selling, setSelling] = useState<NumField>(0);
  const [other, setOther] = useState<NumField>(0);
  const [profit, setProfit] = useState<NumField>(0);
  const [targetReturn, setTargetReturn] = useState<NumField>(9);
  const [purchasePrice, setPurchasePrice] = useState<NumField>("");

  useEffect(() => {
    if (serverAnalysis) {
      setArv(serverAnalysis.arv);
      setRehab(serverAnalysis.rehabCost);
      setClosing(serverAnalysis.closingCosts);
      setHolding(serverAnalysis.holdingCosts);
      setSelling(serverAnalysis.sellingCosts);
      setOther(serverAnalysis.otherCosts);
      setProfit(serverAnalysis.desiredProfitAmount);
      setTargetReturn(serverAnalysis.targetReturnPct);
      setPurchasePrice(serverAnalysis.purchasePrice ?? "");
    } else if (deal.arvOverride || deal.arvEstimate) {
      const baseArv = deal.arvOverride || deal.arvEstimate || 0;
      setArv(baseArv);
      setClosing(Math.round(baseArv * 0.02));
      setSelling(Math.round(baseArv * 0.06));
      setProfit(Math.round(baseArv * 0.09));
    }
  }, [serverAnalysis, deal.arvOverride, deal.arvEstimate]);

  const totalCosts = n(rehab) + n(closing) + n(holding) + n(selling) + n(other);
  const maxOffer = n(arv) - totalCosts - n(profit);
  const gapToAsking = deal.askingPrice - maxOffer;

  const actualPurchase = purchasePrice !== "" ? n(purchasePrice) : maxOffer;
  const projectedProfitAmount = n(arv) - actualPurchase - totalCosts;
  const projectedReturnPct = actualPurchase > 0 ? (projectedProfitAmount / actualPurchase) * 100 : 0;

  const isFarApart = maxOffer < (deal.askingPrice - 100000);

  const derivedSignal = projectedReturnPct >= 15 ? 'strong_candidate' :
                        projectedReturnPct >= n(targetReturn) ? 'close_review_manually' : 'likely_pass';

  const handleSave = () => {
    saveMutation.mutate({
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
      }
    }, {
      onSuccess: () => {
        updateDeal.mutate({
          id: deal.id,
          data: { maxOffer, projectedReturn: projectedReturnPct }
        });
        toast({ title: "Offer analysis saved successfully" });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/offer`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading calculator...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <Card className="lg:col-span-2 shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5 text-primary" /> Calculator Inputs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">After Repair Value</Label>
              <Input type="number" value={arv} onChange={e => setArv(parseField(e.target.value))} className="font-mono text-lg font-semibold border-primary/20 bg-primary/5" />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Rehab Budget</Label>
              <Input type="number" value={rehab} onChange={e => setRehab(parseField(e.target.value))} className="font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Closing Costs (Buy)</Label>
              <Input type="number" value={closing} onChange={e => setClosing(parseField(e.target.value))} className="font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Holding Costs</Label>
              <Input type="number" value={holding} onChange={e => setHolding(parseField(e.target.value))} className="font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Selling Costs</Label>
              <Input type="number" value={selling} onChange={e => setSelling(parseField(e.target.value))} className="font-mono" />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Other / Contingency</Label>
              <Input type="number" value={other} onChange={e => setOther(parseField(e.target.value))} className="font-mono" />
            </div>
          </div>

          <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Target Margins</h4>
              <div className="space-y-1">
                <Label>Desired Profit ($)</Label>
                <Input type="number" value={profit} onChange={e => setProfit(parseField(e.target.value))} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Target Return (%)</Label>
                <Input type="number" value={targetReturn} onChange={e => setTargetReturn(parseField(e.target.value))} className="font-mono" />
              </div>
            </div>

            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-4">
              <h4 className="font-semibold text-sm text-primary">Scenario Testing</h4>
              <div className="space-y-1">
                <Label>Override Purchase Price</Label>
                <Input
                  type="number"
                  value={purchasePrice}
                  placeholder={maxOffer.toFixed(0)}
                  onChange={e => setPurchasePrice(parseField(e.target.value))}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to use Max Offer.</p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-primary shadow-md overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
          <CardHeader className="pb-2">
            <CardDescription className="uppercase tracking-wider font-semibold text-primary">Maximum Allowable Offer</CardDescription>
            <CardTitle className="text-5xl font-display tracking-tighter pt-2">
              {formatCurrency(maxOffer)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 mt-4 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-muted-foreground">Asking Price</span>
                <span className="font-mono">{formatCurrency(deal.askingPrice)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span className="text-muted-foreground">Gap to Asking</span>
                <span className="font-mono font-medium text-destructive">{formatCurrency(gapToAsking)}</span>
              </div>
              <div className="flex justify-between items-center py-1 font-semibold text-primary bg-primary/5 px-2 -mx-2 rounded">
                <span>Projected ROI</span>
                <span className="font-mono text-lg">{formatPercent(projectedReturnPct)}</span>
              </div>
            </div>

            <div className="mt-6">
              <SignalBadge signal={derivedSignal} />
            </div>

            {isFarApart && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Your MAO is more than $100k below asking. Significant negotiation required.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full shadow-lg"
          onClick={handleSave}
          isLoading={saveMutation.isPending || updateDeal.isPending}
        >
          <Save className="w-4 h-4 mr-2" /> Save Offer Strategy
        </Button>
      </div>

    </div>
  );
}
