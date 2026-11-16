import { generateOhlc } from "@/lib/data/ohlc";
import {
  getStrategy,
  STRATEGY_LOGIC,
  STRATEGY_TEMPLATES,
} from "@/lib/strategies/templates";
import type {
  BacktestMetrics,
  BacktestResult,
  CostModel,
  EquityPoint,
  Trade,
} from "@/lib/types";

export const DEFAULT_COSTS: CostModel = {
  commissionPct: 0.00012,
  spreadPct: 0.00006,
  swapPctPerDay: 0.00002,
};

function computeMetrics(trades: Trade[], equity: EquityPoint[], initial = 10_000): BacktestMetrics {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const netPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalCosts = trades.reduce((s, t) => s + t.costs, 0);
  const grossPnl = netPnl + totalCosts;

  let peak = initial;
  let maxDd = 0;
  for (const p of equity) {
    peak = Math.max(peak, p.equity);
    maxDd = Math.max(maxDd, peak > 0 ? (peak - p.equity) / peak : 0);
  }

  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1].equity;
    returns.push(prev === 0 ? 0 : (equity[i].equity - prev) / prev);
  }
  const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const sharpe = std === 0 ? 0 : (mean / std) * Math.sqrt(252);

  const avgTrade = trades.length ? netPnl / trades.length : 0;
  const winRate = trades.length ? wins.length / trades.length : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  const peakLoadPct = Math.min(100, trades.length ? 12 + trades.length * 0.02 : 0);

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    netPnl,
    grossPnl,
    totalCosts,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? 99 : 0) : grossWin / grossLoss,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    avgTrade,
    expectancy,
    peakLoadPct,
    profitable: netPnl > 0 && trades.length >= 5,
  };
}

export function runBacktest(
  strategyId: string,
  options?: { years?: number; costs?: CostModel; initialCapital?: number },
): BacktestResult {
  const template = getStrategy(strategyId);
  if (!template) throw new Error(`Unknown strategy: ${strategyId}`);
  const logic = STRATEGY_LOGIC[strategyId];
  if (!logic) throw new Error(`No logic for strategy: ${strategyId}`);

  const years = options?.years ?? 5;
  const costs = options?.costs ?? DEFAULT_COSTS;
  const initial = options?.initialCapital ?? 10_000;
  const bars = generateOhlc(template.instrument, template.timeframe, years);

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let equity = initial;
  let position: {
    side: "long" | "short";
    entryTime: number;
    entryPrice: number;
    size: number;
    stop: number;
    tp: number;
    entryIndex: number;
  } | null = null;
  let cooldownUntil = 0;
  const cooldownBars = Math.max(3, Math.floor(template.warmup / 8));

  const riskPct = 0.006;

  for (let i = template.warmup; i < bars.length; i++) {
    const bar = bars[i];

    if (position) {
      const hitStop =
        position.side === "long" ? bar.low <= position.stop : bar.high >= position.stop;
      const hitTp =
        position.side === "long" ? bar.high >= position.tp : bar.low <= position.tp;
      const forceExit = i === bars.length - 1;

      if (hitStop || hitTp || forceExit) {
        const exitPrice = hitStop
          ? position.stop
          : hitTp
            ? position.tp
            : bar.close;
        const move =
          position.side === "long"
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        const gross = move * position.size;
        const notional = position.entryPrice * position.size;
        const holdDays = Math.max(0, (bar.time - position.entryTime) / 86_400_000);
        const tradeCosts =
          notional * costs.commissionPct +
          notional * costs.spreadPct * 2 +
          notional * costs.swapPctPerDay * holdDays;
        const pnl = gross - tradeCosts;
        equity += pnl;
        trades.push({
          strategyId,
          side: position.side,
          entryTime: position.entryTime,
          exitTime: bar.time,
          entryPrice: position.entryPrice,
          exitPrice,
          size: position.size,
          pnl,
          costs: tradeCosts,
          barsHeld: i - position.entryIndex,
        });
        position = null;
        cooldownUntil = i + cooldownBars;
      }
    }

    if (!position && i >= cooldownUntil) {
      const signal = logic({ bars, i, params: template.params });
      if (signal && signal.stopDistancePct > 0) {
        const entryPrice =
          signal.side === "long"
            ? bar.close * (1 + costs.spreadPct)
            : bar.close * (1 - costs.spreadPct);
        const stopDistance = entryPrice * signal.stopDistancePct;
        const riskCash = equity * riskPct;
        const size = stopDistance > 0 ? riskCash / stopDistance : 0;
        if (size > 0) {
          const stop =
            signal.side === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
          const tp =
            signal.side === "long"
              ? entryPrice + stopDistance * signal.takeProfitR
              : entryPrice - stopDistance * signal.takeProfitR;
          position = {
            side: signal.side,
            entryTime: bar.time,
            entryPrice,
            size,
            stop,
            tp,
            entryIndex: i,
          };
        }
      }
    }

    if (i % Math.max(1, Math.floor(bars.length / 400)) === 0 || i === bars.length - 1) {
      equityCurve.push({ time: bar.time, equity });
    }
  }

  const metrics = computeMetrics(trades, equityCurve, initial);
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    returns.push(prev === 0 ? 0 : (equityCurve[i].equity - prev) / prev);
  }

  return {
    strategyId,
    name: template.name,
    instrument: template.instrument,
    timeframe: template.timeframe,
    years,
    mode: "ohlc",
    costs,
    metrics,
    trades,
    equityCurve,
    returns,
  };
}

export function backtestAll(
  options?: { years?: number; costs?: CostModel },
): BacktestResult[] {
  return STRATEGY_TEMPLATES.map((t) => runBacktest(t.id, options));
}
