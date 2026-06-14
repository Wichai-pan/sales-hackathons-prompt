// Account 360 — the most important page (Owner / SA-O1) — rendered through the canvas
// Account360Screen. The AI Next Best Action HERO (<NbaPanel/>, Suspense-streamed) and the
// add-note form are preserved by mounting them into the screen's slots/action props.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { NbaPanel, NbaSkeleton } from "@/components/nba-panel";
import { addAccountNote } from "./actions";
import { Account360Screen, type Account360Data } from "@/components/canvas/screens/Account360Screen";
import type {
  Account as CanvasAccount,
  Deal as CanvasDeal,
  Case as CanvasCase,
  Offer as CanvasOffer,
  Contact as CanvasContact,
  ActivityEvent as CanvasActivity,
} from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      ownerRep: true,
      assignedTam: true,
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      deals: { include: { forecastPeriods: { select: { deviceUnits: true, totalRevenue: true } } }, orderBy: { lastActivityAt: "desc" } },
      cases: { include: { service: true, assignedTam: true }, orderBy: { createdAt: "desc" } },
      offers: { include: { deal: true }, orderBy: { updatedAt: "desc" } },
      activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
  if (!account) notFound();

  const notes = await prisma.note.findMany({
    where: { parentType: "ACCOUNT", parentId: id },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  const openDeals = account.deals.filter((d) => d.status === "OPEN");
  const activeCases = account.cases.filter((c) => c.status !== "CLOSED");
  const dealValue = (d: (typeof account.deals)[number]) => d.forecastPeriods.reduce((s, p) => s + p.totalRevenue, 0);
  const arr = account.deals.reduce((s, d) => s + dealValue(d), 0);

  const data: Account360Data = {
    account: {
      id: account.id,
      name: account.name,
      domain: account.domain ?? undefined,
      address: account.address ?? undefined,
      vatId: account.vatId ?? undefined,
      region: account.region,
      segment: account.segment,
      industry: account.industry,
      ownerName: account.ownerRep.name,
      tamName: account.assignedTam?.name,
      arr,
    } satisfies CanvasAccount & { arr?: number },
    openDeals: openDeals.map((d): CanvasDeal => ({
      id: d.id,
      accountId: d.accountId,
      accountName: account.name,
      name: d.name,
      channel: d.channel as CanvasDeal["channel"],
      stage: d.stage as unknown as CanvasDeal["stage"],
      probability: d.probability,
      expectedCloseDate: d.expectedCloseDate?.toISOString(),
      lastActivityAt: d.lastActivityAt.toISOString(),
      status: d.status as unknown as CanvasDeal["status"],
      serviceModel: d.serviceModel as unknown as CanvasDeal["serviceModel"],
      amount: dealValue(d),
    })),
    activeCases: activeCases.map((c): CanvasCase => ({
      id: c.id,
      accountId: c.accountId,
      title: c.title,
      status: c.status as unknown as CanvasCase["status"],
      priority: ({ LOW: "P4", MEDIUM: "P3", HIGH: "P2", CRITICAL: "P1" } as const)[c.priority] ?? "P3",
      serviceName: c.service?.name ?? undefined,
      ownerName: c.assignedTam?.name ?? undefined,
    })),
    offers: account.offers.map((o): CanvasOffer => ({
      id: o.id,
      dealId: o.dealId ?? undefined,
      accountName: account.name,
      title: o.deal?.name ?? `Offer v${o.version}`,
      version: o.version,
      status: o.status as unknown as CanvasOffer["status"],
      subtotal: o.subtotal,
      discountPercent: o.discountPercent,
      total: o.total,
      locked: o.locked,
      currency: "EUR",
    })),
    activity: account.activityEvents.map((e): CanvasActivity => ({
      id: e.id,
      accountId: e.accountId ?? undefined,
      type: e.type as unknown as CanvasActivity["type"],
      summary: e.summary,
      actorName: e.actor?.name,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
    })),
    contacts: account.contacts.map((c): CanvasContact => ({
      id: c.id,
      accountId: c.accountId,
      name: c.name,
      title: c.title ?? undefined,
      decisionRole: (c.decisionRole && c.decisionRole !== "OTHER" ? c.decisionRole : undefined) as CanvasContact["decisionRole"],
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      isPrimary: c.isPrimary,
    })),
    addNoteAction: addAccountNote,
    nbaSlot: (
      <Suspense fallback={<NbaSkeleton />}>
        <NbaPanel accountId={account.id} />
      </Suspense>
    ),
  };

  return <Account360Screen data={data} />;
}
