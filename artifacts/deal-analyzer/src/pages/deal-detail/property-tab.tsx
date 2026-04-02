import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { NumberInput } from "@/components/ui/number-input";
import { useUpdateDeal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DealDetail } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, Info } from "lucide-react";

const formSchema = z.object({
  address: z.string().min(5),
  askingPrice: z.coerce.number().min(1),
  beds: z.coerce.number().nullable(),
  baths: z.coerce.number().nullable(),
  sqft: z.coerce.number().nullable(),
  lotSize: z.coerce.number().nullable(),
  yearBuilt: z.coerce.number().nullable(),
  notes: z.string().nullable(),
  compRadiusMiles: z.coerce.number().min(0.1).max(10),
  compMonthsBack: z.coerce.number().int().min(1).max(36),
  compSqftPct: z.coerce.number().int().min(1).max(50),
  compBedsRange: z.coerce.number().min(0).max(3),
  compBathsRange: z.coerce.number().min(0).max(3),
  compYearBuiltRange: z.coerce.number().int().min(0).max(50),
});

type FormValues = z.infer<typeof formSchema>;

function CriteriaField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {children}
    </div>
  );
}

export default function PropertyTab({ deal, onCompsRefreshed }: { deal: DealDetail; onCompsRefreshed?: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [lotUnit, setLotUnit] = useState<"acres" | "sqft">("acres");

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: deal.address,
      askingPrice: deal.askingPrice,
      beds: deal.beds,
      baths: deal.baths,
      sqft: deal.sqft,
      lotSize: deal.lotSize,
      yearBuilt: deal.yearBuilt,
      notes: deal.notes || "",
      compRadiusMiles: deal.compRadiusMiles ?? 0.5,
      compMonthsBack: deal.compMonthsBack ?? 6,
      compSqftPct: deal.compSqftPct ?? 20,
      compBedsRange: deal.compBedsRange ?? 1,
      compBathsRange: deal.compBathsRange ?? 1,
      compYearBuiltRange: deal.compYearBuiltRange ?? 10,
    },
  });

  const updateMutation = useUpdateDeal();

  const onSubmit = async (data: FormValues) => {
    await updateMutation.mutateAsync({ id: deal.id, data });

    // ?force=true bypasses the server-side TTL because this is an explicit user action
    const refreshRes = await fetch(`/api/deals/${deal.id}/comps/refresh?force=true`, { method: "POST" });
    const refreshData = await refreshRes.json();

    await queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/comps`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}/arv`] });

    onCompsRefreshed?.();

    toast({
      title: "Comps refreshed",
      description: `Found ${refreshData.refreshed} comps matching your criteria.`,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Subject Property Details
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input {...register("address")} />
              </div>
              <div className="space-y-2">
                <Label>Asking Price</Label>
                <CurrencyInput
                  value={watch("askingPrice") || ""}
                  onChange={(val) => setValue("askingPrice", val === "" ? 0 : val, { shouldValidate: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Living SqFt</Label>
                <NumberInput
                  value={watch("sqft") ?? ""}
                  onChange={(val) => setValue("sqft", val === "" ? null : (val as number), { shouldValidate: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bedrooms</Label>
                <Input type="number" step="0.5" {...register("beds")} />
              </div>
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <Input type="number" step="0.5" {...register("baths")} />
              </div>
              <div className="space-y-2">
                <Label>Year Built</Label>
                <Input type="number" {...register("yearBuilt")} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Lot Size</Label>
                  <button
                    type="button"
                    onClick={() => setLotUnit((u) => u === "acres" ? "sqft" : "acres")}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {lotUnit === "acres" ? "show sqft" : "show acres"}
                  </button>
                </div>
                <NumberInput
                  value={
                    watch("lotSize") != null
                      ? (lotUnit === "sqft"
                          ? Math.round((watch("lotSize") as number) * 43560)
                          : watch("lotSize") as number)
                      : ""
                  }
                  onChange={(val) => {
                    if (val === "") { setValue("lotSize", null); return; }
                    setValue("lotSize", lotUnit === "sqft"
                      ? parseFloat(((val as number) / 43560).toFixed(5))
                      : (val as number));
                  }}
                  suffix={lotUnit}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Property Notes & Context</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="Needs full gut, roof is 10 years old..."
                  {...register("notes")}
                />
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Comp Search Criteria</h3>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="w-3 h-3" />
                  Used when pulling comps
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <CriteriaField label="Search Radius" hint="miles">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    {...register("compRadiusMiles")}
                  />
                </CriteriaField>

                <CriteriaField label="Sold Within" hint="months">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="36"
                    {...register("compMonthsBack")}
                  />
                </CriteriaField>

                <CriteriaField label="SqFt Tolerance" hint="±%">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="50"
                    {...register("compSqftPct")}
                  />
                </CriteriaField>

                <CriteriaField label="Beds Range" hint="±beds">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="3"
                    {...register("compBedsRange")}
                  />
                </CriteriaField>

                <CriteriaField label="Baths Range" hint="±baths">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="3"
                    {...register("compBathsRange")}
                  />
                </CriteriaField>

                <CriteriaField label="Year Built Range" hint="±years">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="50"
                    {...register("compYearBuiltRange")}
                  />
                </CriteriaField>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-slate-50 border-t py-4 flex items-center gap-3">
            <Button type="submit" isLoading={isSubmitting} className="gap-2">
              <Search className="w-4 h-4" />
              Find Comps
            </Button>
            <span className="text-xs text-muted-foreground">
              Saves property details, applies criteria, and refreshes comp results
            </span>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
