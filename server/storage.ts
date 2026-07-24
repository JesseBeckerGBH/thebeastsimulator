import {
  models,
  simulationRuns,
  backtestResults,
  benchRecommendations,
} from "@shared/schema";
import type {
  Model,
  InsertModel,
  SimulationRun,
  InsertSimulationRun,
  BacktestResult,
  InsertBacktestResult,
  BenchRecommendation,
  InsertBenchRecommendation,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure tables exist (lightweight migration since this is a fresh SQLite file)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  sport TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  base_accuracy REAL NOT NULL,
  base_edge REAL NOT NULL,
  volatility REAL NOT NULL,
  benched INTEGER NOT NULL DEFAULT 0,
  benched_week_of TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS simulation_runs (
  id TEXT PRIMARY KEY,
  game_count INTEGER NOT NULL,
  consensus_threshold REAL NOT NULL,
  historical_window_years INTEGER NOT NULL DEFAULT 3,
  roster_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  pushes INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  roi REAL NOT NULL,
  variance REAL NOT NULL,
  sharpe REAL NOT NULL,
  max_drawdown REAL NOT NULL,
  bankroll_curve TEXT NOT NULL,
  weekly_breakdown TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bench_recommendations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  week_of TEXT NOT NULL,
  consensus_agreement_rate REAL NOT NULL,
  reason TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

export interface IStorage {
  listModels(): Promise<Model[]>;
  getModel(id: string): Promise<Model | undefined>;
  createModel(model: InsertModel): Promise<Model>;
  updateModel(id: string, patch: Partial<InsertModel>): Promise<Model | undefined>;
  deleteModel(id: string): Promise<boolean>;

  createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun>;
  getSimulationRun(id: string): Promise<SimulationRun | undefined>;
  listSimulationRuns(): Promise<SimulationRun[]>;

  createBacktestResults(results: InsertBacktestResult[]): Promise<BacktestResult[]>;
  getBacktestResultsByRun(runId: string): Promise<BacktestResult[]>;

  createBenchRecommendations(recs: InsertBenchRecommendation[]): Promise<BenchRecommendation[]>;
  getBenchRecommendationsByRun(runId: string): Promise<BenchRecommendation[]>;
  getLatestBenchRecommendations(): Promise<BenchRecommendation[]>;
}

export class DatabaseStorage implements IStorage {
  async listModels(): Promise<Model[]> {
    return db.select().from(models).all();
  }

  async getModel(id: string): Promise<Model | undefined> {
    return db.select().from(models).where(eq(models.id, id)).get();
  }

  async createModel(model: InsertModel): Promise<Model> {
    return db
      .insert(models)
      .values({ ...model, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async updateModel(id: string, patch: Partial<InsertModel>): Promise<Model | undefined> {
    db.update(models).set(patch).where(eq(models.id, id)).run();
    return this.getModel(id);
  }

  async deleteModel(id: string): Promise<boolean> {
    const res = db.delete(models).where(eq(models.id, id)).run();
    return res.changes > 0;
  }

  async createSimulationRun(run: InsertSimulationRun): Promise<SimulationRun> {
    return db
      .insert(simulationRuns)
      .values({ ...run, id: randomUUID(), createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async getSimulationRun(id: string): Promise<SimulationRun | undefined> {
    return db.select().from(simulationRuns).where(eq(simulationRuns.id, id)).get();
  }

  async listSimulationRuns(): Promise<SimulationRun[]> {
    return db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt)).all();
  }

  async createBacktestResults(results: InsertBacktestResult[]): Promise<BacktestResult[]> {
    const out: BacktestResult[] = [];
    for (const r of results) {
      out.push(
        db
          .insert(backtestResults)
          .values({ ...r, id: randomUUID(), createdAt: new Date().toISOString() })
          .returning()
          .get()
      );
    }
    return out;
  }

  async getBacktestResultsByRun(runId: string): Promise<BacktestResult[]> {
    return db.select().from(backtestResults).where(eq(backtestResults.runId, runId)).all();
  }

  async createBenchRecommendations(recs: InsertBenchRecommendation[]): Promise<BenchRecommendation[]> {
    const out: BenchRecommendation[] = [];
    for (const r of recs) {
      out.push(
        db
          .insert(benchRecommendations)
          .values({ ...r, id: randomUUID(), createdAt: new Date().toISOString() })
          .returning()
          .get()
      );
    }
    return out;
  }

  async getBenchRecommendationsByRun(runId: string): Promise<BenchRecommendation[]> {
    return db.select().from(benchRecommendations).where(eq(benchRecommendations.runId, runId)).all();
  }

  async getLatestBenchRecommendations(): Promise<BenchRecommendation[]> {
    const latestRun = db
      .select()
      .from(simulationRuns)
      .orderBy(desc(simulationRuns.createdAt))
      .limit(1)
      .get();
    if (!latestRun) return [];
    return this.getBenchRecommendationsByRun(latestRun.id);
  }
}

export const storage = new DatabaseStorage();
