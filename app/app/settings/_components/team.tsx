"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { ApiError, ROLES, api, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadClassList } from "@/lib/academics";
import { ROLE_INFO, type Member } from "@/lib/school";
import { classText, type AllAssignments, type MyClass } from "@/lib/teaching";
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
  const assignments = useResource(() => api<AllAssignments>("/api/teaching/assignments"), "teaching-assignments");
  const [assigning, setAssigning] = useState<Member | null>(null);
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
                    {m.role !== "accountant" && (
                      <TeachingSummary
                        classes={assignments.data?.teachers.find((t) => t.userId === m.userId)?.classes ?? []}
                        teacher={m.role === "teacher"}
                        onEdit={canGive.includes("teacher") ? () => setAssigning(m) : undefined}
                      />
                    )}
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

      {assigning && (
        <AssignDrawer
          member={assigning}
          current={assignments.data?.teachers.find((t) => t.userId === assigning.userId)?.classes ?? []}
          onClose={() => setAssigning(null)}
          onSaved={(data) => {
            assignments.setData(data);
            setAssigning(null);
            setMessage({ tone: "success", text: `Saved ${assigning.name}'s classes. They'll see them next time a page loads.` });
          }}
        />
      )}

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

/** "Class teacher 5 - A · Maths in 5 - B" under a team member, with an edit link. */
function TeachingSummary({ classes, teacher, onEdit }: { classes: MyClass[]; teacher: boolean; onEdit?: () => void }) {
  const parts = classes.flatMap((c) => [...(c.classTeacher ? [`Class teacher ${classText(c.grade, c.section)}`] : []), ...c.subjects.map((s) => `${s} in ${classText(c.grade, c.section)}`)]);
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      {parts.length ? (
        parts.slice(0, 4).map((p) => (
          <span key={p} className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
            {p}
          </span>
        ))
      ) : teacher ? (
        <span className="text-warning">No classes yet (sees every class)</span>
      ) : null}
      {parts.length > 4 && <span className="text-muted">+{parts.length - 4} more</span>}
      {onEdit && (teacher || parts.length > 0) && (
        <button onClick={onEdit} className="font-medium text-accent hover:underline">
          {parts.length ? "Edit classes" : "Assign classes"}
        </button>
      )}
    </p>
  );
}

type Row = { grade: string; section: string; subject: string };

/** Class teacher and subject assignments for one member. */
function AssignDrawer({ member, current, onClose, onSaved }: { member: Member; current: MyClass[]; onClose: () => void; onSaved: (data: AllAssignments) => void }) {
  const classList = useResource(loadClassList, "academics-classes");
  const [rows, setRows] = useState<Row[]>(() => current.flatMap((c) => [...(c.classTeacher ? [{ grade: c.grade, section: c.section, subject: "" }] : []), ...c.subjects.map((s) => ({ grade: c.grade, section: c.section, subject: s }))]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const classes = classList.data?.classes ?? [];
  const update = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<AllAssignments>(`/api/teaching/assignments/${member.userId}`, { method: "PUT", body: { assignments: rows.filter((r) => r.grade) } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`${member.name}'s classes`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <p className="text-sm text-muted">
        A <strong className="text-foreground">class teacher</strong> marks attendance, enters marks in every subject and writes report-card remarks for their class.
        A <strong className="text-foreground">subject teacher</strong> enters marks and homework for their subject only. Teachers see their own classes first everywhere.
      </p>
      {classList.data && classes.length === 0 && <Alert tone="warning">Set up your classes first (Settings → Classes &amp; subjects).</Alert>}
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const cls = classes.find((c) => c.name === r.grade);
          return (
            <li key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-center gap-2 rounded-xl border border-border bg-surface p-2">
              <Select aria-label="Class" value={r.grade} onChange={(e) => update(i, { grade: e.target.value, section: "", subject: r.subject })} className="h-9 text-sm">
                <option value="">Class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="Section" value={r.section} onChange={(e) => update(i, { section: e.target.value })} className="h-9 text-sm" disabled={!cls?.sections.length}>
                <option value="">{cls?.sections.length ? "All sections" : "—"}</option>
                {cls?.sections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </Select>
              <Select aria-label="Role in class" value={r.subject} onChange={(e) => update(i, { subject: e.target.value })} className="h-9 text-sm">
                <option value="">Class teacher</option>
                {(cls?.subjects ?? []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} teacher
                  </option>
                ))}
                {r.subject && !cls?.subjects.some((s) => s.name === r.subject) && <option value={r.subject}>{r.subject} teacher</option>}
              </Select>
              <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setRows((l) => l.filter((_, k) => k !== i))}>
                <Icon d={ICONS.x} />
              </Button>
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" onClick={() => setRows((l) => [...l, { grade: "", section: "", subject: "" }])}>
        <Icon d={ICONS.plus} />
        Add class or subject
      </Button>
      {rows.length === 0 && <p className="text-xs text-muted">With no classes, a teacher can work with every class (handy until you set this up).</p>}
      <p className="text-xs text-muted">Subjects come from each class&apos;s subject list in Settings → Classes &amp; subjects.</p>
    </Drawer>
  );
}
