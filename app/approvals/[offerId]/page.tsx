// Offer approval detail (SLICE SA-V2 / V) — now rendered through the canvas ApprovalDetailScreen.
// Server-side data fetch + role/status gating stay here; the screen is pure presentation.
// The Approve/Reject decision wiring is preserved: when (and only when) the current role can
// act on the current offer status, we wire the screen's approve/reject form props to our
// existing server actions via FormData adapters. Otherwise the decision forms stay inert and
// we surface the same "who can act" messaging our original page showed.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/session";
import {
  ApprovalDetailScreen,
  type ApprovalDetailScreenData,
} from "@/components/canvas/screens/ApprovalDetailScreen";
import type {
  Offer as CanvasOffer,
  OfferStatus as CanvasOfferStatus,
  OfferLineItem as CanvasOfferLineItem,
  Approval as CanvasApproval,
} from "@/lib/canvas/types";
import type {
  OfferStatus as PrismaOfferStatus,
  OfferItemType as PrismaLineItemType,
  ApprovalStatus as PrismaApprovalStatus,
} from "@prisma/client";
import {
  approveAsSM,
  rejectAsSM,
  approveAsFinance,
  rejectAsFinance,
} from "../actions";

export const dynamic = "force-dynamic";

// Our human-readable status labels (kept for the not-actionable messaging).
const STATUS_LABEL: Record<PrismaOfferStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_SM: "Pending Sales Manager",
  SM_APPROVED: "Sales Manager approved",
  PENDING_FINANCE: "Pending Finance",
  FINANCE_APPROVED: "Finance approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// Prisma OfferStatus → canvas OfferStatus (per ENUM MAPPING).
const OFFER_STATUS: Record<PrismaOfferStatus, CanvasOfferStatus> = {
  DRAFT: "DRAFT",
  SUBMITTED: "PENDING_SM",
  PENDING_SM: "PENDING_SM",
  SM_APPROVED: "PENDING_FINANCE",
  PENDING_FINANCE: "PENDING_FINANCE",
  FINANCE_APPROVED: "APPROVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

const LINE_ITEM_TYPE: Record<PrismaLineItemType, CanvasOfferLineItem["itemType"]> = {
  PRODUCT: "PRODUCT",
  SERVICE: "SERVICE",
};

// ApprovalStatus maps 1:1 (PENDING/APPROVED/REJECTED).
const APPROVAL_STATUS: Record<PrismaApprovalStatus, CanvasApproval["status"]> = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export default async function OfferApprovalDetailPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const role = await currentRole();

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      account: true,
      deal: true,
      createdBy: true,
      lineItems: true,
      approvals: {
        include: { approver: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!offer) notFound();

  // Who can act right now? (role + status gated — same rules as before)
  const canActAsSM = role === "SALES_MANAGER" && offer.status === "PENDING_SM";
  const canActAsFinance = role === "FINANCE" && offer.status === "PENDING_FINANCE";
  const canAct = canActAsSM || canActAsFinance;

  // FormData adapters → our existing, role-checked server actions. Only wired when the
  // current role+status can act; the underlying actions re-enforce the role server-side.
  async function approveAdapter(fd: FormData) {
    "use server";
    const comment = String(fd.get("comment") ?? "");
    if (canActAsSM) await approveAsSM(offerId, comment);
    else if (canActAsFinance) await approveAsFinance(offerId, comment);
  }
  async function rejectAdapter(fd: FormData) {
    "use server";
    const comment = String(fd.get("comment") ?? "");
    if (canActAsSM) await rejectAsSM(offerId, comment);
    else if (canActAsFinance) await rejectAsFinance(offerId, comment);
  }

  const mappedOffer: CanvasOffer = {
    id: offer.id,
    dealId: offer.dealId ?? undefined,
    accountName: offer.account.name,
    title: offer.deal ? offer.deal.name : `Offer for ${offer.account.name}`,
    version: offer.version,
    status: OFFER_STATUS[offer.status],
    subtotal: offer.subtotal,
    discountPercent: offer.discountPercent,
    discountJustification: offer.discountJustification ?? undefined,
    total: offer.total,
    locked: offer.locked,
    currency: "EUR",
    preparedBy: offer.createdBy.name,
    validUntil: undefined,
  };

  const lineItems: CanvasOfferLineItem[] = offer.lineItems.map((li) => ({
    id: li.id,
    offerId: offer.id,
    itemType: LINE_ITEM_TYPE[li.itemType],
    nameSnapshot: li.nameSnapshot,
    // No sku snapshot in our schema → screen falls back to showing the item type.
    skuSnapshot: undefined,
    unitPriceSnapshot: li.unitPriceSnapshot,
    quantity: li.quantity,
    lineTotal: li.lineTotal,
  }));

  const history: CanvasApproval[] = offer.approvals.map((a) => ({
    id: a.id,
    offerId: offer.id,
    step: a.step, // ApprovalStep maps 1:1 (SALES_MANAGER / FINANCE)
    status: APPROVAL_STATUS[a.status],
    approverId: a.approverId ?? undefined,
    approverName: a.approver?.name ?? undefined,
    comment: a.comment ?? undefined,
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : undefined,
  }));

  const data: ApprovalDetailScreenData = {
    offer: mappedOffer,
    lineItems,
    history,
    // Only expose the decision forms when the role+status can actually act. When not
    // actionable, leave the props undefined so the screen's forms fall back to noop and
    // we render the gating message below.
    approveAction: canAct ? approveAdapter : undefined,
    rejectAction: canAct ? rejectAdapter : undefined,
  };

  return (
    <>
      <ApprovalDetailScreen data={data} />
      {!canAct && (
        <div className="px-6 lg:px-8 pb-6 -mt-2">
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            {offer.status === "APPROVED"
              ? "This offer is fully approved. No further action needed."
              : offer.status === "REJECTED"
                ? "This offer was rejected and unlocked for revision."
                : offer.status === "PENDING_SM"
                  ? "Awaiting Sales Manager approval. Only a Sales Manager can act here."
                  : offer.status === "PENDING_FINANCE"
                    ? "Awaiting Finance approval. Only Finance can act here."
                    : `No approval action is available for this offer's current status (${STATUS_LABEL[offer.status]}).`}
          </div>
        </div>
      )}
    </>
  );
}
