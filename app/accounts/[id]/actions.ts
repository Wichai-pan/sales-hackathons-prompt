"use server";

// Account-page server actions (Owner / SA-O1). Writes go through Prisma + createActivityEvent
// so every change lands on the account timeline. These are also the SAME write paths the
// AI-assisted intake "Apply" step reuses (SA-O4) — AI never writes to the DB directly.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";

export async function addAccountNote(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!accountId || !body) return;

  const user = await currentUser();
  if (!user) return;

  await prisma.note.create({
    data: { parentType: "ACCOUNT", parentId: accountId, authorId: user.id, body },
  });
  await createActivityEvent({
    accountId,
    actorId: user.id,
    type: "note_added",
    summary: `${user.name} added a note`,
    linkedRecordType: "ACCOUNT",
    linkedRecordId: accountId,
  });

  revalidatePath(`/accounts/${accountId}`);
}
