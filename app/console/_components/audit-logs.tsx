"use client";

import { Fragment, useState } from "react";
import { Badge, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { Card, PageHeader, Pager, Table, TableState, formatDate, query, useResource, type AuditLog, type Pagination } from "./shared";

const ACTIONS = [
  "admin.login",
  "tenant.update",
  "tenant.enter",
  "membership.create",
  "membership.update",
  "membership.delete",
  "user.update",
  "user.reset_password",
];

export function AuditLogs() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const path = `/api/admin/audit-logs${query({ action, page, limit: 25 })}`;
  const list = useResource(() => api<{ logs: AuditLog[]; pagination: Pagination }>(path), path);
  const logs = list.data?.logs ?? [];

  return (
    <>
      <PageHeader title="Audit log" description="Every action taken by a super admin, newest first." />
      <div className="mb-4">
        <Select
          aria-label="Filter by action"
          className="max-w-xs"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <Card>
        <Table head={["Action", "Admin", "Target", "IP", "When"]}>
          <TableState cols={5} loading={list.loading && !list.data} error={list.error} empty={logs.length === 0} />
          {logs.map((log) => (
            <Fragment key={log._id}>
              <tr
                className={log.metadata ? "cursor-pointer hover:bg-surface-muted" : undefined}
                onClick={() => log.metadata && setExpanded(expanded === log._id ? null : log._id)}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge tone="accent">{log.action}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div>{log.actor?.name ?? "—"}</div>
                  <div className="text-xs text-muted">{log.actor?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="capitalize">{log.targetType}</div>
                  {log.targetId && <div className="font-mono text-xs text-muted">{log.targetId}</div>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{log.ip ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(log.createdAt, true)}</td>
              </tr>
              {expanded === log._id && (
                <tr className="bg-surface-muted">
                  <td colSpan={5} className="px-4 py-3">
                    <pre className="overflow-x-auto text-xs">{JSON.stringify(log.metadata, null, 2)}</pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
        <Pager pagination={list.data?.pagination} onPage={setPage} />
      </Card>
    </>
  );
}
