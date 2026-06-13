"use client";

// Approve / Reject panel for the offer detail page (SLICE SA-V2 / V).
// Shared comment textarea -> Approve (optional comment) or Reject (comment required).
// `step` selects which server actions to call; the parent only renders this for the
// role that can act on the current offer status.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveAsSM,
  rejectAsSM,
  approveAsFinance,
  rejectAsFinance,
} from "./actions";

export function DecisionPanel({
  offerId,
  step,
}: {
  offerId: string;
  step: "SM" | "FINANCE";
}) {
  const router = useRouter();
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (kind: "approve" | "reject") => {
    setError(null);
    if (kind === "reject" && !comment.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setPending(true);
    try {
      if (step === "SM") {
        if (kind === "approve") await approveAsSM(offerId, comment);
        else await rejectAsSM(offerId, comment);
      } else {
        if (kind === "approve") await approveAsFinance(offerId, comment);
        else await rejectAsFinance(offerId, comment);
      }
      setComment("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="approval-comment">
        Comment (required to reject)
      </label>
      <textarea
        id="approval-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={pending}
        rows={3}
        placeholder="Add context for your decision…"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={() => run("approve")} disabled={pending} className="flex-1">
          {pending ? "Working…" : step === "SM" ? "Approve & route to Finance" : "Approve offer"}
        </Button>
        <Button
          onClick={() => run("reject")}
          disabled={pending}
          variant="destructive"
          className="flex-1"
        >
          {pending ? "Working…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
