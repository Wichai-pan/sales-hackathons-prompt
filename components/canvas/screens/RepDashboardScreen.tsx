import Link from "next/link";
import { Mail, Sparkles, Wand2, ArrowRight, Clock } from "lucide-react";
import { AIChip, Avatar, GlassCard, KpiTile, SectionHeader, type KpiTileProps } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Account, Deal, Offer, Case, ActivityEvent, ServerAction } from "@/lib/canvas/types";
import { fmt, initials } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface NextBestAction {
  id: string;
  title: string;
  accountName: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  eta: string;
}

export interface RepDashboardData {
  greetingName: string;
  greetingSubtitle: string;
  kpis: KpiTileProps[];
  nextBestActions: NextBestAction[];
  myAccounts: (Account & { devices?: number; arr?: number; health?: number })[];
  openDealsByStage: { stage: string; deals: Deal[] }[];
  atRiskDeals: (Deal & { aiSummary?: string })[];
  offersInApproval: Offer[];
  recentActivity: ActivityEvent[];
  cases?: Case[];
  /** Server action receiving FormData with field `email` (the raw inbound email). */
  parseEmailAction?: ServerAction;
  /** Server action to create a deal+contact from parsed draft. */
  createFromDraftAction?: ServerAction;
}

export function RepDashboardScreen({ data }: { data: RepDashboardData }) {
  const allDeals = data.openDealsByStage.flatMap((s) => s.deals);
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title={`Good morning, ${data.greetingName} ✨`}
        subtitle={data.greetingSubtitle}
        action={
          <button type="button" className="inline-flex items-center gap-2 rounded-lg ai-gradient px-4 py-2 text-sm font-medium text-white shadow-elegant">
            <Sparkles className="h-4 w-4" /> Daily brief
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((k) => <KpiTile key={k.label} {...k} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* AI intake — paste email → draft */}
        <GlassCard className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-accent/40 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg ai-gradient"><Wand2 className="h-4 w-4 text-white" /></div>
              <div>
                <div className="font-display text-sm font-semibold">AI-assisted intake</div>
                <div className="text-xs text-muted-foreground">Paste an inbound email → structured deal in seconds</div>
              </div>
            </div>
            <AIChip>grounded</AIChip>
          </div>
          <form action={data.parseEmailAction ?? noopAction} className="p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> Inbound email</div>
            <textarea
              name="email"
              rows={10}
              placeholder="Paste an inbound email here…"
              className="w-full resize-none rounded-lg border border-border bg-background/50 p-3 font-mono text-[12px] leading-relaxed text-foreground focus:border-primary focus:outline-none"
            />
            <button type="submit" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-accent/60 px-3 py-1.5 text-xs font-medium ai-gradient-text">
              <Sparkles className="h-3 w-3" /> Parse with AI
            </button>
          </form>
        </GlassCard>

        {/* Next best actions */}
        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="font-display text-sm font-semibold">Today's next best actions</div>
              <div className="text-xs text-muted-foreground">Ranked by AI based on signal & deadlines</div>
            </div>
            <AIChip>{data.nextBestActions.length} new</AIChip>
          </div>
          <div className="divide-y divide-border">
            {data.nextBestActions.map((a) => (
              <div key={a.id} className="group flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/40">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.urgency === "high" ? "bg-destructive" : a.urgency === "medium" ? "bg-warning" : "bg-info"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{a.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{a.accountName}</span><span>·</span><span className="italic">{a.reason}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{a.eta}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* My accounts */}
      <GlassCard className="p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="font-display text-sm font-semibold">My accounts</div>
          <Link href="/accounts" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left font-medium">Account</th>
                <th className="px-3 py-2.5 text-left font-medium">Industry</th>
                <th className="px-3 py-2.5 text-left font-medium">Region</th>
                <th className="px-3 py-2.5 text-right font-medium">Devices</th>
                <th className="px-5 py-2.5 text-right font-medium">ARR</th>
              </tr>
            </thead>
            <tbody>
              {data.myAccounts.map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                  <td className="px-5 py-3">
                    <Link href={`/accounts/${a.id}`} className="flex items-center gap-2">
                      <Avatar initials={initials(a.name)} hue={(a.id.length * 37) % 360} size={22} />
                      <span className="font-medium">{a.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{a.industry ?? "—"}</td>
                  <td className="px-3 py-3"><Badge>{a.region ?? "—"}</Badge></td>
                  <td className="px-3 py-3 text-right tnum">{(a.devices ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium tnum">{a.arr != null ? fmt(a.arr) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Open deals + at-risk + offers-in-approval */}
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">Open deals · by stage</div>
          <div className="divide-y divide-border">
            {data.openDealsByStage.map((s) => (
              <div key={s.stage} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground">{s.stage}</span>
                <span className="tnum">{s.deals.length} · {fmt(s.deals.reduce((x, d) => x + (d.amount ?? 0), 0))}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">At risk</div>
            <Badge variant="destructive">{data.atRiskDeals.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.atRiskDeals.map((d) => (
              <Link key={d.id} href={`/deals/${d.id}`} className="block px-5 py-3 hover:bg-secondary/30">
                <div className="text-sm font-medium leading-tight">{d.name}</div>
                <div className="mt-1 text-xs text-muted-foreground italic line-clamp-2">{d.aiSummary ?? d.stage}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.accountName}</span>
                  <span className="tnum font-medium">{d.amount != null ? fmt(d.amount) : "—"}</span>
                </div>
              </Link>
            ))}
            {data.atRiskDeals.length === 0 && <div className="px-5 py-6 text-xs text-muted-foreground">Nothing at risk 🎉</div>}
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="font-medium text-sm">Offers in approval</div>
            <Badge variant="warning">{data.offersInApproval.length}</Badge>
          </div>
          <div className="divide-y divide-border">
            {data.offersInApproval.map((o) => (
              <Link key={o.id} href={`/offers/${o.id}`} className="block px-5 py-3 hover:bg-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{o.title ?? `Offer ${o.id}`}</span>
                  <Badge variant={o.status === "APPROVED" ? "success" : "warning"}>{o.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{o.accountName} · v{o.version}</span>
                  <span className="tnum">{fmt(o.total, o.currency)}</span>
                </div>
              </Link>
            ))}
            {data.offersInApproval.length === 0 && <div className="px-5 py-6 text-xs text-muted-foreground">No offers in approval.</div>}
          </div>
        </GlassCard>
      </div>

      {/* Recent activity */}
      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Recent activity</div>
        <div className="divide-y divide-border">
          {data.recentActivity.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-5 py-3">
              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary-glow" />
              <div className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{e.actorName ?? "System"}</span>{" "}
                <span className="text-muted-foreground">{e.summary}</span>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
