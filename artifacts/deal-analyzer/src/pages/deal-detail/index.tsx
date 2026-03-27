import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useGetDeal } from "@workspace/api-client-react";
import { DealStatusBadge } from "@/components/status-badge";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Home, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Import tabs
import PropertyTab from "./property-tab";
import CompsTab from "./comps-tab";
import ArvTab from "./arv-tab";
import OfferTab from "./offer-tab";

const TABS = [
  { id: "property", label: "Property Info" },
  { id: "comps", label: "Comps Review" },
  { id: "arv", label: "ARV Engine" },
  { id: "offer", label: "Offer Calculator" },
];

export default function DealDetail() {
  const [, params] = useRoute("/deals/:id");
  const dealId = parseInt(params?.id || "0", 10);
  const [activeTab, setActiveTab] = useState("property");
  
  const { data: deal, isLoading, error } = useGetDeal(dealId);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (error || !deal) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-800">Deal not found</h2>
          <p className="mt-2 text-slate-600">The deal you are looking for does not exist.</p>
          <Link href="/" className="text-primary hover:underline mt-4 inline-block">Return to dashboard</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Pipeline
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <DealStatusBadge status={deal.status} />
              {deal.dataSource === 'mock' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-sm bg-blue-100 text-blue-700 uppercase tracking-wider">
                  Sample Data
                </span>
              )}
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-slate-400" />
              {deal.address}
            </h1>
          </div>
          
          <div className="flex gap-8 bg-white p-4 rounded-xl border shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Asking Price</p>
              <p className="text-xl font-mono font-bold text-slate-900">{formatCurrency(deal.askingPrice)}</p>
            </div>
            <div className="w-px bg-slate-200"></div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Current ARV Est.</p>
              <p className="text-xl font-mono font-bold text-primary">
                {formatCurrency(deal.arvOverride || deal.arvEstimate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Nav */}
      <div className="flex space-x-1 border-b mb-6 overflow-x-auto hide-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-all relative whitespace-nowrap",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pb-24">
        {activeTab === "property" && <PropertyTab deal={deal} />}
        {activeTab === "comps" && <CompsTab deal={deal} />}
        {activeTab === "arv" && <ArvTab deal={deal} onJumpToOffer={() => setActiveTab("offer")} />}
        {activeTab === "offer" && <OfferTab deal={deal} />}
      </div>
    </Layout>
  );
}
