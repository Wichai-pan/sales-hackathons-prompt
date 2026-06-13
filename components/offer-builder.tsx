"use client";

// Offer builder (Owner / SA-O3). Pick products + services from the catalog, set quantities,
// apply a discount (justification required when > 0), see the live total, submit for approval.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/utils";
import { createOffer } from "@/app/offers/actions";

type CatalogItem = { id: string; name: string; price: number; meta?: string };

export function OfferBuilder({
  accountId,
  dealId,
  dealName,
  products,
  services,
  error,
}: {
  accountId: string;
  dealId?: string;
  dealName?: string;
  products: CatalogItem[];
  services: CatalogItem[];
  error?: string;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);

  const setQ = (key: string, v: number) => setQty((m) => ({ ...m, [key]: Math.max(0, v) }));

  const subtotal =
    products.reduce((s, p) => s + p.price * (qty[`PRODUCT_${p.id}`] ?? 0), 0) +
    services.reduce((s, sv) => s + sv.price * (qty[`SERVICE_${sv.id}`] ?? 0), 0);
  const total = Math.round(subtotal * (1 - discount / 100));
  const inputCls = "w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-right";

  const Row = (type: "PRODUCT" | "SERVICE", it: CatalogItem) => {
    const key = `${type}_${it.id}`;
    return (
      <tr key={key} className="border-t border-border">
        <td className="py-2">
          <div className="font-medium">{it.name}</div>
          {it.meta && <div className="text-xs text-muted-foreground">{it.meta}</div>}
        </td>
        <td className="py-2 text-right text-muted-foreground">{formatEUR(it.price)}</td>
        <td className="py-2 text-right">
          <input
            type="number" min="0" name={`qty_${key}`} value={qty[key] ?? 0}
            onChange={(e) => setQ(key, Number(e.target.value))} className={inputCls}
          />
        </td>
        <td className="py-2 text-right">{formatEUR(it.price * (qty[key] ?? 0))}</td>
      </tr>
    );
  };

  return (
    <form action={createOffer} className="space-y-6">
      <input type="hidden" name="accountId" value={accountId} />
      {dealId && <input type="hidden" name="dealId" value={dealId} />}

      {error === "justification" && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          A discount requires a justification.
        </p>
      )}
      {error === "empty" && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Add at least one catalog item.
        </p>
      )}

      <Card>
        <CardHeader><CardTitle>Catalog{dealName ? ` · ${dealName}` : ""}</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1">Item</th><th className="pb-1 text-right">Unit</th><th className="pb-1 text-right">Qty</th><th className="pb-1 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="pt-2 text-xs font-semibold uppercase text-muted-foreground">Devices</td></tr>
              {products.map((p) => Row("PRODUCT", p))}
              <tr><td colSpan={4} className="pt-3 text-xs font-semibold uppercase text-muted-foreground">Services</td></tr>
              {services.map((s) => Row("SERVICE", s))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Discount & total</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Discount %</label>
              <input
                type="number" min="0" max="100" name="discountPercent" value={discount}
                onChange={(e) => setDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">
                Justification {discount > 0 && <span className="text-destructive">*</span>}
              </label>
              <input
                name="discountJustification" placeholder={discount > 0 ? "Required for any discount" : "—"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-end justify-between rounded-md bg-muted p-3">
            <div className="text-sm text-muted-foreground">
              Subtotal {formatEUR(subtotal)}
              {discount > 0 && <> · <Badge variant="secondary">−{discount}%</Badge></>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">{formatEUR(total)}</div>
            </div>
          </div>
          {discount > 0 && (
            <p className="text-xs text-muted-foreground">Discounted offers route to Sales Manager → Finance for approval.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" name="intent" value="draft" variant="secondary">Save draft</Button>
        <Button type="submit" name="intent" value="submit">Submit for approval</Button>
      </div>
    </form>
  );
}
