import { useState } from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  className?: string;
  placeholder?: string;
  step?: string;
  disabled?: boolean;
  suffix?: string;
}

export function NumberInput({ value, onChange, className, placeholder, step: _step, disabled, suffix }: NumberInputProps) {
  const [focused, setFocused] = useState(false);

  const displayValue = focused
    ? (value === "" ? "" : String(value))
    : value === "" || value === null || value === undefined
    ? ""
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(value as number);

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
    <div className="relative w-full">
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        placeholder={placeholder ?? ""}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50 font-mono",
          suffix && "pr-14",
          className
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
