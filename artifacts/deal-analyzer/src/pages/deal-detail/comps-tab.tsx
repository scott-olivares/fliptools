import { useState, useMemo } from "react";
import {
  useGetDealComps,
  useUpdateDealComp,
  useAddCompToDeal,
} from "@workspace/api-client-react";
import type { DealDetail, DealComp } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Home,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Plus,
} from "lucide-react";

type SortKey = "address" | "ppsqft" | "beds" | "distance";
type SortDir = "asc" | "desc";

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (col !== sortKey)
    return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-1" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3 h-3 opacity-70 inline ml-1" />
  ) : (
    <ChevronDown className="w-3 h-3 opacity-70 inline ml-1" />
  );
}

export default function CompsTab({ deal }: { deal: DealDetail }) {
  const queryClient = useQueryClient();
  const { data: compsList, isLoading } = useGetDealComps(deal.id);
  const updateComp = useUpdateDealComp();
  const addComp = useAddCompToDeal();
  const { toast } = useToast();

  const [weightOpen, setWeightOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("distance");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [maxDistance, setMaxDistance] = useState(0.5);
  const [manualCompOpen, setManualCompOpen] = useState(false);
  const [manualCompForm, setManualCompForm] = useState<{
    address: string;
    salePrice: string;
    listPrice: string;
    sqft: string;
    lotSize: string;
    beds: string;
    baths: string;
    soldDate: string;
    listingStatus: "sold" | "pending" | "active";
    propertyType: string;
    condition: "remodeled" | "average" | "unknown";
    source: string;
  }>({
    address: "",
    salePrice: "",
    listPrice: "",
    sqft: "",
    lotSize: "",
    beds: "",
    baths: "",
    soldDate: "",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "average",
    source: "Manual Entry",
  });

  const compsQueryKey = [`/api/deals/${deal.id}/comps`];
  const arvQueryKey = [`/api/deals/${deal.id}/arv`];

  const optimisticUpdate = (
    compId: number,
    patch: Partial<DealComp & { comp: Partial<DealComp["comp"]> }>,
  ) => {
    queryClient.setQueryData(compsQueryKey, (old: DealComp[] | undefined) => {
      if (!old) return old;
      return old.map((dc) =>
        dc.compId === compId
          ? { ...dc, ...patch, comp: { ...dc.comp, ...(patch.comp ?? {}) } }
          : dc,
      );
    });
  };

  const rollback = () => {
    queryClient.invalidateQueries({ queryKey: compsQueryKey });
  };

  const invalidateArv = () => {
    queryClient.invalidateQueries({ queryKey: arvQueryKey });
  };

  const toggleInclude = (comp: DealComp) => {
    const newIncluded = !comp.included;
    optimisticUpdate(comp.compId, { included: newIncluded });
    updateComp.mutate(
      { id: deal.id, compId: comp.compId, data: { included: newIncluded } },
      { onSuccess: invalidateArv, onError: rollback },
    );
  };

  const changeRelevance = (comp: DealComp, val: "high" | "normal" | "low") => {
    optimisticUpdate(comp.compId, { relevance: val });
    updateComp.mutate(
      { id: deal.id, compId: comp.compId, data: { relevance: val } },
      { onSuccess: invalidateArv, onError: rollback },
    );
  };

  const changeCondition = (
    comp: DealComp,
    val: "remodeled" | "average" | "unknown",
  ) => {
    optimisticUpdate(comp.compId, { comp: { condition: val } as any });
    updateComp.mutate(
      { id: deal.id, compId: comp.compId, data: { condition: val } },
      { onSuccess: invalidateArv, onError: rollback },
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleManualCompSubmit = async () => {
    const newComp = {
      address: manualCompForm.address,
      salePrice: manualCompForm.salePrice
        ? parseFloat(manualCompForm.salePrice)
        : null,
      listPrice: manualCompForm.listPrice
        ? parseFloat(manualCompForm.listPrice)
        : null,
      sqft: manualCompForm.sqft ? parseInt(manualCompForm.sqft) : null,
      lotSize: manualCompForm.lotSize
        ? parseFloat(manualCompForm.lotSize)
        : null,
      beds: manualCompForm.beds ? parseFloat(manualCompForm.beds) : null,
      baths: manualCompForm.baths ? parseFloat(manualCompForm.baths) : null,
      soldDate: manualCompForm.soldDate || null,
      listingStatus: manualCompForm.listingStatus,
      propertyType: manualCompForm.propertyType,
      condition: manualCompForm.condition,
      source: manualCompForm.source.slice(0, 100), // Limit to 100 chars for security
      distanceMiles: null,
      latitude: null,
      longitude: null,
    };

    addComp.mutate(
      { id: deal.id, data: { newComp, included: true, relevance: "normal" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: compsQueryKey });
          queryClient.invalidateQueries({ queryKey: arvQueryKey });
          setManualCompOpen(false);
          setManualCompForm({
            address: "",
            salePrice: "",
            listPrice: "",
            sqft: "",
            lotSize: "",
            beds: "",
            baths: "",
            soldDate: "",
            listingStatus: "sold",
            propertyType: "SFR",
            condition: "average",
            source: "Manual Entry",
          });

          // Show user-friendly warning about manual comps
          toast({
            title: "Comp added successfully",
            description:
              "Note: We don't know how far away this property is from your subject property, so it won't be included in distance sorting.",
            variant: "default",
          });
        },
      },
    );
  };

  const allCompsCount = compsList?.length ?? 0;

  const sortedComps = useMemo(() => {
    if (!compsList) return [];
    return [...compsList]
      .filter((dc) => (dc.comp.distanceMiles ?? 0) <= maxDistance)
      .sort((a, b) => {
        // Primary: selected comps always appear above unselected ones
        if (a.included !== b.included) return a.included ? -1 : 1;

        // Secondary: apply the active column sort within each group
        let av: number | string = 0;
        let bv: number | string = 0;
        if (sortKey === "address") {
          av = a.comp.address ?? "";
          bv = b.comp.address ?? "";
          return sortDir === "asc"
            ? (av as string).localeCompare(bv as string)
            : (bv as string).localeCompare(av as string);
        }
        if (sortKey === "ppsqft") {
          const ap = a.comp.salePrice ?? a.comp.listPrice;
          const bp = b.comp.salePrice ?? b.comp.listPrice;
          av = ap && a.comp.sqft ? ap / a.comp.sqft : 0;
          bv = bp && b.comp.sqft ? bp / b.comp.sqft : 0;
        }
        if (sortKey === "beds") {
          av = (a.comp.beds ?? 0) * 10 + (a.comp.baths ?? 0);
          bv = (b.comp.beds ?? 0) * 10 + (b.comp.baths ?? 0);
        }
        if (sortKey === "distance") {
          av = a.comp.distanceMiles ?? 999;
          bv = b.comp.distanceMiles ?? 999;
        }
        return sortDir === "asc"
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number);
      });
  }, [compsList, sortKey, sortDir, maxDistance]);

  if (isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Loading comps...
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Top bar: mock notice + collapsible weight guide */}
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        {deal.dataSource === "mock" && (
          <div className="flex-1 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-semibold text-sm">
                Provider Notice: Sample Data
              </p>
              <p className="text-sm opacity-90">
                These comps are generated for demonstration.
              </p>
            </div>
          </div>
        )}
        <div className="shrink-0 md:ml-auto">
          <button
            onClick={() => setWeightOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1.5 px-3 rounded-md border border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          >
            <span>Learn how weighting is calculated</span>
            {weightOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {weightOpen && (
            <Card className="mt-2 p-4 text-sm bg-slate-50 border-slate-200 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex gap-6 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Base weight — Condition × Status
                  </p>
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left pr-4 pb-1.5 font-medium text-slate-400"></th>
                        <th className="text-center px-2.5 pb-1.5 font-medium text-slate-500">
                          Sold
                        </th>
                        <th className="text-center px-2.5 pb-1.5 font-medium text-slate-500">
                          Pending
                        </th>
                        <th className="text-center px-2.5 pb-1.5 font-medium text-slate-500">
                          Active
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="pr-4 py-1 font-medium text-slate-700">
                          Remodeled
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono font-bold text-emerald-700 bg-emerald-50 rounded">
                          1.00
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-emerald-600 bg-emerald-50/60 rounded">
                          0.85
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.30
                        </td>
                      </tr>
                      <tr>
                        <td className="pr-4 py-1 font-medium text-slate-700">
                          Average
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-amber-600 bg-amber-50 rounded">
                          0.35
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.30
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.10
                        </td>
                      </tr>
                      <tr>
                        <td className="pr-4 py-1 font-medium text-slate-700">
                          Unknown
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.20
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.15
                        </td>
                        <td className="text-center px-2.5 py-1 font-mono text-slate-400 rounded">
                          0.05
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="border-l border-slate-200 pl-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Relevance multiplier
                    </p>
                    <div className="space-y-1.5">
                      {[
                        {
                          label: "High",
                          val: "× 1.2",
                          cls: "text-emerald-700 bg-emerald-50",
                        },
                        {
                          label: "Normal",
                          val: "× 1.0",
                          cls: "text-slate-600 bg-slate-100",
                        },
                        {
                          label: "Low",
                          val: "× 0.6",
                          cls: "text-slate-400 bg-slate-100",
                        },
                      ].map(({ label, val, cls }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-14 text-xs font-medium text-slate-700">
                            {label}
                          </span>
                          <span
                            className={`font-mono font-semibold px-1.5 py-0.5 rounded text-xs ${cls}`}
                          >
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-[170px]">
                    Final weight = base × relevance.
                    <br />
                    Higher = more pull on the ARV.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Manual Comp Button */}
      <div className="flex justify-end">
        <Dialog open={manualCompOpen} onOpenChange={setManualCompOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Comp Manually
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Manual Comp</DialogTitle>
              <DialogDescription>
                Enter details for a comparable property you know about.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={manualCompForm.address}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        address: e.target.value,
                      })
                    }
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div>
                  <Label htmlFor="salePrice">Sale Price</Label>
                  <Input
                    id="salePrice"
                    type="number"
                    value={manualCompForm.salePrice}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        salePrice: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="listPrice">List Price</Label>
                  <Input
                    id="listPrice"
                    type="number"
                    value={manualCompForm.listPrice}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        listPrice: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="sqft">Square Feet</Label>
                  <Input
                    id="sqft"
                    type="number"
                    value={manualCompForm.sqft}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        sqft: e.target.value,
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="lotSize">Lot Size (acres)</Label>
                  <Input
                    id="lotSize"
                    type="number"
                    step="0.01"
                    value={manualCompForm.lotSize}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        lotSize: e.target.value,
                      })
                    }
                    placeholder="0.25"
                  />
                </div>
                <div>
                  <Label htmlFor="beds">Bedrooms</Label>
                  <Input
                    id="beds"
                    type="number"
                    step="0.5"
                    value={manualCompForm.beds}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        beds: e.target.value,
                      })
                    }
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="baths">Bathrooms</Label>
                  <Input
                    id="baths"
                    type="number"
                    step="0.5"
                    value={manualCompForm.baths}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        baths: e.target.value,
                      })
                    }
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label htmlFor="soldDate">Sold Date</Label>
                  <Input
                    id="soldDate"
                    type="date"
                    value={manualCompForm.soldDate}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        soldDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="listingStatus">Listing Status *</Label>
                  <select
                    id="listingStatus"
                    className="w-full h-10 px-3 py-2 text-sm bg-transparent border border-input rounded-md outline-none focus:border-primary"
                    value={manualCompForm.listingStatus}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        listingStatus: e.target.value as
                          | "sold"
                          | "pending"
                          | "active",
                      })
                    }
                  >
                    <option value="sold">Sold</option>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="propertyType">Property Type *</Label>
                  <Input
                    id="propertyType"
                    value={manualCompForm.propertyType}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        propertyType: e.target.value,
                      })
                    }
                    placeholder="SFR"
                  />
                </div>
                <div>
                  <Label htmlFor="condition">Condition *</Label>
                  <select
                    id="condition"
                    className="w-full h-10 px-3 py-2 text-sm bg-transparent border border-input rounded-md outline-none focus:border-primary"
                    value={manualCompForm.condition}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        condition: e.target.value as
                          | "remodeled"
                          | "average"
                          | "unknown",
                      })
                    }
                  >
                    <option value="remodeled">Remodeled</option>
                    <option value="average">Average</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="source">Source *</Label>
                  <Input
                    id="source"
                    value={manualCompForm.source}
                    onChange={(e) =>
                      setManualCompForm({
                        ...manualCompForm,
                        source: e.target.value,
                      })
                    }
                    placeholder="Manual Entry"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setManualCompOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualCompSubmit}
                disabled={!manualCompForm.address || addComp.isPending}
              >
                {addComp.isPending ? "Adding..." : "Add Comp"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Distance filter bar */}
      <div className="flex items-center gap-4 px-1">
        <span className="text-xs font-medium text-slate-500 shrink-0">
          Max distance
        </span>
        <input
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={maxDistance}
          onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
          className="flex-1 max-w-xs h-1.5 appearance-none bg-slate-200 rounded-full accent-primary cursor-pointer"
        />
        <span className="text-xs font-mono font-semibold text-primary w-14 shrink-0">
          {maxDistance.toFixed(1)} mi
        </span>
        <span className="text-xs text-slate-400 shrink-0">
          {sortedComps.length} of {allCompsCount} comp
          {allCompsCount !== 1 ? "s" : ""} shown
        </span>
      </div>

      {/* Comps table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left data-dense-table">
            <thead>
              <tr>
                <th className="w-12 text-center">Use</th>
                <th
                  className="cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => toggleSort("address")}
                >
                  Address{" "}
                  <SortIcon col="address" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th>Type</th>
                <th className="text-right">Price</th>
                <th
                  className="text-right cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => toggleSort("ppsqft")}
                >
                  $/SqFt{" "}
                  <SortIcon col="ppsqft" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-right">SqFt</th>
                <th
                  className="text-right cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => toggleSort("beds")}
                >
                  Beds/Baths{" "}
                  <SortIcon col="beds" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th
                  className="text-right cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => toggleSort("distance")}
                >
                  Distance{" "}
                  <SortIcon
                    col="distance"
                    sortKey={sortKey}
                    sortDir={sortDir}
                  />
                </th>
                <th>Status</th>
                <th>Condition</th>
                <th>Weighting</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject property pinned at top */}
              {(() => {
                const subjectPpsqft =
                  deal.askingPrice && deal.sqft
                    ? deal.askingPrice / deal.sqft
                    : null;
                return (
                  <tr className="bg-blue-50 border-b-2 border-blue-200">
                    <td className="text-center">
                      <Home className="w-4 h-4 text-blue-600 mx-auto" />
                    </td>
                    <td className="max-w-[200px]" title={deal.address}>
                      <div className="font-semibold text-blue-900 truncate">
                        {deal.address}
                      </div>
                      <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mt-0.5">
                        Subject Property
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded px-1.5 py-0.5">
                        {deal.propertyType ?? "SFR"}
                      </span>
                    </td>
                    <td className="text-right font-mono font-semibold text-blue-900">
                      {formatCurrency(deal.askingPrice)}
                      <div className="text-xs text-blue-500 font-normal">
                        asking
                      </div>
                    </td>
                    <td className="text-right font-mono text-blue-700">
                      {formatCurrency(subjectPpsqft)}
                    </td>
                    <td className="text-right font-mono text-blue-900">
                      {formatNumber(deal.sqft)}
                    </td>
                    <td className="text-right font-mono text-blue-900">
                      {deal.beds ?? "—"}/{deal.baths ?? "—"}
                    </td>
                    <td className="text-right font-mono text-blue-500">
                      0.00mi
                    </td>
                    <td>
                      <Badge variant="primary">Subject</Badge>
                    </td>
                    <td>
                      <span className="text-xs text-blue-400">—</span>
                    </td>
                    <td>
                      <span className="text-xs text-blue-400">—</span>
                    </td>
                  </tr>
                );
              })()}

              {sortedComps.map((dc) => {
                const c = dc.comp;
                const effectivePrice = c.salePrice ?? c.listPrice;
                const ppsqft =
                  effectivePrice && c.sqft ? effectivePrice / c.sqft : null;
                const isListPrice = !c.salePrice && !!c.listPrice;
                return (
                  <tr
                    key={dc.id}
                    className={!dc.included ? "bg-slate-50 opacity-60" : ""}
                  >
                    <td
                      className="text-center cursor-pointer"
                      onClick={() => toggleInclude(dc)}
                    >
                      {dc.included ? (
                        <CheckCircle2 className="w-5 h-5 text-primary mx-auto" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 mx-auto" />
                      )}
                    </td>
                    <td
                      className="font-medium max-w-[200px] truncate"
                      title={c.address}
                    >
                      {c.address}
                    </td>
                    <td>
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                        {c.propertyType ?? "—"}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-mono font-semibold">
                        {formatCurrency(effectivePrice)}
                      </span>
                      {isListPrice && (
                        <span className="ml-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">
                          list
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono text-muted-foreground">
                      {formatCurrency(ppsqft)}
                    </td>
                    <td className="text-right font-mono">
                      {formatNumber(c.sqft)}
                    </td>
                    <td className="text-right font-mono">
                      {c.beds}/{c.baths}
                    </td>
                    <td className="text-right font-mono">
                      {c.distanceMiles?.toFixed(2)}mi
                    </td>
                    <td>
                      <Badge
                        variant={
                          c.listingStatus === "sold"
                            ? "secondary"
                            : c.listingStatus === "active"
                              ? "outline"
                              : "warning"
                        }
                      >
                        {c.listingStatus}
                      </Badge>
                    </td>
                    <td>
                      <select
                        className="text-xs bg-transparent border border-slate-200 rounded px-2 py-1 outline-none focus:border-primary disabled:opacity-50"
                        value={c.condition}
                        onChange={(e) =>
                          changeCondition(dc, e.target.value as any)
                        }
                        disabled={!dc.included}
                      >
                        <option value="remodeled">Remodeled</option>
                        <option value="average">Average</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="text-xs bg-transparent border border-slate-200 rounded px-2 py-1 outline-none focus:border-primary disabled:opacity-50"
                        value={dc.relevance}
                        onChange={(e) =>
                          changeRelevance(dc, e.target.value as any)
                        }
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
