// TAM dashboard (SA-V3) — now rendered through the canvas TamDashboardScreen.
// Server-side data fetching (casesForTam), the status filter, and the priority/age
// sort all stay here; the screen is pure presentation. Non-TAM users still see it.

import Link from "next/link";
import type { CaseStatus as PrismaCaseStatus, Priority } from "@prisma/client";
import { currentUser } from "@/lib/session";
import { casesForTam } from "@/lib/cases";
import { slaStatus } from "@/lib/sla";
import { TamDashboardScreen, type TamDashboardData } from "@/components/canvas/screens/TamDashboardScreen";
import type { Case, CasePriority, CaseStatus } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ value: "ALL" | PrismaCaseStatus; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "CLOSED", label: "Closed" },
];

// Prisma Priority -> canvas CasePriority
const PRIORITY_MAP: Record<Priority, CasePriority> = {
  LOW: "P4",
  MEDIUM: "P3",
  HIGH: "P2",
  CRITICAL: "P1",
};
const PRIORITY_ORDER: CasePriority[] = ["P1", "P2", "P3", "P4"];

// Prisma CaseStatus -> canvas CaseStatus
const STATUS_MAP: Record<PrismaCaseStatus, CaseStatus> = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  ESCALATED: "WAITING",
  CLOSED: "CLOSED",
};

type TamCase = Awaited<ReturnType<typeof casesForTam>>[number];

function toCanvasCase(c: TamCase): Case {
  return {
    id: c.id,
    accountId: c.accountId,
    accountName: c.account.name,
    title: c.title,
    description: c.description ?? undefined,
    status: STATUS_MAP[c.status],
    priority: PRIORITY_MAP[c.priority],
    dueDate: c.dueDate ? c.dueDate.toISOString().slice(0, 10) : undefined,
    closedAt: c.closedAt ? c.closedAt.toISOString().slice(0, 10) : undefined,
    ownerId: c.assignedTamId ?? undefined,
    serviceName: c.service?.name ?? undefined,
  };
}

export default async function TamDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const user = await currentUser();

  const all = user ? await casesForTam(user.id) : [];

  const activeFilter = (
    STATUS_FILTERS.some((f) => f.value === status) ? status : "ALL"
  ) as "ALL" | PrismaCaseStatus;

  const cases =
    activeFilter === "ALL"
      ? all
      : all.filter((c) => c.status === activeFilter);

  const openCount = all.filter((c) => c.status !== "CLOSED").length;

  // KPIs derived from the (unfiltered) assigned queue.
  const overdueAll = all.filter((c) => slaStatus(c.dueDate, c.closedAt) === "overdue").length;
  const escalatedAll = all.filter((c) => c.status === "ESCALATED").length;
  const kpis: TamDashboardData["kpis"] = [
    { label: "Total assigned", value: String(all.length) },
    { label: "Open", value: String(openCount) },
    { label: "SLA overdue", value: String(overdueAll) },
    { label: "Escalated", value: String(escalatedAll) },
  ];

  // Presentation panels operate on the currently filtered set.
  const canvasCases = cases.map(toCanvasCase);
  const rawByCanvasPriority = new Map<CasePriority, TamCase[]>();
  for (const c of cases) {
    const p = PRIORITY_MAP[c.priority];
    (rawByCanvasPriority.get(p) ?? rawByCanvasPriority.set(p, []).get(p)!).push(c);
  }
  const byPriority: TamDashboardData["byPriority"] = PRIORITY_ORDER.filter((p) =>
    rawByCanvasPriority.has(p)
  ).map((priority) => ({
    priority,
    cases: (rawByCanvasPriority.get(priority) ?? []).map(toCanvasCase),
  }));

  // byAge: time-to-due (SLA) bucketed for cases that have a due date and aren't closed.
  const ageBuckets: TamDashboardData["byAge"] = [
    { bucket: "0-4h", count: 0 },
    { bucket: "4-24h", count: 0 },
    { bucket: "1-3d", count: 0 },
    { bucket: "3d+", count: 0 },
  ];
  for (const c of cases) {
    if (!c.dueDate || c.closedAt) continue;
    const hours = (c.dueDate.getTime() - Date.now()) / 3_600_000;
    const b =
      hours <= 4 ? ageBuckets[0] : hours <= 24 ? ageBuckets[1] : hours <= 72 ? ageBuckets[2] : ageBuckets[3];
    b.count += 1;
  }

  const slaOverdue = canvasCases.filter((_, i) => slaStatus(cases[i].dueDate, cases[i].closedAt) === "overdue");
  const slaDueSoon = canvasCases.filter((_, i) => slaStatus(cases[i].dueDate, cases[i].closedAt) === "approaching");

  const data: TamDashboardData = {
    ownerName: user?.name ?? "Unassigned",
    kpis,
    byPriority,
    byAge: ageBuckets,
    slaOverdue,
    slaDueSoon,
  };

  return (
    <div className="space-y-4">
      {/* Status filter chips — the screen has no slot for this navigation feature, so we keep it. */}
      <div className="flex flex-wrap items-center gap-2 px-6 pt-6 lg:px-8">
        {user && user.role !== "TAM" && (
          <span className="mr-2 rounded-md bg-warning/15 px-2 py-1 text-xs text-warning">
            Viewing the TAM dashboard as {user.role.replaceAll("_", " ")} — these are cases assigned to you.
          </span>
        )}
        {STATUS_FILTERS.map((f) => {
          const isActive = f.value === activeFilter;
          const href = f.value === "ALL" ? "/tam" : `/tam?status=${f.value}`;
          const count =
            f.value === "ALL"
              ? all.length
              : all.filter((c) => c.status === f.value).length;
          return (
            <Link
              key={f.value}
              href={href}
              className={
                isActive
                  ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/40"
              }
            >
              {f.label}
              <span className="opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>

      <TamDashboardScreen data={data} />
    </div>
  );
}
