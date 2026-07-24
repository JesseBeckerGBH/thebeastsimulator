import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Algorithm } from "@/lib/types";
import { ALGO_LABELS } from "@/lib/types";

const ALGO_STYLES: Record<Algorithm, string> = {
  xgboost: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  random_forest: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  logistic_regression: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

export function AlgoBadge({ algorithm }: { algorithm: Algorithm }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ALGO_STYLES[algorithm])} data-testid={`badge-algo-${algorithm}`}>
      {ALGO_LABELS[algorithm]}
    </Badge>
  );
}
