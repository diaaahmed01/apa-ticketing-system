"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Me } from "./api";

interface Session {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Unconditional permission check, for showing admin navigation and actions. */
  can: (permission: string) => boolean;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>("/api/auth/me"));
    } catch {
      setMe(null); // api.ts already redirected to /login or /change-password
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const can = useCallback((p: string) => !!me?.permissions[p]?.includes("ALWAYS"), [me]);

  return <Ctx.Provider value={{ me, loading, refresh, can }}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used inside SessionProvider");
  return s;
}
