import { NotificationsProvider } from "@/lib/notifications";
import { SessionProvider } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { ToastHost } from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NotificationsProvider>
        <Shell>{children}</Shell>
        <ToastHost />
      </NotificationsProvider>
    </SessionProvider>
  );
}
