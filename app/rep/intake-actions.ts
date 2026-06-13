"use server";

// Apply AI-assisted intake (Owner / SA-O4). Takes the reviewed draft + which parts the user
// kept, and writes real records through normal Prisma paths — AI never writes directly.
// Creates a new account from the draft and attaches the contact / deal / case / note, then
// lands the rep on the fully-populated Account 360 (the demo's payoff).

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createActivityEvent } from "@/lib/activity";
import { probabilityForStage, RESELLER_STAGES } from "@/lib/forecast";
import type { IntakeDraft } from "@/lib/ai/intake";
import type { Channel, DealStage, Priority } from "@prisma/client";

export async function applyIntake(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  let draft: IntakeDraft;
  try {
    draft = JSON.parse(String(formData.get("draft") ?? "{}"));
  } catch {
    redirect("/rep");
  }
  const keep = (k: string) => formData.get(`keep_${k}`) === "on";

  // Account is the anchor — create it from the draft; if the model didn't name it, derive from the
  // contact's email domain (anita@nordsec.fi -> Nordsec), else a sensible default.
  const domain = draft.contact?.email?.split("@")[1]?.split(".")[0];
  const accountName =
    draft.account?.name?.trim() ||
    (domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : "") ||
    "New account";
  const account = await prisma.account.create({
    data: {
      name: accountName,
      region: draft.account?.region?.trim() || "Unknown",
      segment: "Enterprise",
      industry: "Unknown",
      ownerRepId: user.id,
    },
  });

  const summaryParts: string[] = ["account"];

  if (keep("contact") && draft.contact && (draft.contact.name || draft.contact.email)) {
    await prisma.contact.create({
      data: {
        accountId: account.id,
        name: draft.contact.name?.trim() || draft.contact.email!.split("@")[0],
        title: draft.contact.title?.trim() || null,
        email: draft.contact.email?.trim() || null,
        phone: draft.contact.phone?.trim() || null,
        isPrimary: true,
      },
    });
    summaryParts.push("contact");
  }

  if (keep("deal") && draft.deal) {
    const channel = (draft.deal.channel ?? "DIRECT") as Channel;
    let stage = (draft.deal.stage ?? "INTEREST_SHOWN") as DealStage;
    if (channel === "RESELLER" && !RESELLER_STAGES.includes(stage)) stage = "CUSTOMER_TEST";
    await prisma.deal.create({
      data: {
        accountId: account.id,
        ownerRepId: user.id,
        name: draft.deal.name?.trim() || `${accountName} opportunity`,
        channel,
        stage,
        probability: probabilityForStage(stage),
        expectedCloseDate: draft.deal.expectedCloseDate ? new Date(draft.deal.expectedCloseDate) : null,
        status: "OPEN",
      },
    });
    summaryParts.push("deal");
  }

  if (keep("case") && draft.case?.title) {
    await prisma.case.create({
      data: {
        accountId: account.id,
        title: draft.case.title.trim(),
        priority: (draft.case.priority ?? "MEDIUM") as Priority,
        status: "OPEN",
        assignedTamId: null,
      },
    });
    summaryParts.push("case");
  }

  if (keep("task") && draft.task?.body) {
    await prisma.note.create({
      data: { parentType: "ACCOUNT", parentId: account.id, authorId: user.id, body: `Follow-up: ${draft.task.body.trim()}` },
    });
    summaryParts.push("task");
  }

  await createActivityEvent({
    accountId: account.id,
    actorId: user.id,
    type: "ai_intake_applied",
    summary: `${user.name} applied AI-assisted intake (${summaryParts.join(", ")})`,
    linkedRecordType: "ACCOUNT",
    linkedRecordId: account.id,
  });

  redirect(`/accounts/${account.id}`);
}
