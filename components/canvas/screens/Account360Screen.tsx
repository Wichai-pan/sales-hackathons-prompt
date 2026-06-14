import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, AlertTriangle, TrendingUp, Plus, Mail, Phone, Calendar, MessageCircle } from "lucide-react";
import { AIChip, Avatar, GlassCard, HealthRing } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Account, Contact, Deal, Case, Offer, ActivityEvent, DecisionRole, ServerAction } from "@/lib/canvas/types";
import { fmt, initials, fmtDate } from "@/lib/canvas/format";

export interface Account360Data {
  account: Account & { devices?: number; arr?: number; health?: number };
  openDeals: Deal[];
  activeCases: Case[];
  offers: Offer[];
  activity: ActivityEvent[];
  notes: { id: string; body: string; authorName: string; createdAt: string }[];
  contacts: Contact[];
  /** Drop-in node for the streamed AI Next Best Action (the real <NbaPanel/> hero). */
  nbaSlot?: ReactNode;
  /** Fallback static AI Next Best Action card (used only when nbaSlot is absent). */
  nextBestAction?: { title: string; body: string };
  /** Server action for the add-note form (FormData: accountId, body). */
  addNoteAction?: ServerAction;
  insights?: { tone: "primary" | "warning" | "info"; title: string; body: string }[];
}

const decisionTone: Record<DecisionRole, "success" | "warning" | "info" | "default"> = {
  FINANCIAL: "success",
  BUDGET: "info",
  TECH: "warning",
  INFLUENCER: "default",
};

const activityIcon = { EMAIL: Mail, CALL: Phone, MEETING: Calendar, NOTE: MessageCircle, STAGE_CHANGE: Calendar, AI_INSIGHT: Sparkles, SYSTEM: Calendar };

