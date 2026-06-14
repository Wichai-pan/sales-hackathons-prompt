// Case detail (SA-V3) — now rendered through the canvas CaseDetailScreen.
// Server-side data fetching, role-aware notes, and the wired case mutations stay
// here; the screen renders the read-only presentation (header, AI summary,
// threaded conversation, facts). Because our Prisma case status/priority enums
// and our add-note `internal` flag don't line up 1:1 with the screen's built-in
// action forms, we KEEP our real wired forms (restyled with canvas classes) and
// append them below the screen so NO functionality is lost.

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
  reassignCase,
} from "@/app/cases/actions";
import { prisma } from "@/lib/db";
import { caseSummary, MIN_NOTES_FOR_SUMMARY } from "@/lib/ai/case-summary";
import { slaStatus } from "@/lib/sla";
import { CaseDetailScreen, type CaseDetailScreenData } from "@/components/canvas/screens/CaseDetailScreen";
import type { Case as CanvasCase, CaseStatus as CanvasCaseStatus, CasePriority } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  REP: "Sales Rep",
  TAM: "TAM",
  SALES_MANAGER: "Sales Manager",
  FINANCE: "Finance",
};

// Our Prisma enum is the source of truth for the wired change-status form.
const STATUS_OPTIONS: CaseStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED", "CLOSED"];

const STATUS_TO_CANVAS: Record<CaseStatus, CanvasCaseStatus> = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  ESCALATED: "WAITING",
  CLOSED: "CLOSED",
};

const PRIORITY_TO_CANVAS: Record<Priority, CasePriority> = {
  LOW: "P4",
  MEDIUM: "P3",
  HIGH: "P2",
  CRITICAL: "P1",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kase = await caseDetail(id);
  if (!kase) notFound();

  const [notes, , tams] = await Promise.all([
    caseNotes(id),
    caseActivity(kase.accountId),
    prisma.user.findMany({ where: { role: "TAM" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const isClosed = kase.status === "CLOSED";

  // AI case summary (P2 #22) — only once the case has accumulated enough notes.
  // The canvas screen takes a plain string, so we resolve it here (server-side).
  let aiSummary: string | undefined;
  if (notes.length >= MIN_NOTES_FOR_SUMMARY) {
    const { text } = await caseSummary({
      title: kase.title,
      description: kase.description,
      // caseNotes() returns newest-first; the summariser expects oldest-first.
      notes: [...notes].reverse().map((n) => n.body),
    });
    aiSummary = text;
  }

  // ---- Map our Prisma rows to the screen's CaseDetailScreenData ----
  const screenCase: CanvasCase = {
    id: kase.id,
    accountId: kase.accountId,
    accountName: kase.account.name,
    title: kase.title,
    description: kase.description ?? undefined,
    status: STATUS_TO_CANVAS[kase.status],
    priority: PRIORITY_TO_CANVAS[kase.priority],
    dueDate: kase.dueDate ? kase.dueDate.toISOString().slice(0, 10) : undefined,
    closedAt: kase.closedAt ? kase.closedAt.toISOString() : undefined,
    ownerId: kase.assignedTamId ?? undefined,
    ownerName: kase.assignedTam?.name ?? undefined,
    contactName: kase.customerContact?.name ?? undefined,
    serviceName: kase.service?.name ?? undefined,
  };

  const screenData: CaseDetailScreenData = {
    case: screenCase,
    // caseNotes() is newest-first; show oldest-first in the conversation thread.
    notes: [...notes].reverse().map((n) => ({
      id: n.id,
      body: n.body,
      visibility: n.internal ? "INTERNAL" : "WORKING",
      authorName: n.author.name,
      createdAt: n.createdAt.toISOString(),
    })),
    assignees: tams,
    aiSummary,
    // Action props intentionally omitted: the screen's built-in forms use canvas
    // enum values / a `visibility` select that our Prisma actions don't accept.
    // We keep our real wired forms (below) as the authoritative, working controls.
  };

  // ---- Wired server-action forms (kept; restyled with canvas classes) ----
  const sla = slaStatus(kase.dueDate, kase.closedAt);

  return (
    <div className="space-y-6">
      <CaseDetailScreen data={screenData} />

      {/* ---- Authoritative wired actions (real Prisma mutations) ---- */}
      <div className="px-6 lg:px-8 pb-8">
        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Case actions</div>
            <span className="text-xs text-muted-foreground">
              Opened {daysSince(kase.createdAt)}d ago
              {sla === "overdue" && " · SLA overdue"}
              {sla === "approaching" && " · SLA due soon"}
            </span>
          </div>

          {/* Add note (with internal checkbox) */}
          <form
            action={async (formData: FormData) => {
              "use server";
              const body = String(formData.get("body") ?? "");
              const internal = formData.get("internal") === "on";
              await addCaseNote(id, body, internal);
            }}
            className="space-y-2"
          >
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Add a note for this case…"
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="internal"
                  className="h-4 w-4 rounded border-border"
                />
                Internal note (not shown to customer)
              </label>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md ai-gradient px-3 text-xs font-medium text-white hover:opacity-90"
              >
                Add note
              </button>
            </div>
          </form>

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {/* Change status (our Prisma enum values) */}
            <form
              action={async (formData: FormData) => {
                "use server";
                const status = String(formData.get("status") ?? "") as CaseStatus;
                if (STATUS_OPTIONS.includes(status)) {
                  await changeCaseStatus(id, status);
                }
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1">
                <label className="text-xs text-muted-foreground" htmlFor="status">
                  Change status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={kase.status}
                  className="mt-1 block h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Update
              </button>
            </form>

            {/* Reassign TAM */}
            <form action={reassignCase} className="flex items-end gap-2">
              <input type="hidden" name="caseId" value={kase.id} />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground" htmlFor="tamId">
                  Assigned TAM
                </label>
                <select
                  id="tamId"
                  name="tamId"
                  defaultValue={kase.assignedTamId ?? ""}
                  className="mt-1 block h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Reassign to…
                  </option>
                  {tams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Reassign
              </button>
            </form>

            {/* Escalate to 3rd party */}
            <form
              action={async () => {
                "use server";
                await escalateCase(id);
              }}
            >
              <button
                type="submit"
                disabled={kase.status === "ESCALATED"}
                className={cn(
                  "inline-flex h-9 w-full items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary",
                  kase.status === "ESCALATED" && "pointer-events-none opacity-50"
                )}
              >
                Escalate to 3rd party
              </button>
            </form>

            {/* Close case */}
            <form
              action={async () => {
                "use server";
                await closeCase(id);
              }}
            >
              <button
                type="submit"
                disabled={isClosed}
                className={cn(
                  "inline-flex h-9 w-full items-center justify-center rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90",
                  isClosed && "pointer-events-none opacity-50"
                )}
              >
                Close case
              </button>
            </form>
          </div>

          {/* Note authors with role context (preserved from the original page) */}
          {notes.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Note authors
              </div>
              <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border px-2 py-1">
                    {n.author.name} · {ROLE_LABEL[n.author.role]}
                    {n.internal ? " · Internal" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <Link
          href="/tam"
          className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to My cases
        </Link>
      </div>
    </div>
  );
}
