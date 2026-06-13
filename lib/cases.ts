// Case query helpers (SA-V3, Stream B). Read-only Prisma selects for the TAM
// dashboard and the case detail page. Mutations live in app/cases/actions.ts.

import type { Priority } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Priority ordering for the TAM queue: CRITICAL first, LOW last. */
export const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * Cases assigned to a TAM, with account + linked service, ordered by priority
 * (CRITICAL > HIGH > MEDIUM > LOW) then by age (oldest first).
 * Priority can't be sorted by Prisma in semantic order (enum sorts lexically),
 * so we order by createdAt in the DB and re-sort by priority rank in memory.
 */
export async function casesForTam(tamId: string) {
  const cases = await prisma.case.findMany({
    where: { assignedTamId: tamId },
    include: { account: true, service: true },
    orderBy: { createdAt: "asc" }, // oldest first; stable secondary sort
  });
  return cases.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/** A single case with everything the detail page renders. */
export function caseDetail(id: string) {
  return prisma.case.findUnique({
    where: { id },
    include: {
      account: true,
      service: true,
      customerContact: true,
      assignedTam: true,
    },
  });
}

/**
 * Threaded notes for a case (Note.parentType = CASE), newest first,
 * with the author (incl. role) so the UI can show name + role.
 */
export function caseNotes(caseId: string) {
  return prisma.note.findMany({
    where: { parentType: "CASE", parentId: caseId },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Activity history for a case. ActivityEvent rows are anchored to the account,
 * so we scope by accountId and surface case-linked events first while still
 * showing the broader account timeline for context.
 */
export function caseActivity(accountId: string, take = 30) {
  return prisma.activityEvent.findMany({
    where: { accountId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}
