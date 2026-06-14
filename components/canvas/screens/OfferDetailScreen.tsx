import { Send, Sparkles, ShieldCheck, Check, Clock } from "lucide-react";
import { Badge } from "@/components/canvas/ui/badge";
import { GlassCard } from "@/components/canvas/primitives";
import { Button } from "@/components/canvas/ui/button";
import type { Offer, OfferLineItem, Approval, OfferStatus, ServerAction } from "@/lib/canvas/types";
import { fmt, fmtDate } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface OfferDetailScreenData {
  offer: Offer & { heroTagline?: string };
  lineItems: OfferLineItem[];
  approvals: Approval[];
  /** Form action to send the offer as web page (POST). */
  sendAction?: ServerAction;
  /** Form action for accept signature (POST). */
  acceptAction?: ServerAction;
}

const statusFlow: OfferStatus[] = ["DRAFT", "PENDING_SM", "PENDING_FINANCE", "APPROVED"];

export function OfferDetailScreen({ data }: { data: OfferDetailScreenData }) {
  const o = data.offer;
  const subtotal = data.lineItems.reduce((s, l) => s + l.lineTotal, 0);
  const discountAmount = (subtotal * o.discountPercent) / 100;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Offer · {o.id} · v{o.version}</div>
          <h1 className="font-display text-2xl font-semibold">{o.title ?? `Offer ${o.id}`}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            For {o.accountName} · prepared by {o.preparedBy ?? "—"} {o.validUntil && <>· valid until {fmtDate(o.validUntil)}</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={o.status === "APPROVED" ? "success" : o.status === "REJECTED" ? "destructive" : "warning"}>
            {o.status.replace("_", " ")}
          </Badge>
          {o.locked && <Badge variant="outline">Locked</Badge>}
          <form action={data.sendAction ?? noopAction}>
            <Button type="submit" size="sm"><Send className="h-3.5 w-3.5" /> Send as web page</Button>
          </form>
        </div>
      </div>

      {/* Status stepper */}
      <div className="glass-card flex items-center gap-2 p-4">
        {statusFlow.map((s, i) => {
          const idx = statusFlow.indexOf(o.status as OfferStatus);
          const passed = idx >= 0 && i <= idx;
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${passed ? "ai-gradient text-white" : "border border-border bg-card text-muted-foreground"}`}>
                {passed ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </div>
              <div className="text-xs font-medium">{s.replace("_", " ")}</div>
              {i < statusFlow.length - 1 && <div className={`h-px flex-1 ${passed ? "bg-primary-glow" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
            <div className="aurora relative overflow-hidden p-10 ai-gradient">
              <div className="aurora-bg absolute inset-0 opacity-50" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] text-white backdrop-blur">
                  <ShieldCheck className="h-3 w-3" /> HMD Secure · proposal for {o.accountName}
                </div>
                <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white">
                  {o.heroTagline ?? "A secure mobility platform for your team."}
                </h2>
              </div>
            </div>

            <div className="space-y-8 p-8">
              <section>
                <h3 className="mb-4 font-display text-lg font-semibold">What you're getting</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.lineItems.map((l) => (
                    <div key={l.id} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="text-[11px] text-muted-foreground">{l.skuSnapshot ?? l.itemType}</div>
                      <div className="font-medium">{l.nameSnapshot}</div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-xs text-muted-foreground">{l.quantity.toLocaleString()} × {fmt(l.unitPriceSnapshot, o.currency)}</span>
                        <span className="font-display text-lg font-semibold tnum">{fmt(l.lineTotal, o.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-4 font-display text-lg font-semibold">Investment summary</h3>
                <div className="rounded-xl border border-border bg-background/40 p-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="font-medium tnum">{fmt(subtotal, o.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border py-3">
                    <span className="text-sm text-muted-foreground">Discount ({o.discountPercent}%)</span>
                    <span className="font-medium tnum text-success">−{fmt(discountAmount, o.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="font-medium">Total</span>
                    <span className="font-display text-2xl font-semibold tnum ai-gradient-text">{fmt(o.total, o.currency)}</span>
                  </div>
                </div>
                {o.discountJustification && (
                  <div className="mt-3 rounded-lg border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Justification: </span>{o.discountJustification}
                  </div>
                )}
              </section>

              <form action={data.acceptAction ?? noopAction} className="rounded-xl border border-primary/30 bg-accent/20 p-5">
                <div className="text-sm font-medium">Accept and sign</div>
                <p className="mt-1 text-xs text-muted-foreground">A signed PDF will be sent to {o.accountName} and HMD Secure.</p>
                <div className="mt-4 flex items-end gap-3">
                  <label className="flex-1">
                    <input name="signature" required placeholder="Type your full name to sign" className="h-12 w-full rounded-lg border-2 border-dashed border-border bg-background/60 px-4 text-center text-sm focus:border-primary focus:outline-none" />
                  </label>
                  <Button type="submit" size="lg">Accept proposal</Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <GlassCard className="p-0">
            <div className="border-b border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">Approval history</div>
            <div className="relative p-4">
              <div className="absolute left-[26px] top-6 bottom-6 w-px bg-border" />
              {data.approvals.map((a) => (
                <div key={a.id} className="relative mb-3 flex items-start gap-3 last:mb-0">
                  <div className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    a.status === "APPROVED" ? "bg-success text-white" :
                    a.status === "REJECTED" ? "bg-destructive text-white" :
                    "ai-gradient text-white"
                  }`}>
                    {a.status === "APPROVED" ? <Check className="h-3 w-3" /> : a.status === "PENDING" ? <Sparkles className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{a.step.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{a.approverName ?? "—"} · {a.status}</div>
                    {a.comment && <div className="mt-1 text-xs">{a.comment}</div>}
                    {a.decidedAt && <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.decidedAt).toLocaleString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}
