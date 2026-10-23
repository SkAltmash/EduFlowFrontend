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
  | { status: "authenticated"; user: User; tenant?: Tenant; role?: Role; isSuperAdmin: boolean };

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  tenantName?: string;
}

interface AuthContextValue {
  session: Session;
  login(email: string, password: string): Promise<LoginResult>;
  selectTenant(tenantId: string, selectionToken: string): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toSession(result: AuthResult): Session {
  return {
    status: "authenticated",
    user: result.user,
    tenant: result.tenant,
    role: result.role,
    isSuperAdmin: Boolean(result.isSuperAdmin),
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
      if (!result.requiresTenantSelection) accept(result);
      return result;
    },
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

  const value = useMemo(
    () => ({ session, login, selectTenant, register, logout }),
    [session, login, selectTenant, register, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
