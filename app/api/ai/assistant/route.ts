// POST /api/ai/assistant — ask "Aino" a question; answered with the current user's live data.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { askAino } from "@/lib/ai/assistant";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ answer: "Pick a demo user first (top-right → Switch role).", source: "fallback" });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ answer: "Ask me anything about your accounts, deals, pipeline, or how to use the CRM.", source: "fallback" });

  const { answer, source } = await askAino(question, { userId: user.id, role: user.role, name: user.name });
  return NextResponse.json({ answer, source });
}
