"use client";

import { useState } from "react";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Badge, Button, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { CorrectionRequest } from "@/lib/classroom";
import { timeAgo } from "@/lib/whatsapp";

/** Teachers' requests to fix student details; admins open the student, fix it, and resolve. */
export function CorrectionsDrawer({ onClose, onOpenStudent }: { onClose: () => void; onOpenStudent: (id: string) => void }) {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const path = `/api/corrections?status=${status}`;
  const list = useResource(() => api<{ requests: CorrectionRequest[]; open: number }>(path), path);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setState(r: CorrectionRequest, next: "open" | "resolved") {
    setBusy(r.id);
    setError(null);
    try {
      await api(`/api/corrections/${r.id}`, { method: "PATCH", body: { status: next } });
      list.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer title="Correction requests" onClose={onClose}>
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
        {(["open", "resolved"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={cx("rounded-md px-3 py-1.5 capitalize", status === s ? "bg-surface-muted font-medium" : "text-muted")}>
            {s}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {!list.data ? (
        <Skeleton className="h-40" />
      ) : list.data.requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{status === "open" ? "Nothing waiting. 🎉" : "No resolved requests yet."}</p>
      ) : (
        <ul className="space-y-3">
          {list.data.requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => onOpenStudent(r.studentId)} className="min-w-0 text-left">
                  <span className="block truncate font-medium text-accent hover:underline">{r.studentName}</span>
                  <span className="block text-xs text-muted">
                    {r.admissionNo}
                    {r.grade && ` · Class ${r.section ? `${r.grade} - ${r.section}` : r.grade}`}
                  </span>
                </button>
                {r.status === "resolved" ? <Badge tone="success">Resolved</Badge> : <Badge tone="danger">Open</Badge>}
              </div>
              <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">{r.message}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span title={formatDate(r.createdAt, true)}>
                  {r.createdByName} · {timeAgo(r.createdAt)}
                  {r.resolvedByName && ` · resolved by ${r.resolvedByName}`}
                </span>
                {r.status === "open" ? (
                  <Button size="sm" onClick={() => setState(r, "resolved")} loading={busy === r.id}>
                    Mark fixed
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setState(r, "open")} loading={busy === r.id}>
                    Reopen
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
