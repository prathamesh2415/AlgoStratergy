import { NextResponse } from "next/server";
import { pruneAlikePairs } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { threshold?: number };
  return NextResponse.json(pruneAlikePairs(body.threshold ?? 0.72));
}
