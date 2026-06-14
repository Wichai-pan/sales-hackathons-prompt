// New service case (Rep persona #5 — open a case from inside an account).
// Now rendered through the canvas CaseNewScreen. Server-side data + the wired
// createCase action stay here; the screen is pure presentation.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createCase } from "@/app/cases/actions";
import { CaseNewScreen, type CaseNewScreenData } from "@/components/canvas/screens/CaseNewScreen";
import type {
  Account,
  AccountStatus,
  Contact,
  DecisionRole,
  CasePriority,
} from "@/lib/canvas/types";
import type { ContactRole, Priority } from "@prisma/client";

export const dynamic = "force-dynamic";

// ContactRole (Prisma) -> DecisionRole (canvas). OTHER -> INFLUENCER, rest 1:1.
const DECISION_ROLE: Record<ContactRole, DecisionRole> = {
  FINANCIAL: "FINANCIAL",
  BUDGET: "BUDGET",
  TECH: "TECH",
  INFLUENCER: "INFLUENCER",
  OTHER: "INFLUENCER",
};

// CasePriority (canvas, what the screen's <Select> emits) -> Priority (Prisma,
// what createCase expects). Keeps the create form fully wired despite the enum
// mismatch between the canvas screen and our data model.
const PRIORITY_TO_PRISMA: Record<CasePriority, Priority> = {
  P1: "CRITICAL",
  P2: "HIGH",
  P3: "MEDIUM",
  P4: "LOW",
};

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const { accountId } = await searchParams;

  const [accounts, contacts, services] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: accountId ? { accountId } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  // createCase reads formData directly. We adapt the canvas-enum priority back to
  // our Prisma enum, then delegate to the unchanged server action.
  async function adaptCreate(fd: FormData) {
    "use server";
    const canvasPriority = String(fd.get("priority") ?? "P3") as CasePriority;
    fd.set("priority", PRIORITY_TO_PRISMA[canvasPriority] ?? "MEDIUM");
    await createCase(fd);
  }

  const data: CaseNewScreenData = {
    accounts: accounts.map((a): Account => ({
      id: a.id,
      name: a.name,
      domain: a.domain ?? undefined,
      address: a.address ?? undefined,
      vatId: a.vatId ?? undefined,
      region: a.region,
      segment: a.segment,
      industry: a.industry,
      status: a.status as AccountStatus,
      ownerId: a.ownerRepId,
      tamId: a.assignedTamId ?? undefined,
    })),
    contacts: contacts.map((c): Contact => ({
      id: c.id,
      accountId: c.accountId,
      name: c.name,
      title: c.title ?? undefined,
      decisionRole: c.decisionRole ? DECISION_ROLE[c.decisionRole] : undefined,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      isPrimary: c.isPrimary,
    })),
    services: services.map((s) => ({ id: s.id, name: s.name })),
    defaults: { accountId: accountId ?? undefined },
    createAction: adaptCreate,
  };

  return <CaseNewScreen data={data} />;
}
