// Global search results (BUILD-SPEC P1 #11). Universal — no role gate.
// Searches accounts, deals, cases, contacts; links each hit to its record.

import Link from "next/link";
import { Search } from "lucide-react";
import { globalSearch } from "@/lib/search";
import { STAGE_LABEL } from "@/lib/forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { query, accounts, deals, cases, contacts } = await globalSearch(q);
  const total = accounts.length + deals.length + cases.length + contacts.length;

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Search</h1>
        <form action="/search" className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              autoFocus
              placeholder="Search accounts, deals, cases, contacts…"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>
      </section>

      {!query ? (
        <p className="text-sm text-muted-foreground">
          Type a name, region, deal, case, or contact to search across the CRM.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches for “{query}”. Try a shorter or different term.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {total} result{total === 1 ? "" : "s"} for “{query}”.
        </p>
      )}

      {accounts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Accounts ({accounts.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Name</TH><TH>Region</TH><TH>Segment</TH><TH>Owner</TH></TR></THead>
              <TBody>
                {accounts.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">
                      <Link href={`/accounts/${a.id}`} className="text-primary hover:underline">{a.name}</Link>
                    </TD>
                    <TD>{a.region}</TD>
                    <TD>{a.segment}</TD>
                    <TD className="text-muted-foreground">{a.ownerRep.name}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Deals ({deals.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Deal</TH><TH>Account</TH><TH>Stage</TH><TH>Status</TH></TR></THead>
              <TBody>
                {deals.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">
                      <Link href={`/deals/${d.id}`} className="text-primary hover:underline">{d.name}</Link>
                    </TD>
                    <TD className="text-muted-foreground">{d.account.name}</TD>
                    <TD>{STAGE_LABEL[d.stage]}</TD>
                    <TD><Badge variant="secondary">{d.status}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {cases.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cases ({cases.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Title</TH><TH>Account</TH><TH>Status</TH><TH>Priority</TH></TR></THead>
              <TBody>
                {cases.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      <Link href={`/cases/${c.id}`} className="text-primary hover:underline">{c.title}</Link>
                    </TD>
                    <TD className="text-muted-foreground">{c.account.name}</TD>
                    <TD><Badge variant={c.status === "CLOSED" ? "secondary" : c.status === "ESCALATED" ? "destructive" : "warning"}>{c.status.replaceAll("_", " ")}</Badge></TD>
                    <TD>{c.priority}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {contacts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contacts ({contacts.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <THead><TR><TH>Name</TH><TH>Title</TH><TH>Account</TH><TH>Email</TH></TR></THead>
              <TBody>
                {contacts.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">
                      <Link href={`/accounts/${c.accountId}`} className="text-primary hover:underline">{c.name}</Link>
                    </TD>
                    <TD>{c.title ?? "—"}</TD>
                    <TD className="text-muted-foreground">{c.account.name}</TD>
                    <TD className="text-muted-foreground">{c.email ?? "—"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
