"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AUTH_ICONS, AuthField, AuthInput, AuthShell, PasswordInput, PasswordStrength, fieldErrors } from "@/components/auth-shell";
import { isStrongPassword } from "@/components/password-rules";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { session, register } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "", tenantName: "" });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (session.status === "authenticated") router.replace(session.isSuperAdmin ? "/console" : "/app/dashboard");
  }, [session, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const local: Record<string, string> = {};
    if (form.name.trim().length < 2) local.name = "Name must be at least 2 characters";
    if (!form.email.includes("@")) local.email = "Enter a valid email address";
    if (!isStrongPassword(form.password)) local.password = "Password doesn't meet the requirements";
    const org = form.tenantName.trim();
    if (org && org.length < 2) local.tenantName = "Organisation name must be at least 2 characters";
    setErrors(local);
    if (Object.keys(local).length) return;

    setPending(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        ...(org ? { tenantName: org } : {}),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN") setErrors({ email: err.message });
        else if (err.details?.length) setErrors(fieldErrors(err.details));
        else setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Start your free trial"
      subtitle="7 days of EduFlow for your whole school."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {["Every feature", "No credit card", "Set up in minutes"].map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t}
          </span>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <AuthField label="School name" htmlFor="tenantName" error={errors.tenantName} extra={<span className="text-xs text-muted">Optional</span>} hint="Your school, tuition centre or coaching institute.">
          <AuthInput
            id="tenantName"
            icon={AUTH_ICONS.school}
            autoComplete="organization"
            autoFocus
            value={form.tenantName}
            onChange={set("tenantName")}
            aria-invalid={Boolean(errors.tenantName)}
            placeholder="Sunrise Public School"
          />
        </AuthField>
        <AuthField label="Your name" htmlFor="name" error={errors.name}>
          <AuthInput id="name" icon={AUTH_ICONS.user} autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} placeholder="Alice Khan" />
        </AuthField>
        <AuthField label="Work email" htmlFor="email" error={errors.email}>
          <AuthInput
            id="email"
            icon={AUTH_ICONS.mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={form.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@school.edu"
          />
        </AuthField>
        <AuthField label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput id="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-invalid={Boolean(errors.password)} placeholder="Create a strong password" />
          <PasswordStrength value={form.password} />
        </AuthField>
        <Button type="submit" className="h-11 w-full rounded-xl text-[15px] shadow-lg shadow-accent/20" loading={pending}>
          Start free trial
          {!pending && (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </Button>
        <p className="text-center text-xs text-muted">Your 7-day trial starts today. You&apos;ll be the owner and can add your team later.</p>
      </form>
    </AuthShell>
  );
}
