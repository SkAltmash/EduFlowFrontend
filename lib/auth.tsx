"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  api,
  refreshSession,
  setAccessToken,
  type AuthResult,
  type LoginResult,
  type Role,
  type Tenant,
  type User,
} from "./api";

export type Session =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: User; tenant?: Tenant; role?: Role; isSuperAdmin: boolean; impersonating?: boolean };

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  tenantName?: string;
}

interface AuthContextValue {
  session: Session;
  login(email: string, password: string): Promise<LoginResult>;
  completeTwoFactor(token: string, code: string): Promise<AuthResult>;
  selectTenant(tenantId: string, selectionToken: string): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  logout(): Promise<void>;
  /** Super admins: open a school's app as its owner (audited), and come back. */
  enterSchool(tenantId: string): Promise<void>;
  leaveSchool(): Promise<void>;
  /** Applies a change the user just saved (their name, the school's name) without signing in again. */
  updateSession(patch: { user?: User; tenant?: Tenant }): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Set while a super admin is on the way from the console into a school, so the console
// doesn't switch back before the school's app has opened. The app clears it when it opens.
let enteringSchool = false;
export const isEnteringSchool = () => enteringSchool;
export const schoolOpened = () => {
  enteringSchool = false;
};

function toSession(result: AuthResult): Session {
  return {
    status: "authenticated",
    user: result.user,
    tenant: result.tenant,
    role: result.role,
    isSuperAdmin: Boolean(result.isSuperAdmin),
    ...(result.isImpersonating ? { impersonating: true } : {}),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ status: "loading" });

  // Restore the session from the refresh cookie on first load
  useEffect(() => {
    refreshSession()
      .then((result) => setSession(toSession(result)))
      .catch(() => setSession({ status: "anonymous" }));
  }, []);

  const accept = useCallback((result: AuthResult) => {
    setAccessToken(result.accessToken);
    setSession(toSession(result));
    return result;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api<LoginResult>("/api/auth/login", {
        method: "POST",
        body: { email, password },
        noRetry: true,
      });
      if (!result.requiresTenantSelection && !result.requiresTwoFactor) accept(result);
      return result;
    },
    [accept]
  );

  const completeTwoFactor = useCallback(
    async (token: string, code: string) => accept(await api<AuthResult>("/api/auth/two-factor", { method: "POST", body: { token, code }, noRetry: true })),
    [accept]
  );

  const selectTenant = useCallback(
    async (tenantId: string, selectionToken: string) =>
      accept(
        await api<AuthResult>("/api/auth/select-tenant", {
          method: "POST",
          body: { tenantId },
          token: selectionToken,
        })
      ),
    [accept]
  );

  const register = useCallback(
    async (input: RegisterInput) =>
      accept(await api<AuthResult>("/api/auth/register", { method: "POST", body: input, noRetry: true })),
    [accept]
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST", noRetry: true });
    } finally {
      setAccessToken(null);
      setSession({ status: "anonymous" });
    }
  }, []);

  const enterSchool = useCallback(
    async (tenantId: string) => {
      const res = await api<Omit<AuthResult, "user">>(`/api/admin/tenants/${tenantId}/enter`, { method: "POST" });
      const user = session.status === "authenticated" ? session.user : null;
      if (!user) return;
      enteringSchool = true;
      setAccessToken(res.accessToken);
      setSession({ status: "authenticated", user, tenant: res.tenant, role: res.role, isSuperAdmin: true, impersonating: true });
    },
    [session]
  );

  // The refresh cookie still belongs to the super admin, so refreshing returns to the console session
  const leaveSchool = useCallback(async () => {
    setSession(toSession(await refreshSession()));
  }, []);

  const updateSession = useCallback((patch: { user?: User; tenant?: Tenant }) => {
    setSession((s) => (s.status === "authenticated" ? { ...s, ...patch } : s));
  }, []);

  const value = useMemo(
    () => ({ session, login, completeTwoFactor, selectTenant, register, logout, enterSchool, leaveSchool, updateSession }),
    [session, login, completeTwoFactor, selectTenant, register, logout, enterSchool, leaveSchool, updateSession]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
