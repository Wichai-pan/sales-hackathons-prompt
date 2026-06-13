// Case detail (SA-V3). Status / priority / account / service / contact +
// description, threaded notes (internal-vs-working tier, author name + role),
// and the account activity history. Actions: add note, change status, close,
// escalate — all wired to the server actions in ../actions.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import type { CaseStatus, Priority, Role } from "@prisma/client";
import { caseDetail, caseNotes, caseActivity } from "@/lib/cases";
import { daysSince, cn } from "@/lib/utils";
import {
  addCaseNote,
  changeCaseStatus,
  closeCase,
  escalateCase,
} from "@/app/cases/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  REP: "Sales Rep",
  TAM: "TAM",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

const STATUS_OPTIONS: CaseStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "ESCALATED",
  "CLOSED",
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

function fmt(date: Date) {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kase = await caseDetail(id);
  if (!kase) notFound();

  const [notes, activity] = await Promise.all([
    caseNotes(id),
    caseActivity(kase.accountId),
  ]);

  const isClosed = kase.status === "CLOSED";

  // ---- Server-action form adapters (bind the caseId, read FormData) ----
  async function addNoteAction(formData: FormData) {
    "use server";
    const body = String(formData.get("body") ?? "");
    const internal = formData.get("internal") === "on";
    await addCaseNote(id, body, internal);
  }

  async function changeStatusAction(formData: FormData) {
    "use server";
    const status = String(formData.get("status") ?? "") as CaseStatus;
    if (STATUS_OPTIONS.includes(status)) {
      await changeCaseStatus(id, status);
    }
  }

  async function closeAction() {
    "use server";
    await closeCase(id);
  }

  async function escalateAction() {
    "use server";
    await escalateCase(id);
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/tam" className="hover:text-foreground hover:underline">
              My cases
            </Link>{" "}
            / Case
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{kase.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {statusBadge(kase.status)}
            {priorityBadge(kase.priority)}
            <span className="text-xs text-muted-foreground">
              Opened {daysSince(kase.createdAt)}d ago
              {kase.closedAt ? ` · closed ${fmt(kase.closedAt)}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={escalateAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={kase.status === "ESCALATED"}
            >
              Escalate to 3rd party
            </Button>
          </form>
          <form action={closeAction}>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isClosed}
            >
              Close case
            </Button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---- Left: details + status control + notes ---- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Account</dt>
                  <dd className="font-medium">{kase.account.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Linked service</dt>
                  <dd className="font-medium">{kase.service?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Customer contact</dt>
                  <dd className="font-medium">
                    {kase.customerContact
                      ? `${kase.customerContact.name}${
                          kase.customerContact.title
                            ? ` · ${kase.customerContact.title}`
                            : ""
                        }`
                      : "—"}
                    {kase.customerContact?.email && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {kase.customerContact.email}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Assigned TAM</dt>
                  <dd className="font-medium">
                    {kase.assignedTam?.name ?? "Unassigned"}
                  </dd>
                </div>
              </dl>

              <div>
                <dt className="text-xs text-muted-foreground">Description</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">
                  {kase.description?.trim() || "No description provided."}
                </dd>
              </div>

              {/* Change status */}
              <form
                action={changeStatusAction}
                className="flex flex-wrap items-end gap-2 border-t pt-4"
              >
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="status">
                    Change status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={kase.status}
                    className="mt-1 block h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  Update status
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes ({notes.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add note */}
              <form action={addNoteAction} className="space-y-2">
                <textarea
                  name="body"
                  required
                  rows={3}
                  placeholder="Add a note for this case…"
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      name="internal"
                      className="h-4 w-4 rounded border-input"
                    />
                    Internal note (not shown to customer)
                  </label>
                  <Button type="submit" size="sm">
                    Add note
                  </Button>
                </div>
              </form>

              {/* Threaded notes */}
              <ul className="space-y-3 border-t pt-4">
                {notes.length === 0 && (
                  <li className="text-sm text-muted-foreground">No notes yet.</li>
                )}
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "rounded-md border p-3 text-sm",
                      n.internal && "border-amber-200 bg-amber-50"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{n.author.name}</span>
                      <Badge variant="outline">{ROLE_LABEL[n.author.role]}</Badge>
                      {n.internal && (
                        <Badge variant="warning">Internal</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {fmt(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* ---- Right: activity history ---- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((e) => {
                    const onThisCase =
                      e.linkedRecordType === "CASE" && e.linkedRecordId === id;
                    return (
                      <li key={e.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full",
                              onThisCase ? "bg-primary" : "bg-muted-foreground/40"
                            )}
                          />
                          <span className="text-xs text-muted-foreground">
                            {fmt(e.createdAt)}
                          </span>
                        </div>
                        <p className="ml-4 mt-0.5">{e.summary}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
