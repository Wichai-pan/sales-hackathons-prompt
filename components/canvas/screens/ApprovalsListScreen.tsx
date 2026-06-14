import Link from "next/link";
import { Badge } from "@/components/canvas/ui/badge";
import { SectionHeader } from "@/components/canvas/primitives";
import type { Offer, Role, ApprovalStep } from "@/lib/canvas/types";
import { fmt, fmtDate } from "@/lib/canvas/format";

export interface ApprovalsListScreenData {
  role: Role;
  /** Filtered server-side: SM sees PENDING_SM, FINANCE sees PENDING_FINANCE. */
  pending: (Offer & { requestedBy?: string; requestedAt?: string })[];
  recentDecided: (Offer & { decidedAt?: string; decidedBy?: string; decision?: "APPROVED" | "REJECTED" })[];
}

const stepForRole: Partial<Record<Role, ApprovalStep>> = {
  SALES_MANAGER: "SALES_MANAGER",
  FINANCE: "FINANCE",
};

export function ApprovalsListScreen({ data }: { data: ApprovalsListScreenData }) {
  const step = stepForRole[data.role];
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Approvals"
        subtitle={step ? `Queue for ${step.replace("_", " ")} · ${data.pending.length} pending` : "All approvals"}
      />

      <div className="glass-card p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Pending your review</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["Offer", "Account", "Discount", "Total", "Requested by", "Requested", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.pending.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30">
                <td className="px-5 py-3 font-medium">{o.title ?? `Offer ${o.id}`} <span className="text-xs text-muted-foreground">v{o.version}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{o.accountName ?? "—"}</td>
                <td className="px-4 py-3 tnum">{o.discountPercent}%</td>
                <td className="px-4 py-3 tnum font-medium">{fmt(o.total, o.currency)}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.requestedBy ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{o.requestedAt ? fmtDate(o.requestedAt) : "—"}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/approvals/${o.id}`} className="inline-flex items-center gap-1 rounded-md ai-gradient px-3 py-1 text-xs font-medium text-white">Review</Link>
                </td>
              </tr>
            ))}
            {data.pending.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing pending — you're caught up 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-card p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Recently decided</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["Offer", "Account", "Decision", "Decided", "By"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.recentDecided.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 font-medium">{o.title ?? `Offer ${o.id}`}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.accountName ?? "—"}</td>
                <td className="px-4 py-3"><Badge variant={o.decision === "APPROVED" ? "success" : "destructive"}>{o.decision}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{o.decidedAt ? new Date(o.decidedAt).toLocaleString() : "—"}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.decidedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
