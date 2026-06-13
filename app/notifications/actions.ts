"use server";

// Notifications inbox actions (Owner — closes the P1 gap: bell was a dead icon).
// Marks read on open and jumps to the linked record; in-app only (no email).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session";
import { markRead, markAllRead } from "@/lib/notify";

export async function openNotification(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const href = String(formData.get("href") ?? "/");
  if (id) await markRead(id);
  redirect(href);
}

export async function markAllReadAction() {
  const user = await currentUser();
  if (user) await markAllRead(user.id);
  revalidatePath("/notifications");
}
