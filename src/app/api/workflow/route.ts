import { NextResponse } from "next/server";
import { runFullWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST() {
  const started = Date.now();
  const result = runFullWorkflow();
  return NextResponse.json({
    durationMs: Date.now() - started,
    ...result,
  });
}
