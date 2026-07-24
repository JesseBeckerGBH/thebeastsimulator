import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Model, SimulateResponse } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface SimParams {
  gameCount: number;
  consensusThreshold: number;
  historicalWindowYears: number;
}

interface EnsembleContextValue {
  models: Model[];
  isLoading: boolean;
  activeModels: Model[];
  simParams: SimParams;
  setSimParams: (p: Partial<SimParams>) => void;
  lastResult: SimulateResponse | null;
  isSimulating: boolean;
  runSimulation: () => void;
  updateModel: (id: string, patch: Partial<Model>) => void;
  addModel: (model: Omit<Model, "createdAt" | "benched" | "benchedWeekOf">) => void;
  removeModel: (id: string) => void;
}

const EnsembleContext = createContext<EnsembleContextValue | null>(null);

export function useEnsemble() {
  const ctx = useContext(EnsembleContext);
  if (!ctx) throw new Error("useEnsemble must be used within EnsembleProvider");
  return ctx;
}

export function EnsembleProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [simParams, setSimParamsState] = useState<SimParams>({
    gameCount: 1000,
    consensusThreshold: 0.8,
    historicalWindowYears: 3,
  });
  const [lastResult, setLastResult] = useState<SimulateResponse | null>(null);

  // Bootstrap default roster on first load
  useEffect(() => {
    apiRequest("GET", "/api/bootstrap").catch(() => {});
  }, []);

  const { data: models = [], isLoading } = useQuery<Model[]>({
    queryKey: ["/api/models"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Model> }) => {
      const res = await apiRequest("PATCH", `/api/models/${id}`, patch);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/models"] }),
    onError: (err: any) => {
      toast({ title: "Couldn't update model", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (model: any) => {
      const res = await apiRequest("POST", "/api/models", model);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/models"] }),
    onError: (err: any) => {
      toast({ title: "Couldn't add model", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/models/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/models"] }),
    onError: (err: any) => {
      toast({ title: "Couldn't remove model", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const simMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/simulate", simParams);
      return res.json() as Promise<SimulateResponse>;
    },
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Simulation complete", description: `Ran ${simParams.gameCount.toLocaleString()} games across ${data.entities.length - 1} models.` });
    },
    onError: (err: any) => {
      toast({ title: "Simulation failed", description: String(err?.message ?? err), variant: "destructive" });
    },
  });

  const activeModels = models.filter((m) => m.active);

  const value: EnsembleContextValue = {
    models,
    isLoading,
    activeModels,
    simParams,
    setSimParams: (p) => setSimParamsState((prev) => ({ ...prev, ...p })),
    lastResult,
    isSimulating: simMutation.isPending,
    runSimulation: () => simMutation.mutate(),
    updateModel: (id, patch) => updateMutation.mutate({ id, patch }),
    addModel: (model) => addMutation.mutate(model),
    removeModel: (id) => removeMutation.mutate(id),
  };

  return <EnsembleContext.Provider value={value}>{children}</EnsembleContext.Provider>;
}
