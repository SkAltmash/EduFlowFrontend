"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, fieldErrors } from "@/components/auth-shell";
import { Alert, Badge, Button, Field, Input, Spinner } from "@/components/ui";
import { ApiError, type TenantChoice } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session, login, selectTenant } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [choice, setChoice] = useState<{ tenants: TenantChoice[]; token: string } | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Already signed in: go where this account belongs
  useEffect(() => {
    if (session.status === "authenticated") router.replace(session.isSuperAdmin ? "/console" : "/app/students");
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

  if (choice) {
    return (
      <AuthShell
        title="Choose an organisation"
        subtitle="Your account belongs to more than one. Pick where to go."
        footer={
          <button className="font-medium text-accent hover:underline" onClick={() => setChoice(null)}>
            Use a different account
          </button>
        }
      >
        {error && <div className="mb-4"><Alert>{error}</Alert></div>}
        <ul className="space-y-2">
          {choice.tenants.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t.id)}
                disabled={selecting !== null}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted">{t.slug}</span>
                </span>
                {selecting === t.id ? <Spinner /> : <Badge tone="accent">{t.role}</Badge>}
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
      subtitle="Sign in to your EduFlow account"
      footer={
        <>
          New to EduFlow?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Start a 7-day free trial
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@school.edu"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
