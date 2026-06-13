"use server";

// Case mutations (SA-V3). Each action: prisma write -> createActivityEvent on
// the case's account -> notify the account owner where relevant -> revalidate
// the case detail and the TAM dashboard. In-app notifications only.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CaseStatus, Priority } from "@prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { slaDueDate } from "@/lib/sla";

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

/**
 * Open a NEW service case against an existing account (Rep persona #5).
 * Defaults the TAM + customer contact from the account; sets an SLA due date from priority.
 */
export async function createCase(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const accountId = String(formData.get("accountId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!accountId || !title) redirect(accountId ? `/accounts/${accountId}` : "/rep");

  const description = String(formData.get("description") ?? "").trim() || null;
  const priority = String(formData.get("priority") ?? "MEDIUM") as Priority;
  const serviceId = String(formData.get("serviceId") ?? "") || null;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { contacts: { where: { isPrimary: true }, take: 1 } },
  });
  if (!account) redirect("/rep");

  const now = new Date();
  const kase = await prisma.case.create({
    data: {
      accountId,
      serviceId,
      assignedTamId: account.assignedTamId ?? null,
      customerContactId: account.contacts[0]?.id ?? null,
      title,
      description,
      status: "OPEN",
      priority,
      dueDate: slaDueDate(now, priority),
    },
  });

  await createActivityEvent({
    accountId,
    actorId: user.id,
    type: "CASE_OPENED",
    summary: `${user.name} opened a case: ${title}`,
    linkedRecordType: "CASE",
    linkedRecordId: kase.id,
  });
  if (account.assignedTamId) {
    await notify({
      recipientId: account.assignedTamId,
      title: "New case assigned",
      body: `${title} (${priority.toLowerCase()} priority) on ${account.name}.`,
      linkedRecordType: "CASE",
      linkedRecordId: kase.id,
    });
  }

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/tam");
  redirect(`/cases/${kase.id}`);
}

/** Reassign a case to a different TAM (Sales Manager persona #3). */
export async function reassignCase(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const caseId = String(formData.get("caseId") ?? "");
  const tamId = String(formData.get("tamId") ?? "");
  if (!caseId || !tamId) return;

  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase) return;
  const tam = await prisma.user.findUnique({ where: { id: tamId } });
  if (!tam || tam.role !== "TAM") return;

  await prisma.case.update({ where: { id: caseId }, data: { assignedTamId: tamId } });
  await createActivityEvent({
    accountId: kase.accountId,
    actorId: user.id,
    type: "CASE_REASSIGNED",
    summary: `${user.name} reassigned "${kase.title}" to ${tam.name}`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });
  await notify({
    recipientId: tamId,
    title: "Case reassigned to you",
    body: `${kase.title} is now yours.`,
    linkedRecordType: "CASE",
    linkedRecordId: caseId,
  });
  revalidateCase(caseId);
}
