// Ensemble sports betting simulation engine.
// Generates a synthetic rolling 3-year historical game dataset, runs each
// model's predictions against it, combines predictions via weighted
// consensus voting, and computes backtest statistics (ROI, accuracy,
// variance, drawdown) for each individual model and the ensemble.

export type Algorithm = "xgboost" | "random_forest" | "logistic_regression";

export interface SimModel {
  id: string;
  name: string;
  algorithm: Algorithm;
  sport: string;
  weight: number; // relative voting weight
  active: boolean;
  baseAccuracy: number; // 0-1, underlying skill level
  baseEdge: number; // -0.05 to 0.08, edge vs. fair odds
  volatility: number; // 0-1, how noisy the model's confidence/outcomes are
}

export interface SimConfig {
  models: SimModel[];
  gameCount: number; // typically 1000
  consensusThreshold: number; // e.g. 0.8 -> 80% weighted agreement required to bet
  historicalWindowYears: number; // 3
  seed?: number;
}

export interface GameRecord {
  index: number;
  date: string; // ISO date, spread across rolling window
  sport: string;
  americanOdds: number; // odds offered on the "pick"
  trueWinProb: number; // hidden ground-truth probability (models do NOT see this directly)
  actualOutcome: 0 | 1; // 1 = pick hit, 0 = pick missed
}

export interface ModelPick {
  modelId: string;
  probability: number; // model's estimated win probability for the pick
  vote: 0 | 1; // binarized pick: 1 = bet, 0 = pass/fade
  confidence: number; // |probability - 0.5| * 2
}

export interface GameSimResult {
  game: GameRecord;
  picks: ModelPick[];
  ensembleProbability: number;
  ensembleAgreementRate: number; // weighted fraction of active models voting with majority
  majorityIsBet: boolean; // which direction (bet vs pass) the weighted majority took
  ensembleBet: boolean; // true if agreement >= consensus threshold
  ensembleWin?: boolean;
}

