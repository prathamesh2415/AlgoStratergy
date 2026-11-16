import type {
  BacktestResult,
  CorrelationPair,
  Portfolio,
  PortfolioMember,
} from "@/lib/types";

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ax = a.slice(a.length - n);
  const bx = b.slice(b.length - n);
  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - meanA;
    const db = bx[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function score(result: BacktestResult): number {
  const m = result.metrics;
  return m.netPnl * (1 + Math.max(0, m.sharpe)) - m.maxDrawdownPct * 20;
}

export function selectProfitable(results: BacktestResult[]): BacktestResult[] {
  return results
    .filter((r) => r.metrics.profitable)
    .sort((a, b) => score(b) - score(a));
}

export function pruneCorrelated(
  results: BacktestResult[],
  threshold = 0.72,
): { kept: BacktestResult[]; pairs: CorrelationPair[] } {
  const ranked = [...results].sort((a, b) => score(b) - score(a));
  const kept: BacktestResult[] = [];
  const pairs: CorrelationPair[] = [];
  const dropped = new Set<string>();

  for (const candidate of ranked) {
    if (dropped.has(candidate.strategyId)) continue;
    let reject = false;
    for (const existing of kept) {
      const corr = pearson(candidate.returns, existing.returns);
      if (Math.abs(corr) >= threshold) {
        const better = score(candidate) >= score(existing) ? candidate : existing;
        const worse = better.strategyId === candidate.strategyId ? existing : candidate;
        pairs.push({
          a: existing.strategyId,
          b: candidate.strategyId,
          correlation: corr,
          kept: better.strategyId,
          dropped: worse.strategyId,
          reason: `|corr|=${corr.toFixed(2)} ≥ ${threshold}; kept higher score`,
        });
        if (worse.strategyId === candidate.strategyId) {
          reject = true;
          dropped.add(worse.strategyId);
        } else {
          dropped.add(worse.strategyId);
          const idx = kept.findIndex((k) => k.strategyId === worse.strategyId);
          if (idx >= 0) kept.splice(idx, 1);
        }
        break;
      }
    }
    if (!reject && !dropped.has(candidate.strategyId)) kept.push(candidate);
  }

  return { kept, pairs };
}

export function buildPortfolio(
  results: BacktestResult[],
  options?: { correlationThreshold?: number },
): Portfolio {
  const profitable = selectProfitable(results);
  const { kept, pairs } = pruneCorrelated(
    profitable,
    options?.correlationThreshold ?? 0.72,
  );

  const weight = kept.length ? 1 / kept.length : 0;
  const members: PortfolioMember[] = kept.map((r) => ({
    strategyId: r.strategyId,
    name: r.name,
    weight,
    metrics: r.metrics,
  }));

  const combinedNet = members.reduce((s, m) => s + m.metrics.netPnl * m.weight, 0);
  const combinedTrades = members.reduce((s, m) => s + m.metrics.trades, 0);
  const combinedSharpe =
    members.reduce((s, m) => s + m.metrics.sharpe * m.weight, 0) || 0;
  const combinedDd = members.length
    ? Math.max(...members.map((m) => m.metrics.maxDrawdownPct))
    : 0;

  return {
    id: `pf_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    members,
    prunedPairs: pairs,
    combined: {
      netPnl: combinedNet,
      maxDrawdownPct: combinedDd,
      sharpe: combinedSharpe,
      trades: combinedTrades,
    },
  };
}
