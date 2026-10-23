"use client";

import { Badge, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { Card, PageHeader, formatDate, useResource, type AuditLog, type Stats } from "./shared";

function StatCard({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString()}</p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </Card>
  );
}

export function Overview({ onOpenAudit }: { onOpenAudit: () => void }) {
  const stats = useResource(() => api<Stats>("/api/admin/stats"), "stats");
  const recent = useResource(
    () => api<{ logs: AuditLog[] }>("/api/admin/audit-logs?limit=6"),
    "recent-logs"
  );

  return (
    <>
      <PageHeader title="Overview" description="Everything happening across the platform." />

      {stats.loading && !stats.data ? (
        <Spinner className="mx-auto my-16" />
      ) : stats.error ? (
        <p className="text-sm text-danger">{stats.error}</p>
      ) : stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Organisations"
            value={stats.data.tenants.total}
            detail={`${stats.data.tenants.active} active · ${stats.data.tenants.inactive} suspended`}
          />
          <StatCard
            label="Users"
            value={stats.data.users.total}
            detail={`${stats.data.users.active} active · ${stats.data.users.inactive} disabled`}
          />
          <StatCard
            label="New in last 30 days"
            value={stats.data.tenants.last30Days}
            detail={`organisations · ${stats.data.users.last30Days} new users`}
          />
          <StatCard
            label="Active sessions"
            value={stats.data.activeSessions}
            detail={`${stats.data.memberships} memberships in total`}
          />
        </div>
      ) : null}

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Recent admin activity</h2>
          <button onClick={onOpenAudit} className="text-sm font-medium text-accent hover:underline">
            View all
          </button>
        </div>
        {recent.loading && !recent.data ? (
          <Spinner className="mx-auto my-8" />
        ) : recent.error ? (
          <p className="p-5 text-sm text-danger">{recent.error}</p>
        ) : recent.data?.logs.length ? (
          <ul className="divide-y divide-border">
            {recent.data.logs.map((log) => (
              <li key={log._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="min-w-0 truncate">
                  <Badge tone="accent">{log.action}</Badge>
                  <span className="ml-2 text-muted">by {log.actor?.name ?? "unknown"}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDate(log.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted">No activity yet.</p>
        )}
      </Card>
    </>
  );
}
