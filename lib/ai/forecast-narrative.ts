// lib/ai/forecast-narrative.ts — P2 #23. Natural-language pipeline-health summary for the
// Finance / Manager views. Uses Featherless via aiText; deterministic templated fallback when
// the key/model is unavailable so a narrative always renders. Read-only — never mutates data.

import { aiText } from "./client";

export interface ForecastSummary {
  weightedTotal: number;
  totalRevenue: number;
  deviceRevenue: number;
  serviceRevenue: number;
  nearTermWeighted: number; // next 2 quarters, weighted
  quartersCount: number;
  stalledCount: number;
  pastCloseCount: number;
}

const eur = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

export async function forecastNarrative(s: ForecastSummary): Promise<{ text: string; source: "ai" | "fallback" }> {
  const facts = [
    `weighted 3-year pipeline ${eur(s.weightedTotal)} (unweighted ${eur(s.totalRevenue)})`,
    `device revenue ${eur(s.deviceRevenue)} vs service revenue ${eur(s.serviceRevenue)}`,
    `near-term (next 2 quarters) weighted ${eur(s.nearTermWeighted)}`,
    `${s.quartersCount} quarters of coverage`,
    `${s.stalledCount} stalled deals, ${s.pastCloseCount} past expected close`,
  ].join("; ");

  const text = await aiText({
    system:
      "You are a finance analyst for HMD Secure. In 2-3 short sentences, summarise pipeline health for a Sales Manager / Finance reader. Be concrete, cite the biggest risk, and end with one recommended managerial action. No markdown, no bullet points, plain prose.",
    user: `Pipeline facts: ${facts}.`,
    maxTokens: 220,
  });
  if (text) return { text, source: "ai" };

  // Deterministic fallback.
  const risk =
    s.stalledCount + s.pastCloseCount > 0
      ? `${s.stalledCount} stalled and ${s.pastCloseCount} past-close deals put part of this at risk — chase those first.`
      : `No deals are stalled or past close, so the forecast is currently clean.`;
  return {
    text:
      `The weighted 3-year pipeline stands at ${eur(s.weightedTotal)} across ${s.quartersCount} quarters, ` +
      `split ${eur(s.deviceRevenue)} device and ${eur(s.serviceRevenue)} service revenue. ` +
      `Near-term (next two quarters) weighted value is ${eur(s.nearTermWeighted)}. ${risk}`,
    source: "fallback",
  };
}
