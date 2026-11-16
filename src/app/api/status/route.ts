import { NextResponse } from "next/server";
import { getSummary, loadState } from "@/lib/store/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = loadState();
  return NextResponse.json({
    summary: getSummary(),
    backtests: Object.values(state.backtests).map((b) => ({
      strategyId: b.strategyId,
      name: b.name,
      instrument: b.instrument,
      timeframe: b.timeframe,
      metrics: b.metrics,
    })),
    portfolio: state.portfolio,
    paper: state.paper,
  });
}
