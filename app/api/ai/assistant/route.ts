// /api/ai/assistant — GET = personalised greeting + proactive actions; POST = ask Aino a question.
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { askAino, assistantGreeting } from "@/lib/ai/assistant";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ greeting: "Pick a demo user first (top-right → Switch role).", actions: [] });
  const { greeting, actions } = await assistantGreeting({ userId: user.id, role: user.role, name: user.name });
  return NextResponse.json({ greeting, actions });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ answer: "Pick a demo user first (top-right → Switch role).", source: "fallback" });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ answer: "Ask me anything about your accounts, deals, pipeline, or how to use the CRM.", source: "fallback" });

  const { answer, source } = await askAino(question, { userId: user.id, role: user.role, name: user.name });
  return NextResponse.json({ answer, source });
}
