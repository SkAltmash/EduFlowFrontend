// Thin client for the EduFlow API.
// The access token lives in memory only; the refresh token is an HttpOnly cookie
// set by the API on /api/auth, so every auth call must use credentials: "include".

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export type Role = "owner" | "admin" | "teacher" | "accountant";
export const ROLES: Role[] = ["owner", "admin", "teacher", "accountant"];

export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

/** Body of register / login / select-tenant / refresh once a session exists. */
export interface AuthResult {
  user: User;
  tenant?: Tenant;
  role?: Role;
  isSuperAdmin?: boolean;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface TenantChoice extends Tenant {
  role: Role;
}

export type LoginResult =
  | ({ requiresTenantSelection: false } & AuthResult)
  | { requiresTenantSelection: true; user: User; tenants: TenantChoice[]; selectionToken: string };

export interface FieldIssue {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: FieldIssue[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<AuthResult> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Overrides the in-memory access token (e.g. the tenant-selection token). */
  token?: string;
  /** Skip the automatic refresh-and-retry on TOKEN_EXPIRED. */
  noRetry?: boolean;
}

async function send<T>(path: string, { method = "GET", body, token }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const bearer = token ?? accessToken;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", `Cannot reach the API at ${API_URL}. Is the backend running?`);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? res.statusText, err?.details);
  }
  return data as T;
}

/** One in-flight refresh shared by every caller. */
export function refreshSession(): Promise<AuthResult> {
  refreshPromise ??= send<AuthResult>("/api/auth/refresh", { method: "POST" })
    .then((result) => {
      setAccessToken(result.accessToken);
      return result;
    })
    .catch((err) => {
      setAccessToken(null);
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (err) {
    if (!options.noRetry && !options.token && err instanceof ApiError && err.code === "TOKEN_EXPIRED") {
      await refreshSession();
      return send<T>(path, options);
    }
    throw err;
  }
}
