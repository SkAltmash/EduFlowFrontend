"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { ApiError, ROLES, api, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ROLE_INFO, type Member } from "@/lib/school";
import { SettingsCard } from "./card";

/** Mirrors MANAGES in backend/src/modules/school/school.service.js */
const MANAGES: Record<Role, Role[]> = {
  owner: ["owner", "admin", "teacher", "accountant"],
  admin: ["teacher", "accountant"],
  teacher: [],
  accountant: [],
};

const ROLE_TONE: Record<Role, "accent" | "success" | "neutral"> = { owner: "accent", admin: "accent", teacher: "success", accountant: "neutral" };

/** "a teacher", "an admin" */
const aRole = (r: Role) => `${r === "teacher" ? "a" : "an"} ${ROLE_INFO[r].label.toLowerCase()}`;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** A readable temporary password that passes the strength rules, e.g. "Mango-4821-Kite!". */
function suggestPassword() {
  const words = ["Mango", "River", "Tiger", "Lotus", "Cloud", "Maple", "Comet", "Pearl", "Cedar", "Orbit", "Kite", "Delta"];
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${words[r[0] % words.length]}-${1000 + (r[1] % 9000)}-${words[r[2] % words.length].toLowerCase()}!`;
}

export function TeamSettings() {
  const { session } = useAuth();
  const me = session.status === "authenticated" ? session : null;
  const myRole = (me?.role ?? "teacher") as Role;
  const canGive = MANAGES[myRole];
  const list = useResource(() => api<{ members: Member[] }>("/api/school/members"), "school-members");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const members = list.data?.members ?? [];
  const counts = ROLES.map((r) => [r, members.filter((m) => m.role === r).length] as const).filter(([, n]) => n > 0);

  async function change(m: Member, role: Role) {
    if (role === m.role) return;
    setBusyId(m.userId);
    setMessage(null);
    try {
      list.setData(await api<{ members: Member[] }>(`/api/school/members/${m.userId}`, { method: "PATCH", body: { role } }));
      setMessage({ tone: "success", text: `${m.name} is now ${aRole(role)}. They'll need to sign in again.` });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.name} from the team? They'll lose access to this school right away. Their account and anything they recorded stay.`)) return;
    setBusyId(m.userId);
    setMessage(null);
    try {
      list.setData(await api<{ members: Member[] }>(`/api/school/members/${m.userId}`, { method: "DELETE" }));
      setMessage({ tone: "success", text: `${m.name} was removed.` });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SettingsCard
      title="Team & roles"
      description="Who can sign in to this school, and what each person can do."
      action={
        <Button size="sm" onClick={() => setAdding(true)}>
          <Icon d={ICONS.plus} />
          Add member
        </Button>
      }
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {list.error && <Alert>{list.error}</Alert>}

      {!list.data && !list.error ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {counts.map(([r, n]) => (
              <span key={r} className="rounded-full bg-surface-muted px-2.5 py-1">
                {ROLE_INFO[r].label}s <span className="font-semibold text-foreground">{n}</span>
              </span>
            ))}
          </div>
          <ul className="-mx-5 divide-y divide-border border-y border-border">
            {members.map((m) => {
              const self = m.userId === me?.user.id;
              const editable = !self && canGive.includes(m.role);
              return (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials(m.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {self && <span className="font-normal text-muted"> (you)</span>}
                      {!m.isActive && <Badge tone="danger">Disabled</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {m.email} · joined {formatDate(m.joinedAt)}
                    </p>
                  </div>
                  <div className="flex w-full items-center gap-2 pl-12 sm:w-auto sm:pl-0">
                    {editable ? (
                      <>
                        <Select
                          aria-label={`Role of ${m.name}`}
                          value={m.role}
                          disabled={busyId === m.userId}
                          onChange={(e) => change(m, e.target.value as Role)}
                          className="h-9 w-36 text-sm"
                        >
                          {canGive.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_INFO[r].label}
                            </option>
                          ))}
                        </Select>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name}`} onClick={() => remove(m)} disabled={busyId === m.userId}>
                          <Icon d={ICONS.x} />
                        </Button>
                      </>
                    ) : (
                      <Badge tone={ROLE_TONE[m.role]}>{ROLE_INFO[m.role].label}</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">What each role can do</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-border px-3 py-2">
              <dt className="text-sm font-medium">{ROLE_INFO[r].label}</dt>
              <dd className="text-xs text-muted">{ROLE_INFO[r].text}</dd>
            </div>
          ))}
        </dl>
        {myRole === "admin" && <p className="mt-2 text-xs text-muted">As an admin you can add and manage teachers and accountants. Ask an owner to add admins.</p>}
      </div>

      {adding && (
        <AddMemberDrawer
          roles={canGive}
          school={me?.tenant?.name ?? ""}
          onClose={() => setAdding(false)}
          onAdded={(members) => list.setData({ members })}
        />
      )}
    </SettingsCard>
  );
}

