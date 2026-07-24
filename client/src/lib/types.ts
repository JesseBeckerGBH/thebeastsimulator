export type Algorithm = "xgboost" | "random_forest" | "logistic_regression";

export interface Model {
  id: string;
  name: string;
  algorithm: Algorithm;
  sport: string;
  weight: number;
  active: boolean;
  baseAccuracy: number;
  baseEdge: number;
  volatility: number;
  benched: boolean;
  benchedWeekOf: string | null;
  createdAt: string;
}

export interface WeeklyStat {
  week: number;
  weekOf: string;
  accuracy: number;
  roi: number;
  consensusAgreement: number;
  bets: number;
}

export interface EntityBacktest {
  entityId: string;
  entityName: string;
  wins: number;
  losses: number;
  pushes: number;
  bets: number;
  accuracy: number;
  roi: number;
  variance: number;
  stdDev: number;
  sharpe: number;
  maxDrawdown: number;
  bankrollCurve: number[];
  weeklyBreakdown: WeeklyStat[];
  finalBankroll: number;
}

export interface BenchRecommendation {
  modelId: string;
  modelName: string;
  weekOf: string;
  consensusAgreementRate: number;
  reason: string;
  recommendation: "bench" | "retain" | "watch";
}

export interface SimulationRun {
  id: string;
  gameCount: number;
  consensusThreshold: number;
  historicalWindowYears: number;
  rosterSnapshot: string;
  createdAt: string;
}

export interface SimulateResponse {
  runId: string;
  run: SimulationRun;
  entities: EntityBacktest[];
  benchRecommendations: BenchRecommendation[];
  sampleGames: {
    index: number;
    date: string;
    sport: string;
    americanOdds: number;
    actualOutcome: 0 | 1;
  }[];
}

export const ALGO_LABELS: Record<Algorithm, string> = {
  xgboost: "XGBoost",
  random_forest: "Random Forest",
  logistic_regression: "Logistic Regression",
};

export const SPORTS = ["NBA", "WNBA", "UFC", "Tennis", "PGA"];
