// lib/ai/client.ts — LLM wrapper via Featherless (OpenAI-compatible). Server-only.
// Core rule: if the key is missing, hasAI() is false and callers MUST use their deterministic fallback.
// A missing/failed key never throws to the user — the demo always works.
//
// Deps: `npm i openai zod server-only`
// Env (all optional):
//   FEATHERLESS_API_KEY   — Bearer key from the Featherless platform
//   FEATHERLESS_MODEL     — org/model id, default "Qwen/Qwen2.5-7B-Instruct"
//   FEATHERLESS_BASE_URL  — default "https://api.featherless.ai/v1"
//
// Featherless is OpenAI-compatible, so we use the standard `openai` client with a custom baseURL.
// (Production target per the HMD brief is Azure OpenAI in EU; for the hackathon we use Featherless —
//  documented as an assumption. The AI only sees seeded/demo CRM text, not real customer PII.)

import "server-only";
import OpenAI from "openai";

// Read env at RUNTIME (not module top-level) — Next dev/build can evaluate this module before
// .env is in process.env, which would wrongly latch hasAI() to false.
function cfg() {
  return {
    apiKey: process.env.FEATHERLESS_API_KEY,
    model: process.env.FEATHERLESS_MODEL ?? "Qwen/Qwen2.5-7B-Instruct",
    baseURL: process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1",
  };
}

export function hasAI(): boolean {
  return Boolean(process.env.FEATHERLESS_API_KEY);
}

function client(): OpenAI {
  const { apiKey, baseURL } = cfg();
  return new OpenAI({ apiKey, baseURL });
}

/** Pull the first balanced JSON object out of a model reply (handles ```json fences / chatter). */
function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}" && --depth === 0) return body.slice(start, i + 1);
  }
  return null;
}

/**
 * Ask the model for STRICT JSON and parse it. Returns null on any failure so the
 * caller falls back to deterministic rules. Never throws.
 */
export async function aiJSON<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  if (!hasAI()) return null;
  try {
    const res = await client().chat.completions.create({
      model: cfg().model,
      messages: [
        { role: "system", content: opts.system + "\nRespond with ONLY a single JSON object, no prose, no code fences." },
        { role: "user", content: opts.user },
      ],
      temperature: 0.2,
      max_tokens: opts.maxTokens ?? 800,
    });
    const msg = res.choices[0]?.message as { content?: string; reasoning?: string } | undefined;
    // Featherless reasoning models (e.g. GLM-4.6) put output in `reasoning` with empty `content`.
    const text = msg?.content || msg?.reasoning;
    if (!text) return null;
    const json = extractJsonObject(text);
    return json ? (JSON.parse(json) as T) : null;
  } catch (err) {
    console.error("[ai] aiJSON failed, falling back:", err);
    return null;
  }
}

/** Plain-text completion (e.g. forecast narrative). Returns null on failure. */
export async function aiText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  if (!hasAI()) return null;
  try {
    const res = await client().chat.completions.create({
      model: cfg().model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0.4,
      max_tokens: opts.maxTokens ?? 400,
    });
    const msg = res.choices[0]?.message as { content?: string; reasoning?: string } | undefined;
    return (msg?.content || msg?.reasoning)?.trim() ?? null;
  } catch (err) {
    console.error("[ai] aiText failed, falling back:", err);
    return null;
  }
}
