import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateDeal } from "@workspace/api-client-react";
import { ArrowLeft, Home, DollarSign, Ruler, Bed, Bath, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  address: z.string().min(5, "Address is required"),
  askingPrice: z.coerce.number().min(1, "Asking price is required"),
  beds: z.coerce.number().optional().nullable(),
  baths: z.coerce.number().optional().nullable(),
  sqft: z.coerce.number().optional().nullable(),
  lotSize: z.coerce.number().optional().nullable(),
  yearBuilt: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewDeal() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      askingPrice: undefined,
    }
  });

  const createMutation = useCreateDeal({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
        setLocation(`/deals/${data.id}`);
      }
    }
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate({ data: { ...data, status: "new" } });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Pipeline
        </Link>
        
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-6">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Home className="w-6 h-6 text-primary" />
              Analyze New Deal
            </CardTitle>
            <CardDescription>
              Enter the subject property details to begin analyzing comps, ARV, and your max offer.
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Subject Property Address *</Label>
                  <Input 
                    id="address" 
                    placeholder="123 Main St, Austin, TX 78701" 
                    {...register("address")} 
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Asking Price *</Label>
                  <Input 
                    id="askingPrice" 
                    type="number" 
                    icon={<DollarSign className="w-4 h-4" />}
                    placeholder="450000" 
                    {...register("askingPrice")} 
                  />
                  {errors.askingPrice && <p className="text-sm text-destructive">{errors.askingPrice.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="beds">Bedrooms</Label>
                  <Input id="beds" type="number" step="0.5" icon={<Bed className="w-4 h-4" />} {...register("beds")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baths">Bathrooms</Label>
                  <Input id="baths" type="number" step="0.5" icon={<Bath className="w-4 h-4" />} {...register("baths")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sqft">Living SqFt</Label>
                  <Input id="sqft" type="number" icon={<Ruler className="w-4 h-4" />} {...register("sqft")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearBuilt">Year Built</Label>
                  <Input id="yearBuilt" type="number" icon={<Calendar className="w-4 h-4" />} {...register("yearBuilt")} />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="bg-slate-50 border-t py-4 flex justify-end">
              <Button 
                type="submit" 
                size="lg" 
                isLoading={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                Create & Analyze
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
