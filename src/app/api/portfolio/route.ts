import { NextResponse } from "next/server";
import { putProfitableInPortfolio } from "@/lib/workflow";
import { loadState } from "@/lib/store/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ portfolio: loadState().portfolio });
}

export async function POST() {
  return NextResponse.json(putProfitableInPortfolio());
}
