import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Button } from "@/components/canvas/ui/button";
import { Select, Textarea } from "@/components/canvas/ui/input";
import type { Case, CasePriority, CaseStatus, ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";

export interface CaseDetailScreenData {
  case: Case;
  /** Internal-vs-working threaded notes. */
  notes: { id: string; body: string; visibility: "INTERNAL" | "WORKING"; authorName: string; createdAt: string }[];
  assignees: { id: string; name: string }[];
  aiSummary?: string;
  addNoteAction?: ServerAction;
  changeStatusAction?: ServerAction;
  closeAction?: ServerAction;
  escalateAction?: ServerAction;
  reassignAction?: ServerAction;
}

const priorityTone: Record<CasePriority, "destructive" | "warning" | "info" | "default"> = {
  P1: "destructive", P2: "warning", P3: "info", P4: "default",
};
const statuses: CaseStatus[] = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];

export function CaseDetailScreen({ data }: { data: CaseDetailScreenData }) {
  const c = data.case;
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link href="/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All cases
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Case · {c.id}</div>
          <h1 className="font-display text-2xl font-semibold">{c.title}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {c.accountName} · {c.serviceName ?? "—"} · contact {c.contactName ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={priorityTone[c.priority]}>{c.priority}</Badge>
          <Badge variant="info">{c.status}</Badge>
        </div>
      </div>

      {data.aiSummary && (
        <GlassCard className="border-primary/30 bg-accent/20 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-primary-glow" />
            <div>
              <div className="text-xs ai-gradient-text font-medium">AI case summary</div>
              <div className="mt-1 text-sm">{data.aiSummary}</div>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="p-0">
          <div className="border-b border-border px-5 py-3 font-medium text-sm">Conversation</div>
          <div className="divide-y divide-border">
            {data.notes.map((n) => (
              <div key={n.id} className={`px-5 py-3 ${n.visibility === "INTERNAL" ? "bg-warning/5" : ""}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{n.authorName}</span>
                  <span className="text-muted-foreground">
                    {n.visibility === "INTERNAL" && <Badge variant="warning" className="mr-2">Internal</Badge>}
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm">{n.body}</div>
              </div>
            ))}
          </div>
          <form action={data.addNoteAction ?? noopAction} className="border-t border-border p-4 space-y-2">
            <Textarea name="body" rows={3} placeholder="Reply or add internal note…" />
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">
                <select name="visibility" defaultValue="WORKING" className="rounded border border-border bg-card px-2 py-1 text-xs">
                  <option value="WORKING">Visible to customer</option>
                  <option value="INTERNAL">Internal only</option>
                </select>
              </label>
              <Button type="submit" size="sm">Post</Button>
            </div>
          </form>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Actions</div>
            <div className="space-y-3 p-5">
              <form action={data.changeStatusAction ?? noopAction} className="flex gap-2">
                <Select name="status" defaultValue={c.status} className="flex-1">
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Button type="submit" variant="secondary" size="sm">Update</Button>
              </form>
              <form action={data.reassignAction ?? noopAction} className="flex gap-2">
                <Select name="assigneeId" defaultValue={c.ownerId} className="flex-1">
                  {data.assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
                <Button type="submit" variant="secondary" size="sm">Reassign</Button>
              </form>
              <form action={data.escalateAction ?? noopAction}>
                <Button type="submit" variant="outline" className="w-full">Escalate</Button>
              </form>
              <form action={data.closeAction ?? noopAction}>
                <Button type="submit" variant="destructive" className="w-full">Close case</Button>
              </form>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Facts</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Account</dt><dd>{c.accountName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Service</dt><dd>{c.serviceName ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Contact</dt><dd>{c.contactName ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Due</dt><dd>{c.dueDate ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Owner</dt><dd>{c.ownerName ?? "—"}</dd></div>
            </dl>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
