import { SessionProvider } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { ToastHost } from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
      <ToastHost />
    </SessionProvider>
  );
}
