import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/canvas/AppShell";
import { AiAssistant } from "@/components/ai-assistant";
import { currentUser } from "@/lib/session";
import { unreadCount } from "@/lib/notify";
import type { User as CanvasUser } from "@/lib/canvas/types";

export const metadata: Metadata = {
  title: "HMD Secure CRM",
  description: "HMD Secure's AI-native CRM — accounts, deals, cases, offers, and a 3-year weighted forecast.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const canvasUser: CanvasUser = user
    ? { id: user.id, name: user.name, email: user.email, role: user.role, avatarHue: 280 }
    : { id: "guest", name: "Guest", email: "", role: "REP", avatarHue: 280 };
  const unread = user ? await unreadCount(user.id) : 0;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <AppShell role={canvasUser.role} user={canvasUser} unreadCount={unread}>
          <div className="px-4 py-6 sm:px-6">{children}</div>
        </AppShell>
        {/* Wired "Aino" AI assistant (Owner) — single floating bubble. */}
        <AiAssistant />
      </body>
    </html>
  );
}
