// Offer detail (Owner / SA-O3) — rendered through the canvas OfferDetailScreen.
// A polished customer-facing proposal view (hero, line items, investment summary) + the
// approval-history timeline. Approve/Reject controls live in the SM/Finance queues (/approvals);
// the screen's optional send/accept forms are intentionally not wired (no broken placeholders).

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { submitForApproval } from "@/lib/approval";
import { OfferDetailScreen, type OfferDetailScreenData } from "@/components/canvas/screens/OfferDetailScreen";
import type {
  Offer as CanvasOffer,
  OfferLineItem as CanvasLineItem,
  Approval as CanvasApproval,
} from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      account: true,
      deal: true,
      createdBy: true,
      lineItems: true,
      approvals: { include: { approver: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!offer) notFound();

  // A DRAFT offer can be submitted into the approval chain straight from this page
  // (no discount -> auto-approved; discount -> PENDING_SM + locked + SM notified).
  async function submitAction() {
    "use server";
    await submitForApproval(id);
    redirect(`/offers/${id}`);
  }

  const data: OfferDetailScreenData = {
    offer: {
      id: offer.id,
      dealId: offer.dealId ?? undefined,
      accountName: offer.account.name,
      title: `${offer.deal?.name ?? "Offer"} · v${offer.version}`,
      version: offer.version,
      status: offer.status as unknown as CanvasOffer["status"],
      subtotal: offer.subtotal,
      discountPercent: offer.discountPercent,
      discountJustification: offer.discountJustification ?? undefined,
      total: offer.total,
      locked: offer.locked,
      currency: "EUR",
      preparedBy: offer.createdBy.name,
    },
    lineItems: offer.lineItems.map((li): CanvasLineItem => ({
      id: li.id,
      offerId: li.offerId,
      itemType: li.itemType as unknown as CanvasLineItem["itemType"],
      nameSnapshot: li.nameSnapshot,
      unitPriceSnapshot: li.unitPriceSnapshot,
      quantity: li.quantity,
      lineTotal: li.lineTotal,
    })),
    approvals: offer.approvals.map((a): CanvasApproval => ({
      id: a.id,
      offerId: a.offerId,
      step: a.step as unknown as CanvasApproval["step"],
      status: a.status as unknown as CanvasApproval["status"],
      approverName: a.approver?.name ?? undefined,
      comment: a.comment ?? undefined,
      decidedAt: a.decidedAt?.toISOString(),
    })),
    backHref: `/accounts/${offer.accountId}`,
    backLabel: offer.account.name,
    submitAction: offer.status === "DRAFT" ? submitAction : undefined,
  };

  return <OfferDetailScreen data={data} />;
}
