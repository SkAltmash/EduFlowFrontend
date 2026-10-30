"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { errorMessage } from "@/components/data";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { ApiError, api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_INFO } from "@/lib/school";
import { PhoneOtp, formatPhone, useAuthOptions, type OtpChallenge } from "@/components/phone-otp";
import { SettingsCard } from "./card";

type Message = { tone: "success" | "danger"; text: string } | null;

export function AccountSettings() {
  const { session } = useAuth();
  if (session.status !== "authenticated") return null;
  return (
    <div className="space-y-6">
      <ProfileCard user={session.user} />
      {!session.impersonating && <MobileCard user={session.user} />}
      <PasswordCard />
      <SettingsCard title="Appearance" description="Applies to this device only.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </div>
      </SettingsCard>
      {session.tenant && session.role && (
        <SettingsCard title="Your access" description={`In ${session.tenant.name}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="accent">{ROLE_INFO[session.role].label}</Badge>
              <p className="mt-1.5 text-sm text-muted">{ROLE_INFO[session.role].text}.</p>
            </div>
            <p className="text-xs text-muted">Only an owner or admin can change your role.</p>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

function ProfileCard({ user }: { user: User }) {
  const { updateSession } = useAuth();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const dirty = name.trim() !== user.name;
  const valid = name.trim().length >= 2;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ user: User }>("/api/auth/me", { method: "PATCH", body: { name: name.trim() } });
      updateSession({ user: res.user });
      setName(res.user.name);
      setMessage({ tone: "success", text: "Name saved." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <SettingsCard
        title="Your profile"
        description="Your name appears on receipts you issue and messages you send."
        footer={
          <Button type="submit" loading={busy} disabled={!dirty || !valid}>
            Save
          </Button>
        }
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="me-name" error={name && !valid ? "Name must be at least 2 characters" : undefined}>
            <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="me-email" hint="Used to sign in. Ask your platform admin to change it.">
            <Input id="me-email" value={user.email} readOnly disabled />
          </Field>
        </div>
      </SettingsCard>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mismatch = Boolean(confirm) && confirm !== next;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const res = await api<{ signedOutSessions: number }>("/api/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      const others = res.signedOutSessions;
      setMessage({ tone: "success", text: `Password changed.${others ? ` Signed out ${others} other device${others === 1 ? "" : "s"}.` : ""}` });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      else setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <SettingsCard
        title="Password"
        description="Changing it signs you out on every other device."
        footer={
          <Button type="submit" loading={busy} disabled={!current || !isStrongPassword(next) || next !== confirm}>
            Change password
          </Button>
        }
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="grid max-w-md gap-4">
          <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword}>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={errors.newPassword}>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          {next && <PasswordRules value={next} />}
          <Field label="Confirm new password" htmlFor="pw-confirm" error={mismatch ? "Passwords don't match" : undefined}>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
      </SettingsCard>
    </form>
  );
}

/** The account's mobile number: added or changed by OTP; also used to sign in with an OTP. */
function MobileCard({ user }: { user: User }) {
  const { updateSession } = useAuth();
  const options = useAuthOptions();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const phone = user.phone ?? "";

  return (
    <SettingsCard
      title="Mobile number"
      description={options?.phoneLogin ? "Used to sign in with a one-time code (OTP), and to reach you." : "Your mobile number for this account."}
      action={
        phone && !editing && options?.phoneLogin ? (
          <Button variant="secondary" size="sm" onClick={() => { setEditing(true); setMessage(null); }}>
            Change
          </Button>
        ) : undefined
      }
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {phone && !editing ? (
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-wide tabular-nums">+91 {formatPhone(phone)}</span>
          <Badge tone="success">Verified</Badge>
        </div>
      ) : !options ? null : !options.phoneLogin ? (
        <p className="text-sm text-muted">{phone ? "" : "No mobile number yet. "}Adding or changing it needs SMS codes, which aren&apos;t switched on yet.</p>
      ) : (
        <div className="max-w-md space-y-3">
          <p className="text-sm text-muted">{phone ? "Enter your new number. We'll text it a code to confirm." : "No mobile number yet. Add one to sign in with a one-time code."}</p>
          <PhoneOtp
            sendLabel="Send OTP"
            submitLabel={phone ? "Change number" : "Add number"}
            send={(p) => api<OtpChallenge>("/api/auth/me/phone/send", { method: "POST", body: { phone: p }, noRetry: true })}
            verify={async (challengeId, code) => {
              const res = await api<{ user: User }>("/api/auth/me/phone/verify", { method: "POST", body: { challengeId, code } });
              updateSession({ user: res.user });
              setEditing(false);
              setMessage({ tone: "success", text: phone ? "Mobile number changed." : "Mobile number added. You can now sign in with an OTP." });
            }}
          />
          {phone && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
