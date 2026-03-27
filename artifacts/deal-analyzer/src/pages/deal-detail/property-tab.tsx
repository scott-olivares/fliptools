import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateDeal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DealDetail } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  address: z.string().min(5),
  askingPrice: z.coerce.number().min(1),
  beds: z.coerce.number().nullable(),
  baths: z.coerce.number().nullable(),
  sqft: z.coerce.number().nullable(),
  lotSize: z.coerce.number().nullable(),
  yearBuilt: z.coerce.number().nullable(),
  notes: z.string().nullable(),
});

export default function PropertyTab({ deal }: { deal: DealDetail }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { register, handleSubmit } = useForm({
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
    }
  });

  const updateMutation = useUpdateDeal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
        toast({ title: "Property details updated" });
      }
    }
  });

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Subject Property Details</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit((d) => updateMutation.mutate({ id: deal.id, data: d }))}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label>Asking Price</Label>
              <Input type="number" {...register("askingPrice")} />
            </div>
            <div className="space-y-2">
              <Label>Living SqFt</Label>
              <Input type="number" {...register("sqft")} />
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
              <Label>Lot Size (sqft)</Label>
              <Input type="number" {...register("lotSize")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Property Notes & Context</Label>
              <textarea 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Needs full gut, roof is 10 years old..."
                {...register("notes")}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t py-4">
          <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
