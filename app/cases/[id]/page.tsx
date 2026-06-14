// Case detail (SA-V3) — rendered through the canvas CaseDetailScreen.
// Server-side data + the AI case summary stay here; the screen's built-in forms are
// WIRED to our real Prisma mutations via adapter server actions (single source of truth,
// no duplicate controls). The account service-history timeline is passed in too.

import { notFound } from "next/navigation";
import type { CaseStatus, Priority, Role } from "@prisma/client";
import { caseDetail, caseNotes, caseActivity } from "@/lib/cases";
import {
  addCaseNote,
  changeCaseStatus,
  closeCase,
  escalateCase,
  reassignCase,
} from "@/app/cases/actions";
import { prisma } from "@/lib/db";
import { caseSummary, MIN_NOTES_FOR_SUMMARY } from "@/lib/ai/case-summary";
import { CaseDetailScreen, type CaseDetailScreenData } from "@/components/canvas/screens/CaseDetailScreen";
import type { Case as CanvasCase, CaseStatus as CanvasCaseStatus, CasePriority } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  REP: "Sales Rep",
  TAM: "TAM",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

const STATUS_TO_CANVAS: Record<CaseStatus, CanvasCaseStatus> = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  ESCALATED: "WAITING",
  CLOSED: "CLOSED",
};
const CANVAS_TO_STATUS: Record<string, CaseStatus> = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING: "ESCALATED",
  CLOSED: "CLOSED",
};
const PRIORITY_TO_CANVAS: Record<Priority, CasePriority> = {
  LOW: "P4",
  MEDIUM: "P3",
  HIGH: "P2",
  CRITICAL: "P1",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kase = await caseDetail(id);
  if (!kase) notFound();

  const [notes, activity, tams] = await Promise.all([
    caseNotes(id),
    caseActivity(kase.accountId),
    prisma.user.findMany({ where: { role: "TAM" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // AI case summary (P2 #22) — only once the case has accumulated enough notes.
  let aiSummary: string | undefined;
  if (notes.length >= MIN_NOTES_FOR_SUMMARY) {
    const { text } = await caseSummary({
      title: kase.title,
      description: kase.description,
      notes: [...notes].reverse().map((n) => n.body), // caseNotes() is newest-first
    });
    aiSummary = text;
  }

  const screenCase: CanvasCase = {
    id: kase.id,
    accountId: kase.accountId,
    accountName: kase.account.name,
    title: kase.title,
    description: kase.description ?? undefined,
    status: STATUS_TO_CANVAS[kase.status],
    priority: PRIORITY_TO_CANVAS[kase.priority],
    dueDate: kase.dueDate ? kase.dueDate.toISOString().slice(0, 10) : undefined,
    closedAt: kase.closedAt ? kase.closedAt.toISOString() : undefined,
    ownerId: kase.assignedTamId ?? undefined,
    ownerName: kase.assignedTam?.name ?? undefined,
    contactName: kase.customerContact?.name ?? undefined,
    serviceName: kase.service?.name ?? undefined,
  };

  // ---- Adapter server actions: wire the canvas screen's forms to real mutations ----
  async function addNoteAction(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;
    await addCaseNote(id, body, String(formData.get("visibility")) === "INTERNAL");
  }
  async function changeStatusAction(formData: FormData) {
    "use server";
    const status = CANVAS_TO_STATUS[String(formData.get("status") ?? "")];
    if (status) await changeCaseStatus(id, status);
  }
  async function reassignAction(formData: FormData) {
    "use server";
    const tamId = String(formData.get("assigneeId") ?? "");
    if (!tamId) return;
    const fd = new FormData();
    fd.set("caseId", id);
    fd.set("tamId", tamId);
    await reassignCase(fd);
  }
  async function escalateAction() {
    "use server";
    await escalateCase(id);
  }
  async function closeAction() {
    "use server";
    await closeCase(id);
  }

  const screenData: CaseDetailScreenData = {
    case: screenCase,
    notes: [...notes].reverse().map((n) => ({
      id: n.id,
      body: n.body,
      visibility: n.internal ? "INTERNAL" : "WORKING",
      authorName: `${n.author.name} · ${ROLE_LABEL[n.author.role]}`,
      createdAt: n.createdAt.toISOString(),
    })),
    assignees: tams,
    aiSummary,
    activity: activity.map((a) => ({
      summary: a.summary,
      actorName: a.actor?.name ?? undefined,
      createdAt: a.createdAt.toISOString(),
      onThisCase: a.linkedRecordType === "CASE" && a.linkedRecordId === id,
    })),
    addNoteAction,
    changeStatusAction,
    reassignAction,
    escalateAction,
    closeAction,
  };

  return <CaseDetailScreen data={screenData} />;
}
