// lib/targets.ts — quarter/3-yr forecast decomposition for Sales Manager #4:
// committed vs at-risk vs gap-to-target. Standalone (does not touch lib/reporting.ts).

import { prisma } from "./db";
import { STAGE_PROBABILITY } from "./forecast";
import { daysSince } from "./utils";

/** Team 3-year weighted target (CONFIGURABLE ASSUMPTION — no quota field in the brief). */
export const TEAM_TARGET_3YR = 30_000_000;

export interface ForecastCategories {
  committed: number; // high-confidence, on-track weighted pipeline
  atRisk: number; // stalled (>14d) or past expected close
  upside: number; // early-stage, not yet committed
  target: number;
  gapToTarget: number; // target − committed
}

export async function forecastCategories(): Promise<ForecastCategories> {
  const deals = await prisma.deal.findMany({
    where: { status: "OPEN" },
    include: { forecastPeriods: { select: { weightedRevenue: true } } },
  });
  const now = Date.now();
  let committed = 0, atRisk = 0, upside = 0;
  for (const d of deals) {
    const weighted = d.forecastPeriods.reduce((s, p) => s + p.weightedRevenue, 0);
    const stale = daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate ? d.expectedCloseDate.getTime() < now : false);
    const prob = d.probability || STAGE_PROBABILITY[d.stage] || 0;
    if (stale) atRisk += weighted;
    else if (prob >= 70) committed += weighted; // CUSTOMER_TEST(70) / CONTRACT_NEGOTIATION(90) / WON(100)
    else upside += weighted;
  }
  return {
    committed: Math.round(committed),
    atRisk: Math.round(atRisk),
    upside: Math.round(upside),
    target: TEAM_TARGET_3YR,
    gapToTarget: Math.round(Math.max(0, TEAM_TARGET_3YR - committed)),
  };
}