export function Account360Screen({ data }: { data: Account360Data }) {
  const a = data.account;
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link href="/rep" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to dashboard
      </Link>

      <GlassCard className="flex flex-wrap items-center gap-6 p-6">
        <Avatar initials={initials(a.name)} hue={(a.id.length * 37) % 360} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">{a.name}</h1>
            {a.industry && <Badge variant="outline">{a.industry}</Badge>}
            {a.region && <Badge>{a.region}</Badge>}
            {a.segment && <Badge variant="info">{a.segment}</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {a.domain && <span>{a.domain} · </span>}
            {a.address && <span>{a.address} · </span>}
            {a.vatId && <span>VAT {a.vatId} · </span>}
            Owner: {a.ownerName ?? "—"} · TAM: {a.tamName ?? "—"}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">ARR</div>
            <div className="font-display text-2xl font-semibold tnum">{a.arr != null ? fmt(a.arr) : "—"}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Open pipeline</div>
            <div className="font-display text-2xl font-semibold tnum">{fmt(data.openDeals.reduce((s, d) => s + (d.amount ?? 0), 0))}</div>
          </div>
          {a.health != null && (
            <div className="flex flex-col items-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Health</div>
              <HealthRing value={a.health} size={56} />
            </div>
          )}
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <Link href={`/deals/new?accountId=${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg ai-gradient px-3 py-1.5 text-xs font-medium text-white"><Plus className="h-3 w-3" /> New deal</Link>
          <Link href={`/offers/new?accountId=${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Plus className="h-3 w-3" /> New offer</Link>
          <Link href={`/cases/new?accountId=${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs"><Plus className="h-3 w-3" /> New case</Link>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Open deals + cases */}
          <div className="grid gap-4 md:grid-cols-2">
            <GlassCard className="p-0">
              <div className="border-b border-border px-5 py-3 font-medium text-sm">Open deals</div>
              <div className="divide-y divide-border">
                {data.openDeals.map((d) => (
                  <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.stage} · closes {d.expectedCloseDate ? fmtDate(d.expectedCloseDate) : "—"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.amount != null && <span className="font-display tnum">{fmt(d.amount)}</span>}
                      <Badge variant="outline">{d.probability}%</Badge>
                    </div>
                  </Link>
                ))}
                {data.openDeals.length === 0 && <div className="px-5 py-6 text-xs text-muted-foreground">No open deals.</div>}
              </div>
            </GlassCard>

            <GlassCard className="p-0">
              <div className="border-b border-border px-5 py-3 font-medium text-sm">Active cases</div>
              <div className="divide-y divide-border">
                {data.activeCases.map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.status} · {c.serviceName ?? "—"}</div>
                    </div>
                    <Badge variant={c.priority === "P1" ? "destructive" : c.priority === "P2" ? "warning" : "default"}>{c.priority}</Badge>
                  </Link>
                ))}
                {data.activeCases.length === 0 && <div className="px-5 py-6 text-xs text-muted-foreground">No active cases.</div>}
              </div>
            </GlassCard>
          </div>

          {/* Offers */}
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Offers</div>
            <div className="divide-y divide-border">
              {data.offers.map((o) => (
                <Link key={o.id} href={`/offers/${o.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/30">
                  <div>
                    <div className="font-medium">{o.title ?? `Offer ${o.id}`} <span className="text-xs text-muted-foreground">v{o.version}</span></div>
                    <div className="text-xs text-muted-foreground">Subtotal {fmt(o.subtotal, o.currency)} · Total {fmt(o.total, o.currency)}</div>
                  </div>
                  <Badge variant={o.status === "APPROVED" ? "success" : o.status === "REJECTED" ? "destructive" : "warning"}>{o.status.replace("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Activity timeline */}
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Recent activity</div>
            <div className="relative px-5 py-4">
              <div className="absolute bottom-4 left-7 top-4 w-px bg-border" />
              {data.activity.map((e) => {
                const Icon = activityIcon[e.type] ?? Calendar;
                const ai = e.type === "AI_INSIGHT";
                return (
                  <div key={e.id} className="relative flex gap-4 py-2.5">
                    <div className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full ${ai ? "ai-gradient" : "bg-secondary border border-border"}`}>
                      <Icon className={`h-2.5 w-2.5 ${ai ? "text-white" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm"><span className="font-medium">{e.actorName ?? "System"}</span> <span className="text-muted-foreground">{e.summary}</span></div>
                      <div className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Notes */}
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Notes</div>
            {data.addNoteAction && (
              <form action={data.addNoteAction} className="flex gap-2 border-b border-border p-4">
                <input type="hidden" name="accountId" value={a.id} />
                <input
                  name="body"
                  placeholder="Add a note…"
                  required
                  className="flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button type="submit" className="rounded-lg ai-gradient px-4 py-2 text-xs font-medium text-white">Add</button>
              </form>
            )}
            <div className="divide-y divide-border">
              {data.notes.length === 0 && <div className="px-5 py-6 text-xs text-muted-foreground">No notes yet.</div>}
              {data.notes.map((n) => (
                <div key={n.id} className="px-5 py-3">
                  <div className="text-sm">{n.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {data.nbaSlot}
          {!data.nbaSlot && data.nextBestAction && (
            <GlassCard className="p-0">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                <div className="grid h-7 w-7 place-items-center rounded-lg ai-gradient"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
                <div className="font-display text-sm font-semibold ai-gradient-text">Next best action</div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs"><TrendingUp className="h-3.5 w-3.5 text-primary-glow" /><span className="font-medium">{data.nextBestAction.title}</span></div>
                <div className="mt-2 text-sm leading-snug">{data.nextBestAction.body}</div>
              </div>
            </GlassCard>
          )}

          {data.insights && data.insights.length > 0 && (
            <GlassCard className="p-0">
              <div className="border-b border-border px-5 py-3 font-medium text-sm">AI Insights</div>
              <div className="space-y-3 p-4">
                {data.insights.map((i, k) => (
                  <div key={k} className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      {i.tone === "warning" ? <AlertTriangle className="h-3.5 w-3.5 text-warning" /> :
                       i.tone === "info" ? <Sparkles className="h-3.5 w-3.5 text-info" /> :
                       <TrendingUp className="h-3.5 w-3.5 text-primary-glow" />}
                      <span className="font-medium">{i.title}</span>
                    </div>
                    <div className="mt-2 text-sm leading-snug">{i.body}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">Contacts</div>
              <AIChip>{data.contacts.filter((c) => c.decisionRole === "FINANCIAL" || c.decisionRole === "BUDGET").length} decision makers</AIChip>
            </div>
            <div className="space-y-3">
              {data.contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar initials={initials(c.name)} hue={(c.id.length * 53) % 360} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight">{c.name} {c.isPrimary && <span className="text-[10px] text-primary-glow">★</span>}</div>
                    <div className="text-xs text-muted-foreground">{c.title ?? c.email ?? "—"}</div>
                  </div>
                  {c.decisionRole && <Badge variant={decisionTone[c.decisionRole]}>{c.decisionRole}</Badge>}
                </div>
              ))}
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}
