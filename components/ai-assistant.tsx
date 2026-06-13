"use client";

// Floating "Aino" AI assistant (bottom-right). Conversational query over live data + usage help.
// On-thesis: the "AI analyst on the team" you can just ask. Calls /api/ai/assistant (Featherless + fallback).

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send } from "lucide-react";

type Msg = { role: "user" | "aino"; text: string };
type Action = { label: string; prompt: string };

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [greeted, setGreeted] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  // On first open, fetch a personalised greeting + proactive, data-driven work suggestions.
  useEffect(() => {
    if (!open || greeted) return;
    setGreeted(true);
    fetch("/api/ai/assistant")
      .then((r) => r.json())
      .then((d) => {
        setMsgs([{ role: "aino", text: d.greeting ?? "Hi — how can I help?" }]);
        setActions(Array.isArray(d.actions) ? d.actions : []);
      })
      .catch(() => setMsgs([{ role: "aino", text: "Hi — ask me about your accounts, deals, or pipeline." }]));
  }, [open, greeted]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "aino", text: data.answer ?? "…" }]);
    } catch {
      setMsgs((m) => [...m, { role: "aino", text: "I couldn't reach the server just now — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Aino"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" /> Ask Aino
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary"><Sparkles className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-medium leading-none">Aino</div>
            <div className="text-[11px] text-muted-foreground">AI analyst</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">Aino is thinking…</div></div>}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {actions.map((a) => (
            <button key={a.label} onClick={() => send(a.prompt)} className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-foreground hover:bg-primary/10">{a.label}</button>
          ))}
          <button onClick={() => send("How do I use this CRM?")} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">How do I use this?</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Aino…"
          className="flex-1 rounded-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" disabled={busy} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
