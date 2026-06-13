// In-app notifications ONLY (BUILD-SPEC hard rule — no outbound email).
// Owner + all V slices call notify(); do NOT re-implement.

import type { Notification } from "@prisma/client";
import { prisma } from "./db";

export interface NotifyInput {
  recipientId: string;
  title: string;
  body: string;
  linkedRecordType?: string | null; // "OFFER" | "CASE" | "DEAL" | ...
  linkedRecordId?: string | null;
}

export async function notify(input: NotifyInput): Promise<Notification> {
  return prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      title: input.title,
      body: input.body,
      linkedRecordType: input.linkedRecordType ?? null,
      linkedRecordId: input.linkedRecordId ?? null,
    },
  });
}

export function listNotifications(recipientId: string, take = 30) {
  return prisma.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function unreadCount(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, readAt: null },
  });
}

export async function markRead(id: string): Promise<void> {
  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(recipientId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}
