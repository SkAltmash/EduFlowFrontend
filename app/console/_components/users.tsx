"use client";

import { useState } from "react";
import { PasswordRules, isStrongPassword } from "@/components/password-rules";
import { Badge, Button, Field, Input, Spinner } from "@/components/ui";
import { api, type Role } from "@/lib/api";
import {
  Card,
  Drawer,
  Notice,
  PageHeader,
  Pager,
  Section,
  StatusTabs,
  Table,
  TableState,
  errorMessage,
  formatDate,
  query,
  useDebounced,
  useResource,
  type AdminTenant,
  type AdminUser,
  type Pagination,
  type StatusFilter,
} from "./shared";

export function Users() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(search.trim());

  const path = `/api/admin/users${query({ search: q, status, page, limit: 20 })}`;
  const list = useResource(() => api<{ users: AdminUser[]; pagination: Pagination }>(path), path);
  const users = list.data?.users ?? [];

  return (
    <>
      <PageHeader title="Users" description="Every account on the platform." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <StatusTabs
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
        />
      </div>
      <Card>
        <Table head={["Name", "Organisations", "Status", "Joined"]}>
          <TableState cols={4} loading={list.loading && !list.data} error={list.error} empty={users.length === 0} />
          {users.map((u) => (
            <tr key={u.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOpenId(u.id)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 font-medium">
                  {u.name}
                  {u.isSuperAdmin && <Badge tone="accent">super admin</Badge>}
                </div>
                <div className="text-xs text-muted">{u.email}</div>
              </td>
              <td className="px-4 py-3 tabular-nums">{u.tenantCount ?? 0}</td>
              <td className="px-4 py-3">
                {u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </Table>
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </Card>

      {openId && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </>
  );
}

type UserDetail = {
  user: AdminUser;
  memberships: { tenant: Pick<AdminTenant, "id" | "name" | "slug" | "isActive">; role: Role; joinedAt: string }[];
};

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const detail = useResource(() => api<UserDetail>(`/api/admin/users/${id}`), id);
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const user = detail.data?.user;

  async function run(key: string, action: () => Promise<void>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  const patchUser = (key: string, body: { name?: string; isActive?: boolean }, success: string) =>
    run(
      key,
      async () => {
        detail.setData(await api<UserDetail>(`/api/admin/users/${id}`, { method: "PATCH", body }));
        setName(null);
      },
      success
    );

  return (
    <Drawer title={user?.name ?? "User"} onClose={onClose}>
      {detail.loading && !detail.data ? (
        <Spinner className="mx-auto my-16" />
      ) : detail.error ? (
        <p className="text-sm text-danger">{detail.error}</p>
      ) : user ? (
        <>
          <Notice message={message} />

          {user.isSuperAdmin && (
            <p className="rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-accent">
              Super admin accounts can only be changed from the server with <code className="font-mono">npm run superadmin</code>.
            </p>
          )}

          <Section title="Profile">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name && name.trim() !== user.name) patchUser("name", { name: name.trim() }, "Name updated");
              }}
            >
              <Field label="Name" htmlFor="user-name">
                <div className="flex gap-2">
                  <Input
                    id="user-name"
                    value={name ?? user.name}
                    disabled={user.isSuperAdmin}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={!name || name.trim() === user.name} loading={busy === "name"}>
                    Save
                  </Button>
                </div>
              </Field>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-muted">Email</dt>
                  <dd className="truncate">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-muted">Joined</dt>
                  <dd>{formatDate(user.createdAt)}</dd>
                </div>
              </dl>
            </form>
          </Section>

          {!user.isSuperAdmin && (
            <Section title="Account status">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="text-sm">
                  {user.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}
                  <p className="mt-1.5 text-muted">
                    {user.isActive ? "Disabling signs them out everywhere." : "They can't sign in until re-enabled."}
                  </p>
                </div>
                <Button
                  variant={user.isActive ? "danger" : "secondary"}
                  size="sm"
                  loading={busy === "status"}
                  onClick={() => {
                    if (user.isActive && !confirm(`Disable ${user.name}? They will be signed out everywhere.`)) return;
                    patchUser("status", { isActive: !user.isActive }, user.isActive ? "Account disabled" : "Account enabled");
                  }}
                >
                  {user.isActive ? "Disable" : "Enable"}
                </Button>
              </div>
            </Section>
          )}

          <Section title={`Organisations (${detail.data!.memberships.length})`}>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {detail.data!.memberships.map((m) => (
                <li key={m.tenant.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.tenant.name}</span>
                    <span className="block text-xs text-muted">joined {formatDate(m.joinedAt)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    {!m.tenant.isActive && <Badge tone="danger">suspended</Badge>}
                    <Badge tone="accent">{m.role}</Badge>
                  </span>
                </li>
              ))}
              {detail.data!.memberships.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted">Not a member of any organisation</li>
              )}
            </ul>
          </Section>

          {!user.isSuperAdmin && (
            <Section title="Reset password">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    "password",
                    async () => {
                      await api(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { password } });
                      setPassword("");
                    },
                    "Password reset. All of their sessions were ended."
                  );
                }}
              >
                <div className="flex gap-2">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button type="submit" variant="secondary" disabled={!isStrongPassword(password)} loading={busy === "password"}>
                    Reset
                  </Button>
                </div>
                {password && <PasswordRules value={password} />}
              </form>
            </Section>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
