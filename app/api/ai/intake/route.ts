// AI-assisted intake route (Owner / SA-O4, HERO demo opener).
// POST { pasted } -> { draft, source }. Server-only; the LLM key never reaches the browser.
// Returns a DRAFT only — nothing is written until the user hits "Apply" (applyIntake action).

import { NextResponse } from "next/server";
import { extractIntake } from "@/lib/ai/intake";

export async function POST(req: Request) {
  let pasted = "";
  try {
    const body = await req.json();
    pasted = String(body?.pasted ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!pasted) return NextResponse.json({ error: "empty" }, { status: 400 });

  const { draft, source } = await extractIntake(pasted);
  return NextResponse.json({ draft, source });
}
