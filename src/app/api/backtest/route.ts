import { NextResponse } from "next/server";
import { backtestAllStrategies, backtestOne } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    years?: number;
    strategyId?: string;
  };
  if (body.strategyId) {
    return NextResponse.json(backtestOne(body.strategyId, body.years ?? 5));
  }
  return NextResponse.json(backtestAllStrategies({ years: body.years ?? 5 }));
}
