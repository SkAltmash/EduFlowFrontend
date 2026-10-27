"use client";

import { useState } from "react";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Skeleton } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Drawer, PageHeader, errorMessage, formatDate, generatePassword, loginShareLink, useResource } from "./shared";

interface Admin {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  twoFactor: boolean;
  createdAt: string;
  isYou: boolean;
}

/** Everyone who can open this console, and adding or removing them. */
export function Admins() {
  const res = useResource(() => api<{ admins: Admin[] }>("/api/admin/super-admins"), "console-admins");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const admins = res.data?.admins ?? [];

  async function remove(a: Admin) {
    if (!confirm(`Remove ${a.name} as a super admin? They're signed out and lose access to the console. Their account stays.`)) return;
    setBusy(a.id);
    setMessage(null);
    try {
      res.setData(await api<{ admins: Admin[] }>(`/api/admin/super-admins/${a.id}`, { method: "DELETE" }));
      setMessage({ tone: "success", text: `${a.name} is no longer a super admin.` });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Admins"
        description="Super admins can see and change every school. Add only people you fully trust."
        icon="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM12 11a2 2 0 100-4 2 2 0 000 4zM8.5 15.5c.6-1.5 2-2.5 3.5-2.5s2.9 1 3.5 2.5"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Icon d={ICONS.plus} />
            Add super admin
          </Button>
        }
      />
      {res.error && <Alert>{res.error}</Alert>}
      {message && <div className="mb-4"><Alert tone={message.tone}>{message.text}</Alert></div>}
      {!res.data ? (
        <Skeleton className="h-40" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{a.name.trim()[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {a.name}
                  {a.isYou && <Badge tone="accent">You</Badge>}
                  {a.twoFactor ? <Badge tone="success">Two-step on</Badge> : <Badge>Two-step off</Badge>}
                  {!a.isActive && <Badge tone="danger">Disabled</Badge>}
                </p>
                <p className="truncate text-xs text-muted">
                  {a.email} · since {formatDate(a.createdAt)}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(a)}>
                <Icon d={ICONS.edit} />
                {a.isYou ? "My account" : "Edit"}
              </Button>
              {!a.isYou && (
                <Button variant="ghost" size="sm" className="text-danger" loading={busy === a.id} disabled={busy !== null} onClick={() => remove(a)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Every add and remove is in the audit log. Ask new admins to turn on two-step login under Security.</p>

      {editing && (
        <EditAdmin
          admin={editing}
          onClose={() => setEditing(null)}
          onSaved={(list, text) => {
            res.setData({ admins: list });
            setEditing(list.find((a) => a.id === editing.id) ?? null);
            setMessage({ tone: "success", text });
          }}
        />
      )}

      {adding && (
        <AddAdmin
          onClose={() => setAdding(false)}
          onAdded={(list, text) => {
            res.setData({ admins: list });
            setMessage({ tone: "success", text });
          }}
        />
      )}
    </>
  );
}

function AddAdmin({ onClose, onAdded }: { onClose: () => void; onAdded: (list: Admin[], message: string) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; email: string; password: string } | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = isNew ? { email: email.trim(), name: name.trim(), password } : { email: email.trim() };
      const res = await api<{ admins: Admin[] }>("/api/admin/super-admins", { method: "POST", body });
      if (isNew) {
        onAdded(res.admins, `${name.trim()} can now sign in to the console.`);
        setDone({ name: name.trim(), email: email.trim(), password });
      } else {
        onAdded(res.admins, `${email.trim()} is now a super admin. Their next sign-in opens the console.`);
        onClose();
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      // No account yet: ask for a name and password to create one
      if (code === "NAME_PASSWORD_REQUIRED") {
        setIsNew(true);
        setPassword(generatePassword());
        setError(null);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Drawer title="Super admin added" onClose={onClose} footer={<div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>}>
        <Alert tone="success">{done.name} can sign in now. Send the login details; the password isn&apos;t shown again.</Alert>
        <div className="rounded-xl bg-surface-muted px-4 py-3 text-sm">
          <p>Email: <strong>{done.email}</strong></p>
          <p>Password: <code className="font-mono font-semibold">{done.password}</code></p>
        </div>
        <a href={loginShareLink(done)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white">
          <Icon d={WA_ICON} />
          Send on WhatsApp
        </a>
      </Drawer>
    );
  }

  const valid = email.includes("@") && (!isNew || (name.trim().length >= 2 && isStrongPassword(password)));
  return (
    <Drawer
      title="Add super admin"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => confirm(`Give ${email.trim()} full access to every school?`) && save()} loading={busy} disabled={!valid}>
            {isNew ? "Create super admin" : "Add"}
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <Alert tone="warning">A super admin can see every school&apos;s data, change plans, delete schools and add more admins.</Alert>
      <Field label="Email" htmlFor="sa-email" hint={isNew ? undefined : "If they already have an EduFlow account, it becomes a super admin. Otherwise you'll set a name and password."}>
        <Input id="sa-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setIsNew(false); }} placeholder="name@example.com" autoFocus />
      </Field>
      {isNew && (
        <>
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">No account with this email yet. A new one will be created.</p>
          <Field label="Name" htmlFor="sa-name">
            <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Password" htmlFor="sa-password">
            <div className="flex gap-2">
              <Input id="sa-password" className="font-mono" spellCheck={false} value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}>New</Button>
            </div>
          </Field>
          <PasswordRules value={password} />
        </>
      )}
    </Drawer>
  );
}

/** Name and email of an admin; a new password for someone else, or your own password change. */
function EditAdmin({ admin, onClose, onSaved }: { admin: Admin; onClose: () => void; onSaved: (list: Admin[], message: string) => void }) {
  const { session, updateSession } = useAuth();
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const changed = name.trim() !== admin.name || email.trim().toLowerCase() !== admin.email;

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ tone: "success", text: await action() });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  const saveDetails = () =>
    run("details", async () => {
      const body = { ...(name.trim() !== admin.name ? { name: name.trim() } : {}), ...(email.trim().toLowerCase() !== admin.email ? { email: email.trim() } : {}) };
      const res = await api<{ admins: Admin[] }>(`/api/admin/super-admins/${admin.id}`, { method: "PATCH", body });
      const me = res.admins.find((a) => a.id === admin.id);
      // Your own name and email in the sidebar too
      if (admin.isYou && me && session.status === "authenticated") updateSession({ user: { ...session.user, name: me.name, email: me.email } });
      onSaved(res.admins, admin.isYou ? "Your details were saved." : `${me?.name ?? "Admin"} saved.`);
      return "Saved.";
    });

  const resetOther = () =>
    run("password", async () => {
      await api(`/api/admin/super-admins/${admin.id}/password`, { method: "POST", body: { password: newPassword } });
      setShared(newPassword);
      setNewPassword("");
      return `New password set. ${admin.name} was signed out everywhere.`;
    });

  const changeOwn = () =>
    run("password", async () => {
      const r = await api<{ signedOutSessions: number }>("/api/admin/account/password", { method: "POST", body: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      return `Password changed.${r.signedOutSessions ? ` ${r.signedOutSessions} other device${r.signedOutSessions === 1 ? " was" : "s were"} signed out.` : ""}`;
    });

  return (
    <Drawer title={admin.isYou ? "My account" : `Edit ${admin.name}`} onClose={onClose}>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Details</h3>
        <Field label="Name" htmlFor="ea-name">
          <Input id="ea-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Email" htmlFor="ea-email" hint="Used to sign in.">
          <Input id="ea-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button onClick={saveDetails} loading={busy === "details"} disabled={!changed || name.trim().length < 2 || !email.includes("@")}>
            Save details
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">{admin.isYou ? "Change my password" : "Set a new password"}</h3>
        {admin.isYou && (
          <Field label="Current password" htmlFor="ea-current">
            <Input id="ea-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
        )}
        <Field label="New password" htmlFor="ea-new">
          <div className="flex gap-2">
            <Input id="ea-new" className="font-mono" spellCheck={false} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => setNewPassword(generatePassword())}>
              Generate
            </Button>
          </div>
        </Field>
        {newPassword && <PasswordRules value={newPassword} />}
        <div className="flex justify-end">
          <Button
            variant="secondary"
            loading={busy === "password"}
            disabled={!isStrongPassword(newPassword) || (admin.isYou && !currentPassword)}
            onClick={() => (admin.isYou ? changeOwn() : confirm(`Set a new password for ${admin.name}? They'll be signed out everywhere.`) && resetOther())}
          >
            {admin.isYou ? "Change password" : "Set password"}
          </Button>
        </div>
        {shared && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm">
            <span>
              New password: <code className="font-mono font-semibold">{shared}</code>
            </span>
            <a href={loginShareLink({ name: admin.name, email: admin.email, password: shared })} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
              <Icon d={WA_ICON} className="size-4" />
              Send on WhatsApp
            </a>
          </div>
        )}
      </section>
    </Drawer>
  );
}
