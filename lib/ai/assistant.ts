// lib/ai/assistant.ts — "Aino", the in-app AI analyst/assistant (floating chat).
// Answers the user's question using a LIVE, role-aware data snapshot + guides CRM usage.
// Featherless via aiText; deterministic keyword fallback so it always responds. Read-only.

import "server-only";
import { prisma } from "@/lib/db";
import { aiText } from "./client";
import { daysSince } from "@/lib/utils";
import { stalledDeals, pastCloseDeals, threeYearForecast } from "@/lib/reporting";
import { forecastCategories } from "@/lib/targets";
import type { Role } from "@prisma/client";

const eur = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

/** A compact, role-relevant snapshot of the live data so Aino answers with real numbers. */
async function snapshot(userId: string, role: Role): Promise<string> {
  const lines: string[] = [];
  if (role === "REP") {
    const [accounts, deals, pending] = await Promise.all([
      prisma.account.count({ where: { ownerRepId: userId } }),
      prisma.deal.findMany({ where: { ownerRepId: userId, status: "OPEN" }, include: { account: true } }),
      prisma.offer.count({ where: { createdById: userId, status: { in: ["PENDING_SM", "PENDING_FINANCE"] } } }),
    ]);
    const atRisk = deals.filter((d) => daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()));
    lines.push(`My accounts: ${accounts}. My open deals: ${deals.length}. Offers awaiting approval: ${pending}.`);
    lines.push(`At-risk deals (${atRisk.length}): ${atRisk.slice(0, 5).map((d) => `${d.name} [${d.account.name}]`).join("; ") || "none"}.`);
  } else if (role === "SALES_MANAGER") {
    const [stalled, pastClose, pendingSM, cats] = await Promise.all([stalledDeals(), pastCloseDeals(), prisma.offer.count({ where: { status: "PENDING_SM" } }), forecastCategories()]);
    lines.push(`Stalled deals (>14d): ${stalled.length}. Past expected close: ${pastClose.length}. Offers awaiting MY (SM) approval: ${pendingSM}.`);
    lines.push(`Forecast: committed ${eur(cats.committed)}, at-risk ${eur(cats.atRisk)}, target ${eur(cats.target)}, gap ${eur(cats.gapToTarget)}.`);
    lines.push(`Top stalled: ${stalled.slice(0, 4).map((d) => d.name).join("; ") || "none"}.`);
  } else if (role === "FINANCE") {
    const [fc, pendingFin] = await Promise.all([threeYearForecast(), prisma.offer.count({ where: { status: "PENDING_FINANCE" } })]);
    lines.push(`3-yr weighted pipeline: ${eur(fc.totals.weightedRevenue)} (device ${eur(fc.totals.deviceRevenue)} / service ${eur(fc.totals.serviceRevenue)}). Offers awaiting MY (Finance) approval: ${pendingFin}.`);
  } else if (role === "TAM") {
    const cases = await prisma.case.findMany({ where: { assignedTamId: userId, status: { not: "CLOSED" } } });
    const overdue = cases.filter((c) => c.dueDate && c.dueDate.getTime() < Date.now());
    lines.push(`My open cases: ${cases.length}. Overdue (SLA): ${overdue.length}.`);
    lines.push(`Open cases: ${cases.slice(0, 5).map((c) => `${c.title} [${c.priority}]`).join("; ") || "none"}.`);
  }
  return lines.join("\n");
}

const HELP = `How the CRM works (for guidance answers):
- Apply a discount: open a deal → "Build offer" → add catalog items → set discount % + a justification → Submit. It routes to the Sales Manager, then Finance.
- Open a service case: open the account → "New case".
- Move a deal stage: open the deal → "Move stage". Reseller deals have no Contract-negotiation stage.
- See the forecast: Finance/Manager dashboards (3-year, device vs service, stage-weighted).
- Notifications are in-app (bell, top-right).`;

export async function askAino(question: string, opts: { userId: string; role: Role; name: string }): Promise<{ answer: string; source: "ai" | "fallback" }> {
  const snap = await snapshot(opts.userId, opts.role);

  const ai = await aiText({
    system:
      `You are "Aino", the AI analyst built into HMD Secure's CRM. The user is ${opts.name} (role: ${opts.role}). ` +
      `Answer their question concisely and CONCRETELY using the live data snapshot below, or guide them on how to use the CRM. ` +
      `Prefer specific names/numbers from the snapshot. 1-4 sentences, plain prose, no markdown.\n\n` +
      `LIVE DATA:\n${snap}\n\n${HELP}`,
    user: question,
    maxTokens: 260,
  });
  if (ai) return { answer: ai, source: "ai" };

  // Deterministic fallback — keyword routing over the snapshot + help.
  const q = question.toLowerCase();
  if (/risk|stalled|stuck|overdue|past close/.test(q)) return { answer: snap.split("\n").find((l) => /at-risk|stalled|overdue/i.test(l)) ?? snap, source: "fallback" };
  if (/forecast|pipeline|committed|target|gap|revenue/.test(q)) return { answer: snap.split("\n").find((l) => /forecast|weighted|pipeline/i.test(l)) ?? snap, source: "fallback" };
  if (/approv|offer|discount|pending/.test(q)) {
    if (/how|apply|create|build/.test(q)) return { answer: HELP.split("\n").find((l) => /discount/i.test(l)) ?? HELP, source: "fallback" };
    return { answer: snap, source: "fallback" };
  }
  if (/case|ticket|issue|support|sla/.test(q)) return { answer: snap.split("\n").find((l) => /case/i.test(l)) ?? HELP, source: "fallback" };
  if (/how|where|do i|guide|help/.test(q)) return { answer: HELP, source: "fallback" };
  return { answer: `Here's where things stand:\n${snap}`, source: "fallback" };
}
