// Activity timeline helper — every meaningful change appends one ActivityEvent.
// Owner + all V slices call this; do NOT re-implement.

import type { ActivityEvent } from "@prisma/client";
import { prisma } from "./db";

export interface CreateActivityInput {
  accountId?: string | null;
  actorId?: string | null;
  type: string; // e.g. "DEAL_CREATED", "OFFER_SUBMITTED", "CASE_CLOSED"
  summary: string;
  linkedRecordType?: string | null; // "DEAL" | "OFFER" | "CASE" | "ACCOUNT" | ...
  linkedRecordId?: string | null;
}

export async function createActivityEvent(
  input: CreateActivityInput
): Promise<ActivityEvent> {
  return prisma.activityEvent.create({
    data: {
      accountId: input.accountId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      summary: input.summary,
      linkedRecordType: input.linkedRecordType ?? null,
      linkedRecordId: input.linkedRecordId ?? null,
    },
  });
}

/** Most recent activity for an account (timeline panel). */
export function accountTimeline(accountId: string, take = 30) {
  return prisma.activityEvent.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: true },
  });
}
