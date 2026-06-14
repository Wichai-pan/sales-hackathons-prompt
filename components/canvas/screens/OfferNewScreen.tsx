import { SectionHeader } from "@/components/canvas/primitives";
import { Button } from "@/components/canvas/ui/button";
import { Input, Select, Textarea } from "@/components/canvas/ui/input";
import type { Account, Deal, Product, Service, ServerAction } from "@/lib/canvas/types";
import { fmt } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface OfferNewScreenData {
  accounts: Account[];
  deals: Deal[];
  products: Product[];
  services: Service[];
  defaults?: { accountId?: string; dealId?: string };
  /**
   * Form encodes line items with bracket names: product[<id>], service[<id>],
   * discountPercent, discountJustification, accountId, dealId.
   */
  createAction?: ServerAction;
}

export function OfferNewScreen({ data }: { data: OfferNewScreenData }) {
  const d = data.defaults ?? {};
  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8 space-y-6">
      <SectionHeader title="New offer" subtitle="Pick products + services → discount → justification" />
      <form action={data.createAction ?? noopAction} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Account</span>
                <Select name="accountId" defaultValue={d.accountId} required>
                  <option value="">Select…</option>
                  {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Deal (optional)</span>
                <Select name="dealId" defaultValue={d.dealId}>
                  <option value="">—</option>
                  {data.deals.map((dl) => <option key={dl.id} value={dl.id}>{dl.name}</option>)}
                </Select>
              </label>
            </div>
          </div>

          <div className="glass-card p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Products</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-medium">SKU</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.products.filter((p) => p.status === "ACTIVE").map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-right tnum">{fmt(p.unitPrice, p.currency)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input name={`product[${p.id}]`} type="number" min={0} defaultValue={0} className="h-8 w-20 text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Services</div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Invoicing</th>
                  <th className="px-3 py-2 text-right font-medium">Base</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.services.filter((s) => s.status === "ACTIVE").map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.providerType}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{s.invoicingModel.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-right tnum">{fmt(s.basePrice, s.currency)}</td>
                    <td className="px-3 py-2 text-right">
                      <Input name={`service[${s.id}]`} type="number" min={0} defaultValue={0} className="h-8 w-20 text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="glass-card p-5">
            <div className="text-sm font-medium">Discount</div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Discount %</span>
              <Input name="discountPercent" type="number" min={0} max={100} step="0.5" defaultValue={0} />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Justification</span>
              <Textarea name="discountJustification" rows={4} placeholder="Why this discount?" />
            </label>
            <div className="mt-4 rounded-lg border border-primary/20 bg-accent/30 p-3 text-xs text-muted-foreground">
              Live total is calculated server-side after submission.
            </div>
            <Button type="submit" className="mt-4 w-full">Create offer (Draft)</Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
