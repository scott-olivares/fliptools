import { useGetDealComps, useUpdateDealComp } from "@workspace/api-client-react";
import type { DealDetail, DealComp } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, AlertCircle, Home } from "lucide-react";

function ConditionBadge({ condition }: { condition: string }) {
  if (condition === 'remodeled') return <Badge variant="success">Remodeled</Badge>;
  if (condition === 'average') return <Badge variant="warning">Average</Badge>;
  return <Badge variant="secondary">Unknown</Badge>;
}

export default function CompsTab({ deal }: { deal: DealDetail }) {
  const queryClient = useQueryClient();
  const { data: compsList, isLoading } = useGetDealComps(deal.id);
  const updateComp = useUpdateDealComp();

  const toggleInclude = (comp: DealComp) => {
    updateComp.mutate({
      id: deal.id,
      compId: comp.compId,
      data: { included: !comp.included }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/comps`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/arv`] });
      }
    });
  };

  const changeRelevance = (comp: DealComp, val: "high"|"normal"|"low") => {
    updateComp.mutate({
      id: deal.id,
      compId: comp.compId,
      data: { relevance: val }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/comps`] });
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/arv`] });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading comps...</div>;

  return (
    <div className="space-y-6">
      {deal.dataSource === 'mock' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
          <div>
            <p className="font-semibold text-sm">Provider Notice: Sample Data</p>
            <p className="text-sm opacity-90">These comps are generated for demonstration. In a production build, this would integrate with an MLS data provider via API.</p>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left data-dense-table">
            <thead>
              <tr>
                <th className="w-12 text-center">Use</th>
                <th>Address</th>
                <th className="text-right">Price</th>
                <th className="text-right">$/SqFt</th>
                <th className="text-right">SqFt</th>
                <th className="text-right">Beds/Baths</th>
                <th className="text-right">Distance</th>
                <th>Status</th>
                <th>Condition</th>
                <th>Weighting</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject property row — always pinned at top */}
              {(() => {
                const subjectPpsqft = deal.askingPrice && deal.sqft ? deal.askingPrice / deal.sqft : null;
                return (
                  <tr className="bg-blue-50 border-b-2 border-blue-200">
                    <td className="text-center">
                      <Home className="w-4 h-4 text-blue-600 mx-auto" />
                    </td>
                    <td className="max-w-[200px]" title={deal.address}>
                      <div className="font-semibold text-blue-900 truncate">{deal.address}</div>
                      <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mt-0.5">Subject Property</div>
                    </td>
                    <td className="text-right font-mono font-semibold text-blue-900">
                      {formatCurrency(deal.askingPrice)}
                      <div className="text-xs text-blue-500 font-normal">asking</div>
                    </td>
                    <td className="text-right font-mono text-blue-700">{formatCurrency(subjectPpsqft)}</td>
                    <td className="text-right font-mono text-blue-900">{formatNumber(deal.sqft)}</td>
                    <td className="text-right font-mono text-blue-900">{deal.beds ?? '—'}/{deal.baths ?? '—'}</td>
                    <td className="text-right font-mono text-blue-500">0.00mi</td>
                    <td><Badge variant="primary">Subject</Badge></td>
                    <td><span className="text-xs text-blue-400">—</span></td>
                    <td><span className="text-xs text-blue-400">—</span></td>
                  </tr>
                );
              })()}

              {compsList?.map((dc) => {
                const c = dc.comp;
                const ppsqft = c.salePrice && c.sqft ? c.salePrice / c.sqft : null;
                
                return (
                  <tr key={dc.id} className={!dc.included ? "bg-slate-50 opacity-60" : ""}>
                    <td className="text-center cursor-pointer" onClick={() => toggleInclude(dc)}>
                      {dc.included ? 
                        <CheckCircle2 className="w-5 h-5 text-primary mx-auto" /> : 
                        <Circle className="w-5 h-5 text-slate-300 mx-auto" />
                      }
                    </td>
                    <td className="font-medium max-w-[200px] truncate" title={c.address}>{c.address}</td>
                    <td className="text-right font-mono font-semibold">
                      {formatCurrency(c.salePrice || c.listPrice)}
                    </td>
                    <td className="text-right font-mono text-muted-foreground">{formatCurrency(ppsqft)}</td>
                    <td className="text-right font-mono">{formatNumber(c.sqft)}</td>
                    <td className="text-right font-mono">{c.beds}/{c.baths}</td>
                    <td className="text-right font-mono">{c.distanceMiles?.toFixed(2)}mi</td>
                    <td>
                      <Badge variant={c.listingStatus === 'sold' ? 'secondary' : c.listingStatus === 'active' ? 'outline' : 'warning'}>
                        {c.listingStatus}
                      </Badge>
                    </td>
                    <td><ConditionBadge condition={c.condition} /></td>
                    <td>
                      <select 
                        className="text-xs bg-transparent border border-slate-200 rounded px-2 py-1 outline-none focus:border-primary disabled:opacity-50"
                        value={dc.relevance}
                        onChange={(e) => changeRelevance(dc, e.target.value as any)}
                        disabled={!dc.included}
                      >
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
