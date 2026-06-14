import { Plus } from "lucide-react";
import { GlassCard, SectionHeader } from "@/components/canvas/primitives";
import { Badge } from "@/components/canvas/ui/badge";
import { Button } from "@/components/canvas/ui/button";
import { Input, Select } from "@/components/canvas/ui/input";
import type { Product, Service, ProductStatus, ProviderType, InvoicingModel, ServerAction } from "@/lib/canvas/types";
import { fmt } from "@/lib/canvas/format";
import { noopAction } from "@/lib/canvas/types";

export interface CatalogScreenData {
  products: Product[];
  services: Service[];
  /** Inline add/edit actions. Inputs follow the field names of each entity. */
  saveProductAction?: ServerAction;
  saveServiceAction?: ServerAction;
}

const statuses: ProductStatus[] = ["ACTIVE", "RETIRED"];
const providerTypes: ProviderType[] = ["INTERNAL", "THIRD_PARTY"];
const invoicingModels: InvoicingModel[] = ["ONE_OFF", "FIXED_TERM", "MONTHLY_RECURRING"];

export function CatalogScreen({ data }: { data: CatalogScreenData }) {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <SectionHeader title="Catalog" subtitle="Products & services available to quote" />

      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Products</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["SKU", "Name", "Category", "Unit price", "GM %", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-2.5 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.category ?? "—"}</td>
                <td className="px-4 py-2.5 tnum">{fmt(p.unitPrice, p.currency)}</td>
                <td className="px-4 py-2.5 tnum">{p.gmPercent.toFixed(1)}%</td>
                <td className="px-4 py-2.5"><Badge variant={p.status === "ACTIVE" ? "success" : "default"}>{p.status}</Badge></td>
                <td className="px-5 py-2.5 text-right">
                  <span className="text-xs text-muted-foreground">Manage below</span>
                </td>
              </tr>
            ))}
            <tr className="bg-secondary/20">
              <td colSpan={7} className="px-5 py-3">
                <form action={data.saveProductAction ?? noopAction} className="flex flex-wrap items-end gap-2">
                  <Input name="sku" placeholder="SKU" className="w-28" required />
                  <Input name="name" placeholder="Name" className="flex-1" required />
                  <Input name="category" placeholder="Category" className="w-32" />
                  <Input name="unitPrice" type="number" min={0} placeholder="Price" className="w-24" required />
                  <Input name="gmPercent" type="number" min={0} max={100} step="0.1" placeholder="GM%" className="w-20" required />
                  <Input name="currency" defaultValue="EUR" className="w-20" />
                  <Select name="status" defaultValue="ACTIVE" className="w-28">{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
                  <Button type="submit" size="sm"><Plus className="h-3 w-3" /> Add</Button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </GlassCard>

      <GlassCard className="p-0">
        <div className="border-b border-border px-5 py-3 font-medium text-sm">Services</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              {["Name", "Provider", "Invoicing", "Base price", "GM %", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-medium first:pl-5 last:pr-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.services.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5"><Badge variant={s.providerType === "INTERNAL" ? "info" : "default"}>{s.providerType}</Badge></td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.invoicingModel.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 tnum">{fmt(s.basePrice, s.currency)}</td>
                <td className="px-4 py-2.5 tnum">{s.gmPercent.toFixed(1)}%</td>
                <td className="px-4 py-2.5"><Badge variant={s.status === "ACTIVE" ? "success" : "default"}>{s.status}</Badge></td>
                <td className="px-5 py-2.5 text-right">
                  <span className="text-xs text-muted-foreground">Manage below</span>
                </td>
              </tr>
            ))}
            <tr className="bg-secondary/20">
              <td colSpan={7} className="px-5 py-3">
                <form action={data.saveServiceAction ?? noopAction} className="flex flex-wrap items-end gap-2">
                  <Input name="name" placeholder="Name" className="flex-1" required />
                  <Select name="providerType" defaultValue="INTERNAL" className="w-32">{providerTypes.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
                  <Select name="invoicingModel" defaultValue="ONE_OFF" className="w-40">{invoicingModels.map((i) => <option key={i} value={i}>{i.replace(/_/g, " ")}</option>)}</Select>
                  <Input name="basePrice" type="number" min={0} placeholder="Price" className="w-24" required />
                  <Input name="gmPercent" type="number" min={0} max={100} step="0.1" placeholder="GM%" className="w-20" required />
                  <Input name="currency" defaultValue="EUR" className="w-20" />
                  <Select name="status" defaultValue="ACTIVE" className="w-28">{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
                  <Button type="submit" size="sm"><Plus className="h-3 w-3" /> Add</Button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
