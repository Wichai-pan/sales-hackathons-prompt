// AI Next Best Action panel (Owner). HERO magic moment.
// Routes through Featherless (lib/ai/nba.ts); on missing key / model failure it returns the
// deterministic rule-based advice instead, so the panel always renders something useful.

import { prisma } from "@/lib/db";
import { daysSince } from "@/lib/utils";
import { nextBestAction, type NbaContext } from "@/lib/ai/nba";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function NbaSkeleton() {
  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Next best action</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Analyzing this account…</p>
      </CardContent>
    </Card>
  );
}

export async function NbaPanel({ accountId }: { accountId: string }) {
  const [account, deals, cases, offers, latestNote] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId } }),
    prisma.deal.findMany({ where: { accountId, status: "OPEN" } }),
    prisma.case.findMany({ where: { accountId, status: { not: "CLOSED" } } }),
    prisma.offer.findMany({ where: { accountId } }),
    prisma.note.findFirst({ where: { parentType: "ACCOUNT", parentId: accountId }, orderBy: { createdAt: "desc" } }),
  ]);

  const ctx: NbaContext = {
    accountName: account?.name ?? "",
    deals: deals.map((d) => ({
      name: d.name,
      stage: d.stage,
      channel: d.channel,
      daysSinceActivity: daysSince(d.lastActivityAt),
      pastExpectedClose: !!d.expectedCloseDate && d.expectedCloseDate.getTime() < Date.now(),
    })),
    cases: cases.map((c) => ({ title: c.title, priority: c.priority, status: c.status })),
    offers: offers.map((o) => ({ status: o.status, pendingApproval: o.status === "PENDING_SM" || o.status === "PENDING_FINANCE" })),
    latestNote: latestNote?.body ?? null,
  };

  const { nba, source } = await nextBestAction(ctx);

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Next best action</CardTitle>
        <Badge variant="secondary">{source === "ai" ? "AI" : "AI · rules"}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{nba.recommendation}</p>
        <ul className="mt-2 space-y-1">
          {nba.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-xs text-muted-foreground">
              <span className="mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        {nba.draftEmail && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary">Draft email</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{nba.draftEmail}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
