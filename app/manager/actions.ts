"use server";

// Manager actions (SLICE SA-V4). Reassign an OPEN deal to another rep.
// Writes deal.ownerRepId -> logs an ActivityEvent -> notifies the new rep ->
// revalidates the manager dashboard. Uses shared helpers only.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import { notify } from "@/lib/notify";

export async function reassignDeal(formData: FormData): Promise<void> {
  const dealId = String(formData.get("dealId") ?? "");
  const newRepId = String(formData.get("newRepId") ?? "");
  if (!dealId || !newRepId) return;

  const [actor, deal, newRep] = await Promise.all([
    currentUser(),
    prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        account: { select: { id: true, name: true } },
        ownerRep: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: newRepId } }),
  ]);

  if (!deal || !newRep) return;
  if (deal.ownerRepId === newRepId) return; // no-op

  await prisma.deal.update({
    where: { id: dealId },
    data: { ownerRepId: newRepId },
  });

  await createActivityEvent({
    accountId: deal.accountId,
    actorId: actor?.id ?? null,
    type: "DEAL_REASSIGNED",
    summary: `Deal "${deal.name}" reassigned from ${deal.ownerRep.name} to ${newRep.name}`,
    linkedRecordType: "DEAL",
    linkedRecordId: deal.id,
  });

  await notify({
    recipientId: newRep.id,
    title: "Deal reassigned to you",
    body: `${actor?.name ?? "A manager"} assigned "${deal.name}" (${deal.account.name}) to you.`,
    linkedRecordType: "DEAL",
    linkedRecordId: deal.id,
  });

  revalidatePath("/manager");
}
