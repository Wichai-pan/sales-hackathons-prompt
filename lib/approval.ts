// Offer approval STATE MACHINE (SLICE SA-V2, Stream B / V).
// This is the contract Owner's offer BUILDER calls when a rep submits an offer.
//
// State flow enforced here (subset of OfferStatus that the chain uses):
//   DRAFT --submit--> PENDING_SM --smApprove--> PENDING_FINANCE --financeApprove--> APPROVED
//                        |                          |
//                     smReject                  financeReject
//                        v                          v
//                     REJECTED                   REJECTED
//
// Business rules (BUILD-SPEC "Offer Approval"):
//   - discountPercent > 0 REQUIRES a discountJustification (else throw).
//   - While an offer is pending it is LOCKED (no edits); reject unlocks for revision.
//   - Finance CANNOT approve before the Sales Manager (hard guard).
//   - Every transition appends an ActivityEvent and fires in-app notify() (no email).
//
// ASSUMPTION (documented): a ZERO-discount offer needs no approval chain. submitForApproval
// short-circuits it straight to APPROVED + unlocked and records OFFER_APPROVED — there is no
// Approval row because there was nothing to approve. Any discount > 0 enters the SM->Finance chain.

import type { ApprovalStep, ApprovalStatus, User } from "@prisma/client";
import { prisma } from "./db";
import { notify } from "./notify";
import { createActivityEvent } from "./activity";

/** Fetch every active user holding a given role (notification fan-out targets). */
export async function usersByRole(role: "SALES_MANAGER" | "FINANCE"): Promise<User[]> {
  return prisma.user.findMany({ where: { role } });
}

/**
 * Rep submits an offer for approval.
 * - discount > 0 with no justification -> throw.
 * - discount > 0 -> PENDING_SM + locked, open SM Approval, notify all Sales Managers.
 * - discount == 0 -> APPROVED + unlocked, no chain (documented assumption above).
 */
