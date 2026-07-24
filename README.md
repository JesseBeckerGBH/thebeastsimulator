# The Beast Simulator

Interactive ensemble simulator for sports betting prediction models — XGBoost, Random Forest, and Logistic Regression combined via weighted-vote consensus.

## Features

- **Model Roster** — toggle models active/inactive with a 3–7 model cap, tune per-model voting weights, add custom models, and set the consensus threshold.
- **Simulation Engine** — runs 1,000 games against a rolling 3-year synthetic historical dataset, with per-model skill/noise modeling by algorithm type and sport.
- **Backtesting** — ROI, accuracy, variance, Sharpe ratio, and max drawdown for the ensemble vs. every individual model, plus bankroll trajectory and weekly ROI trend charts.
- **Performance Report** — weekly bench/watch/retain recommendations at the 80% consensus threshold, with plain-language reasoning and an agreement-rate trend chart.

## Stack

Express + Vite + React + Tailwind CSS + shadcn/ui + Drizzle ORM (SQLite via `better-sqlite3`).

## Development

```bash
npm install
npm run dev
```

Starts the Express backend and Vite frontend on the same port (default 5000).

## Production build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Notes

All data is synthetic and generated for research/demo purposes. Not betting advice.
