import { SectionHeader } from "@/components/canvas/primitives";
import { Button } from "@/components/canvas/ui/button";
import { Input, Select, Textarea } from "@/components/canvas/ui/input";
import type { Account, DealChannel, DealStage, ServiceModel, ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";

export interface DealNewScreenData {
  accounts: Account[];
  defaults?: {
    accountId?: string;
    stage?: DealStage;
    channel?: DealChannel;
    serviceModel?: ServiceModel;
  };
  createAction?: ServerAction;
}

const stages: DealStage[] = ["LEAD", "DISCOVERY", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];
const channels: DealChannel[] = ["DIRECT", "RESELLER"];
const serviceModels: ServiceModel[] = ["DEVICE_ONLY", "DEVICE_PLUS_SERVICES", "SERVICES_ONLY"];

export function DealNewScreen({ data }: { data: DealNewScreenData }) {
  const d = data.defaults ?? {};
  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8 space-y-6">
      <SectionHeader title="New deal" subtitle="Create a deal · auto-link to forecast" />
      <form action={data.createAction ?? noopAction} className="glass-card p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Account</span>
            <Select name="accountId" defaultValue={d.accountId} required>
              <option value="">Select account…</option>
              {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Name</span>
            <Input name="name" required placeholder="e.g. Q3 conductor fleet renewal" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Channel</span>
            <Select name="channel" defaultValue={d.channel ?? "DIRECT"}>{channels.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Stage</span>
            <Select name="stage" defaultValue={d.stage ?? "DISCOVERY"}>{stages.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Probability (%)</span>
            <Input name="probability" type="number" min={0} max={100} defaultValue={20} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Expected close date</span>
            <Input name="expectedCloseDate" type="date" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Service model</span>
            <Select name="serviceModel" defaultValue={d.serviceModel ?? "DEVICE_PLUS_SERVICES"}>
              {serviceModels.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Initial notes</span>
            <Textarea name="notes" rows={4} placeholder="Context, champion, next steps…" />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="reset" variant="outline">Reset</Button>
          <Button type="submit">Create deal</Button>
        </div>
      </form>
    </div>
  );
}
