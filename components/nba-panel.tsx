// AI Next Best Action panel (Owner). HERO magic moment.
// SA-O1: live via deterministic RULES (no LLM dependency) so the slot already works.
// SA-O4 will route this through Featherless (lib/ai/nba.ts) with these same rules as fallback.

import { prisma } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/forecast";
import { daysSince } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Advice = { recommendation: string; reasons: string[]; draftEmail?: string | null };

export async function NbaPanel({ accountId }: { accountId: string }) {
  const [deals, cases, offers] = await Promise.all([
    prisma.deal.findMany({ where: { accountId, status: "OPEN" } }),
    prisma.case.findMany({ where: { accountId, status: { not: "CLOSED" } } }),
    prisma.offer.findMany({ where: { accountId } }),
  ]);

  const advice = ruleBasedAdvice(deals, cases, offers);

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Next best action</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{advice.recommendation}</p>
        <ul className="mt-2 space-y-1">
          {advice.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {advice.draftEmail && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary">Draft email</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{advice.draftEmail}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// Deterministic rules — priority order mirrors BUILD-SPEC / lib/ai/nba.ts fallback.
function ruleBasedAdvice(
  deals: { name: string; stage: string; lastActivityAt: Date; expectedCloseDate: Date | null }[],
  cases: { title: string; priority: string; status: string }[],
  offers: { status: string }[],
): Advice {
  const hotCase = cases.find((c) => c.priority === "HIGH" || c.priority === "CRITICAL");
  const pendingOffer = offers.find((o) => o.status === "PENDING_SM" || o.status === "PENDING_FINANCE");
  const inTest = deals.find((d) => d.stage === "CUSTOMER_TEST");
  const pastClose = deals.find((d) => d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now());
  const staleDeal = deals.find((d) => daysSince(d.lastActivityAt) >= 14);

  if (hotCase)
    return {
      recommendation: `Resolve the ${hotCase.priority.toLowerCase()}-priority case "${hotCase.title}" before pushing any deal.`,
      reasons: ["An open high-priority service case erodes trust and blocks the close.", "Loop in the TAM so sales keeps momentum."],
    };
  if (pendingOffer)
    return {
      recommendation: "Chase the pending offer approval so the deal can move forward.",
      reasons: ["An offer is awaiting approval.", "Idle approvals slip the close date."],
    };
  if (inTest)
    return {
      recommendation: `Schedule a decision meeting — "${inTest.name}" is in ${STAGE_LABEL["CUSTOMER_TEST"]}.`,
      reasons: ["Customer test is the highest win-signal stage before close.", "A decision meeting converts evaluation into commitment."],
      draftEmail: "Hi,\n\nThanks for evaluating HMD Secure. Now that testing is underway, could we set up a short call this week to review results and outline next steps toward rollout?\n\nBest regards",
    };
  if (pastClose || staleDeal) {
    const d = pastClose ?? staleDeal!;
    return {
      recommendation: `Follow up on "${d.name}" — it's ${pastClose ? "past its expected close date" : `stalled (${daysSince(d.lastActivityAt)} days, no activity)`}.`,
      reasons: [pastClose ? "The expected close date has passed." : "No activity for 14+ days signals risk.", "A timely touch keeps the deal alive."],
      draftEmail: `Hi,\n\nChecking in on where things stand with ${d.name}. Happy to answer any open questions or adjust the proposal — what would help you move forward?\n\nBest regards`,
    };
  }
  return {
    recommendation: "Log your latest conversation and confirm the next concrete step with the customer.",
    reasons: ["Keeping the timeline current makes every later analysis accurate."],
  };
}
