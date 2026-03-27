import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default:     "border-transparent bg-slate-700 text-white hover:bg-slate-800",
    primary:     "border-transparent bg-blue-600 text-white hover:bg-blue-700",
    secondary:   "border-transparent bg-slate-200 text-slate-800 hover:bg-slate-300",
    destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
    success:     "border-transparent bg-emerald-600 text-white hover:bg-emerald-700",
    warning:     "border-transparent bg-amber-500 text-amber-950 hover:bg-amber-600",
    outline:     "border-slate-300 text-slate-700 bg-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
