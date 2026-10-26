"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, fieldErrors } from "@/components/auth-shell";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { Alert, Button, Field, Input } from "@/components/ui";
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
    if (session.status === "authenticated") router.replace(session.isSuperAdmin ? "/console" : "/app/students");
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
      title="Start your 7-day free trial"
      subtitle="Every feature included. No credit card needed."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={Boolean(errors.name)} placeholder="Alice Khan" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@school.edu"
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>
        <PasswordRules value={form.password} />
        <Field
          label="Organisation name"
          htmlFor="tenantName"
          error={errors.tenantName}
          hint="Optional. Your school, tuition centre or coaching institute."
        >
          <Input
            id="tenantName"
            autoComplete="organization"
            value={form.tenantName}
            onChange={set("tenantName")}
            aria-invalid={Boolean(errors.tenantName)}
            placeholder="Sunrise Public School"
          />
        </Field>
        <Button type="submit" className="w-full" loading={pending}>
          Start free trial
        </Button>
      </form>
    </AuthShell>
  );
}