export interface WeeklyStat {
  week: number;
  weekOf: string;
  accuracy: number;
  roi: number;
  consensusAgreement: number; // for a given model: rate of agreeing with ensemble majority
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

export interface SimulationOutput {
  games: GameRecord[];
  results: GameSimResult[];
  entities: EntityBacktest[]; // one per model + one "ensemble"
  benchRecommendations: BenchRecommendation[];
}

// ---------- Deterministic PRNG (mulberry32) so runs are reproducible per seed ----------
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number, mean = 0, stdDev = 1) {
  // Box-Muller transform
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

const SPORTS = ["NBA", "WNBA", "UFC", "Tennis", "PGA"];

function americanToDecimal(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

function americanToImpliedProb(american: number): number {
  return american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);
}

/** Generate a synthetic rolling N-year historical dataset of games with true outcome probabilities baked in. */
function generateHistoricalGames(gameCount: number, windowYears: number, rand: () => number): GameRecord[] {
  const games: GameRecord[] = [];
  const msPerWindow = windowYears * 365 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const start = now - msPerWindow;

  for (let i = 0; i < gameCount; i++) {
    // Spread games evenly across the rolling window with slight jitter
    const t = start + (msPerWindow * i) / gameCount + rand() * (msPerWindow / gameCount) * 0.5;
    const date = new Date(t).toISOString().slice(0, 10);
    const sport = SPORTS[Math.floor(rand() * SPORTS.length)];

    // True win probability for "the pick" — centered around a realistic
    // range for a well-selected side/prop (52%-63%), with market-implied
    // odds priced slightly under that (the "edge" opportunity).
    const trueProb = 0.5 + Math.abs(gaussian(rand, 0.06, 0.05));
    const clampedTrue = Math.min(0.75, Math.max(0.42, trueProb));

    // Market odds priced close to true prob but with vig, occasionally mispriced
    const marketProb = Math.min(0.92, Math.max(0.2, clampedTrue - 0.03 - rand() * 0.04));
    const decimalOdds = 1 / marketProb;
    const americanOdds =
      decimalOdds >= 2 ? Math.round((decimalOdds - 1) * 100) : Math.round(-100 / (decimalOdds - 1));

    const actualOutcome: 0 | 1 = rand() < clampedTrue ? 1 : 0;

    games.push({ index: i, date, sport, americanOdds, trueWinProb: clampedTrue, actualOutcome });
  }

  return games;
}

/** Simulate a single model's prediction for a game based on its skill profile. */
function modelPredict(model: SimModel, game: GameRecord, rand: () => number): ModelPick {
  // Model's estimated probability = true-ish signal + model-specific noise/bias.
  // baseAccuracy shifts how close the model's read is to reality;
  // baseEdge shifts systematic bias (overconfidence/underconfidence);
  // volatility adds per-game noise.
  const impliedProb = americanToImpliedProb(game.americanOdds);
  // Models never see the realized outcome — only a noisy read of the hidden
  // true win probability (their "skill" signal), blended with the market's
  // implied probability (their anchor/prior), plus per-game noise.
  const skillWeight = 0.25 + model.baseAccuracy * 0.35; // ~0.25 - 0.60: even skilled models only partially see the true signal
  const noise = gaussian(rand, 0, 0.06 + model.volatility * 0.12);
  let estProb = skillWeight * game.trueWinProb + (1 - skillWeight) * impliedProb + model.baseEdge + noise;
  estProb = Math.min(0.95, Math.max(0.05, estProb));

  const vote: 0 | 1 = estProb >= 0.5 ? 1 : 0;
  const confidence = Math.abs(estProb - 0.5) * 2;

  return { modelId: model.id, probability: estProb, vote, confidence };
}

function algoLabel(algo: Algorithm): string {
  if (algo === "xgboost") return "XGBoost";
  if (algo === "random_forest") return "Random Forest";
  return "Logistic Regression";
}

function weekIndexForDate(dateStr: string, allDates: string[]): number {
  // Bucket games into weeks by chronological order rather than calendar week,
  // since games are synthetic/randomly jittered across the window.
  const idx = allDates.indexOf(dateStr);
  return idx;
}

/** Core entry point: run the full simulation and backtest for the given config. */
export function runSimulation(config: SimConfig): SimulationOutput {
  const { models, gameCount, consensusThreshold, historicalWindowYears } = config;
  const rand = mulberry32(config.seed ?? 42);
  const activeModels = models.filter((m) => m.active);

  const games = generateHistoricalGames(gameCount, historicalWindowYears, rand);

  const results: GameSimResult[] = [];

  for (const game of games) {
    const picks = activeModels.map((m) => modelPredict(m, game, rand));

    const totalWeight = activeModels.reduce((s, m) => s + m.weight, 0) || 1;
    // Weighted vote share for "bet" (vote === 1)
    const betWeight = picks.reduce((s, p, idx) => s + (p.vote === 1 ? activeModels[idx].weight : 0), 0);
    const passWeight = totalWeight - betWeight;
    const majorityShare = Math.max(betWeight, passWeight) / totalWeight;
    const majorityIsBet = betWeight >= passWeight;

    // Weighted average probability (only counted if ensemble decides to bet)
    const ensembleProbability =
      picks.reduce((s, p, idx) => s + p.probability * activeModels[idx].weight, 0) / totalWeight;

    const ensembleBet = majorityIsBet && majorityShare >= consensusThreshold;

    results.push({
      game,
      picks,
      ensembleProbability,
      ensembleAgreementRate: majorityShare,
      majorityIsBet,
      ensembleBet,
      ensembleWin: ensembleBet ? game.actualOutcome === 1 : undefined,
    });
  }

  const allDates = games.map((g) => g.date);

  // ---------- Per-model backtest ----------
  const entities: EntityBacktest[] = [];

  for (const model of activeModels) {
    // Consensus agreement: did this model's vote (bet/pass) match the ensemble's
    // weighted-majority direction on each game? This is the per-model signal used
    // for weekly bench decisions (trailing agreement rate vs. the 80% threshold).
    const agreementSeries = results.map((r) => {
      const p = r.picks.find((pp) => pp.modelId === model.id);
      if (!p) return 1;
      return p.vote === (r.majorityIsBet ? 1 : 0) ? 1 : 0;
    });

    entities.push(computeBacktest(model.id, model.name, results, allDates, (r) => {
      const p = r.picks.find((pp) => pp.modelId === model.id);
      if (!p) return null;
      return p.vote === 1 ? { bets: true, odds: r.game.americanOdds, win: r.game.actualOutcome === 1 } : { bets: false, odds: r.game.americanOdds, win: false };
    }, agreementSeries));
  }

  // Ensemble entity
  entities.push(
    computeBacktest(
      "ensemble",
      "Ensemble (Weighted Vote)",
      results,
      allDates,
      (r) => (r.ensembleBet ? { bets: true, odds: r.game.americanOdds, win: r.game.actualOutcome === 1 } : { bets: false, odds: r.game.americanOdds, win: false }),
      results.map(() => 1)
    )
  );

  // ---------- Bench recommendations (80% consensus threshold logic) ----------
  const benchRecommendations: BenchRecommendation[] = [];
  const latestWeek = Math.max(...entities[0].weeklyBreakdown.map((w) => w.week), 0);
  const lastNWeeks = 4; // evaluate trailing 4 weeks for weekly bench decision

  for (const model of activeModels) {
    const entity = entities.find((e) => e.entityId === model.id)!;
    const recentWeeks = entity.weeklyBreakdown.filter((w) => w.week > latestWeek - lastNWeeks);
    const avgAgreement =
      recentWeeks.length > 0
        ? recentWeeks.reduce((s, w) => s + w.consensusAgreement, 0) / recentWeeks.length
        : 1;
    const avgRoi = recentWeeks.length > 0 ? recentWeeks.reduce((s, w) => s + w.roi, 0) / recentWeeks.length : 0;
    const lastWeekOf = entity.weeklyBreakdown.at(-1)?.weekOf ?? allDates.at(-1) ?? "";

    let recommendation: "bench" | "retain" | "watch" = "retain";
    let reason = `Agrees with ensemble consensus ${(avgAgreement * 100).toFixed(1)}% of the time over the trailing ${lastNWeeks} weeks — within acceptable range.`;

    if (avgAgreement < 0.8) {
      recommendation = "bench";
      reason = `Consensus agreement fell to ${(avgAgreement * 100).toFixed(1)}% (below the 80% threshold) over the trailing ${lastNWeeks} weeks, with ${avgRoi < 0 ? "negative" : "weak"} ROI of ${avgRoi.toFixed(1)}% — recommend benching this week.`;
    } else if (avgAgreement < 0.85 || avgRoi < 0) {
      recommendation = "watch";
      reason = `Consensus agreement at ${(avgAgreement * 100).toFixed(1)}% is near the 80% threshold with recent ROI of ${avgRoi.toFixed(1)}% — monitor closely next week.`;
    }

    benchRecommendations.push({
      modelId: model.id,
      modelName: model.name,
      weekOf: lastWeekOf,
      consensusAgreementRate: avgAgreement,
      reason,
      recommendation,
    });
  }

  return { games, results, entities, benchRecommendations };
}

function computeBacktest(
  entityId: string,
  entityName: string,
  results: GameSimResult[],
  allDates: string[],
  getDecision: (r: GameSimResult, idx: number) => { bets: boolean; odds: number; win: boolean } | null,
  agreementSeries: number[]
): EntityBacktest {
  const STAKE = 100; // flat stake per bet in bankroll units
  let wins = 0,
    losses = 0,
    pushes = 0;
  let bankroll = 10000;
  const bankrollCurve: number[] = [bankroll];
  const perGameReturns: number[] = [];
  let peak = bankroll;
  let maxDrawdown = 0;

  const weeklyMap = new Map<number, { wins: number; losses: number; bets: number; roiSum: number; agreementSum: number; agreementCount: number; weekOf: string }>();
  const WEEK_SIZE = 25; // games per "week" bucket for reporting granularity across 1000 games (~40 weeks)

  results.forEach((r, idx) => {
    const decision = getDecision(r, idx);
    const week = Math.floor(idx / WEEK_SIZE);
    if (!weeklyMap.has(week)) {
      weeklyMap.set(week, { wins: 0, losses: 0, bets: 0, roiSum: 0, agreementSum: 0, agreementCount: 0, weekOf: r.game.date });
    }
    const wk = weeklyMap.get(week)!;
    wk.agreementSum += agreementSeries[idx] ?? 0;
    wk.agreementCount += 1;

    if (!decision || !decision.bets) {
      perGameReturns.push(0);
      bankrollCurve.push(bankroll);
      return;
    }

    wk.bets += 1;
    const decimalOdds = americanToDecimal(decision.odds);
    if (decision.win) {
      const profit = STAKE * (decimalOdds - 1);
      bankroll += profit;
      perGameReturns.push(profit / STAKE);
      wins += 1;
      wk.wins += 1;
    } else {
      bankroll -= STAKE;
      perGameReturns.push(-1);
      losses += 1;
      wk.losses += 1;
    }

    peak = Math.max(peak, bankroll);
    const drawdown = ((peak - bankroll) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    bankrollCurve.push(bankroll);
  });

  const totalBets = wins + losses;
  const accuracy = totalBets > 0 ? wins / totalBets : 0;
  const totalStaked = totalBets * STAKE;
  const netProfit = bankroll - 10000;
  const roi = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

  const betReturns = perGameReturns.filter((_, i) => {
    const decision = getDecision(results[i], i);
    return decision?.bets;
  });
  const meanReturn = betReturns.length > 0 ? betReturns.reduce((s, v) => s + v, 0) / betReturns.length : 0;
  const variance =
    betReturns.length > 0
      ? betReturns.reduce((s, v) => s + Math.pow(v - meanReturn, 2), 0) / betReturns.length
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(betReturns.length || 1) : 0;

  const weeklyBreakdown: WeeklyStat[] = Array.from(weeklyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, wk]) => ({
      week,
      weekOf: wk.weekOf,
      accuracy: wk.bets > 0 ? wk.wins / wk.bets : 0,
      roi: wk.bets > 0 ? ((wk.wins * STAKE * 0.91 - wk.losses * STAKE) / (wk.bets * STAKE)) * 100 : 0,
      consensusAgreement: wk.agreementCount > 0 ? wk.agreementSum / wk.agreementCount : 1,
      bets: wk.bets,
    }));

  return {
    entityId,
    entityName,
    wins,
    losses,
    pushes,
    bets: totalBets,
    accuracy,
    roi,
    variance,
    stdDev,
    sharpe,
    maxDrawdown,
    bankrollCurve: bankrollCurve.filter((_, i) => i % Math.max(1, Math.floor(bankrollCurve.length / 200)) === 0),
    weeklyBreakdown,
    finalBankroll: bankroll,
  };
}

