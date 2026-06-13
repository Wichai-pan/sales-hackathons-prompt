// TAM dashboard (SA-V3). The current user's assigned cases as a dense table,
// sorted by priority (CRITICAL > HIGH > MEDIUM > LOW) then age (oldest first),
// with a status filter. Non-TAM users still see it, flagged as the TAM view.

import Link from "next/link";
import type { CaseStatus, Priority } from "@prisma/client";
import { currentUser } from "@/lib/session";
import { casesForTam } from "@/lib/cases";
import { daysSince } from "@/lib/utils";
import { slaStatus, slaLabel } from "@/lib/sla";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ value: "ALL" | CaseStatus; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "CLOSED", label: "Closed" },
];

function priorityBadge(priority: Priority) {
  const variant =
    priority === "CRITICAL"
      ? "destructive"
      : priority === "HIGH"
      ? "warning"
      : priority === "MEDIUM"
      ? "secondary"
      : "outline";
  return <Badge variant={variant as never}>{priority}</Badge>;
}

function slaBadge(dueDate: Date | null, closedAt: Date | null) {
  const s = slaStatus(dueDate, closedAt);
  if (s === "none") return <span className="text-muted-foreground">—</span>;
  if (s === "overdue") return <Badge variant="destructive">{slaLabel(s)}</Badge>;
  if (s === "approaching") return <Badge variant="secondary">{slaLabel(s)}</Badge>;
  return <span className="text-muted-foreground">{slaLabel(s)}</span>;
}

function statusBadge(status: CaseStatus) {
  const variant =
    status === "CLOSED"
      ? "secondary"
      : status === "ESCALATED"
      ? "destructive"
      : status === "IN_PROGRESS"
      ? "default"
      : "warning";
  return <Badge variant={variant as never}>{status.replaceAll("_", " ")}</Badge>;
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
  ) as "ALL" | CaseStatus;

  const cases =
    activeFilter === "ALL"
      ? all
      : all.filter((c) => c.status === activeFilter);

  const openCount = all.filter((c) => c.status !== "CLOSED").length;

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user
              ? `Cases assigned to ${user.name} — ${openCount} open, ${all.length} total.`
              : "No active user."}
          </p>
          {user && user.role !== "TAM" && (
            <p className="mt-1 text-xs text-amber-700">
              You are viewing the TAM dashboard as {user.role.replaceAll("_", " ")}.
              These are cases assigned to you.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
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
                  : "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50"
              }
            >
              {f.label}
              <span className="opacity-70">{count}</span>
            </Link>
          );
        })}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeFilter === "ALL"
              ? "All assigned cases"
              : `${STATUS_FILTERS.find((f) => f.value === activeFilter)?.label} cases`}{" "}
            ({cases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No cases match this filter.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Account</TH>
                  <TH>Service</TH>
                  <TH>Priority</TH>
                  <TH>Status</TH>
                  <TH>SLA</TH>
                  <TH className="text-right">Age</TH>
                </TR>
              </THead>
              <TBody>
                {cases.map((c) => {
                  const age = daysSince(c.createdAt);
                  return (
                    <TR key={c.id}>
                      <TD className="font-medium">
                        <Link
                          href={`/cases/${c.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {c.title}
                        </Link>
                      </TD>
                      <TD className="text-muted-foreground">{c.account.name}</TD>
                      <TD className="text-muted-foreground">
                        {c.service?.name ?? "—"}
                      </TD>
                      <TD>{priorityBadge(c.priority)}</TD>
                      <TD>{statusBadge(c.status)}</TD>
                      <TD>{slaBadge(c.dueDate, c.closedAt)}</TD>
                      <TD className="text-right tabular-nums text-muted-foreground">
                        {age}d
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
