import { useState } from "react";
import { useEnsemble } from "@/lib/ensemble-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AlgoBadge } from "@/components/algo-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, PlayCircle } from "lucide-react";
import type { Algorithm } from "@/lib/types";
import { SPORTS } from "@/lib/types";
import { randomUUID } from "@/lib/uuid";

export default function Roster() {
  const { models, isLoading, activeModels, updateModel, addModel, removeModel, runSimulation, isSimulating, simParams, setSimParams } = useEnsemble();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            Model Roster
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-prose">
            Toggle models in or out, tune voting weight per model, and set the consensus
            threshold used to decide when the ensemble places a bet. Roster is capped between 3
            and 7 active models.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddModelDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={addModel} disabled={activeModels.length >= 7} />
          <Button onClick={() => runSimulation()} disabled={isSimulating || activeModels.length < 3} data-testid="button-run-simulation-roster">
            <PlayCircle className="h-4 w-4" />
            {isSimulating ? "Simulating…" : "Run Simulation"}
          </Button>
        </div>
      </div>

      {/* Roster status bar */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-card-border bg-card px-4 py-3">
        <span className="text-sm font-medium">Active: {activeModels.length} / 7</span>
        <div className="h-1.5 flex-1 min-w-32 max-w-64 rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (activeModels.length / 7) * 100)}%` }}
          />
        </div>
        {activeModels.length < 3 && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            Need {3 - activeModels.length} more to run
          </Badge>
        )}
        {activeModels.length >= 7 && (
          <Badge variant="outline" className="border-chart-3/40 text-chart-3">
            Roster full
          </Badge>
        )}
      </div>

      {/* Consensus threshold control */}
      <div className="mt-5 rounded-lg border border-card-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="consensus-threshold" className="text-sm font-medium">
            Consensus Threshold
          </Label>
          <span className="text-sm font-semibold tabular-nums text-primary" data-testid="text-consensus-value">
            {Math.round(simParams.consensusThreshold * 100)}%
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Minimum weighted agreement among active models required before the ensemble places a
          bet. Also used as the weekly benching cutoff for individual models.
        </p>
        <Slider
          id="consensus-threshold"
          className="mt-3"
          min={0.5}
          max={1}
          step={0.01}
          value={[simParams.consensusThreshold]}
          onValueChange={([v]) => setSimParams({ consensusThreshold: v })}
          data-testid="slider-consensus-threshold"
        />
      </div>

      {/* Model list */}
      <div className="mt-6 space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)
          : models.map((m) => (
              <div key={m.id} className="rounded-lg border border-card-border bg-card p-4" data-testid={`row-model-${m.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={m.active}
                      onCheckedChange={(checked) => updateModel(m.id, { active: checked })}
                      disabled={(m.active && activeModels.length <= 3) || (!m.active && activeModels.length >= 7)}
                      data-testid={`switch-active-${m.id}`}
                      aria-label={`Toggle ${m.name} active`}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium" data-testid={`text-name-${m.id}`}>
                          {m.name}
                        </p>
                        <AlgoBadge algorithm={m.algorithm} />
                        <Badge variant="secondary" className="text-xs">
                          {m.sport}
                        </Badge>
                        {m.benched && (
                          <Badge variant="outline" className="border-destructive/40 text-destructive text-xs" data-testid={`badge-benched-${m.id}`}>
                            Benched {m.benchedWeekOf ? `(wk of ${m.benchedWeekOf})` : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        base accuracy {(m.baseAccuracy * 100).toFixed(0)}% · edge{" "}
                        {m.baseEdge >= 0 ? "+" : ""}
                        {(m.baseEdge * 100).toFixed(1)}% · volatility {(m.volatility * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeModel(m.id)}
                    disabled={m.active && activeModels.length <= 3}
                    data-testid={`button-remove-${m.id}`}
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Voting Weight</Label>
                      <span className="text-xs font-medium tabular-nums">{m.weight.toFixed(2)}</span>
                    </div>
                    <Slider
                      className="mt-2"
                      min={0.1}
                      max={2}
                      step={0.05}
                      value={[m.weight]}
                      onValueChange={([v]) => updateModel(m.id, { weight: v })}
                      data-testid={`slider-weight-${m.id}`}
                      disabled={!m.active}
                    />
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

function AddModelDialog({
  open,
  onOpenChange,
  onAdd,
  disabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (m: any) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [algorithm, setAlgorithm] = useState<Algorithm>("xgboost");
  const [sport, setSport] = useState(SPORTS[0]);
  const [baseAccuracy, setBaseAccuracy] = useState(0.6);

  const reset = () => {
    setName("");
    setAlgorithm("xgboost");
    setSport(SPORTS[0]);
    setBaseAccuracy(0.6);
  };

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      id: randomUUID(),
      name: name.trim(),
      algorithm,
      sport,
      weight: 1,
      active: true,
      baseAccuracy,
      baseEdge: 0,
      volatility: 0.4,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} data-testid="button-add-model">
          <Plus className="h-4 w-4" />
          Add Model
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a model to the roster</DialogTitle>
          <DialogDescription>
            New models join the ensemble immediately. Roster is capped at 7 active models.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="model-name">Name</Label>
            <Input
              id="model-name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. XGBoost Player Props"
              data-testid="input-model-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="model-algo">Algorithm</Label>
              <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as Algorithm)}>
                <SelectTrigger id="model-algo" className="mt-1.5" data-testid="select-algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xgboost">XGBoost</SelectItem>
                  <SelectItem value="random_forest">Random Forest</SelectItem>
                  <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="model-sport">Sport</Label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger id="model-sport" className="mt-1.5" data-testid="select-sport">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Base Accuracy (simulation seed)</Label>
              <span className="text-xs font-medium tabular-nums">{(baseAccuracy * 100).toFixed(0)}%</span>
            </div>
            <Slider
              className="mt-2"
              min={0.4}
              max={0.85}
              step={0.01}
              value={[baseAccuracy]}
              onValueChange={([v]) => setBaseAccuracy(v)}
              data-testid="slider-base-accuracy"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-add-model">
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()} data-testid="button-confirm-add-model">
            Add Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
