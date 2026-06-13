// lib/ai/case-summary.ts — P2 #22. One-paragraph AI summary for a case that has accumulated
// enough notes (>= MIN_NOTES). Uses Featherless via aiText; deterministic fallback otherwise.
// Read-only — never mutates the case.

import { aiText } from "./client";

export const MIN_NOTES_FOR_SUMMARY = 5;

export async function caseSummary(input: {
  title: string;
  description?: string | null;
  notes: string[];
}): Promise<{ text: string; source: "ai" | "fallback" }> {
  const thread = input.notes.map((n, i) => `${i + 1}. ${n}`).join("\n");
  const text = await aiText({
    system:
      "You are a TAM assistant for HMD Secure. Summarise this support case in ONE short paragraph (≤3 sentences) for a colleague picking it up cold: what the issue is, where it stands now, and the next step. Plain prose, no markdown, no lists.",
    user: `Case: ${input.title}\n${input.description ?? ""}\nNotes (oldest first):\n${thread}`,
    maxTokens: 200,
  });
  if (text) return { text, source: "ai" };

  // Deterministic fallback: stitch first + last note.
  const first = input.notes[0] ?? "";
  const last = input.notes[input.notes.length - 1] ?? "";
  return {
    text: `${input.title}. It began: "${first}" Latest update: "${last}" (${input.notes.length} notes on file.)`,
    source: "fallback",
  };
}
