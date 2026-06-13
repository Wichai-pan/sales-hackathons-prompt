// lib/ai/intake.ts — HERO demo opener: paste email/notes -> DRAFT crm updates (preview only).
// The route returns this draft; the UI shows a checklist; only "Apply selected" writes records
// via the SAME server actions used for manual create. AI never mutates the DB directly.
//
// Pipeline stages (must match Prisma enum): INTEREST_SHOWN, RFI_ANSWERED, RFP_OFFER_GIVEN,
// CUSTOMER_TEST, CONTRACT_NEGOTIATION (direct only), WON, LOST.

import { z } from "zod";
import { aiJSON } from "./client";

export const IntakeDraftSchema = z.object({
  summary: z.string().describe("one-line summary of what was pasted"),
  contact: z
    .object({
      name: z.string().nullable(),
      title: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
    })
    .nullable(),
  account: z
    .object({ name: z.string().nullable(), region: z.string().nullable() })
    .nullable(),
  deal: z
    .object({
      name: z.string().nullable(),
      channel: z.enum(["DIRECT", "RESELLER"]).nullable(),
      stage: z
        .enum([
          "INTEREST_SHOWN",
          "RFI_ANSWERED",
          "RFP_OFFER_GIVEN",
          "CUSTOMER_TEST",
          "CONTRACT_NEGOTIATION",
          "WON",
          "LOST",
        ])
        .nullable(),
      expectedCloseDate: z.string().nullable(),
    })
    .nullable(),
  case: z
    .object({
      title: z.string().nullable(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable(),
    })
    .nullable(),
  task: z.object({ body: z.string() }).nullable(),
});
export type IntakeDraft = z.infer<typeof IntakeDraftSchema>;

const SYSTEM = `You are a CRM intake assistant for HMD Secure (sells smart devices + services to enterprises).
Read the pasted email thread or meeting notes and extract DRAFT CRM records.

Output ONLY a JSON object with EXACTLY these keys and shapes (use null when not clearly present — do NOT invent, do NOT rename keys, do NOT add keys):
{
  "summary": string,
  "contact": { "name": string|null, "title": string|null, "email": string|null, "phone": string|null } | null,
  "account": { "name": string|null, "region": string|null } | null,
  "deal": { "name": string|null, "channel": "DIRECT"|"RESELLER", "stage": "INTEREST_SHOWN"|"RFI_ANSWERED"|"RFP_OFFER_GIVEN"|"CUSTOMER_TEST"|"CONTRACT_NEGOTIATION"|"WON"|"LOST", "expectedCloseDate": string|null } | null,
  "case": { "title": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" } | null,
  "task": { "body": string } | null
}

Rules:
- "account.name" = the customer company name. "contact" is an OBJECT (not a string).
- deal.stage: "evaluate/pilot/test/POC" => CUSTOMER_TEST; "interested/exploring" => INTEREST_SHOWN; "sent RFP/quote/offer" => RFP_OFFER_GIVEN; "answered RFI/questionnaire" => RFI_ANSWERED; "negotiating contract/legal/pricing terms" => CONTRACT_NEGOTIATION.
- "case" ONLY if the customer reports a problem/issue/incident/support need; case.title is a short label; map "urgent/blocking/critical" => HIGH or CRITICAL priority.
- channel: RESELLER only if a partner/reseller/distributor is clearly the buyer, else DIRECT.
- "task" is the single most useful follow-up; task.body is a short imperative sentence.`;

export async function extractIntake(pasted: string): Promise<{
  draft: IntakeDraft;
  source: "ai" | "fallback";
}> {
  const ai = await aiJSON<IntakeDraft>({
    system: SYSTEM,
    user: `Extract draft CRM records from:\n\n"""\n${pasted}\n"""`,
    maxTokens: 700,
  });
  const parsed = ai ? IntakeDraftSchema.safeParse(ai) : null;
  if (parsed?.success) return { draft: parsed.data, source: "ai" };
  if (ai && parsed && !parsed.success) {
    console.warn("[ai] intake schema mismatch, using fallback:", parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  }
  return { draft: fallbackExtract(pasted), source: "fallback" };
}

// ---- Deterministic fallback (no API key / model failure): regex + keyword rules ----
function fallbackExtract(text: string): IntakeDraft {
  const t = text.trim();
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const domain = email?.split("@")[1] ?? null;

  // crude name: first "Firstname Lastname" near a sign-off or "From:"
  const name =
    t.match(/(?:from:|regards,|best,|thanks,)\s*\n?\s*([A-Z][a-z]+ [A-Z][a-z]+)/i)?.[1] ??
    t.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/)?.[1] ??
    null;

  const lower = t.toLowerCase();
  const has = (...w: string[]) => w.some((x) => lower.includes(x));

  let stage: IntakeDraft["deal"] extends infer D ? any : never = null;
  if (has("contract", "legal review", "terms", "negotiat")) stage = "CONTRACT_NEGOTIATION";
  else if (has("pilot", "poc", "proof of concept", "evaluate", "trial", "testing"))
    stage = "CUSTOMER_TEST";
  else if (has("rfp", "quote", "offer", "proposal")) stage = "RFP_OFFER_GIVEN";
  else if (has("rfi", "questionnaire")) stage = "RFI_ANSWERED";
  else if (has("interested", "exploring", "looking into", "evaluate")) stage = "INTEREST_SHOWN";

  const isCase = has("issue", "problem", "broken", "down", "not working", "error", "incident", "outage", "bug", "support");
  const priority = has("urgent", "critical", "asap", "outage", "down") ? "HIGH" : "MEDIUM";

  return {
    summary: t.slice(0, 120).replace(/\s+/g, " "),
    contact: name || email ? { name, title: null, email, phone: null } : null,
    account: domain
      ? { name: domain.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()), region: null }
      : null,
    deal: stage ? { name: null, channel: "DIRECT", stage, expectedCloseDate: null } : null,
    case: isCase
      ? { title: t.split(/[.\n]/)[0].slice(0, 80), priority: priority as any }
      : null,
    task: { body: isCase ? "Acknowledge the issue and assign a TAM." : "Follow up to confirm next step." },
  };
}
