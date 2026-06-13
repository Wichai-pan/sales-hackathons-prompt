// lib/ai/nba.ts — HERO magic moment: AI Next Best Action on the account page.
// Reads a compact account-context object (caller builds it from Prisma) and returns advice.
// MUST NOT mutate records. Deterministic fallback rules per BUILD-SPEC so it always renders.

import { z } from "zod";
import { aiJSON } from "./client";

// Caller assembles this from the account's deals/cases/offers/notes.
export type NbaContext = {
  accountName: string;
  deals: {
    name: string;
    stage: string;
    channel: "DIRECT" | "RESELLER";
    daysSinceActivity: number;
    pastExpectedClose: boolean;
  }[];
  cases: { title: string; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; status: string }[];
  offers: { status: string; pendingApproval: boolean }[];
  latestNote?: string | null;
};

export const NbaSchema = z.object({
  recommendation: z.string(),
  reasons: z.array(z.string()).min(1).max(3),
  draftEmail: z.string().nullable(),
});
export type Nba = z.infer<typeof NbaSchema>;

const SYSTEM = `You are a sales analyst embedded in HMD Secure's CRM.
Given one account's current state, output the single best next action for the sales rep.
Return STRICT JSON: { "recommendation": string, "reasons": string[1..3], "draftEmail": string|null }.
Be concrete and specific to the data. Prefer unblocking deals: an open high-priority case blocks a close;
a stalled deal (>14 days) needs a follow-up; an offer pending approval needs a nudge; a deal in customer
test needs a decision meeting. Only include draftEmail if an outbound email is the recommended action.`;

export async function nextBestAction(ctx: NbaContext): Promise<{ nba: Nba; source: "ai" | "fallback" }> {
  const ai = await aiJSON<Nba>({
    system: SYSTEM,
    user: `Account state:\n${JSON.stringify(ctx, null, 2)}`,
    maxTokens: 450,
  });
  const parsed = ai ? NbaSchema.safeParse(ai) : null;
  if (parsed?.success) return { nba: parsed.data, source: "ai" };
  return { nba: fallbackNba(ctx), source: "fallback" };
}

// ---- Deterministic fallback rules (BUILD-SPEC order of priority) ----
function fallbackNba(ctx: NbaContext): Nba {
  const hotCase = ctx.cases.find(
    (c) => (c.priority === "HIGH" || c.priority === "CRITICAL") && c.status !== "CLOSED",
  );
  const pendingOffer = ctx.offers.find((o) => o.pendingApproval);
  const staleDeal = ctx.deals.find((d) => d.daysSinceActivity >= 14);
  const pastClose = ctx.deals.find((d) => d.pastExpectedClose);
  const inTest = ctx.deals.find((d) => d.stage === "CUSTOMER_TEST");

  if (hotCase)
    return {
      recommendation: `Resolve the open ${hotCase.priority.toLowerCase()}-priority case "${hotCase.title}" before pushing any deal.`,
      reasons: [
        "An unresolved high-priority service case erodes trust and blocks the close.",
        "TAM should be engaged so sales can keep momentum.",
      ],
      draftEmail: null,
    };
  if (pendingOffer)
    return {
      recommendation: "Chase the pending offer approval so the deal can move forward.",
      reasons: ["An offer is stuck awaiting approval.", "Approvals left idle slip the close date."],
      draftEmail: null,
    };
  if (inTest)
    return {
      recommendation: `Schedule a decision meeting — "${inTest.name}" is in Customer Test.`,
      reasons: ["Customer test is the highest-win-signal stage before close.", "A decision meeting converts evaluation into commitment."],
      draftEmail: `Hi,\n\nThanks for evaluating HMD Secure. Now that testing is underway, could we set up a short call this week to review results and outline next steps toward rollout?\n\nBest regards`,
    };
  if (pastClose || staleDeal) {
    const d = pastClose ?? staleDeal!;
    return {
      recommendation: `Follow up on "${d.name}" — it's ${pastClose ? "past its expected close date" : `stalled (${d.daysSinceActivity} days no activity)`}.`,
      reasons: [pastClose ? "The expected close date has passed." : "No activity for 14+ days signals risk.", "A timely touch keeps the deal alive."],
      draftEmail: `Hi,\n\nChecking in on where things stand with ${d.name}. Happy to answer any open questions or adjust the proposal — what would help you move forward?\n\nBest regards`,
    };
  }
  return {
    recommendation: "Log your latest conversation and confirm the next concrete step with the customer.",
    reasons: ["Keeping the timeline current makes every later analysis accurate."],
    draftEmail: null,
  };
}
