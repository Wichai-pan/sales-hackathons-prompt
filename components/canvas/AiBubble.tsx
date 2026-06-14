"use client";

import { Sparkles, X, Send, ArrowRight } from "lucide-react";
import { useState } from "react";

const defaultSuggestions = [
  "Which deals in Q3 are at risk?",
  "Draft a renewal email for Deutsche Bahn",
  "Summarize Airbus last 30 days of activity",
  "Top accounts by health score drop",
];

export interface AiBubbleProps {
  userName?: string;
  suggestions?: string[];
  /** Form action for the chat input. Receives FormData with field `message`. */
  action?: (formData: FormData) => void | Promise<void>;
}

export function AiBubble({ userName = "there", suggestions = defaultSuggestions, action }: AiBubbleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full ai-gradient px-4 py-3 text-sm font-medium text-white shadow-elegant hover:scale-[1.03] transition-transform"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-white ai-pulse" />
        </span>
        <Sparkles className="h-4 w-4" /> Ask AI
      </button>

      {open && (
        <div
          className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[460px] flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right"
          style={{ animation: "ai-slide-in 220ms ease-out" }}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg ai-gradient">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold ai-gradient-text">HMD Copilot</div>
                <div className="text-[10px] text-muted-foreground">Live, grounded in your CRM</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div className="rounded-2xl rounded-tl-sm bg-secondary/50 p-4 text-sm">
              Hi {userName} 👋 — I can answer questions across your pipeline, draft emails, prep meetings and flag
              risks. What do you want to do?
            </div>
            <div className="grid gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="group flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3 text-left text-sm hover:border-primary/40 hover:bg-accent/30 transition-colors"
                >
                  <span>{s}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </button>
              ))}
            </div>
          </div>

          <form action={action} className="border-t border-border p-4">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2">
              <textarea
                name="message"
                placeholder="Ask anything about your CRM…"
                rows={1}
                className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none"
              />
              <button type="submit" className="grid h-9 w-9 place-items-center rounded-lg ai-gradient text-white">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        @keyframes ai-slide-in {
          from { transform: translateX(480px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