function AddMemberDrawer({ roles, school, onClose, onAdded }: { roles: Role[]; school: string; onClose: () => void; onAdded: (members: Member[]) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles.includes("teacher") ? "teacher" : roles[0]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // After adding: what to tell the new member
  const [done, setDone] = useState<{ created: boolean; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const signInUrl = typeof window === "undefined" ? "" : `${window.location.origin}/login`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await api<{ members: Member[]; created: boolean }>("/api/school/members", {
        method: "POST",
        body: { email, role, ...(name.trim() ? { name: name.trim() } : {}), ...(password ? { password } : {}) },
      });
      onAdded(res.members);
      setDone({ created: res.created, name: res.members.find((m) => m.email === email.trim().toLowerCase())?.name ?? name });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const invite = done
    ? [
        `Hi ${done.name.split(/\s+/)[0]}, you've been added to ${school} on EduFlow as ${aRole(role)}.`,
        "",
        `Sign in: ${signInUrl}`,
        `Email: ${email.trim().toLowerCase()}`,
        done.created ? `Temporary password: ${password}` : "Password: the one you already use for EduFlow",
        ...(done.created ? ["", "Please change your password after signing in (Settings → My account)."] : []),
      ].join("\n")
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text is on screen
    }
  }

  if (done) {
    return (
      <Drawer title="Member added" onClose={onClose}>
        <Alert tone="success">
          {done.name} can now sign in to {school}.
          {!done.created && " They already had an EduFlow account, so they keep their current password."}
        </Alert>
        <div>
          <p className="mb-2 text-sm font-medium">Send them their sign-in details</p>
          <pre className="whitespace-pre-wrap rounded-lg bg-surface-muted p-3 font-sans text-sm">{invite}</pre>
          {done.created && <p className="mt-2 text-xs text-muted">The password is shown only now. Share it privately.</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#128c4a] px-4 text-sm font-medium text-white hover:bg-[#0f7a40]">
            <Icon d={WA_ICON} />
            Share on WhatsApp
          </a>
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied ✓" : "Copy details"}
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Done
        </Button>
      </Drawer>
    );
  }

  return (
    <Drawer title="Add team member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="m-email" error={errors.email}>
          <Input id="m-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" autoFocus />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Role</legend>
          <div className="grid gap-2">
            {roles.map((r) => (
              <label key={r} className={cx("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", role === r ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-muted")}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block text-sm font-medium">{ROLE_INFO[r].label}</span>
                  <span className="block text-xs text-muted">{ROLE_INFO[r].text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-sm font-medium">New to EduFlow?</p>
            <p className="text-xs text-muted">Fill these in to create their account. If they already use EduFlow (for another school), leave them empty: they keep their password.</p>
          </div>
          <Field label="Full name" htmlFor="m-name" error={errors.name}>
            <Input id="m-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Temporary password" htmlFor="m-password" error={errors.password}>
            <div className="flex gap-2">
              <Input id="m-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 flex-1 font-mono" />
              <Button type="button" variant="secondary" onClick={() => setPassword(suggestPassword())}>
                Generate
              </Button>
            </div>
          </Field>
          {password && <PasswordRules value={password} />}
        </div>

        <Button type="submit" className="w-full" loading={busy} disabled={!email.trim() || (Boolean(password) && !isStrongPassword(password))}>
          Add to team
        </Button>
      </form>
    </Drawer>
  );
}
