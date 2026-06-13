"use client";

// AI-assisted intake panel (Owner / SA-O4) — the HERO demo opener.
// Paste an email/notes blob -> AI returns a DRAFT (preview only) -> review + uncheck what you
// don't want -> "Apply selected" writes real records via the applyIntake server action.

import { useState } from "react";
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

const SAMPLE = `From: Anita Koskinen <anita.koskinen@nordsec.fi>
Subject: Device rollout + a blocker

Hi, following our call — NordSec wants to evaluate 500 HMD Secure Pro devices across our Helsinki and Berlin sites this quarter, with a likely 3-year rollout. We're keen to start a pilot.

One issue: two of the trial devices from last week won't enrol in MDM — this is blocking our security sign-off, fairly urgent.

Can you send next steps?`;

export function IntakePanel() {
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);

  async function generate() {
    setLoading(true);
    setDraft(null);
    try {
      const res = await fetch("/api/ai/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasted }),
      });
      const data = await res.json();
      setDraft(data.draft ?? null);
      setSource(data.source ?? null);
    } catch {
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AI-assisted intake</CardTitle>
        <Badge variant="secondary">AI</Badge>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground">
          Paste an email or meeting notes — AI drafts the CRM records. Nothing is saved until you apply.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="Paste an email thread or notes…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={generate} disabled={loading || pasted.trim().length < 10}>
            {loading ? "Reading…" : "Generate draft"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setPasted(SAMPLE)}>
            Use sample email
          </Button>
        </div>

        {draft && (
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
