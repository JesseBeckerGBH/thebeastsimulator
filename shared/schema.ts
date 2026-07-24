import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------- Models ----------
// A model in the ensemble roster (3-7 cap enforced in app logic)
export const models = sqliteTable("models", {
  id: text("id").primaryKey(), // e.g. "xgboost-1"
  name: text("name").notNull(),
  algorithm: text("algorithm").notNull(), // "xgboost" | "random_forest" | "logistic_regression"
  sport: text("sport").notNull(), // "NBA" | "WNBA" | "UFC" | "Tennis" | "PGA" | "NFL"
  weight: real("weight").notNull().default(1), // voting weight, 0-1 (relative)
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  baseAccuracy: real("base_accuracy").notNull(), // synthetic generator seed accuracy
  baseEdge: real("base_edge").notNull(), // synthetic generator seed edge vs vig
  volatility: real("volatility").notNull(), // synthetic generator seed volatility
  benched: integer("benched", { mode: "boolean" }).notNull().default(false),
  benchedWeekOf: text("benched_week_of"), // ISO date string of week benched, null if not benched
  createdAt: text("created_at").notNull(),
});

export const insertModelSchema = createInsertSchema(models).omit({
  createdAt: true,
});
export type InsertModel = z.infer<typeof insertModelSchema>;
export type Model = typeof models.$inferSelect;

// ---------- Simulation Runs ----------
// One "run" = simulate N games with a given roster/config snapshot
export const simulationRuns = sqliteTable("simulation_runs", {
  id: text("id").primaryKey(),
  gameCount: integer("game_count").notNull(),
  consensusThreshold: real("consensus_threshold").notNull(), // e.g. 0.8
  historicalWindowYears: integer("historical_window_years").notNull().default(3),
  rosterSnapshot: text("roster_snapshot").notNull(), // JSON string of Model[] used
  createdAt: text("created_at").notNull(),
});

export const insertSimulationRunSchema = createInsertSchema(simulationRuns).omit({
  id: true,
  createdAt: true,
});
export type InsertSimulationRun = z.infer<typeof insertSimulationRunSchema>;
export type SimulationRun = typeof simulationRuns.$inferSelect;

// ---------- Backtest Results ----------
// One row per model (+ one row for "ensemble") per simulation run
export const backtestResults = sqliteTable("backtest_results", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  entityId: text("entity_id").notNull(), // model id, or "ensemble"
  entityName: text("entity_name").notNull(),
  wins: integer("wins").notNull(),
  losses: integer("losses").notNull(),
  pushes: integer("pushes").notNull(),
  accuracy: real("accuracy").notNull(),
  roi: real("roi").notNull(), // percent
  variance: real("variance").notNull(), // variance of per-game returns
  sharpe: real("sharpe").notNull(),
  maxDrawdown: real("max_drawdown").notNull(), // percent
  bankrollCurve: text("bankroll_curve").notNull(), // JSON array of cumulative bankroll values
  weeklyBreakdown: text("weekly_breakdown").notNull(), // JSON array of {week, accuracy, roi, consensusAgreement}
  createdAt: text("created_at").notNull(),
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;
export type BacktestResult = typeof backtestResults.$inferSelect;

// ---------- Bench Recommendations ----------
// Weekly benching recommendation log, derived from 80% consensus disagreement threshold
export const benchRecommendations = sqliteTable("bench_recommendations", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  modelId: text("model_id").notNull(),
  modelName: text("model_name").notNull(),
  weekOf: text("week_of").notNull(),
  consensusAgreementRate: real("consensus_agreement_rate").notNull(), // how often model agreed w/ ensemble consensus
  reason: text("reason").notNull(),
  recommendation: text("recommendation").notNull(), // "bench" | "retain" | "watch"
  createdAt: text("created_at").notNull(),
});

export const insertBenchRecommendationSchema = createInsertSchema(benchRecommendations).omit({
  id: true,
  createdAt: true,
});
export type InsertBenchRecommendation = z.infer<typeof insertBenchRecommendationSchema>;
export type BenchRecommendation = typeof benchRecommendations.$inferSelect;
