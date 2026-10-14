/** Thin fetch wrapper for the ATS API. Errors carry the backend's stable code and readable message. */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the ATS server. Check your connection and try again.");
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const body = (data && typeof data === "object" ? data : {}) as { error?: unknown; message?: unknown };
    const code = body.error ? String(body.error) : "HTTP_" + res.status;
    const msg = body.message ? String(body.message)
      : res.status >= 500 ? "The ATS server isn't responding. Try again in a moment." : "The request failed.";
    if (typeof window !== "undefined") {
      if (code === "UNAUTHENTICATED" && !location.pathname.startsWith("/login")) {
        location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search);
      } else if (code === "PASSWORD_CHANGE_REQUIRED" && !location.pathname.startsWith("/change-password")) {
        location.href = "/change-password";
      }
    }
    throw new ApiError(res.status, code, msg);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};

/* ---- Shared API types ---- */

export type Organization = "PORT" | "VENDOR";

export interface RoleRef { code: string; name: string; nameAr: string | null }

export interface Me {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  organization: Organization;
  avatarColor: string | null;
  preferredLang: "en" | "ar";
  mustChangePassword: boolean;
  roles: RoleRef[];
  /** permission code → granted condition codes ("ALWAYS" = unconditional) */
  permissions: Record<string, string[]>;
}

export interface UserView {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  organization: Organization;
  active: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  avatarColor: string | null;
  preferredLang: "en" | "ar";
  roles: RoleRef[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface IssuedView { user: UserView; temporaryPassword: string }

export interface ModuleView { id: number; name: string; nameAr: string | null; active: boolean; sortOrder: number }

export interface PermRole { id: number; code: string; name: string; nameAr: string | null; description: string | null; system: boolean; activeUsers: number }
export interface PermDef { code: string; category: string; name: string; description: string | null; allowedConditions: string[] }
export interface PermGrant { role: string; permission: string; condition: string }
export interface PermCondition { code: string; label: string }
export interface PermMatrix { roles: PermRole[]; permissions: PermDef[]; grants: PermGrant[]; conditions: PermCondition[] }
export interface PermChange { role: string; permission: string; condition: string; action: "GRANT" | "REVOKE" }
export interface PermChangeResult { changeSetId: string; applied: number; matrix: PermMatrix }
