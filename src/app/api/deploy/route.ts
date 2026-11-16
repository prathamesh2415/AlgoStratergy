import { NextResponse } from "next/server";
import { deployPaperDemo } from "@/lib/workflow";
import { loadState } from "@/lib/store/state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ paper: loadState().paper });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    balance?: number;
    name?: string;
  };
  try {
    return NextResponse.json(deployPaperDemo(body));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deploy failed" },
      { status: 400 },
    );
  }
}
