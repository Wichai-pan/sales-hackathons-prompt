// Preset query chips (BUILD-SPEC P1a) — 3 one-click "smart views" = predefined filters.
// Lightweight conversational-query substitute, NOT open-ended NLP.

import { prisma } from "./db";

export const SMART_VIEWS = [
  { key: "at-risk-dach", label: "At-risk DACH enterprise deals", hint: "Open enterprise deals in DACH that are stalled >14 days or past their close date." },
  { key: "offers-finance", label: "Offers pending Finance", hint: "Discounted offers that passed Sales Manager and await Finance sign-off." },
  { key: "cases-blocking", label: "Cases blocking customer tests", hint: "Open cases on accounts that have a deal in the Customer test stage." },
] as const;

export type SmartViewKey = (typeof SMART_VIEWS)[number]["key"];

const since14d = () => new Date(Date.now() - 14 * 86400000);

export function atRiskDachEnterprise() {
  return prisma.deal.findMany({
    where: {
      status: "OPEN",
      account: { region: { contains: "DACH", mode: "insensitive" }, segment: "Enterprise" },
      OR: [{ lastActivityAt: { lt: since14d() } }, { expectedCloseDate: { lt: new Date() } }],
    },
    include: { account: true, ownerRep: true },
    orderBy: { lastActivityAt: "asc" },
  });
}

export function offersPendingFinance() {
  return prisma.offer.findMany({
    where: { status: "PENDING_FINANCE" },
    include: { account: true },
    orderBy: { updatedAt: "asc" },
  });
}

export async function casesBlockingCustomerTests() {
  const testDeals = await prisma.deal.findMany({
    where: { stage: "CUSTOMER_TEST", status: "OPEN" },
    select: { accountId: true },
  });
  const accountIds = [...new Set(testDeals.map((d) => d.accountId))];
  return prisma.case.findMany({
    where: { accountId: { in: accountIds }, status: { not: "CLOSED" } },
    include: { account: true, service: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}
