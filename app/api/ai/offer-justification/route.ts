// AI discount-justification drafter (Owner). POST { items:[{name,qty}], discountPercent, dealName }
// -> { text, source }. Drafts the business justification a rep would hand-write for the SM/Finance
// approval path. Server-only (LLM key never reaches the browser); deterministic fallback if no AI.

import { NextResponse } from "next/server";
import { aiText } from "@/lib/ai/client";

export async function POST(req: Request) {
  let body: { items?: { name?: string; qty?: number }[]; discountPercent?: number; dealName?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const discountPercent = Math.max(0, Math.min(100, Number(body.discountPercent ?? 0)));
  const dealName = String(body.dealName ?? "").trim();
  const itemList = items
    .filter((i) => i?.name && Number(i.qty) > 0)
    .map((i) => `${i.qty}× ${i.name}`)
    .join(", ");

  const text = await aiText({
    system:
      "You are a B2B sales-operations assistant at HMD Secure (secure devices + services). " +
      "Write a concise, credible 1–2 sentence business justification for a proposed discount, " +
      "suitable for Sales Manager and Finance approval. Reference volume, strategic/competitive value, " +
      "or recurring-service upside where it fits. Output ONLY the justification sentence(s) — no preamble, no quotes.",
    user:
      `Offer for ${dealName ? `the deal "${dealName}"` : "this account"}. ` +
      `Line items: ${itemList || "(not specified)"}. Discount: ${discountPercent}%. ` +
      "Write the discount justification.",
    maxTokens: 120,
  });

  if (text) return NextResponse.json({ text, source: "ai" });

  const fallback =
    discountPercent >= 15
      ? `Strategic ${discountPercent}% discount to secure a multi-year, high-volume commitment (${itemList || "full device + services package"}); protects against competitive displacement and anchors recurring service revenue.`
      : `Standard ${discountPercent}% volume discount on ${itemList || "the proposed package"}, in line with the customer's committed quantities and expected expansion.`;
  return NextResponse.json({ text: fallback, source: "fallback" });
}
