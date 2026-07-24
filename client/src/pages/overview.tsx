import { Link } from "wouter";
import { useEnsemble } from "@/lib/ensemble-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/kpi-card";
import { AlgoBadge } from "@/components/algo-badge";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PlayCircle, ArrowRight, TrendingUp, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

export default function Overview() {
  const { models, activeModels, isLoading, lastResult, isSimulating, runSimulation } = useEnsemble();

  const ensemble = lastResult?.entities.find((e) => e.entityId === "ensemble");
  const bestModel = lastResult?.entities
    .filter((e) => e.entityId !== "ensemble")
    .sort((a, b) => b.roi - a.roi)[0];
  // Derive from persisted model state (source of truth) so this stays consistent
  // with the "Benched" badges shown in the roster below, even on a fresh page load
  // before any simulation has run in the current session.
  const benchCount = models.filter((m) => m.benched).length;

  const chartData = buildComparisonSeries(lastResult);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Ensemble Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-prose">
            Blend XGBoost, Random Forest, and Logistic Regression signals into one weighted-vote
            ensemble, then backtest it against a rolling 3-year synthetic dataset.
          </p>
        </div>
        <Button onClick={() => runSimulation()} disabled={isSimulating || activeModels.length < 3} data-testid="button-run-simulation-overview">
          <PlayCircle className="h-4 w-4" />
          {isSimulating ? "Simulating…" : "Run Simulation"}
        </Button>
      </div>

      {activeModels.length < 3 && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Roster needs at least 3 active models to run a simulation. Currently {activeModels.length} active.
        </div>
      )}

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <KpiCard
              label="Active Models"
              value={`${activeModels.length} / 7`}
              testId="kpi-active-models"
            />
            <KpiCard
              label="Ensemble ROI"
              value={ensemble ? `${ensemble.roi >= 0 ? "+" : ""}${ensemble.roi.toFixed(1)}%` : "—"}
              delta={ensemble && bestModel ? ensemble.roi - bestModel.roi : undefined}
              deltaLabel="pp vs. best solo model"
              testId="kpi-ensemble-roi"
            />
            <KpiCard
              label="Ensemble Accuracy"
              value={ensemble ? `${(ensemble.accuracy * 100).toFixed(1)}%` : "—"}
              testId="kpi-ensemble-accuracy"
            />
            <KpiCard
              label="Flagged for Bench"
              value={String(benchCount)}
              deltaLabel={benchCount > 0 ? `${benchCount} below 80% consensus` : "all models within consensus"}
              delta={benchCount > 0 ? -1 : 0}
              hideDeltaValue
              testId="kpi-bench-count"
            />
          </>
        )}
      </div>

      {/* Roster snapshot */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current Roster</h2>
          <Link href="/roster">
            <Button variant="ghost" size="sm" data-testid="link-manage-roster">
              Manage roster <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
            : models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-card-border bg-card p-4"
                  data-testid={`card-model-${m.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-model-name-${m.id}`}>
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.sport}</p>
                    </div>
                    {!m.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                    {m.active && m.benched && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">
                        Benched
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <AlgoBadge algorithm={m.algorithm} />
                    <span className="text-xs tabular-nums text-muted-foreground">weight {m.weight.toFixed(2)}</span>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* Results preview */}
      {lastResult ? (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Latest Backtest</h2>
            <Link href="/backtest">
              <Button variant="ghost" size="sm" data-testid="link-view-backtest">
                Full results <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
          <div className="mt-3 rounded-lg border border-card-border bg-card p-4">
            <div className="flex items-center gap-2 pb-2">
              <TrendingUp className="h-4 w-4 text-chart-1" />
              <p className="text-sm font-medium">Bankroll trajectory — ensemble vs. individual models</p>
            </div>
            <div className="h-64 w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--popover-border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {lastResult.entities.map((e, i) => (
                    <Line
                      key={e.entityId}
                      type="monotone"
                      dataKey={e.entityId}
                      name={e.entityName}
                      stroke={e.entityId === "ensemble" ? "#10b981" : CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                      strokeWidth={e.entityId === "ensemble" ? 2.5 : 1.5}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed border-card-border p-8 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No simulation has been run yet. Configure your roster, then run a simulation to see
            backtest results here.
          </p>
        </div>
      )}
    </div>
  );
}

function buildComparisonSeries(result: ReturnType<typeof useEnsemble>["lastResult"]) {
  if (!result) return [];
  const maxLen = Math.max(...result.entities.map((e) => e.bankrollCurve.length));
  const rows: Record<string, number>[] = [];
  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, number> = { idx: i };
    for (const e of result.entities) {
      const curve = e.bankrollCurve;
      row[e.entityId] = curve[Math.min(i, curve.length - 1)];
    }
    rows.push(row);
  }
  return rows;
}
