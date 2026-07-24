import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertModelSchema } from "@shared/schema";
import { runSimulation, defaultRoster, type SimModel } from "./lib/simulation";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Seed default roster on first boot
  app.get("/api/bootstrap", async (_req, res) => {
    const existing = await storage.listModels();
    if (existing.length === 0) {
      for (const m of defaultRoster()) {
        await storage.createModel(m);
      }
    }
    const list = await storage.listModels();
    res.json(list);
  });

  // ---------- Models CRUD ----------
  app.get("/api/models", async (_req, res) => {
    const list = await storage.listModels();
    res.json(list);
  });

  app.post("/api/models", async (req, res) => {
    try {
      const activeModels = (await storage.listModels()).filter((m) => m.active);
      if (activeModels.length >= 7) {
        return res.status(400).json({ message: "Roster is capped at 7 active models. Bench or remove one first." });
      }
      const parsed = insertModelSchema.parse({ ...req.body, id: req.body.id ?? randomUUID() });
      const created = await storage.createModel(parsed);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Failed to create model" });
    }
  });

  app.patch("/api/models/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const patchSchema = insertModelSchema.partial();
      const patch = patchSchema.parse(req.body);

      if (patch.active === true) {
        const activeModels = (await storage.listModels()).filter((m) => m.active && m.id !== id);
        if (activeModels.length >= 7) {
          return res.status(400).json({ message: "Roster is capped at 7 active models." });
        }
      }

      const updated = await storage.updateModel(id, patch);
      if (!updated) return res.status(404).json({ message: "Model not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", async (req, res) => {
    const activeModels = (await storage.listModels()).filter((m) => m.active);
    const target = await storage.getModel(req.params.id);
    if (target?.active && activeModels.length <= 3) {
      return res.status(400).json({ message: "Roster requires a minimum of 3 active models." });
    }
    const ok = await storage.deleteModel(req.params.id);
    if (!ok) return res.status(404).json({ message: "Model not found" });
    res.status(204).end();
  });

  // ---------- Simulation ----------
  const runSimSchema = z.object({
    gameCount: z.number().int().min(50).max(5000).default(1000),
    consensusThreshold: z.number().min(0.5).max(1).default(0.8),
    historicalWindowYears: z.number().int().min(1).max(10).default(3),
    seed: z.number().int().optional(),
  });

  app.post("/api/simulate", async (req, res) => {
    try {
      const params = runSimSchema.parse(req.body ?? {});
      const allModels = await storage.listModels();
      const activeModels = allModels.filter((m) => m.active);

      if (activeModels.length < 3) {
        return res.status(400).json({ message: "At least 3 active models are required to run a simulation." });
      }
      if (activeModels.length > 7) {
        return res.status(400).json({ message: "Roster is capped at 7 active models." });
      }

      const simModels: SimModel[] = activeModels.map((m) => ({
        id: m.id,
        name: m.name,
        algorithm: m.algorithm as SimModel["algorithm"],
        sport: m.sport,
        weight: m.weight,
        active: m.active,
        baseAccuracy: m.baseAccuracy,
        baseEdge: m.baseEdge,
        volatility: m.volatility,
      }));

      const output = runSimulation({
        models: simModels,
        gameCount: params.gameCount,
        consensusThreshold: params.consensusThreshold,
        historicalWindowYears: params.historicalWindowYears,
        seed: params.seed ?? Math.floor(Math.random() * 1_000_000),
      });

      const run = await storage.createSimulationRun({
        gameCount: params.gameCount,
        consensusThreshold: params.consensusThreshold,
        historicalWindowYears: params.historicalWindowYears,
        rosterSnapshot: JSON.stringify(activeModels),
      });

      await storage.createBacktestResults(
        output.entities.map((e) => ({
          runId: run.id,
          entityId: e.entityId,
          entityName: e.entityName,
          wins: e.wins,
          losses: e.losses,
          pushes: e.pushes,
          accuracy: e.accuracy,
          roi: e.roi,
          variance: e.variance,
          sharpe: e.sharpe,
          maxDrawdown: e.maxDrawdown,
          bankrollCurve: JSON.stringify(e.bankrollCurve),
          weeklyBreakdown: JSON.stringify(e.weeklyBreakdown),
        }))
      );

      await storage.createBenchRecommendations(
        output.benchRecommendations.map((b) => ({
          runId: run.id,
          modelId: b.modelId,
          modelName: b.modelName,
          weekOf: b.weekOf,
          consensusAgreementRate: b.consensusAgreementRate,
          reason: b.reason,
          recommendation: b.recommendation,
        }))
      );

      // Apply bench flags to models table for "weekly benching" state
      for (const rec of output.benchRecommendations) {
        await storage.updateModel(rec.modelId, {
          benched: rec.recommendation === "bench",
          benchedWeekOf: rec.recommendation === "bench" ? rec.weekOf : null,
        } as any);
      }

      res.json({
        runId: run.id,
        run,
        entities: output.entities,
        benchRecommendations: output.benchRecommendations,
        sampleGames: output.games.slice(0, 25),
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      console.error(err);
      res.status(500).json({ message: "Simulation failed" });
    }
  });

  app.get("/api/runs", async (_req, res) => {
    res.json(await storage.listSimulationRuns());
  });

  app.get("/api/runs/:id/results", async (req, res) => {
    const run = await storage.getSimulationRun(req.params.id);
    if (!run) return res.status(404).json({ message: "Run not found" });
    const results = await storage.getBacktestResultsByRun(req.params.id);
    const bench = await storage.getBenchRecommendationsByRun(req.params.id);
    res.json({ run, results, bench });
  });

  app.get("/api/bench/latest", async (_req, res) => {
    res.json(await storage.getLatestBenchRecommendations());
  });

  return httpServer;
}
