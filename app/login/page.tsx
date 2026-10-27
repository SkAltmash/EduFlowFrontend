"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AUTH_ICONS, AuthField, AuthInput, AuthShell, PasswordInput, fieldErrors } from "@/components/auth-shell";
import { Alert, Badge, Button, Spinner } from "@/components/ui";
import { ApiError, type TenantChoice } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, login, selectTenant, completeTwoFactor } = useAuth();
  // Super admins with two-step login: the 6-digit code from their authenticator app
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [choice, setChoice] = useState<{ tenants: TenantChoice[]; token: string } | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Already signed in: go where this account belongs
  useEffect(() => {
    if (session.status === "authenticated") router.replace(session.isSuperAdmin ? "/console" : "/app/dashboard");
  }, [session, router]);

  function showError(err: unknown) {
    if (err instanceof ApiError) {
      setErrors(fieldErrors(err.details));
      setError(err.details?.length ? null : err.message);
    } else {
      setError("Something went wrong. Please try again.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setErrors({});
    try {
      const result = await login(email, password);
      if (result.requiresTenantSelection) {
        setChoice({ tenants: result.tenants, token: result.selectionToken });
      } else if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken);
      }
    } catch (err) {
      showError(err);
    } finally {
      setPending(false);
    }
  }

  async function onSelect(tenantId: string) {
    if (!choice) return;
    setSelecting(tenantId);
    setError(null);
    try {
      await selectTenant(tenantId, choice.token);
    } catch (err) {
      // The selection token only lives 5 minutes
      if (err instanceof ApiError && err.status === 401) {
        setChoice(null);
        setError("That took a while, so please sign in again.");
      } else {
        showError(err);
      }
    } finally {
      setSelecting(null);
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (!twoFactorToken) return;
    setPending(true);
    setError(null);
    try {
      await completeTwoFactor(twoFactorToken, code);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TWO_FACTOR_EXPIRED") {
        setTwoFactorToken(null);
        setCode("");
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (twoFactorToken) {
    return (
      <AuthShell
        title="Two-step verification"
        subtitle="Enter the 6-digit code from your authenticator app."
        footer={
          <button className="font-medium text-accent hover:underline" onClick={() => { setTwoFactorToken(null); setCode(""); setError(null); }}>
            Use a different account
          </button>
        }
      >
        <form onSubmit={onCode} className="space-y-5" noValidate>
          {error && <Alert>{error}</Alert>}
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="6-digit code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="h-14 w-full rounded-xl border border-border bg-surface text-center font-mono text-3xl tracking-[0.5em] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
          <Button type="submit" className="h-11 w-full rounded-xl text-[15px]" loading={pending} disabled={code.length !== 6}>
            Verify
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (choice) {
    return (
      <AuthShell
        title="Choose a school"
        subtitle="Your account is part of more than one. Where would you like to go?"
        footer={
          <button className="font-medium text-accent hover:underline" onClick={() => setChoice(null)}>
            Use a different account
          </button>
        }
      >
        {error && <div className="mb-4"><Alert>{error}</Alert></div>}
        <ul className="space-y-2.5">
          {choice.tenants.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                disabled={selecting !== null}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-px hover:border-accent hover:shadow-md hover:shadow-accent/10 disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">{t.name.trim()[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="mt-0.5 inline-block">
                    <Badge tone="accent">{t.role}</Badge>
                  </span>
                </span>
                {selecting === t.id ? (
                  <Spinner className="text-accent" />
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your school."
      footer={
        <>
          New to EduFlow?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Start a 7-day free trial
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <AuthField label="Email" htmlFor="email" error={errors.email}>
          <AuthInput
            id="email"
            icon={AUTH_ICONS.mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@school.edu"
          />
        </AuthField>
        <AuthField label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            placeholder="Your password"
          />
        </AuthField>
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px] shadow-lg shadow-accent/20" loading={pending}>
          Sign in
          {!pending && (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
