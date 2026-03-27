import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DealStatusBadge, SignalBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Search, Plus, ExternalLink, Activity, Database, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListDeals, useSeedData } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  
  const { data: deals, isLoading, error } = useListDeals();
  const seedMutation = useSeedData({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      }
    }
  });

  const filteredDeals = deals?.filter(deal => 
    deal.address.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <Layout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Deal Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage and evaluate your real estate acquisitions.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Input 
            icon={<Search className="w-4 h-4" />} 
            placeholder="Search addresses..." 
            className="w-full md:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Link href="/deals/new" className="shrink-0">
            <Button className="whitespace-nowrap gap-2 w-full md:w-auto px-5">
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse data-dense-table">
            <thead>
              <tr>
                <th>Address</th>
                <th className="text-right">Asking Price</th>
                <th className="text-right">ARV Est.</th>
                <th className="text-right">Max Offer</th>
                <th className="text-right">Proj. ROI</th>
                <th>Status</th>
                <th>Signal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary/50" />
                    Loading pipeline...
                  </td>
                </tr>
              )}
              
              {!isLoading && filteredDeals.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Database className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-1">No deals found</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {searchTerm ? "Try adjusting your search query." : "Your pipeline is empty. Add a new deal or load sample data to see the analyzer in action."}
                      </p>
                      {!searchTerm && (
                        <div className="flex gap-3">
                          <Button 
                            variant="outline" 
                            onClick={() => seedMutation.mutate()}
                            isLoading={seedMutation.isPending}
                          >
                            Load Sample Data
                          </Button>
                          <Link href="/deals/new">
                            <Button>Create Deal</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {filteredDeals.map((deal) => (
                <tr key={deal.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="font-medium text-slate-900 truncate max-w-[250px]" title={deal.address}>
                    <Link href={`/deals/${deal.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                      {deal.address}
                    </Link>
                  </td>
                  <td className="text-right font-mono text-slate-600">{formatCurrency(deal.askingPrice)}</td>
                  <td className="text-right font-mono font-medium text-slate-900">
                    {formatCurrency(deal.arvOverride || deal.arvEstimate)}
                  </td>
                  <td className="text-right font-mono font-bold text-primary">
                    {formatCurrency(deal.maxOffer)}
                  </td>
                  <td className="text-right font-mono">
                    <span className={cn(
                      "font-semibold",
                      (deal.projectedReturn || 0) >= 15 ? "text-success" : 
                      (deal.projectedReturn || 0) > 8 ? "text-warning" : "text-slate-600"
                    )}>
                      {formatPercent(deal.projectedReturn)}
                    </span>
                  </td>
                  <td><DealStatusBadge status={deal.status} /></td>
                  <td>
                    {/* Fake signal logic if missing from list endpoint, ideally backend adds this to list */}
                    <SignalBadge signal={(deal.projectedReturn || 0) >= 15 ? 'strong_candidate' : (deal.projectedReturn || 0) >= 9 ? 'close_review_manually' : 'likely_pass'} />
                  </td>
                  <td className="text-right pr-4">
                    <Link href={`/deals/${deal.id}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 text-xs">
                        Analyze <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Layout>
  );
}