export async function submitForApproval(offerId: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("Offer not found");

  if (offer.discountPercent > 0 && !offer.discountJustification?.trim()) {
    throw new Error("Discount requires justification");
  }

  // No discount -> nothing to approve. Auto-approve and unlock.
  if (offer.discountPercent === 0) {
    const updated = await prisma.offer.update({
      where: { id: offerId },
      data: { status: "APPROVED", locked: false },
    });
    await createActivityEvent({
      accountId: offer.accountId,
      actorId: offer.createdById,
      type: "OFFER_APPROVED",
      summary: `Offer auto-approved (no discount) — ${money(offer.total)}`,
      linkedRecordType: "OFFER",
      linkedRecordId: offer.id,
    });
    return updated;
  }

  // Discount -> enter the SM approval chain. Atomic: lock + open SM approval.
  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "PENDING_SM", locked: true },
    }),
    prisma.approval.create({
      data: { offerId, step: "SALES_MANAGER" as ApprovalStep, status: "PENDING" as ApprovalStatus },
    }),
  ]);

  await createActivityEvent({
    accountId: offer.accountId,
    actorId: offer.createdById,
    type: "OFFER_SUBMITTED",
    summary: `Offer submitted for approval — ${offer.discountPercent}% discount, ${money(offer.total)}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  const managers = await usersByRole("SALES_MANAGER");
  await Promise.all(
    managers.map((m) =>
      notify({
        recipientId: m.id,
        title: "Offer awaiting your approval",
        body: `An offer with a ${offer.discountPercent}% discount (${money(offer.total)}) needs Sales Manager approval.`,
        linkedRecordType: "OFFER",
        linkedRecordId: offer.id,
      })
    )
  );

  return updated;
}

/**
 * Sales Manager approves. Requires PENDING_SM.
 * SM Approval -> APPROVED; offer -> PENDING_FINANCE (stays locked); open Finance Approval;
 * notify all Finance users.
 */
export async function smApprove(offerId: string, approverId: string, comment?: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING_SM") {
    throw new Error("Offer is not pending Sales Manager approval");
  }

  const smApproval = await prisma.approval.findFirst({
    where: { offerId, step: "SALES_MANAGER", status: "PENDING" },
  });
  if (!smApproval) throw new Error("No pending Sales Manager approval found");

  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "PENDING_FINANCE", locked: true },
    }),
    prisma.approval.update({
      where: { id: smApproval.id },
      data: { status: "APPROVED", approverId, comment: comment ?? null, decidedAt: new Date() },
    }),
    prisma.approval.create({
      data: { offerId, step: "FINANCE" as ApprovalStep, status: "PENDING" as ApprovalStatus },
    }),
  ]);

  await createActivityEvent({
    accountId: offer.accountId,
    actorId: approverId,
    type: "OFFER_SM_APPROVED",
    summary: `Sales Manager approved offer — routed to Finance${comment?.trim() ? `: ${comment.trim()}` : ""}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  const finance = await usersByRole("FINANCE");
  await Promise.all(
    finance.map((f) =>
      notify({
        recipientId: f.id,
        title: "Offer awaiting Finance approval",
        body: `A Sales-Manager-approved offer (${offer.discountPercent}% discount, ${money(offer.total)}) needs Finance approval.`,
        linkedRecordType: "OFFER",
        linkedRecordId: offer.id,
      })
    )
  );

  return updated;
}

/**
 * Sales Manager rejects. Requires PENDING_SM.
 * SM Approval -> REJECTED (+ reason); offer -> REJECTED, UNLOCKED for revision; notify the rep.
 */
export async function smReject(offerId: string, approverId: string, comment: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING_SM") {
    throw new Error("Offer is not pending Sales Manager approval");
  }
  if (!comment?.trim()) throw new Error("Rejection requires a reason");

  const smApproval = await prisma.approval.findFirst({
    where: { offerId, step: "SALES_MANAGER", status: "PENDING" },
  });
  if (!smApproval) throw new Error("No pending Sales Manager approval found");

  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "REJECTED", locked: false },
    }),
    prisma.approval.update({
      where: { id: smApproval.id },
      data: { status: "REJECTED", approverId, comment, decidedAt: new Date() },
    }),
  ]);

  await createActivityEvent({
    accountId: offer.accountId,
    actorId: approverId,
    type: "OFFER_REJECTED",
    summary: `Sales Manager rejected offer: ${comment.trim()}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  await notify({
    recipientId: offer.createdById,
    title: "Offer rejected by Sales Manager",
    body: `Your offer was rejected and unlocked for revision. Reason: ${comment.trim()}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  return updated;
}

/**
 * Finance approves. HARD GUARD: requires PENDING_FINANCE (i.e. SM already approved).
 * Finance Approval -> APPROVED; offer -> APPROVED + UNLOCKED; notify the rep.
 */
export async function financeApprove(offerId: string, approverId: string, comment?: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING_FINANCE") {
    throw new Error("Finance cannot approve before Sales Manager");
  }

  const finApproval = await prisma.approval.findFirst({
    where: { offerId, step: "FINANCE", status: "PENDING" },
  });
  if (!finApproval) throw new Error("No pending Finance approval found");

  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "APPROVED", locked: false },
    }),
    prisma.approval.update({
      where: { id: finApproval.id },
      data: { status: "APPROVED", approverId, comment: comment ?? null, decidedAt: new Date() },
    }),
  ]);

  await createActivityEvent({
    accountId: offer.accountId,
    actorId: approverId,
    type: "OFFER_APPROVED",
    summary: `Finance approved offer — fully approved${comment?.trim() ? `: ${comment.trim()}` : ""}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  await notify({
    recipientId: offer.createdById,
    title: "Offer approved",
    body: `Your offer (${money(offer.total)}) was fully approved by Finance.`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  return updated;
}

/**
 * Finance rejects. Requires PENDING_FINANCE.
 * Finance Approval -> REJECTED (+ reason); offer -> REJECTED, UNLOCKED for revision; notify the rep.
 */
export async function financeReject(offerId: string, approverId: string, comment: string) {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("Offer not found");
  if (offer.status !== "PENDING_FINANCE") {
    throw new Error("Offer is not pending Finance approval");
  }
  if (!comment?.trim()) throw new Error("Rejection requires a reason");

  const finApproval = await prisma.approval.findFirst({
    where: { offerId, step: "FINANCE", status: "PENDING" },
  });
  if (!finApproval) throw new Error("No pending Finance approval found");

  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: { status: "REJECTED", locked: false },
    }),
    prisma.approval.update({
      where: { id: finApproval.id },
      data: { status: "REJECTED", approverId, comment, decidedAt: new Date() },
    }),
  ]);

  await createActivityEvent({
    accountId: offer.accountId,
    actorId: approverId,
    type: "OFFER_REJECTED",
    summary: `Finance rejected offer: ${comment.trim()}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  await notify({
    recipientId: offer.createdById,
    title: "Offer rejected by Finance",
    body: `Your offer was rejected and unlocked for revision. Reason: ${comment.trim()}`,
    linkedRecordType: "OFFER",
    linkedRecordId: offer.id,
  });

  return updated;
}

/** Tiny EUR formatter for activity/notification copy (kept local to avoid UI deps in lib). */
function money(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
