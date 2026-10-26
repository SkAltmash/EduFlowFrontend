// Thin client for the EduFlow API.
// The access token lives in memory only; the refresh token is an HttpOnly cookie
// set by the API on /api/auth, so every auth call must use credentials: "include".

// Trim spaces/newlines and every trailing slash: a value pasted as ".../" or ".../ "
// would otherwise produce "...//api/..." URLs that the backend answers with 404.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

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

/** Long enough for a free-tier server to wake from sleep (~50s). */
const REQUEST_TIMEOUT_MS = 70_000;

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

  const where = API_URL || "this site's /api";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      // A sleeping free-tier server can take ~50s to wake; don't spin forever
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if ((err as Error)?.name === "TimeoutError") {
      throw new ApiError(0, "TIMEOUT", "The server is taking too long to respond. It may be waking up. Please try again in a minute.");
    }
    throw new ApiError(0, "NETWORK_ERROR", `Cannot reach the API at ${where}. Check your internet connection and try again.`);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    // Not an API error body (e.g. an HTML 404 page): never show an empty message
    const fallback =
      res.status === 404
        ? `The API wasn't found at ${where} (HTTP 404). The site's API address is set up incorrectly.`
        : res.status >= 500
          ? `The server had a problem (HTTP ${res.status}). Please try again.`
          : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message || fallback, err?.details);
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
