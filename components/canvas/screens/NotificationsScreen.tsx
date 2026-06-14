import { Bell, Check } from "lucide-react";
import { SectionHeader, GlassCard } from "@/components/canvas/primitives";
import { Button } from "@/components/canvas/ui/button";
import type { Notification, ServerAction } from "@/lib/canvas/types";
import { noopAction } from "@/lib/canvas/types";

export interface NotificationsScreenData {
  notifications: Notification[];
  markAllReadAction?: ServerAction;
  markReadAction?: ServerAction; // expects `id`
}

export function NotificationsScreen({ data }: { data: NotificationsScreenData }) {
  const unread = data.notifications.filter((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8 space-y-6">
      <SectionHeader
        title="Notifications"
        subtitle={`${unread.length} unread`}
        action={
          <form action={data.markAllReadAction ?? noopAction}>
            <Button type="submit" variant="outline" size="sm"><Check className="h-3 w-3" /> Mark all read</Button>
          </form>
        }
      />
      <GlassCard className="p-0">
        <div className="divide-y divide-border">
          {data.notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-3 ${!n.readAt ? "bg-accent/20" : ""}`}>
              <div className="mt-1 grid h-7 w-7 place-items-center rounded-lg border border-border bg-card">
                <Bell className="h-3.5 w-3.5 text-primary-glow" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.readAt && (
                <form action={data.markReadAction ?? noopAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <Button type="submit" variant="ghost" size="sm">Mark read</Button>
                </form>
              )}
            </div>
          ))}
          {data.notifications.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No notifications.</div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
