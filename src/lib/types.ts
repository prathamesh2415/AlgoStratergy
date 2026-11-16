export type Timeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";

export type StrategyCategory =
  | "Momentum"
  | "Breakout"
  | "Reversal"
  | "Mean reversion"
  | "Session"
  | "Trend";

export type Side = "long" | "short";

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  strategyId: string;
  side: Side;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  costs: number;
  barsHeld: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
}

export interface BacktestMetrics {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  grossPnl: number;
  totalCosts: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpe: number;
  avgTrade: number;
  expectancy: number;
  peakLoadPct: number;
  profitable: boolean;
}

export interface BacktestResult {
  strategyId: string;
  name: string;
  instrument: string;
  timeframe: Timeframe;
  years: number;
  mode: "ohlc";
  costs: CostModel;
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  returns: number[];
}

export interface CostModel {
  /** Round-trip commission as fraction of notional (e.g. 0.0002 = 2 bps). */
  commissionPct: number;
  /** One-way spread as fraction of price. */
  spreadPct: number;
  /** Swap per day as fraction of notional. */
  swapPctPerDay: number;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  instrument: string;
  timeframe: Timeframe;
  category: StrategyCategory;
  description: string;
  rules: string[];
  params: Record<string, number | string | boolean>;
  /** Bars of history needed before signals are valid. */
  warmup: number;
}

export interface StrategyContext {
  bars: Bar[];
  i: number;
  params: Record<string, number | string | boolean>;
}

export type Signal = {
  side: Side;
  stopDistancePct: number;
  takeProfitR: number;
} | null;

export type StrategyFn = (ctx: StrategyContext) => Signal;

export interface PortfolioMember {
  strategyId: string;
  name: string;
  weight: number;
  metrics: BacktestMetrics;
}

export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
  kept: string;
  dropped: string;
  reason: string;
}

export interface Portfolio {
  id: string;
  createdAt: string;
  members: PortfolioMember[];
  prunedPairs: CorrelationPair[];
  combined: {
    netPnl: number;
    maxDrawdownPct: number;
    sharpe: number;
    trades: number;
  };
}

export interface PaperAccount {
  id: string;
  name: string;
  balance: number;
  equity: number;
  deployedAt: string;
  portfolioId: string;
  status: "running" | "stopped";
  members: PortfolioMember[];
  notes: string;
}

export interface LabState {
  backtests: Record<string, BacktestResult>;
  portfolio: Portfolio | null;
  paper: PaperAccount | null;
  lastWorkflowAt: string | null;
}
