// Notifications inbox (Owner) — now rendered through the canvas NotificationsScreen.
// Server-side data + role guard stay here; the screen is pure presentation.
//
// The canvas screen exposes mark-all-read + per-row mark-read, but has NO slot for our
// click-through-to-record feature (open the linked Offer/Deal/Case/Account and mark it read).
// We therefore KEEP our existing wired `openNotification` forms below the screen, restyled
// with canvas classes, so no functionality is lost.

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { listNotifications } from "@/lib/notify";
import { GlassCard } from "@/components/canvas/primitives";
import { NotificationsScreen, type NotificationsScreenData } from "@/components/canvas/screens/NotificationsScreen";
import { openNotification, markAllReadAction } from "./actions";
import { markRead } from "@/lib/notify";

export const dynamic = "force-dynamic";

function recordHref(type?: string | null, id?: string | null): string {
  if (!type || !id) return "/";
  switch (type.toUpperCase()) {
    case "OFFER": return `/offers/${id}`;
    case "DEAL": return `/deals/${id}`;
    case "CASE": return `/cases/${id}`;
    case "ACCOUNT": return `/accounts/${id}`;
    default: return "/";
  }
}

// Inline adapter for the screen's per-row mark-read prop (FormData with `id`).
async function markReadAction(fd: FormData) {
  "use server";
  const id = String(fd.get("id") ?? "");
  if (id) await markRead(id);
}

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const items = await listNotifications(user.id, 50);

  const data: NotificationsScreenData = {
    notifications: items.map((n) => ({
      id: n.id,
      userId: n.recipientId,
      title: n.title,
      body: n.body,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    markAllReadAction,
    markReadAction,
  };

  return (
    <div className="space-y-6">
      <NotificationsScreen data={data} />

      {/* KEEP: click-through-to-record (open linked record + mark read). The canvas screen has
          no slot for this, so we preserve our wired forms here, restyled with canvas classes. */}
      {items.length > 0 && (
        <div className="mx-auto max-w-3xl px-6 lg:px-8 pb-6 lg:pb-8">
          <GlassCard className="p-0">
            <div className="border-b border-border px-5 py-3 font-medium text-sm">Open linked record</div>
            <div className="divide-y divide-border">
              {items.map((n) => (
                <form key={n.id} action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="href" value={recordHref(n.linkedRecordType, n.linkedRecordId)} />
                  <button
                    type="submit"
                    className={`flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent/20 ${!n.readAt ? "bg-accent/10" : ""}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.readAt ? "" : "font-medium"}`}>{n.title}</span>
                      <span className="block text-xs text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </span>
                    </span>
                    <span className="mt-1 text-xs text-primary-glow">Open &rarr;</span>
                  </button>
                </form>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
