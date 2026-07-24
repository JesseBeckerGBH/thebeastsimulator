import { useEnsemble } from "@/lib/ensemble-context";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { PlayCircle, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

export default function Backtest() {
  const { lastResult, isSimulating, runSimulation, activeModels, simParams } = useEnsemble();

  if (!lastResult) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">
          Backtest Results
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

  const { entities, run } = lastResult;
  const ensemble = entities.find((e) => e.entityId === "ensemble")!;
  const soloModels = entities.filter((e) => e.entityId !== "ensemble");

  const roiData = entities.map((e) => ({ name: shortName(e.entityName), roi: Number(e.roi.toFixed(2)) }));
  const accuracyData = entities.map((e) => ({ name: shortName(e.entityName), accuracy: Number((e.accuracy * 100).toFixed(1)) }));
  const varianceData = entities.map((e) => ({ name: shortName(e.entityName), variance: Number(e.variance.toFixed(3)) }));

  const weeklySeries = buildWeeklySeries(lastResult);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Backtest Results
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.gameCount.toLocaleString()} games · rolling {run.historicalWindowYears}-year window ·{" "}
            {Math.round(run.consensusThreshold * 100)}% consensus threshold
          </p>
        </div>
        <Link href="/roster">
          <Button variant="outline" data-testid="button-adjust-roster">
            Adjust roster & re-run
          </Button>
        </Link>
      </div>

      {/* Summary table */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-card-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead className="text-right">Bets</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
              <TableHead className="text-right">ROI</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Sharpe</TableHead>
              <TableHead className="text-right">Max Drawdown</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map((e) => (
              <TableRow key={e.entityId} className={e.entityId === "ensemble" ? "bg-accent/40" : undefined} data-testid={`row-result-${e.entityId}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {e.entityName}
                    {e.entityId === "ensemble" && (
                      <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                        Ensemble
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.bets}</TableCell>
                <TableCell className="text-right tabular-nums">{(e.accuracy * 100).toFixed(1)}%</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${e.roi >= 0 ? "text-chart-1" : "text-destructive"}`}>
                  {e.roi >= 0 ? "+" : ""}
                  {e.roi.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.variance.toFixed(3)}</TableCell>
                <TableCell className="text-right tabular-nums">{e.sharpe.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">-{e.maxDrawdown.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="ROI by entity (%)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="roi" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Accuracy by entity (%)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accuracyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Return variance by entity (lower = steadier)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={varianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="variance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Weekly ROI trend — ensemble vs. models (%)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {entities.map((e, i) => (
                <Line
                  key={e.entityId}
                  type="monotone"
                  dataKey={e.entityId}
                  name={shortName(e.entityName)}
                  stroke={e.entityId === "ensemble" ? "#10b981" : CHART_COLORS[(i + 1) % CHART_COLORS.length]}
                  strokeWidth={e.entityId === "ensemble" ? 2.5 : 1.25}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--popover-border))",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 h-64 w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
        {children}
      </div>
    </div>
  );
}

function shortName(name: string) {
  return name.replace(" (Weighted Vote)", "");
}

function buildWeeklySeries(result: ReturnType<typeof useEnsemble>["lastResult"]) {
  if (!result) return [];
  const maxWeeks = Math.max(...result.entities.map((e) => e.weeklyBreakdown.length));
  const rows: Record<string, number>[] = [];
  for (let w = 0; w < maxWeeks; w++) {
    const row: Record<string, number> = { week: w + 1 };
    for (const e of result.entities) {
      row[e.entityId] = Number((e.weeklyBreakdown[w]?.roi ?? 0).toFixed(2));
    }
    rows.push(row);
  }
  return rows;
}
