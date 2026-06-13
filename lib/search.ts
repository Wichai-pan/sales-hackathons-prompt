// Global free-text search across accounts, deals, cases, and contacts (BUILD-SPEC P1 #11).
// Case-insensitive substring match; each group capped so the page stays fast and demo-dense.

import { prisma } from "./db";

export async function globalSearch(rawQuery: string) {
  const q = rawQuery.trim();
  if (!q) {
    return { query: "", accounts: [], deals: [], cases: [], contacts: [] };
  }

  const like = { contains: q, mode: "insensitive" as const };

  const [accounts, deals, cases, contacts] = await Promise.all([
    prisma.account.findMany({
      where: { OR: [{ name: like }, { region: like }, { segment: like }, { industry: like }] },
      include: { ownerRep: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.deal.findMany({
      where: { OR: [{ name: like }, { notes: like }] },
      include: { account: true },
      orderBy: { lastActivityAt: "desc" },
      take: 10,
    }),
    prisma.case.findMany({
      where: { OR: [{ title: like }, { description: like }] },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.contact.findMany({
      where: { OR: [{ name: like }, { email: like }, { title: like }] },
      include: { account: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
  ]);

  return { query: q, accounts, deals, cases, contacts };
}

export type SearchResults = Awaited<ReturnType<typeof globalSearch>>;
