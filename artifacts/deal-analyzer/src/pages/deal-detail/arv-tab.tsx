import { useState } from "react";
import { useUpdateDeal } from "@workspace/api-client-react";
import type { DealDetail, ARVResult } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Info,
  Scale,
  Tag,
  Eye,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ArvTab({
  deal,
  arv,
  onJumpToOffer,
}: {
  deal: DealDetail;
  arv: ARVResult | undefined;
  onJumpToOffer: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateDeal = useUpdateDeal();

  const [overrideValue, setOverrideValue] = useState<number | "">(
    deal.arvOverride || "",
  );

  const handleSaveOverride = () => {
    const val = overrideValue !== "" ? overrideValue : null;
    updateDeal.mutate(
      {
        id: deal.id,
        data: { arvOverride: val },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/deals/${deal.id}`],
          });
          toast({
            title: val ? "ARV Override Applied" : "ARV Override Removed",
          });
        },
      },
    );
  };

  if (!arv)
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Calculating weighted ARV...
      </div>
    );

  const displayArv = deal.arvOverride || arv.suggestedArv;
  const isOverridden = !!deal.arvOverride;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Result & Actions */}
      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl">
          <CardContent className="pt-6">
            <p className="text-slate-300 font-medium tracking-wide uppercase text-xs mb-2 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              {isOverridden ? "Manual ARV" : "System ARV Estimate"}
            </p>
            <h2 className="text-4xl font-display font-bold mb-4 tracking-tight">
              {formatCurrency(displayArv)}
            </h2>

            {!isOverridden && (
              <div className="flex items-center gap-2 mb-4 bg-white/10 px-3 py-2 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-slate-100">
                  Confidence:{" "}
                  <strong className="text-white capitalize">
                    {arv.confidenceLevel}
                  </strong>
                </span>
              </div>
            )}

            <p className="text-sm text-slate-300 leading-relaxed">
              {arv.confidenceExplanation}
            </p>

            <Button
              className="w-full mt-6 bg-white text-slate-900 hover:bg-slate-100"
              onClick={onJumpToOffer}
            >
              Calculate Offer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual Override</CardTitle>
            <CardDescription>
              Discard the calculation and use your own number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Override ARV Amount</Label>
              <div className="flex gap-2">
                <CurrencyInput
                  value={overrideValue}
                  onChange={setOverrideValue}
                  placeholder={formatCurrency(arv.suggestedArv)}
                />
                <Button
                  variant="secondary"
                  onClick={handleSaveOverride}
                  isLoading={updateDeal.isPending}
                >
                  Apply
                </Button>
              </div>
            </div>
            {isOverridden && (
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => {
                  setOverrideValue("");
                  updateDeal.mutate({
                    id: deal.id,
                    data: { arvOverride: null },
                  });
                }}
              >
                Clear Override
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Transparency */}
      <div className="lg:col-span-2 space-y-6">
        {arv.marketSignal && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Market Warning</h4>
              <p className="text-sm">{arv.marketSignal}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Calculation Methodology</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-6 bg-slate-50 p-4 rounded-lg border">
              {arv.methodology}
            </p>

            <h4 className="font-semibold text-sm mb-3">
              Contributing Sold Comps
            </h4>
            <div className="border rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm data-dense-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {arv.contributingComps.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-4 text-muted-foreground"
                      >
                        No valid sold comps found.
                      </td>
                    </tr>
                  )}
                  {arv.contributingComps.map((c) => (
                    <tr key={c.compId}>
                      <td className="font-medium">{c.address}</td>
                      <td className="text-right font-mono">
                        {formatCurrency(c.salePrice)}
                      </td>
                      <td className="text-right font-mono">
                        {formatPercent(c.weight * 100)}
                      </td>
                      <td className="text-right font-mono font-medium text-primary">
                        {formatCurrency(c.adjustedContribution)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="font-semibold text-sm mb-3">
              Active Competition (Remodeled)
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm data-dense-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th className="text-right">List Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {arv.marketComps.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center py-4 text-muted-foreground"
                      >
                        No direct active competition.
                      </td>
                    </tr>
                  )}
                  {arv.marketComps.map((c) => (
                    <tr key={c.compId}>
                      <td className="font-medium">{c.address}</td>
                      <td className="text-right font-mono">
                        {formatCurrency(c.listPrice)}
                      </td>
                      <td>
                        <Badge variant="outline">{c.listingStatus}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How This Works */}
      <div className="lg:col-span-3 border-t pt-6 mt-2">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-slate-700">
            How ARV Analysis Works
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">
                Condition × Status Weighting
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Each comp is weighted by how reliable it is as a price signal. A
              remodeled, sold comp carries full weight (1.0×). A remodeled
              pending is 0.85×. Active listings are discounted heavily (0.30×)
              since they haven't closed. Average-condition comps start at 0.35×,
              and unknown condition at 0.20×.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">
                Relevance Multiplier
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The High / Normal / Low flag you set on each comp in the Comps
              Review tab multiplies its base weight further — High adds 20%
              (1.2×), Normal keeps it unchanged (1.0×), and Low cuts it by 40%
              (0.6×). Use this to promote your best comps and suppress outliers
              without excluding them entirely.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">
                Transparent Breakdown
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              The Contributing Comps table shows exactly which sold comps are
              driving the number — including each comp's weight and dollar
              contribution. Active remodeled listings appear separately as
              market context (competition), not as price inputs, since they
              haven't cleared the market yet.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Pencil className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">
                Manual Override & Offer Flow
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If your judgment differs from the model — local knowledge,
              unreported condition issues, a hot pocket — enter your own ARV in
              the override field and it replaces the calculated value
              everywhere. When you're satisfied with the ARV, click "Calculate
              Offer" to carry it into the Offer Calculator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
