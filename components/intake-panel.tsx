"use client";

// AI-assisted intake panel (Owner / SA-O4) — the HERO demo opener.
// Paste an email/notes blob (OR click "Try a sample" to drop one in) -> AI returns a DRAFT
// (preview only) -> review + uncheck what you don't want -> "Apply selected" writes real
// records via the applyIntake server action.

import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { applyIntake } from "@/app/rep/intake-actions";

type Draft = {
  summary?: string;
  account?: { name?: string | null; region?: string | null } | null;
  contact?: { name?: string | null; title?: string | null; email?: string | null } | null;
  deal?: { name?: string | null; channel?: string | null; stage?: string | null } | null;
  case?: { title?: string | null; priority?: string | null } | null;
  task?: { body?: string } | null;
};

// A few realistic inbound emails so the demo can be re-run with different results.
const SAMPLES: string[] = [
  `From: Anita Koskinen <anita.koskinen@nordsec.fi>
Subject: Device rollout + a blocker

Hi, following our call — NordSec wants to evaluate 500 HMD Secure Pro devices across our Helsinki and Berlin sites this quarter, with a likely 3-year rollout. We're keen to start a pilot.

One issue: two of the trial devices from last week won't enrol in MDM — this is blocking our security sign-off, fairly urgent.

Can you send next steps?`,

  `From: Marco Lindqvist <marco@norduk-retail.se>
Subject: Secure devices for our stores

Hi there — Norduk Retail is planning to roll out around 600 secure Android devices across our Stockholm stores next quarter, plus an MDM management service. Our IT lead Anna Berg (anna.berg@norduk.se) will run the technical evaluation.

Heads up: we had a security incident last month, so getting this locked down is fairly urgent for us.`,

  `From: Henrik Sørensen <h.sorensen@baltfin.dk>
Subject: Fleet refresh + compliance support

Hello, BaltFin is looking to refresh ~350 devices for our advisory teams in Copenhagen and Oslo, on a 3-year plan. We'd also need your compliance audit service given our regulatory requirements.

Separately, our current devices keep dropping the VPN — it's becoming a daily complaint from staff. Could you advise?`,
];

export function IntakePanel() {
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [sampleIdx, setSampleIdx] = useState(0);

  // Parse the given text (or the textarea) with the AI, keeping a visible "reading" delay
  // so it always feels like the AI is working — even when the deterministic fallback is instant.
  async function generate(text?: string) {
    const content = (text ?? pasted).trim();
    if (content.length < 10) return;
    setLoading(true);
    setDraft(null);
    const started = Date.now();
    try {
      const res = await fetch("/api/ai/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasted: content }),
      });
      const data = await res.json();
      const elapsed = Date.now() - started;
      if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed));
      setDraft(data.draft ?? null);
      setSource(data.source ?? null);
    } catch {
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }

  // One-click demo: drop in the next sample email AND auto-parse it (no paste needed).
  function runSample() {
    const sample = SAMPLES[sampleIdx % SAMPLES.length];
    setSampleIdx((i) => i + 1);
    setPasted(sample);
    void generate(sample);
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI-assisted intake</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground">
          Paste an email or meeting notes — or click <span className="font-medium text-foreground">Try a sample</span>. AI drafts the CRM records; nothing is saved until you apply.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder={`Paste an email thread or notes…  (or click "Try a sample" to auto-fill a demo email)`}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => generate()} disabled={loading || pasted.trim().length < 10}>
            {loading ? (
              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Reading…</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Generate draft</span>
            )}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={runSample} disabled={loading}>
            <span className="inline-flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" /> Try a sample (email {((sampleIdx % SAMPLES.length) + 1)}/{SAMPLES.length})</span>
          </Button>
        </div>

        {loading && (
          <div className="mt-3 space-y-2 rounded-md border border-primary/20 bg-accent/20 p-3">
            <div className="text-xs font-medium ai-gradient-text">AI is reading the email — extracting account / contact / deal / case…</div>
            <div className="h-2 w-full animate-pulse rounded bg-muted" />
            <div className="h-2 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-2 w-3/5 animate-pulse rounded bg-muted" />
          </div>
        )}

        {draft && !loading && (
          <form action={applyIntake} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="draft" value={JSON.stringify(draft)} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Draft CRM records</span>
              <Badge variant="outline">{source === "ai" ? "AI" : "rules fallback"}</Badge>
            </div>

            <DraftRow name="contact" label="Contact" enabled={!!(draft.contact?.name || draft.contact?.email)}>
              {draft.contact?.name ?? draft.contact?.email}{draft.contact?.title ? ` · ${draft.contact.title}` : ""}
            </DraftRow>
            <DraftRow name="deal" label="Deal" enabled={!!draft.deal}>
              {draft.deal?.name ?? "Opportunity"} · {(draft.deal?.channel ?? "DIRECT").toLowerCase()} · {(draft.deal?.stage ?? "INTEREST_SHOWN").replaceAll("_", " ").toLowerCase()}
            </DraftRow>
            <DraftRow name="case" label="Case" enabled={!!draft.case?.title}>
              {draft.case?.title} {draft.case?.priority ? <Badge variant="destructive" className="ml-1">{draft.case.priority}</Badge> : null}
            </DraftRow>
            <DraftRow name="task" label="Follow-up" enabled={!!draft.task?.body}>
              {draft.task?.body}
            </DraftRow>

            <Button type="submit" size="sm" className="w-full">Apply selected updates →</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DraftRow({ name, label, enabled, children }: { name: string; label: string; enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return null;
  return (
    <label className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
      <input type="checkbox" name={`keep_${name}`} defaultChecked className="mt-1" />
      <span>
        <span className="font-medium">{label}: </span>
        {children}
      </span>
    </label>
  );
}
