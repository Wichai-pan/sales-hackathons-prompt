// Notifications inbox (Owner). Consumes listNotifications; each row opens its linked record and
// marks itself read. In-app only.

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { listNotifications } from "@/lib/notify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { openNotification, markAllReadAction } from "./actions";

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

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/role-switch");

  const items = await listNotifications(user.id, 50);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">{unread} unread · in-app only</p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <Button type="submit" size="sm" variant="secondary">Mark all read</Button>
          </form>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Inbox</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <form action={openNotification}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="href" value={recordHref(n.linkedRecordType, n.linkedRecordId)} />
                    <button type="submit" className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/50">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} />
                      <span className="flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-sm ${n.readAt ? "" : "font-medium"}`}>{n.title}</span>
                          {!n.readAt && <Badge variant="secondary">new</Badge>}
                        </span>
                        <span className="block text-sm text-muted-foreground">{n.body}</span>
                        <span className="block text-xs text-muted-foreground">
                          {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </span>
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
