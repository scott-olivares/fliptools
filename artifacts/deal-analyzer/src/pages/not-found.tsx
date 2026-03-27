import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md mx-4 shadow-lg border-slate-200">
          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 font-display tracking-tight">404</h1>
            <p className="text-slate-600 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Link href="/">
              <Button size="lg" className="w-full">
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
