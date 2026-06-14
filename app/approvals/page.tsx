// Approval queue (SLICE SA-V2 / V) — now rendered through the canvas ApprovalsListScreen.
// Role-aware (UNCHANGED):
//   SALES_MANAGER -> offers PENDING_SM (need first-step approval)
//   FINANCE       -> offers PENDING_FINANCE (already SM-approved, need finance sign-off)
// Other roles see a read-only note (no actionable queue for them).

import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentRole } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import {
  ApprovalsListScreen,
  type ApprovalsListScreenData,
} from "@/components/canvas/screens/ApprovalsListScreen";
import type { OfferStatus, ApprovalStep } from "@prisma/client";
import type { Offer, OfferStatus as CanvasOfferStatus } from "@/lib/canvas/types";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const role = await currentRole();

  // Pick the status this role acts on (UNCHANGED gating logic).
  const queueStatus: OfferStatus | null =
    role === "SALES_MANAGER" ? "PENDING_SM" : role === "FINANCE" ? "PENDING_FINANCE" : null;

  // Roles without a queue keep the existing read-only note (no canvas screen for them).
  if (!queueStatus || (role !== "SALES_MANAGER" && role !== "FINANCE")) {
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-semibold">Approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">Offer approval queue.</p>
        </section>
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
      </div>
    );
  }

  const approvalStep: ApprovalStep = role === "SALES_MANAGER" ? "SALES_MANAGER" : "FINANCE";
  // Canvas status for this role's pending queue.
  const canvasPendingStatus: CanvasOfferStatus =
    role === "SALES_MANAGER" ? "PENDING_SM" : "PENDING_FINANCE";

  const [offers, decidedApprovals] = await Promise.all([
    prisma.offer.findMany({
      where: { status: queueStatus },
      include: { account: true, deal: true, createdBy: true },
      orderBy: { updatedAt: "asc" }, // oldest-waiting first
    }),
    // Additive read-only: this role's recently decided approvals (fills the screen's "Recently decided" slot).
    prisma.approval.findMany({
      where: { step: approvalStep, status: { in: ["APPROVED", "REJECTED"] } },
      include: { approver: true, offer: { include: { account: true } } },
      orderBy: { decidedAt: "desc" },
      take: 8,
    }),
  ]);

  const pending: ApprovalsListScreenData["pending"] = offers.map((o) => {
    const offer: Offer & { requestedBy?: string; requestedAt?: string } = {
      id: o.id,
      dealId: o.dealId ?? undefined,
      accountName: o.account.name,
      title: o.deal?.name ?? undefined,
      version: o.version,
      status: canvasPendingStatus,
      subtotal: o.subtotal,
      discountPercent: o.discountPercent,
      discountJustification: o.discountJustification ?? undefined,
      total: o.total,
      locked: o.locked,
      currency: "EUR",
      preparedBy: o.createdBy.name,
      requestedBy: o.createdBy.name,
      requestedAt: o.updatedAt.toISOString(),
    };
    return offer;
  });

  const recentDecided: ApprovalsListScreenData["recentDecided"] = decidedApprovals.map((a) => {
    const o = a.offer;
    const canvasStatus: CanvasOfferStatus = a.status === "APPROVED" ? "APPROVED" : "REJECTED";
    return {
      id: o.id,
      dealId: o.dealId ?? undefined,
      accountName: o.account.name,
      title: undefined,
      version: o.version,
      status: canvasStatus,
      subtotal: o.subtotal,
      discountPercent: o.discountPercent,
      discountJustification: o.discountJustification ?? undefined,
      total: o.total,
      locked: o.locked,
      currency: "EUR",
      decidedAt: a.decidedAt ? a.decidedAt.toISOString() : undefined,
      decidedBy: a.approver?.name ?? undefined,
      decision: a.status === "APPROVED" ? "APPROVED" : "REJECTED",
    };
  });

  const data: ApprovalsListScreenData = {
    role,
    pending,
    recentDecided,
  };

  return <ApprovalsListScreen data={data} />;
}
