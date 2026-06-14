import { SectionHeader } from "@/components/canvas/primitives";
import { Button } from "@/components/canvas/ui/button";
import { Input, Select, Textarea } from "@/components/canvas/ui/input";
import type { Account, Contact, CasePriority, ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";

export interface CaseNewScreenData {
  accounts: Account[];
  /** Contacts grouped by accountId for client-side filtering (or render flat). */
  contacts: Contact[];
  services?: { id: string; name: string }[];
  defaults?: { accountId?: string };
  createAction?: ServerAction;
}

const priorities: CasePriority[] = ["P1", "P2", "P3", "P4"];

export function CaseNewScreen({ data }: { data: CaseNewScreenData }) {
  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8 space-y-6">
      <SectionHeader title="New case" subtitle="Open a support / TAM case" />
      <form action={data.createAction ?? noopAction} className="glass-card p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Title</span>
            <Input name="title" required placeholder="Short summary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Account</span>
            <Select name="accountId" defaultValue={data.defaults?.accountId} required>
              <option value="">Select…</option>
              {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Contact</span>
            <Select name="contactId">
              <option value="">—</option>
              {data.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Priority</span>
            <Select name="priority" defaultValue="P3">{priorities.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          </label>
          {data.services && (
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Service</span>
              <Select name="serviceId">
                <option value="">—</option>
                {data.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Description</span>
            <Textarea name="description" rows={6} placeholder="What's happening?" required />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="reset" variant="outline">Reset</Button>
          <Button type="submit">Open case</Button>
        </div>
      </form>
    </div>
  );
}
