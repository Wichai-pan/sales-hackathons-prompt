// Rep dashboard (Owner / SA-O1) — rendered through the canvas RepDashboardScreen.
// The real AI-assisted intake HERO (<IntakePanel/>, email → AI draft → Apply) is mounted via
// the screen's intakeSlot, so no hero capability is lost in the canvas migration. Next-best-actions
// are derived from real rep signals (at-risk deals, offers awaiting approval).

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { STAGE_LABEL, DIRECT_STAGES } from "@/lib/forecast";
import { formatEUR, daysSince } from "@/lib/utils";
import { IntakePanel } from "@/components/intake-panel";
import { RepDashboardScreen, type RepDashboardData, type NextBestAction } from "@/components/canvas/screens/RepDashboardScreen";
import type { Deal as CanvasDeal, Offer as CanvasOffer, ActivityEvent as CanvasActivity } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export default async function RepDashboard() {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const [accounts, deals, pendingOffers, activity] = await Promise.all([
    prisma.account.findMany({
      where: { ownerRepId: user.id },
      include: { _count: { select: { deals: true, cases: true, offers: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.deal.findMany({
      where: { ownerRepId: user.id, status: "OPEN" },
      include: { account: true, forecastPeriods: { select: { deviceUnits: true, totalRevenue: true } } },
      orderBy: { lastActivityAt: "desc" },
    }),
    prisma.offer.findMany({
      where: { createdById: user.id, status: { in: ["PENDING_SM", "PENDING_FINANCE", "SM_APPROVED"] } },
      include: { account: true, deal: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activityEvent.findMany({
      where: { account: { ownerRepId: user.id } },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const dealValue = (d: (typeof deals)[number]) =>
    d.forecastPeriods.reduce((s, p) => s + p.totalRevenue, 0);

  const atRisk = deals.filter(
    (d) => daysSince(d.lastActivityAt) >= 14 || (d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now()),
  );

  // Per-account roll-ups (devices + pipeline value) from the deals we already loaded.
  const acctAgg = new Map<string, { devices: number; arr: number }>();
  for (const d of deals) {
    const a = acctAgg.get(d.accountId) ?? { devices: 0, arr: 0 };
    a.devices += d.forecastPeriods.reduce((s, p) => s + p.deviceUnits, 0);
    a.arr += dealValue(d);
    acctAgg.set(d.accountId, a);
  }

  const toCanvasDeal = (d: (typeof deals)[number]): CanvasDeal & { aiSummary?: string } => ({
    id: d.id,
    accountId: d.accountId,
    accountName: d.account.name,
    name: d.name,
    channel: d.channel as CanvasDeal["channel"],
    stage: d.stage as unknown as CanvasDeal["stage"],
    probability: d.probability,
    expectedCloseDate: d.expectedCloseDate?.toISOString(),
    lastActivityAt: d.lastActivityAt.toISOString(),
    status: d.status as unknown as CanvasDeal["status"],
    serviceModel: d.serviceModel as unknown as CanvasDeal["serviceModel"],
    amount: dealValue(d),
  });

  // Open pipeline grouped by stage (excludes closed stages), matching the prior dashboard.
  const openDealsByStage = DIRECT_STAGES.filter((s) => s !== "WON" && s !== "LOST").map((stage) => ({
    stage: STAGE_LABEL[stage],
    deals: deals.filter((d) => d.stage === stage).map(toCanvasDeal),
  }));

  // Derived next-best-actions from real signals — no AI call, deterministic & instant.
  const nextBestActions: NextBestAction[] = [
    ...atRisk.slice(0, 4).map((d) => {
      const pastClose = !!(d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now());
      return {
        id: `deal-${d.id}`,
        title: `Follow up: ${d.name}`,
        accountName: d.account.name,
        reason: pastClose ? "past expected close" : `${daysSince(d.lastActivityAt)}d since last touch`,
        urgency: "high" as const,
        eta: "Today",
      };
    }),
    ...pendingOffers.slice(0, 3).map((o) => ({
      id: `offer-${o.id}`,
      title: `Chase approval: ${o.deal?.name ?? o.account.name} v${o.version}`,
      accountName: o.account.name,
      reason: `awaiting ${o.status.replace("_", " ").toLowerCase()}`,
      urgency: "medium" as const,
      eta: "This week",
    })),
  ].slice(0, 6);

  const totalPipeline = deals.reduce((s, d) => s + dealValue(d), 0);

  const data: RepDashboardData = {
    greetingName: user.name.split(" ")[0],
    greetingSubtitle: `${accounts.length} accounts · ${deals.length} open deals · ${pendingOffers.length} offers in approval`,
    kpis: [
      { label: "Open deals", value: String(deals.length) },
      { label: "Pipeline value", value: formatEUR(totalPipeline) },
      { label: "Offers in approval", value: String(pendingOffers.length) },
      { label: "At-risk deals", value: String(atRisk.length) },
    ],
    nextBestActions,
    myAccounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      industry: a.industry,
      region: a.region,
      segment: a.segment,
      devices: acctAgg.get(a.id)?.devices ?? 0,
      arr: acctAgg.get(a.id)?.arr ?? 0,
    })),
    openDealsByStage,
    atRiskDeals: atRisk.map(toCanvasDeal),
    offersInApproval: pendingOffers.map((o): CanvasOffer => ({
      id: o.id,
      dealId: o.dealId ?? undefined,
      accountName: o.account.name,
      title: o.deal?.name ?? `Offer v${o.version}`,
      version: o.version,
      status: o.status as unknown as CanvasOffer["status"],
      subtotal: o.subtotal,
      discountPercent: o.discountPercent,
      total: o.total,
      locked: o.locked,
      currency: "EUR",
    })),
    recentActivity: activity.map((e): CanvasActivity => ({
      id: e.id,
      accountId: e.accountId ?? undefined,
      type: e.type as unknown as CanvasActivity["type"],
      summary: e.summary,
      actorName: e.account?.name,
      createdAt: e.createdAt.toISOString(),
    })),
    intakeSlot: <IntakePanel />,
  };

  return <RepDashboardScreen data={data} />;
}
