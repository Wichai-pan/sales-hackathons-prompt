"use client";

// Deal create form (Owner / SA-O2). Channel switches the allowed stages live
// (reseller hides Contract negotiation). Year-1 forecast entered as 4 quarters;
// the server action projects years 2-3 and writes DealForecastPeriod rows.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABEL, DIRECT_STAGES, RESELLER_STAGES } from "@/lib/forecast";
import { createDeal } from "@/app/deals/actions";
import type { Channel, DealStage } from "@prisma/client";

const SELECTABLE = (stages: DealStage[]) => stages.filter((s) => s !== "WON" && s !== "LOST");

export function DealForm({ accountId, accountName }: { accountId: string; accountName: string }) {
  const [channel, setChannel] = useState<Channel>("DIRECT");
  const stages = SELECTABLE(channel === "RESELLER" ? RESELLER_STAGES : DIRECT_STAGES);

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <form action={createDeal} className="space-y-6">
      <input type="hidden" name="accountId" value={accountId} />

      <Card>
        <CardHeader><CardTitle>New deal · {accountName}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Deal name</label>
            <input name="name" required placeholder="e.g. Fleet rollout 2026" className={inputCls} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Channel</label>
              <div className="mt-1 flex gap-2">
                {(["DIRECT", "RESELLER"] as Channel[]).map((c) => (
                  <label key={c} className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${channel === c ? "border-primary bg-primary/10 font-medium" : "border-input"}`}>
                    <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
                    {c === "DIRECT" ? "Direct" : "Reseller"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Stage</label>
              <select name="stage" className={inputCls} defaultValue="INTEREST_SHOWN">
                {stages.map((s) => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
              {channel === "RESELLER" && (
                <p className="mt-1 text-xs text-muted-foreground">Reseller deals skip Contract negotiation.</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Expected close</label>
              <input type="date" name="expectedCloseDate" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Service billing model</label>
            <select name="serviceModel" defaultValue="MONTHLY_RECURRING" className={inputCls}>
              <option value="MONTHLY_RECURRING">Monthly recurring (scales with active devices)</option>
              <option value="FIXED_TERM">Fixed-term (spread evenly across the term)</option>
              <option value="ONE_OFF">One-off (recognised at delivery)</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Recognises the service revenue you enter below differently per HMD&apos;s invoicing models.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>12-month forecast (4 quarters)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Enter year-1 by quarter. Device and service revenue stay separate. Years 2-3 are projected automatically for the 3-year forecast.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1"></th>
                  <th className="py-1">Device units</th>
                  <th className="py-1">Device revenue (€)</th>
                  <th className="py-1">Service revenue (€)</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((q) => (
                  <tr key={q}>
                    <td className="py-1 pr-2 font-medium">Q{q}</td>
                    <td className="py-1 pr-2"><input name={`q${q}_units`} type="number" min="0" defaultValue="0" className={inputCls} /></td>
                    <td className="py-1 pr-2"><input name={`q${q}_device`} type="number" min="0" defaultValue="0" className={inputCls} /></td>
                    <td className="py-1"><input name={`q${q}_service`} type="number" min="0" defaultValue="0" className={inputCls} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create deal</Button>
      </div>
    </form>
  );
}
