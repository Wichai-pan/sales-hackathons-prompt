"use server";

// Case mutations (SA-V3). Each action: prisma write -> createActivityEvent on
// the case's account -> notify the account owner where relevant -> revalidate
// the case detail and the TAM dashboard. In-app notifications only.

import { revalidatePath } from "next/cache";
import type { CaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import { notify } from "@/lib/notify";

const STATUS_LABEL: Record<CaseStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ESCALATED: "Escalated",
  CLOSED: "Closed",
};

/** Revalidate everything a case change can affect. */
function revalidateCase(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/tam");
}

/** Add a threaded note to a case. `internal` flags the internal-vs-working tier. */
export async function addCaseNote(
  caseId: string,
  body: string,
  internal: boolean
) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const user = await currentUser();
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) return;

  await prisma.note.create({
    data: {
      parentType: "CASE",
      parentId: caseId,
      authorId: user!.id,
      body: trimmed,
      internal,
    },
  });

  await createActivityEvent({
    accountId: kase.accountId,
    actorId: user?.id ?? null,
    type: internal ? "CASE_NOTE_INTERNAL" : "CASE_NOTE_ADDED",
    summary: `${user?.name ?? "Someone"} added ${
      internal ? "an internal note" : "a note"
    } to case "${kase.title}"`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });

  revalidateCase(caseId);
}

/** Change a case's status to any of OPEN / IN_PROGRESS / ESCALATED / CLOSED. */
export async function changeCaseStatus(caseId: string, status: CaseStatus) {
  const user = await currentUser();
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.status === status) return;

  await prisma.case.update({
    where: { id: caseId },
    data: {
      status,
      // Closing via the status select still stamps closedAt; reopening clears it.
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });

  await createActivityEvent({
    accountId: kase.accountId,
    actorId: user?.id ?? null,
    type: "CASE_STATUS_CHANGED",
    summary: `${user?.name ?? "Someone"} changed case "${kase.title}" status to ${STATUS_LABEL[status]}`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });

  revalidateCase(caseId);
}

/** Close a case: status = CLOSED, closedAt = now. Notifies the account owner. */
export async function closeCase(caseId: string) {
  const user = await currentUser();
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { account: true },
  });
  if (!kase || kase.status === "CLOSED") return;

  await prisma.case.update({
    where: { id: caseId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  await createActivityEvent({
    accountId: kase.accountId,
    actorId: user?.id ?? null,
    type: "CASE_CLOSED",
    summary: `${user?.name ?? "Someone"} closed case "${kase.title}"`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });

  // Tell the account owner the case is resolved (in-app only).
  if (kase.account.ownerRepId && kase.account.ownerRepId !== user?.id) {
    await notify({
      recipientId: kase.account.ownerRepId,
      title: "Case closed",
      body: `Case "${kase.title}" on ${kase.account.name} was closed by ${user?.name ?? "the TAM"}.`,
      linkedRecordType: "CASE",
      linkedRecordId: caseId,
    });
  }

  revalidateCase(caseId);
}

/** Escalate a case to a 3rd party: status = ESCALATED. Notifies the account owner. */
export async function escalateCase(caseId: string) {
  const user = await currentUser();
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { account: true },
  });
  if (!kase || kase.status === "ESCALATED") return;

  await prisma.case.update({
    where: { id: caseId },
    data: { status: "ESCALATED" },
  });

  await createActivityEvent({
    accountId: kase.accountId,
    actorId: user?.id ?? null,
    type: "CASE_ESCALATED",
    summary: `${user?.name ?? "Someone"} escalated case "${kase.title}" to a 3rd party`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });

  if (kase.account.ownerRepId && kase.account.ownerRepId !== user?.id) {
    await notify({
      recipientId: kase.account.ownerRepId,
      title: "Case escalated",
      body: `Case "${kase.title}" on ${kase.account.name} was escalated to a 3rd party by ${user?.name ?? "the TAM"}.`,
      linkedRecordType: "CASE",
      linkedRecordId: caseId,
    });
  }

  revalidateCase(caseId);
}
