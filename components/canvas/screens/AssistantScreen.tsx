"use client";

import { Sparkles, Send, Plus, MessageSquare, Table2 } from "lucide-react";
import { AIChip, Avatar } from "@/components/canvas/primitives";
import type { ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";
import { initials } from "@/lib/canvas/format";

export interface AssistantMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Optional rich blocks the AI renders. */
  table?: { columns: string[]; rows: (string | number)[][] };
  sources?: { title: string; subtitle?: string }[];
}

export interface AssistantScreenData {
  userName: string;
  threads: { id: string; title: string }[];
  activeThreadId?: string;
  messages: AssistantMessage[];
  /** Sources for the right rail. */
  sources?: { title: string; subtitle?: string }[];
  sendAction?: ServerAction;
}

export function AssistantScreen({ data }: { data: AssistantScreenData }) {
  return (
    <div className="grid h-[calc(100vh-56px)] grid-cols-[260px_1fr_320px] gap-0">
      <aside className="flex flex-col border-r border-border bg-sidebar/40 p-3">
        <a href="/assistant" className="mb-3 inline-flex items-center justify-center gap-1.5 rounded-lg ai-gradient px-3 py-2 text-sm font-medium text-white">
          <Plus className="h-3.5 w-3.5" /> New chat
        </a>
        <div className="space-y-1 text-sm overflow-y-auto">
          {data.threads.map((t) => (
            <a
              key={t.id}
              href={`/assistant?thread=${t.id}`}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${data.activeThreadId === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <MessageSquare className="h-3 w-3" />
              <span className="truncate">{t.title}</span>
            </a>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-6 py-3">
          <div className="grid h-7 w-7 place-items-center rounded-lg ai-gradient"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
          <div className="font-display text-sm font-semibold ai-gradient-text">HMD Copilot</div>
          <AIChip>Grounded in live CRM</AIChip>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {data.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end gap-3">
                <div className="max-w-xl rounded-2xl rounded-tr-sm bg-accent/40 p-3 text-sm">{m.text}</div>
                <Avatar initials={initials(data.userName)} hue={280} size={28} />
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full ai-gradient"><Sparkles className="h-3.5 w-3.5 text-white" /></div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="text-sm">{m.text}</div>
                  {m.table && (
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <tr>{m.table.columns.map((c) => <th key={c} className="px-3 py-2 text-left">{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {m.table.rows.map((r, i) => (
                            <tr key={i} className="border-t border-border/60">
                              {r.map((cell, j) => <td key={j} className="px-3 py-2.5 text-sm">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <form action={data.sendAction ?? noopAction} className="border-t border-border p-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-2">
            <textarea name="message" rows={2} placeholder="Ask anything about your CRM…" className="w-full resize-none bg-transparent p-2 text-sm focus:outline-none" />
            <div className="flex items-center justify-between p-1">
              <div className="text-[11px] text-muted-foreground">Grounded in: deals, accounts, activity, cases, forecast</div>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg ai-gradient px-3 py-1.5 text-xs font-medium text-white"><Send className="h-3 w-3" /> Send</button>
            </div>
          </div>
        </form>
      </div>

      <aside className="border-l border-border bg-sidebar/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><Table2 className="h-3 w-3" /> Sources used</div>
        <div className="space-y-2 text-sm">
          {(data.sources ?? []).map((s, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs font-medium">{s.title}</div>
              {s.subtitle && <div className="text-[11px] text-muted-foreground">{s.subtitle}</div>}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
