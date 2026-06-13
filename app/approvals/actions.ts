"use server";

// Server-action wrappers for the offer approval queue (SLICE SA-V2 / V).
// Each resolves the acting user via currentUser(), delegates to the lib/approval.ts
// state machine (which enforces the rules + fires notify/createActivityEvent),
// then revalidates the queue and the offer detail page.

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session";
import { smApprove, smReject, financeApprove, financeReject } from "@/lib/approval";

function revalidate(offerId: string) {
  revalidatePath("/approvals");
  revalidatePath(`/approvals/${offerId}`);
}

export async function approveAsSM(offerId: string, comment: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "SALES_MANAGER") throw new Error("Only a Sales Manager can approve this step");
  await smApprove(offerId, user.id, comment?.trim() || undefined);
  revalidate(offerId);
}

export async function rejectAsSM(offerId: string, comment: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "SALES_MANAGER") throw new Error("Only a Sales Manager can reject this step");
  await smReject(offerId, user.id, comment);
  revalidate(offerId);
}

export async function approveAsFinance(offerId: string, comment: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "FINANCE") throw new Error("Only Finance can approve this step");
  await financeApprove(offerId, user.id, comment?.trim() || undefined);
  revalidate(offerId);
}

export async function rejectAsFinance(offerId: string, comment: string) {
  const user = await currentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "FINANCE") throw new Error("Only Finance can reject this step");
  await financeReject(offerId, user.id, comment);
  revalidate(offerId);
}
