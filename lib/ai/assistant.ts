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
    const [accounts, deals, pending, wonLost] = await Promise.all([
      prisma.account.findMany({ where: { ownerRepId: userId }, select: { name: true } }),
      prisma.deal.findMany({ where: { ownerRepId: userId, status: "OPEN" }, include: { account: true } }),
      prisma.offer.count({ where: { createdById: userId, status: { in: ["PENDING_SM", "PENDING_FINANCE"] } } }),
      prisma.deal.groupBy({ by: ["status"], where: { ownerRepId: userId, status: { in: ["WON", "LOST"] } }, _count: true }),
    ]);
    const won = wonLost.find((w) => w.status === "WON")?._count ?? 0;
    const lost = wonLost.find((w) => w.status === "LOST")?._count ?? 0;
    const atRisk = deals.filter((d) => daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()));
    const byStage = deals.reduce<Record<string, number>>((m, d) => ((m[d.stage] = (m[d.stage] ?? 0) + 1), m), {});
    lines.push(`My book: ${accounts.length} accounts — ${accounts.slice(0, 8).map((a) => a.name).join(", ")}.`);
    lines.push(`My open deals: ${deals.length} (by stage: ${Object.entries(byStage).map(([s, n]) => `${s} ${n}`).join(", ") || "none"}). Offers awaiting approval: ${pending}.`);
    lines.push(`Closed so far: ${won} won, ${lost} lost.`);
    lines.push(`At-risk deals (${atRisk.length}): ${atRisk.slice(0, 5).map((d) => `${d.name} [${d.account.name}, ${daysSince(d.lastActivityAt)}d idle]`).join("; ") || "none"}.`);
  } else if (role === "SALES_MANAGER") {
    const [stalled, pastClose, pendingSM, cats, reps] = await Promise.all([stalledDeals(), pastCloseDeals(), prisma.offer.count({ where: { status: "PENDING_SM" } }), forecastCategories(), prisma.user.findMany({ where: { role: "REP" }, select: { id: true, name: true } })]);
    const repDealCounts = await Promise.all(reps.map(async (r) => ({ name: r.name, n: await prisma.deal.count({ where: { ownerRepId: r.id, status: "OPEN" } }) })));
    lines.push(`My team: ${repDealCounts.map((r) => `${r.name} (${r.n} open)`).join(", ")}.`);
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

export interface AinoAction { label: string; prompt: string }

/** A personalised greeting + proactive, data-driven WORK suggestions shown when the panel opens. */
export async function assistantGreeting(opts: { userId: string; role: Role; name: string }): Promise<{ greeting: string; actions: AinoAction[] }> {
  const first = opts.name.split(" ")[0];
  const actions: AinoAction[] = [];
  let situational = "";

  if (opts.role === "REP") {
    const [deals, pending] = await Promise.all([
      prisma.deal.findMany({ where: { ownerRepId: opts.userId, status: "OPEN" }, include: { account: true } }),
      prisma.offer.count({ where: { createdById: opts.userId, status: { in: ["PENDING_SM", "PENDING_FINANCE"] } } }),
    ]);
    const atRisk = deals
      .filter((d) => daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()))
      .sort((a, b) => daysSince(b.lastActivityAt) - daysSince(a.lastActivityAt));
    situational = `you have ${atRisk.length} at-risk deal${atRisk.length === 1 ? "" : "s"}${pending ? ` and ${pending} offer${pending === 1 ? "" : "s"} in approval` : ""}.`;
    if (atRisk[0]) actions.push({ label: `Follow up: ${atRisk[0].name}`, prompt: `How should I follow up on the deal "${atRisk[0].name}" at ${atRisk[0].account.name}? Draft a short email.` });
    if (pending) actions.push({ label: "Check offers in approval", prompt: "What's the status of my offers in approval and what should I do about them?" });
    actions.push({ label: "Plan my day", prompt: "What are the top 3 things I should do today, most urgent first?" });
  } else if (opts.role === "SALES_MANAGER") {
    const [stalled, pendingSM] = await Promise.all([stalledDeals(), prisma.offer.count({ where: { status: "PENDING_SM" } })]);
    situational = `${stalled.length} stalled deal${stalled.length === 1 ? "" : "s"} need attention${pendingSM ? ` and ${pendingSM} offer${pendingSM === 1 ? "" : "s"} awaiting your approval` : ""}.`;
    if (pendingSM) actions.push({ label: "Review approvals", prompt: "Which offers are waiting for my approval and should I approve them?" });
    if (stalled[0]) actions.push({ label: `Unstick: ${stalled[0].name}`, prompt: `The deal "${stalled[0].name}" is stalled — what should I do and who should own it?` });
    actions.push({ label: "Where's my gap to target?", prompt: "What's my committed vs at-risk vs gap to target, and how do I close the gap?" });
  } else if (opts.role === "FINANCE") {
    const pendingFin = await prisma.offer.count({ where: { status: "PENDING_FINANCE" } });
    situational = pendingFin ? `${pendingFin} discounted offer${pendingFin === 1 ? "" : "s"} need${pendingFin === 1 ? "s" : ""} your second approval.` : `the pipeline forecast is ready for you.`;
    if (pendingFin) actions.push({ label: "Review Finance approvals", prompt: "Which offers need my Finance approval and are the discounts justified?" });
    actions.push({ label: "Pipeline health", prompt: "Summarise the 3-year weighted pipeline health and the biggest risk." });
    actions.push({ label: "Plan my day", prompt: "What are the top 3 things I should do today?" });
  } else {
    // TAM
    const cases = await prisma.case.findMany({ where: { assignedTamId: opts.userId, status: { not: "CLOSED" } } });
    const overdue = cases.filter((c) => c.dueDate && c.dueDate.getTime() < Date.now());
    situational = `you have ${cases.length} open case${cases.length === 1 ? "" : "s"}${overdue.length ? `, ${overdue.length} past SLA` : ""}.`;
    const worst = [...cases].sort((a, b) => (b.priority === "CRITICAL" ? 1 : 0) - (a.priority === "CRITICAL" ? 1 : 0))[0];
    if (worst) actions.push({ label: `Tackle: ${worst.title}`, prompt: `What should I do about the case "${worst.title}"? Summarise where it stands and the next step.` });
    actions.push({ label: "My day", prompt: "Which cases should I work first today, most urgent first?" });
  }

  return {
    greeting: `Hi ${first} 👋 — ${situational} Where do you want to start?`,
    actions: actions.slice(0, 4),
  };
}

export async function askAino(question: string, opts: { userId: string; role: Role; name: string }): Promise<{ answer: string; source: "ai" | "fallback" }> {
  const snap = await snapshot(opts.userId, opts.role);

  const ai = await aiText({
    system:
      `You are "Aino", the AI analyst built into HMD Secure's CRM. The user is ${opts.name} (role: ${opts.role}). ` +
      `Talk to them like a proactive colleague who already knows their book of business — lead with WHAT TO DO, not how the tool works. ` +
      `Answer concisely and CONCRETELY using the live data snapshot below, naming specific deals/cases/accounts and numbers. ` +
      `If they ask what to do / to plan their day / where to start, give a SHORT PRIORITISED list (most urgent first, ~3 items) of concrete next actions tied to specific records. ` +
      `Only explain how-to steps if they explicitly ask how. 1-4 sentences (or a tight 3-item list), plain prose, no markdown.\n\n` +
      `LIVE DATA:\n${snap}\n\n${HELP}`,
    user: question,
    maxTokens: 280,
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
