import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetDeal,
  useCalculateArv,
  useUpdateDeal,
  getCalculateArvQueryKey,
} from "@workspace/api-client-react";

import { formatCurrency, formatNumber } from "@/lib/utils";
import { ArrowLeft, MapPin, Loader2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

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

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "offer_submitted", label: "Offer Submitted" },
  { value: "passed", label: "Passed" },
  { value: "closed", label: "Closed" },
];

export default function DealDetail() {
  const [, params] = useRoute("/deals/:id");
  const dealId = parseInt(params?.id || "0", 10);
  const [activeTab, setActiveTab] = useState("property");
  const queryClient = useQueryClient();
  const updateDeal = useUpdateDeal();

  const { data: deal, isLoading, error } = useGetDeal(dealId);
  // Always keep the ARV query mounted so it refetches in the background
  // whenever comps are changed (comps tab invalidates this query key)
  const { data: arv } = useCalculateArv(dealId, {
    query: {
      enabled: !!dealId,
      queryKey: getCalculateArvQueryKey(dealId),
    },
  });

  function handleStatusChange(newStatus: string) {
    // Optimistically update the UI before the server responds
    const dealQueryKey = [`/api/deals/${dealId}`];
    const previousDeal = queryClient.getQueryData(dealQueryKey);

    // Optimistic update
    queryClient.setQueryData(dealQueryKey, (old: any) => {
      if (!old) return old;
      return { ...old, status: newStatus };
    });

    updateDeal.mutate(
      { id: dealId, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: dealQueryKey });
          queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
        },
        onError: () => {
          // Rollback on error
          queryClient.setQueryData(dealQueryKey, previousDeal);
        },
      },
    );
  }

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
          <p className="mt-2 text-slate-600">
            The deal you are looking for does not exist.
          </p>
          <Link
            href="/"
            className="text-primary hover:underline mt-4 inline-block"
          >
            Return to dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Print-only header with timestamp */}
      <div className="hidden print:block mb-6 pb-4 border-b">
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Deal Analysis Report
        </h2>
        <p className="text-sm text-slate-600">
          Generated: {new Date().toLocaleDateString()}{" "}
          {new Date().toLocaleTimeString()}
        </p>
      </div>

      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors print:hidden"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Pipeline
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <select
                value={deal.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updateDeal.isPending}
                className="text-xs font-semibold border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 print:hidden"
                aria-label="Deal status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {deal.dataSource === "mock" && (
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

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="print:hidden"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print / Export
            </Button>

            <div className="flex gap-8 bg-white p-4 rounded-xl border shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Asking Price
                </p>
                <p className="text-xl font-mono font-bold text-slate-900">
                  {formatCurrency(deal.askingPrice)}
                </p>
              </div>
              <div className="w-px bg-slate-200"></div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Current ARV Est.
                </p>
                <p className="text-xl font-mono font-bold text-primary">
                  {formatCurrency(
                    deal.arvOverride || arv?.suggestedArv || deal.arvEstimate,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-friendly summary - only visible when printing */}
      <div className="hidden print:block mb-6 no-page-break">
        <div className="bg-slate-50 p-4 rounded border">
          <h3 className="text-lg font-bold mb-4">Deal Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Status:</span>{" "}
              {deal.status || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Property Type:</span>{" "}
              {deal.propertyType || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Beds/Baths:</span> {deal.beds}/
              {deal.baths}
            </div>
            <div>
              <span className="font-semibold">Square Feet:</span>{" "}
              {formatNumber(deal.sqft)}
            </div>
            <div>
              <span className="font-semibold">Year Built:</span>{" "}
              {deal.yearBuilt || "N/A"}
            </div>
            <div>
              <span className="font-semibold">Lot Size:</span>{" "}
              {deal.lotSize ? `${deal.lotSize} acres` : "N/A"}
            </div>
            {arv && (
              <>
                <div className="col-span-2 border-t pt-4 mt-2">
                  <span className="font-semibold">ARV Confidence:</span>{" "}
                  {arv.confidenceLevel}
                </div>
                <div className="col-span-2">
                  <span className="font-semibold">Signal:</span>{" "}
                  {arv.marketSignal || "N/A"}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Nav — 2×2 grid on mobile, single row on md+ */}
      <div className="mb-6 print:hidden">
        <div className="grid grid-cols-2 gap-1 md:hidden bg-slate-100 p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-2.5 px-3 text-sm font-medium rounded-lg transition-all text-center",
                activeTab === tab.id
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-slate-900",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="hidden md:flex space-x-1 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-5 py-3 text-sm font-medium transition-all relative whitespace-nowrap",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-slate-900 hover:bg-slate-50",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - show all tabs when printing */}
      <div className="pb-24">
        <div
          className={activeTab === "property" ? "block" : "hidden print:block"}
        >
          <h2 className="hidden print:block text-lg font-bold mb-4 mt-8 page-break-before">
            Property Information
          </h2>
          <PropertyTab
            deal={deal}
            onCompsRefreshed={() => setActiveTab("comps")}
          />
        </div>
        <div className={activeTab === "comps" ? "block" : "hidden print:block"}>
          <h2 className="hidden print:block text-lg font-bold mb-4 mt-8 page-break-before">
            Comparable Properties
          </h2>
          <CompsTab deal={deal} />
        </div>
        <div className={activeTab === "arv" ? "block" : "hidden print:block"}>
          <h2 className="hidden print:block text-lg font-bold mb-4 mt-8 page-break-before">
            ARV Analysis
          </h2>
          <ArvTab
            deal={deal}
            arv={arv}
            onJumpToOffer={() => setActiveTab("offer")}
          />
        </div>
        <div className={activeTab === "offer" ? "block" : "hidden print:block"}>
          <h2 className="hidden print:block text-lg font-bold mb-4 mt-8 page-break-before">
            Offer Calculator
          </h2>
          <OfferTab deal={deal} />
        </div>
      </div>
    </Layout>
  );
}
