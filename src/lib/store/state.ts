import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { BacktestResult, LabState, PaperAccount, Portfolio } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STATE_FILE = path.join(DATA_DIR, "lab-state.json");

function emptyState(): LabState {
  return {
    backtests: {},
    portfolio: null,
    paper: null,
    lastWorkflowAt: null,
  };
}

export function loadState(): LabState {
  try {
    if (!existsSync(STATE_FILE)) return emptyState();
    const raw = readFileSync(STATE_FILE, "utf8");
    return { ...emptyState(), ...JSON.parse(raw) } as LabState;
  } catch {
    return emptyState();
  }
}

export function saveState(state: LabState): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function upsertBacktests(results: BacktestResult[]): LabState {
  const state = loadState();
  for (const r of results) {
    // Persist without heavy trade lists for dashboard speed; keep summary metrics + returns.
    state.backtests[r.strategyId] = {
      ...r,
      trades: r.trades.slice(0, 25),
    };
  }
  state.lastWorkflowAt = new Date().toISOString();
  saveState(state);
  return state;
}

export function setPortfolio(portfolio: Portfolio): LabState {
  const state = loadState();
  state.portfolio = portfolio;
  state.lastWorkflowAt = new Date().toISOString();
  saveState(state);
  return state;
}

export function setPaper(paper: PaperAccount): LabState {
  const state = loadState();
  state.paper = paper;
  state.lastWorkflowAt = new Date().toISOString();
  saveState(state);
  return state;
}

export function getSummary() {
  const state = loadState();
  const backtests = Object.values(state.backtests);
  return {
    strategyCount: 19,
    backtested: backtests.length,
    profitable: backtests.filter((b) => b.metrics.profitable).length,
    portfolioSize: state.portfolio?.members.length ?? 0,
    paper: state.paper
      ? {
          id: state.paper.id,
          status: state.paper.status,
          balance: state.paper.balance,
          equity: state.paper.equity,
          deployedAt: state.paper.deployedAt,
        }
      : null,
    lastWorkflowAt: state.lastWorkflowAt,
  };
}
