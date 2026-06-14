"use client";

import Link from "next/link";
import { Search, Sparkles, Send, Paperclip, Clock } from "lucide-react";
import { useState } from "react";
import { Avatar, AIChip, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import type { Case, CasePriority, ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";
import { initials } from "@/lib/canvas/format";

export interface CasesListScreenData {
  cases: (Case & { lastMessage?: string; slaLabel?: string })[];
  /** AI suggested context shown for the active case (caller passes it). */
  aiContextByCaseId?: Record<string, string>;
  replyAction?: ServerAction;
}

const priorityTone: Record<CasePriority, "destructive" | "warning" | "info" | "default"> = {
  P1: "destructive", P2: "warning", P3: "info", P4: "default",
};

export function CasesListScreen({ data }: { data: CasesListScreenData }) {
  const [activeId, setActiveId] = useState(data.cases[0]?.id);
  const active = data.cases.find((c) => c.id === activeId) ?? data.cases[0];
  if (!active) {
    return <div className="p-6 text-sm text-muted-foreground">No cases.</div>;
  }
  const aiContext = data.aiContextByCaseId?.[active.id];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title="Cases" subtitle={`${data.cases.length} cases · ${data.cases.filter((c) => c.priority === "P1").length} P1`} />
      <div className="grid h-[calc(100vh-220px)] grid-cols-[280px_1fr_320px] gap-0 overflow-hidden rounded-2xl border border-border bg-card">
        {/* List */}
        <div className="flex flex-col border-r border-border">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input placeholder="Search cases" className="h-8 w-full rounded-md border border-border bg-background/50 pl-8 pr-2 text-xs focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {data.cases.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setActiveId(k.id)}
                className={`w-full border-b border-border/60 px-3 py-3 text-left transition ${active.id === k.id ? "bg-accent/40" : "hover:bg-secondary/40"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={priorityTone[k.priority]}>{k.priority}</Badge>
                  <span className="text-[10px] text-muted-foreground">{k.slaLabel ?? ""}</span>
                </div>
                <div className="mt-1.5 text-sm font-medium leading-tight">{k.title}</div>
                <div className="text-[11px] text-muted-foreground">{k.accountName}</div>
                {k.lastMessage && <div className="mt-1 truncate text-[11px] text-muted-foreground/80">{k.lastMessage}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <div className="text-sm font-medium">{active.title}</div>
              <div className="text-[11px] text-muted-foreground">{active.accountName} · case {active.id}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={priorityTone[active.priority]}>{active.priority}</Badge>
              <Badge variant="info">{active.status}</Badge>
              <Link href={`/cases/${active.id}`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary">Open</Link>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {active.description && (
              <div className="flex items-start gap-3">
                <Avatar initials={initials(active.contactName ?? active.accountName ?? "?")} hue={280} size={32} />
                <div className="max-w-xl rounded-2xl rounded-tl-sm bg-secondary/40 p-3">
                  <div className="mb-1 text-[11px] text-muted-foreground">{active.contactName ?? active.accountName}</div>
                  <div className="text-sm">{active.description}</div>
                </div>
              </div>
            )}
            {aiContext && (
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full ai-gradient"><Sparkles className="h-4 w-4 text-white" /></div>
                <div className="max-w-xl rounded-2xl rounded-tl-sm border border-primary/30 bg-accent/30 p-3">
                  <div className="mb-1 flex items-center gap-2 text-[11px] ai-gradient-text">AI suggested context</div>
                  <div className="text-sm">{aiContext}</div>
                </div>
              </div>
            )}
          </div>
          <form action={data.replyAction ?? noopAction} className="border-t border-border p-3">
            <input type="hidden" name="caseId" value={active.id} />
            <div className="rounded-xl border border-border bg-background/50 p-2">
              <div className="flex items-center gap-1 px-1 pb-1 text-[10px] text-muted-foreground">
                <label className="rounded px-1.5 py-0.5"><input type="radio" name="kind" value="reply" defaultChecked className="mr-1 accent-[oklch(var(--primary))]" />Reply</label>
                <label className="rounded px-1.5 py-0.5"><input type="radio" name="kind" value="internal" className="mr-1 accent-[oklch(var(--primary))]" />Internal note</label>
                <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 ai-gradient-text"><Sparkles className="h-3 w-3" /> Draft with AI</span>
              </div>
              <textarea name="body" rows={2} placeholder="Type a reply… (⌘↵ to send)" className="w-full resize-none bg-transparent p-1 text-sm focus:outline-none" />
              <div className="flex items-center justify-between p-1">
                <button type="button" className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary"><Paperclip className="h-3.5 w-3.5" /></button>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md ai-gradient px-3 py-1 text-xs font-medium text-white"><Send className="h-3 w-3" /> Send</button>
              </div>
            </div>
          </form>
        </div>

        {/* Right rail */}
        <div className="space-y-4 border-l border-border bg-sidebar/40 p-4 overflow-y-auto">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">SLA</div>
            <div className="mt-1 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <div className="font-display text-lg font-semibold tnum">{active.slaLabel ?? "—"}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Customer</div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Avatar initials={initials(active.accountName ?? "?")} hue={120} size={28} />
                <div>
                  <div className="text-sm font-medium">{active.accountName}</div>
                  <div className="text-[11px] text-muted-foreground">Account</div>
                </div>
              </div>
            </div>
          </div>
          <AIChip>2 similar cases this week</AIChip>
        </div>
      </div>
    </div>
  );
}
