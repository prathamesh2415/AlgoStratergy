import { backtestAll, DEFAULT_COSTS, runBacktest } from "@/lib/backtest/runner";
import { buildPortfolio, selectProfitable } from "@/lib/portfolio/math";
import { listStrategies } from "@/lib/strategies/templates";
import {
  getSummary,
  loadState,
  setPaper,
  setPortfolio,
  upsertBacktests,
} from "@/lib/store/state";
import type { CostModel, PaperAccount } from "@/lib/types";

export function whatStrategiesDoIHave() {
  const templates = listStrategies();
  const state = loadState();
  return {
    count: templates.length,
    strategies: templates.map((t) => ({
      id: t.id,
      name: t.name,
      instrument: t.instrument,
      timeframe: t.timeframe,
      category: t.category,
      description: t.description,
      rules: t.rules,
      params: t.params,
      backtested: Boolean(state.backtests[t.id]),
      profitable: state.backtests[t.id]?.metrics.profitable ?? null,
    })),
  };
}

export function backtestAllStrategies(options?: {
  years?: number;
  costs?: Partial<CostModel>;
}) {
  const costs: CostModel = { ...DEFAULT_COSTS, ...options?.costs };
  const years = options?.years ?? 5;
  const results = backtestAll({ years, costs });
  upsertBacktests(results);
  return {
    years,
    mode: "ohlc" as const,
    note: "Demo uses deterministic synthetic OHLC with commission, spread, and swap — not ATH tick data.",
    costs,
    results: results.map((r) => ({
      strategyId: r.strategyId,
      name: r.name,
      instrument: r.instrument,
      timeframe: r.timeframe,
      metrics: r.metrics,
    })),
    profitableIds: results.filter((r) => r.metrics.profitable).map((r) => r.strategyId),
  };
}

export function putProfitableInPortfolio() {
  const state = loadState();
  let results = Object.values(state.backtests);
  if (results.length === 0) {
    results = backtestAll({ years: 5, costs: DEFAULT_COSTS });
    upsertBacktests(results);
  }
  // Build without correlation prune first, then prune in next step — but ATH flow
  // often builds then prunes. We build with prune so portfolio is always deployable,
  // and expose alike pairs explicitly in pruneAlike.
  const profitable = selectProfitable(results);
  const portfolio = buildPortfolio(results, { correlationThreshold: 1.01 }); // no prune yet
  // Equal-weight all profitable (pre-prune)
  portfolio.members = profitable.map((r) => ({
    strategyId: r.strategyId,
    name: r.name,
    weight: profitable.length ? 1 / profitable.length : 0,
    metrics: r.metrics,
  }));
  portfolio.prunedPairs = [];
  portfolio.combined = {
    netPnl: portfolio.members.reduce((s, m) => s + m.metrics.netPnl * m.weight, 0),
    maxDrawdownPct: portfolio.members.length
      ? Math.max(...portfolio.members.map((m) => m.metrics.maxDrawdownPct))
      : 0,
    sharpe: portfolio.members.reduce((s, m) => s + m.metrics.sharpe * m.weight, 0),
    trades: portfolio.members.reduce((s, m) => s + m.metrics.trades, 0),
  };
  setPortfolio(portfolio);
  return {
    message: `Placed ${portfolio.members.length} profitable strategies into a portfolio.`,
    portfolio,
  };
}

export function pruneAlikePairs(threshold = 0.72) {
  const state = loadState();
  let results = Object.values(state.backtests);
  if (results.length === 0) {
    results = backtestAll({ years: 5, costs: DEFAULT_COSTS });
    upsertBacktests(results);
  }
  const portfolio = buildPortfolio(results, { correlationThreshold: threshold });
  setPortfolio(portfolio);
  return {
    threshold,
    message:
      portfolio.prunedPairs.length === 0
        ? "No highly alike pairs found; kept all profitable members."
        : `Found ${portfolio.prunedPairs.length} alike pair(s); kept the better of each.`,
    prunedPairs: portfolio.prunedPairs,
    portfolio,
  };
}

export function deployPaperDemo(options?: { balance?: number; name?: string }) {
  const state = loadState();
  if (!state.portfolio || state.portfolio.members.length === 0) {
    pruneAlikePairs();
  }
  const latest = loadState();
  if (!latest.portfolio || latest.portfolio.members.length === 0) {
    throw new Error("No portfolio members to deploy. Run backtests first.");
  }
  const balance = options?.balance ?? 10_000;
  const paper: PaperAccount = {
    id: `demo_${Date.now().toString(36)}`,
    name: options?.name ?? "Demo Account",
    balance,
    equity: balance,
    deployedAt: new Date().toISOString(),
    portfolioId: latest.portfolio.id,
    status: "running",
    members: latest.portfolio.members,
    notes:
      "Paper deployment on local demo account. Not connected to a live broker.",
  };
  setPaper(paper);
  return {
    message: `Deployed ${paper.members.length} strategies on ${paper.name}.`,
    paper,
    summary: getSummary(),
  };
}

export function runFullWorkflow() {
  const strategies = whatStrategiesDoIHave();
  const backtests = backtestAllStrategies({ years: 5 });
  const portfolioStep = putProfitableInPortfolio();
  const prune = pruneAlikePairs(0.72);
  const deploy = deployPaperDemo();
  return {
    strategies,
    backtests: {
      profitableIds: backtests.profitableIds,
      results: backtests.results,
    },
    portfolioBeforePrune: portfolioStep.portfolio.members.map((m) => m.strategyId),
    prune,
    deploy,
    summary: getSummary(),
  };
}

export function backtestOne(strategyId: string, years = 5) {
  const result = runBacktest(strategyId, { years, costs: DEFAULT_COSTS });
  upsertBacktests([result]);
  return {
    strategyId: result.strategyId,
    name: result.name,
    metrics: result.metrics,
    sampleTrades: result.trades.slice(0, 10),
  };
}
