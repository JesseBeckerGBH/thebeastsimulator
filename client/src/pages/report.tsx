import { useEnsemble } from "@/lib/ensemble-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { PlayCircle, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

export default function Report() {
  const { lastResult, isSimulating, runSimulation, activeModels, simParams } = useEnsemble();

  if (!lastResult) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">
          Performance Report
        </h1>
        <div className="mt-8 rounded-lg border border-dashed border-card-border p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No simulation results yet.</p>
          <Button className="mt-4" onClick={() => runSimulation()} disabled={isSimulating || activeModels.length < 3} data-testid="button-run-simulation-empty">
            <PlayCircle className="h-4 w-4" />
            {isSimulating ? "Simulating…" : "Run Simulation"}
          </Button>
        </div>
      </div>
    );
  }

  const { entities, benchRecommendations, run } = lastResult;
  const bench = benchRecommendations.filter((b) => b.recommendation === "bench");
  const watch = benchRecommendations.filter((b) => b.recommendation === "watch");
  const retain = benchRecommendations.filter((b) => b.recommendation === "retain");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Performance Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-prose">
            Weekly benching recommendations based on each model's rate of agreement with the
            ensemble's weighted-vote consensus. Models trending below the{" "}
            {Math.round(run.consensusThreshold * 100)}% threshold over the trailing 4 weeks are
            flagged for benching.
          </p>
        </div>
        <Button variant="outline" onClick={() => runSimulation()} disabled={isSimulating} data-testid="button-refresh-report">
          <PlayCircle className="h-4 w-4" />
          {isSimulating ? "Refreshing…" : "Refresh Report"}
        </Button>
      </div>

      {/* Summary badges */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<ShieldX className="h-4 w-4" />}
          label="Bench this week"
          count={bench.length}
          tone="destructive"
          testId="summary-bench"
        />
        <SummaryCard
          icon={<ShieldQuestion className="h-4 w-4" />}
          label="Watch closely"
          count={watch.length}
          tone="warning"
          testId="summary-watch"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Retained"
          count={retain.length}
          tone="success"
          testId="summary-retain"
        />
      </div>

      {/* Recommendation list */}
      <div className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">Weekly Bench Recommendations</h2>
        {benchRecommendations.length === 0 && (
          <p className="text-sm text-muted-foreground">No active models to evaluate.</p>
        )}
        {benchRecommendations
          .sort((a, b) => a.consensusAgreementRate - b.consensusAgreementRate)
          .map((rec) => (
            <div
              key={rec.modelId}
              className="rounded-lg border border-card-border bg-card p-4"
              data-testid={`card-bench-${rec.modelId}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{rec.modelName}</p>
                  <RecommendationBadge recommendation={rec.recommendation} />
                </div>
                <span className="text-xs text-muted-foreground">week of {rec.weekOf}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress
                  value={rec.consensusAgreementRate * 100}
                  className={cn(
                    "h-2",
                    rec.recommendation === "bench" && "[&>div]:bg-destructive",
                    rec.recommendation === "watch" && "[&>div]:bg-chart-3",
                    rec.recommendation === "retain" && "[&>div]:bg-chart-1"
                  )}
                />
                <span className="w-14 text-right text-xs font-medium tabular-nums">
                  {(rec.consensusAgreementRate * 100).toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>
            </div>
          ))}
      </div>

      {/* Consensus agreement trend */}
      <div className="mt-8 rounded-lg border border-card-border bg-card p-4">
        <p className="text-sm font-medium">Weekly consensus agreement rate by model</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Dashed line marks the {Math.round(run.consensusThreshold * 100)}% benching threshold.
        </p>
        <div className="mt-3 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={buildAgreementSeries(lastResult)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--popover-border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <ReferenceLine y={run.consensusThreshold * 100} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              {entities
                .filter((e) => e.entityId !== "ensemble")
                .map((e, i) => (
                  <Line
                    key={e.entityId}
                    type="monotone"
                    dataKey={e.entityId}
                    name={e.entityName}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={1.75}
                    dot={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  count,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: "destructive" | "warning" | "success";
  testId: string;
}) {
  const toneClasses = {
    destructive: "text-destructive bg-destructive/10 border-destructive/25",
    warning: "text-chart-3 bg-chart-3/10 border-chart-3/25",
    success: "text-chart-1 bg-chart-1/10 border-chart-1/25",
  }[tone];

  return (
    <div className={cn("rounded-lg border p-4", toneClasses)} data-testid={testId}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums" data-testid={`${testId}-count`}>
        {count}
      </p>
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: "bench" | "retain" | "watch" }) {
  if (recommendation === "bench") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">
        Bench
      </Badge>
    );
  }
  if (recommendation === "watch") {
    return (
      <Badge variant="outline" className="border-chart-3/40 text-chart-3 text-xs">
        Watch
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-chart-1/40 text-chart-1 text-xs">
      Retain
    </Badge>
  );
}

function buildAgreementSeries(result: ReturnType<typeof useEnsemble>["lastResult"]) {
  if (!result) return [];
  const models = result.entities.filter((e) => e.entityId !== "ensemble");
  const maxWeeks = Math.max(...models.map((e) => e.weeklyBreakdown.length));
  const rows: Record<string, number>[] = [];
  for (let w = 0; w < maxWeeks; w++) {
    const row: Record<string, number> = { week: w + 1 };
    for (const e of models) {
      row[e.entityId] = Number(((e.weeklyBreakdown[w]?.consensusAgreement ?? 1) * 100).toFixed(1));
    }
    rows.push(row);
  }
  return rows;
}
