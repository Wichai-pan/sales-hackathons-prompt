import Link from "next/link";
import { ArrowLeft, Check, X, Sparkles } from "lucide-react";
import { GlassCard, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Textarea } from "@/components/canvas/ui/input";
import { Button } from "@/components/canvas/ui/button";
import type { Offer, OfferLineItem, Approval, ServerAction } from "@/lib/canvas/types";
import { fmt } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface ApprovalDetailScreenData {
  offer: Offer;
  lineItems: OfferLineItem[];
  history: Approval[];
  /** AI recommendation surfaced from policy / margin checks. */
  aiRecommendation?: { decision: "APPROVE" | "REJECT" | "NEGOTIATE"; rationale: string };
  approveAction?: ServerAction;
  rejectAction?: ServerAction;
}

export function ApprovalDetailScreen({ data }: { data: ApprovalDetailScreenData }) {
  const o = data.offer;
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link href="/approvals" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All approvals
      </Link>

      <SectionHeader
        title={o.title ?? `Offer ${o.id}`}
        subtitle={`${o.accountName ?? ""} · v${o.version} · ${o.status.replace("_", " ")}`}
        action={<Badge variant="warning">Awaiting your decision</Badge>}
      />

      {data.aiRecommendation && (
        <GlassCard className="border-primary/30 bg-accent/20 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg ai-gradient"><Sparkles className="h-4 w-4 text-white" /></div>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="ai-gradient-text">AI recommendation:</span>
                <Badge variant={data.aiRecommendation.decision === "APPROVE" ? "success" : data.aiRecommendation.decision === "REJECT" ? "destructive" : "warning"}>
                  {data.aiRecommendation.decision}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{data.aiRecommendation.rationale}</p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">Line items</div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-5 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit</th>
                <th className="px-5 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{l.nameSnapshot}</div>
                    <div className="text-xs text-muted-foreground">{l.skuSnapshot ?? l.itemType}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tnum">{l.quantity.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right tnum">{fmt(l.unitPriceSnapshot, o.currency)}</td>
                  <td className="px-5 py-2.5 text-right tnum font-medium">{fmt(l.lineTotal, o.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30">
                <td className="px-5 py-3 text-muted-foreground">Discount {o.discountPercent}%</td>
                <td colSpan={2} />
                <td className="px-5 py-3 text-right tnum text-success">−{fmt((o.subtotal * o.discountPercent) / 100, o.currency)}</td>
              </tr>
              <tr className="bg-accent/30">
                <td className="px-5 py-3 font-medium">Total</td>
                <td colSpan={2} />
                <td className="px-5 py-3 text-right font-display text-lg font-semibold tnum ai-gradient-text">{fmt(o.total, o.currency)}</td>
              </tr>
            </tfoot>
          </table>
          {o.discountJustification && (
            <div className="border-t border-border p-4 text-xs">
              <span className="font-medium">Justification: </span>
              <span className="text-muted-foreground">{o.discountJustification}</span>
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Decision</div>
            <div className="p-5 space-y-3">
              <form action={data.approveAction ?? noopAction} className="space-y-2">
                <Textarea name="comment" rows={3} placeholder="Approval comment (optional)" />
                <Button type="submit" className="w-full"><Check className="h-4 w-4" /> Approve</Button>
              </form>
              <form action={data.rejectAction ?? noopAction} className="space-y-2">
                <Textarea name="comment" rows={3} placeholder="Reason for rejection" required />
                <Button type="submit" variant="destructive" className="w-full"><X className="h-4 w-4" /> Reject</Button>
              </form>
            </div>
          </GlassCard>

          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">History</div>
            <div className="divide-y divide-border">
              {data.history.map((h) => (
                <div key={h.id} className="px-5 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{h.step.replace("_", " ")}</span>
                    <Badge variant={h.status === "APPROVED" ? "success" : h.status === "REJECTED" ? "destructive" : "warning"}>{h.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{h.approverName ?? "—"} {h.decidedAt && `· ${new Date(h.decidedAt).toLocaleString()}`}</div>
                  {h.comment && <div className="mt-1 text-xs">{h.comment}</div>}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
