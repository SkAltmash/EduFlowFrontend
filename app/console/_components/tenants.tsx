"use client";

import { useState } from "react";
import { Badge, Button, Field, Input, Select, Spinner } from "@/components/ui";
import { ROLES, api, type Role } from "@/lib/api";
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
  type Member,
  type Pagination,
  type StatusFilter,
} from "./shared";

export function Tenants() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(search.trim());

  const path = `/api/admin/tenants${query({ search: q, status, page, limit: 20 })}`;
  const list = useResource(() => api<{ tenants: AdminTenant[]; pagination: Pagination }>(path), path);
  const tenants = list.data?.tenants ?? [];

  return (
    <>
      <PageHeader title="Organisations" description="Schools, tuition centres and coaching institutes on EduFlow." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search by name or slug"
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
        <Table head={["Name", "Members", "Status", "Created"]}>
          <TableState cols={4} loading={list.loading && !list.data} error={list.error} empty={tenants.length === 0} />
          {tenants.map((t) => (
            <tr key={t.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOpenId(t.id)}>
              <td className="px-4 py-3">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted">{t.slug}</div>
              </td>
              <td className="px-4 py-3 tabular-nums">{t.memberCount ?? 0}</td>
              <td className="px-4 py-3">
                {t.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(t.createdAt)}</td>
            </tr>
          ))}
        </Table>
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </Card>

      {openId && <TenantDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </>
  );
}

type TenantDetail = { tenant: AdminTenant; members: Member[] };

function TenantDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const detail = useResource(() => api<TenantDetail>(`/api/admin/tenants/${id}`), id);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [newMember, setNewMember] = useState<{ email: string; role: Role }>({ email: "", role: "teacher" });

  const tenant = detail.data?.tenant;
  const members = detail.data?.members ?? [];

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

  const patchTenant = (body: { name?: string; isActive?: boolean }, success: string) =>
    run(
      "tenant",
      async () => {
        detail.setData(await api<TenantDetail>(`/api/admin/tenants/${id}`, { method: "PATCH", body }));
        setName(null);
      },
      success
    );

  const setMembers = (res: { members: Member[] }) =>
    detail.setData((d) => (d ? { ...d, members: res.members } : d));

  return (
    <Drawer title={tenant?.name ?? "Organisation"} onClose={onClose}>
      {detail.loading && !detail.data ? (
        <Spinner className="mx-auto my-16" />
      ) : detail.error ? (
        <p className="text-sm text-danger">{detail.error}</p>
      ) : tenant ? (
        <>
          <Notice message={message} />

          <Section title="Details">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name && name.trim() !== tenant.name) patchTenant({ name: name.trim() }, "Name updated");
              }}
            >
              <Field label="Name" htmlFor="tenant-name">
                <div className="flex gap-2">
                  <Input id="tenant-name" value={name ?? tenant.name} onChange={(e) => setName(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={!name || name.trim() === tenant.name} loading={busy === "tenant" && name !== null}>
                    Save
                  </Button>
                </div>
              </Field>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted">Slug</dt>
                  <dd className="font-mono text-xs">{tenant.slug}</dd>
                </div>
                <div>
                  <dt className="text-muted">Created</dt>
                  <dd>{formatDate(tenant.createdAt)}</dd>
                </div>
              </dl>
            </form>
          </Section>

          <Section title="Status">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="text-sm">
                {tenant.isActive ? (
                  <>
                    <Badge tone="success">Active</Badge>
                    <p className="mt-1.5 text-muted">Suspending signs every member out immediately.</p>
                  </>
                ) : (
                  <>
                    <Badge tone="danger">Suspended</Badge>
                    <p className="mt-1.5 text-muted">Members can&apos;t sign in to this organisation.</p>
                  </>
                )}
              </div>
              <Button
                variant={tenant.isActive ? "danger" : "secondary"}
                size="sm"
                loading={busy === "tenant" && name === null}
                onClick={() => {
                  if (tenant.isActive && !confirm(`Suspend ${tenant.name}? All members will be signed out.`)) return;
                  patchTenant({ isActive: !tenant.isActive }, tenant.isActive ? "Organisation suspended" : "Organisation reactivated");
                }}
              >
                {tenant.isActive ? "Suspend" : "Reactivate"}
              </Button>
            </div>
          </Section>

          <Section title={`Members (${members.length})`}>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {m.name} {!m.isActive && <Badge tone="danger">disabled</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">{m.email}</div>
                  </div>
                  <Select
                    aria-label={`Role for ${m.name}`}
                    className="h-8 w-32 text-xs"
                    value={m.role}
                    disabled={busy !== null}
                    onChange={(e) => {
                      const role = e.target.value as Role;
                      run(
                        `role-${m.userId}`,
                        async () =>
                          setMembers(
                            await api(`/api/admin/tenants/${id}/members/${m.userId}`, { method: "PATCH", body: { role } })
                          ),
                        `${m.name} is now ${role}`
                      );
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    loading={busy === `remove-${m.userId}`}
                    disabled={busy !== null}
                    onClick={() => {
                      if (!confirm(`Remove ${m.name} from ${tenant.name}?`)) return;
                      run(
                        `remove-${m.userId}`,
                        async () => setMembers(await api(`/api/admin/tenants/${id}/members/${m.userId}`, { method: "DELETE" })),
                        `${m.name} removed`
                      );
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
              {members.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No members</li>}
            </ul>
          </Section>

          <Section title="Add member">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  "add",
                  async () => {
                    setMembers(await api(`/api/admin/tenants/${id}/members`, { method: "POST", body: newMember }));
                    setNewMember({ email: "", role: "teacher" });
                  },
                  `${newMember.email} added`
                );
              }}
            >
              <Input
                type="email"
                required
                className="min-w-0 flex-1"
                placeholder="Email of an existing user"
                value={newMember.email}
                onChange={(e) => setNewMember((n) => ({ ...n, email: e.target.value }))}
              />
              <Select
                aria-label="Role"
                className="w-32"
                value={newMember.role}
                onChange={(e) => setNewMember((n) => ({ ...n, role: e.target.value as Role }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
              <Button type="submit" loading={busy === "add"} disabled={!newMember.email}>
                Add
              </Button>
            </form>
          </Section>
        </>
      ) : null}
    </Drawer>
  );
}