export function defaultRoster(): SimModel[] {
  return [
    {
      id: "xgb-1",
      name: "XGBoost Core",
      algorithm: "xgboost",
      sport: "NBA",
      weight: 1.2,
      active: true,
      baseAccuracy: 0.72,
      baseEdge: 0.015,
      volatility: 0.35,
    },
    {
      id: "rf-1",
      name: "Random Forest Ensemble",
      algorithm: "random_forest",
      sport: "NBA",
      weight: 1,
      active: true,
      baseAccuracy: 0.65,
      baseEdge: 0.005,
      volatility: 0.45,
    },
    {
      id: "logit-1",
      name: "Logistic Baseline",
      algorithm: "logistic_regression",
      sport: "NBA",
      weight: 0.8,
      active: true,
      baseAccuracy: 0.58,
      baseEdge: -0.005,
      volatility: 0.3,
    },
    {
      id: "xgb-2",
      name: "XGBoost Props",
      algorithm: "xgboost",
      sport: "WNBA",
      weight: 1,
      active: true,
      baseAccuracy: 0.68,
      baseEdge: 0.01,
      volatility: 0.4,
    },
    {
      id: "rf-2",
      name: "Random Forest Combat",
      algorithm: "random_forest",
      sport: "UFC",
      weight: 0.9,
      active: false,
      baseAccuracy: 0.55,
      baseEdge: -0.02,
      volatility: 0.6,
    },
  ];
}
