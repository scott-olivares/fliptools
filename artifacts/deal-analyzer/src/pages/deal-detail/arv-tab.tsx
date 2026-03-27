import { useState } from "react";
import { useUpdateDeal } from "@workspace/api-client-react";
import type { DealDetail, ARVResult } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ArvTab({ deal, arv, onJumpToOffer }: { deal: DealDetail, arv: ARVResult | undefined, onJumpToOffer: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateDeal = useUpdateDeal();
  
  const [overrideValue, setOverrideValue] = useState(deal.arvOverride?.toString() || "");

  const handleSaveOverride = () => {
    const val = overrideValue ? parseFloat(overrideValue) : null;
    updateDeal.mutate({
      id: deal.id,
      data: { arvOverride: val }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
        toast({ title: val ? "ARV Override Applied" : "ARV Override Removed" });
      }
    });
  };

  if (!arv) return <div className="p-8 text-center text-muted-foreground animate-pulse">Calculating weighted ARV...</div>;

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
                  Confidence: <strong className="text-white capitalize">{arv.confidenceLevel}</strong>
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
            <CardDescription>Discard the calculation and use your own number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Override ARV Amount</Label>
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  value={overrideValue} 
                  onChange={e => setOverrideValue(e.target.value)} 
                  placeholder={arv.suggestedArv.toString()}
                />
                <Button variant="secondary" onClick={handleSaveOverride} isLoading={updateDeal.isPending}>
                  Apply
                </Button>
              </div>
            </div>
            {isOverridden && (
              <Button variant="ghost" className="w-full text-destructive" onClick={() => { setOverrideValue(""); updateDeal.mutate({ id: deal.id, data: { arvOverride: null } }) }}>
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

            <h4 className="font-semibold text-sm mb-3">Contributing Sold Comps</h4>
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
                    <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">No valid sold comps found.</td></tr>
                  )}
                  {arv.contributingComps.map(c => (
                    <tr key={c.compId}>
                      <td className="font-medium">{c.address}</td>
                      <td className="text-right font-mono">{formatCurrency(c.salePrice)}</td>
                      <td className="text-right font-mono">{formatPercent(c.weight * 100)}</td>
                      <td className="text-right font-mono font-medium text-primary">{formatCurrency(c.adjustedContribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="font-semibold text-sm mb-3">Active Competition (Remodeled)</h4>
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
                    <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">No direct active competition.</td></tr>
                  )}
                  {arv.marketComps.map(c => (
                    <tr key={c.compId}>
                      <td className="font-medium">{c.address}</td>
                      <td className="text-right font-mono">{formatCurrency(c.listPrice)}</td>
                      <td><Badge variant="outline">{c.listingStatus}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
