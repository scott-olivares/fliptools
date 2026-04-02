import { useState } from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CurrencyInput({ value, onChange, className, placeholder, disabled }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);

  const displayValue = focused
    ? (value === "" ? "" : String(value))
    : value === "" || value === 0
    ? ""
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value as number);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    if (raw === "") {
      onChange("");
    } else {
      const parsed = parseFloat(raw);
      onChange(isNaN(parsed) ? "" : parsed);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder ?? "$0"}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={handleChange}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50 font-mono",
        className
      )}
    />
  );
}
