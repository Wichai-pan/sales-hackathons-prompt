// Global search results (BUILD-SPEC P1 #11) — now rendered through the canvas SearchScreen.
// Universal — no role gate. Searches accounts, deals, cases, contacts; links each hit to its record.

import { globalSearch } from "@/lib/search";
import { STAGE_LABEL } from "@/lib/forecast";
import { SearchScreen, type SearchScreenData, type SearchHit } from "@/components/canvas/screens/SearchScreen";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { query, accounts, deals, cases, contacts } = await globalSearch(q);

  const hits: SearchHit[] = [
    ...accounts.map((a): SearchHit => ({
      kind: "account",
      id: a.id,
      name: a.name,
      subtitle: [a.region, a.segment, a.ownerRep?.name && `Owner: ${a.ownerRep.name}`]
        .filter(Boolean)
        .join(" · "),
    })),
    ...deals.map((d): SearchHit => ({
      kind: "deal",
      id: d.id,
      name: d.name,
      subtitle: [d.account.name, STAGE_LABEL[d.stage], d.status].filter(Boolean).join(" · "),
    })),
    ...cases.map((c): SearchHit => ({
      kind: "case",
      id: c.id,
      name: c.title,
      subtitle: [c.account.name, c.status.replaceAll("_", " "), c.priority].filter(Boolean).join(" · "),
    })),
    // Contacts link to their account (we have no /contacts/[id] route), so id = accountId.
    ...contacts.map((c): SearchHit => ({
      kind: "contact",
      id: c.accountId,
      name: c.name,
      subtitle: [c.title, c.account.name, c.email].filter(Boolean).join(" · "),
    })),
  ];

  const data: SearchScreenData = { query, hits };

  return <SearchScreen data={data} />;
}
