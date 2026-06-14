"use client";

// "Daily brief" CTA on the rep dashboard. Opens the floating Aino assistant, whose
// first-open greeting IS a personalised AI daily brief ("Hi <name> — you have N at-risk
// deals…") + proactive work chips. Bridges to the client AiAssistant via a window event
// so the server-rendered dashboard can trigger it without prop drilling.

import { Sparkles } from "lucide-react";

export function DailyBriefButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("aino:open"))}
      className="inline-flex items-center gap-2 rounded-lg ai-gradient px-4 py-2 text-sm font-medium text-white shadow-elegant transition hover:opacity-90"
    >
      <Sparkles className="h-4 w-4" /> Daily brief
    </button>
  );
}
