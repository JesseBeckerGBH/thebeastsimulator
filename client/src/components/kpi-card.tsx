import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number; // percentage points; positive = good (green), negative = bad (red)
  deltaLabel?: string;
  hideDeltaValue?: boolean; // show only deltaLabel text, without the numeric prefix
  icon?: React.ReactNode;
  testId?: string;
}

export function KpiCard({ label, value, delta, deltaLabel, hideDeltaValue, icon, testId }: KpiCardProps) {
  const isUp = (delta ?? 0) > 0;
  const isDown = (delta ?? 0) < 0;

  return (
    <div className="rounded-lg border border-card-border bg-card p-4" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums" data-testid={`${testId}-value`}>
          {value}
        </span>
      </div>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-1.5 flex items-center gap-1 text-xs font-medium tabular-nums",
            isUp && "text-chart-1",
            isDown && "text-destructive",
            !isUp && !isDown && "text-muted-foreground"
          )}
        >
          {isUp && <ArrowUp className="h-3 w-3" />}
          {isDown && <ArrowDown className="h-3 w-3" />}
          {!isUp && !isDown && <Minus className="h-3 w-3" />}
          <span>
            {!hideDeltaValue && `${Math.abs(delta).toFixed(1)} `}
            {deltaLabel ?? "pp vs. baseline"}
          </span>
        </div>
      )}
    </div>
  );
}
