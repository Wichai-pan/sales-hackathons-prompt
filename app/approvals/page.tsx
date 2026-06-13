// Approval queue (SLICE SA-V2 / V). Role-aware:
//   SALES_MANAGER -> offers PENDING_SM (need first-step approval)
//   FINANCE       -> offers PENDING_FINANCE (already SM-approved, need finance sign-off)
// Other roles see a read-only note (no actionable queue for them).

import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { formatEUR, daysSince } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import type { OfferStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function truncate(s: string | null | undefined, n = 60): string {
  if (!s) return "—";
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function submittedAgo(date: Date): string {
  const days = daysSince(date);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default async function ApprovalsPage() {
  const role = await currentRole();

  // Pick the status this role acts on.
  const queueStatus: OfferStatus | null =
    role === "SALES_MANAGER" ? "PENDING_SM" : role === "FINANCE" ? "PENDING_FINANCE" : null;

  if (!queueStatus) {
    return (
      <main className="space-y-6">
        <Header role={role} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            The approval queue is available to Sales Managers and Finance. Your current role has no
            offers to act on.{" "}
            <Link href="/role-switch" className="text-primary hover:underline">
              Switch role
            </Link>
            .
          </CardContent>
        </Card>
      </main>
    );
  }

  const offers = await prisma.offer.findMany({
    where: { status: queueStatus },
    include: { account: true, deal: true, createdBy: true },
    orderBy: { updatedAt: "asc" }, // oldest-waiting first
  });

  return (
    <main className="space-y-6">
      <Header role={role} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            {role === "SALES_MANAGER" ? "Pending Sales Manager approval" : "Pending Finance approval"}
          </CardTitle>
          <Badge variant="warning">{offers.length} waiting</Badge>
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing in your queue. All caught up.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Account</TH>
                  <TH>Deal</TH>
                  <TH>Submitted by</TH>
                  <TH className="text-right">Discount</TH>
                  <TH>Justification</TH>
                  <TH className="text-right">Total</TH>
                  <TH>Waiting</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {offers.map((o) => (
                  <TR key={o.id}>
                    <TD className="font-medium">{o.account.name}</TD>
                    <TD className="text-muted-foreground">{o.deal?.name ?? "—"}</TD>
                    <TD className="text-muted-foreground">{o.createdBy.name}</TD>
                    <TD className="text-right">
                      <Badge variant={o.discountPercent >= 20 ? "destructive" : "warning"}>
                        {o.discountPercent}%
                      </Badge>
                    </TD>
                    <TD className="max-w-[16rem] text-muted-foreground" title={o.discountJustification ?? ""}>
                      {truncate(o.discountJustification)}
                    </TD>
                    <TD className="text-right font-medium">{formatEUR(o.total)}</TD>
                    <TD className="text-muted-foreground">{submittedAgo(o.updatedAt)}</TD>
                    <TD className="text-right">
                      <Link
                        href={`/approvals/${o.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Review →
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Header({ role }: { role: string | null }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Approvals</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {role === "SALES_MANAGER"
          ? "Discounted offers awaiting your first-step approval before they route to Finance."
          : role === "FINANCE"
            ? "Sales-Manager-approved offers awaiting final Finance sign-off."
            : "Offer approval queue."}
      </p>
    </section>
  );
}
