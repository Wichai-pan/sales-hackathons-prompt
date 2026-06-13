// lib/sla.ts — P2 #18. SLA due-date helpers for cases. dueDate is set from priority at create time
// (seed + future case creation). The UI highlights overdue and approaching cases.

import type { Priority } from "@prisma/client";

/** SLA window in days from case creation, by priority (CONFIGURABLE ASSUMPTION). */
export const SLA_DAYS: Record<Priority, number> = {
  CRITICAL: 2,
  HIGH: 4,
  MEDIUM: 8,
  LOW: 15,
};

export type SlaStatus = "overdue" | "approaching" | "ok" | "none";

/** dueDate = createdAt + SLA_DAYS[priority]. */
export function slaDueDate(createdAt: Date, priority: Priority): Date {
  return new Date(createdAt.getTime() + SLA_DAYS[priority] * 86400000);
}

/** Classify a case's SLA state. Closed cases are never flagged. Approaching = within 2 days. */
export function slaStatus(dueDate: Date | null | undefined, closedAt: Date | null | undefined): SlaStatus {
  if (!dueDate) return "none";
  if (closedAt) return "ok";
  const days = (dueDate.getTime() - Date.now()) / 86400000;
  if (days < 0) return "overdue";
  if (days <= 2) return "approaching";
  return "ok";
}

export function slaLabel(status: SlaStatus): string {
  switch (status) {
    case "overdue": return "Overdue";
    case "approaching": return "Due soon";
    default: return "On track";
  }
}
