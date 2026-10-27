"use client";

import { useState } from "react";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Announcement } from "@/lib/platform";
import { Drawer, PageHeader, errorMessage, formatDate, useResource } from "./shared";

type Draft = Omit<Announcement, "id" | "createdAt" | "startsAt" | "endsAt"> & { id: string | null; startsAt: string; endsAt: string };

const TONE_STYLE: Record<Announcement["tone"], string> = {
  info: "border-accent/30 bg-accent-soft",
  success: "border-success/30 bg-success-soft",
  warning: "border-warning/40 bg-warning-soft",
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const empty = (): Draft => ({ id: null, title: "", body: "", tone: "info", linkUrl: "", linkLabel: "", startsAt: new Date().toISOString().slice(0, 10), endsAt: "", active: true });

function isLive(a: Announcement) {
  const now = Date.now();
  return a.active && new Date(a.startsAt).getTime() <= now && (!a.endsAt || new Date(a.endsAt).getTime() > now);
}

/** Banners shown at the top of every school's app (new features, downtime, offers). */
export function Announcements() {
  const res = useResource(() => api<{ announcements: Announcement[] }>("/api/admin/announcements"), "console-announcements");
  const [editing, setEditing] = useState<Draft | null>(null);
  const list = res.data?.announcements ?? [];

  return (
    <>
      <PageHeader
        title="Announcements"
        description="A banner at the top of every school's app. Staff can dismiss it."
        icon="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8M19 5a9 9 0 010 14"
        actions={
          <Button onClick={() => setEditing(empty())}>
            <Icon d={ICONS.plus} />
            New announcement
          </Button>
        }
      />
      {res.error && <Alert>{res.error}</Alert>}
      {!res.data ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a.title}</p>
                    {isLive(a) ? <Badge tone="success">Live</Badge> : a.active ? <Badge tone="accent">Scheduled / ended</Badge> : <Badge>Off</Badge>}
                  </div>
                  {a.body && <p className="mt-1 text-sm text-muted">{a.body}</p>}
                  <p className="mt-1.5 text-xs text-muted">
                    From {formatDate(a.startsAt)}
                    {a.endsAt ? ` to ${formatDate(a.endsAt)}` : ", no end date"}
                    {a.linkUrl && ` · link: ${a.linkLabel || a.linkUrl}`}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditing({ ...a, startsAt: day(a.startsAt), endsAt: day(a.endsAt) })}>
                  <Icon d={ICONS.edit} />
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Editor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(announcements) => {
            res.setData({ announcements });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function Editor({ draft: initial, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (list: Announcement[]) => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: "save" | "delete") {
    setBusy(kind);
    setError(null);
    try {
      const path = d.id ? `/api/admin/announcements/${d.id}` : "/api/admin/announcements";
      // The whole announcement every time, so nothing falls back to a default
      const body = {
        title: d.title.trim(),
        body: d.body.trim(),
        tone: d.tone,
        linkUrl: d.linkUrl.trim(),
        linkLabel: d.linkLabel.trim(),
        startsAt: d.startsAt ? `${d.startsAt}T00:00:00.000Z` : new Date().toISOString(),
        endsAt: d.endsAt ? `${d.endsAt}T23:59:59.000Z` : null,
        active: d.active,
      };
      const res = await api<{ announcements: Announcement[] }>(path, kind === "delete" ? { method: "DELETE" } : { method: d.id ? "PATCH" : "POST", body });
      onSaved(res.announcements);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      title={d.id ? "Edit announcement" : "New announcement"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {d.id ? (
            <Button variant="danger" loading={busy === "delete"} disabled={busy !== null} onClick={() => confirm("Delete this announcement?") && send("delete")}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy === "save"} disabled={d.title.trim().length < 2 || busy !== null} onClick={() => send("save")}>
              {d.id ? "Save" : "Publish"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
        <div className={cx("rounded-xl border px-4 py-3 text-sm", TONE_STYLE[d.tone])}>
          <p className="font-semibold">📣 {d.title || "Title"}</p>
          {d.body && <p className="text-muted">{d.body}</p>}
          {d.linkUrl && <p className="font-medium text-accent">{d.linkLabel || "Learn more"} →</p>}
        </div>
      </div>
      <Field label="Title" htmlFor="ann-title">
        <Input id="ann-title" value={d.title} maxLength={120} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. New: share report cards on WhatsApp" />
      </Field>
      <Field label="Message" htmlFor="ann-body">
        <textarea id="ann-body" rows={3} maxLength={500} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      </Field>
      <Field label="Style" htmlFor="ann-tone">
        <Select id="ann-tone" value={d.tone} onChange={(e) => setD({ ...d, tone: e.target.value as Announcement["tone"] })}>
          <option value="info">Info (blue)</option>
          <option value="success">Good news (green)</option>
          <option value="warning">Warning (amber)</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Link (optional)" htmlFor="ann-link">
          <Input id="ann-link" type="url" value={d.linkUrl} onChange={(e) => setD({ ...d, linkUrl: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="Link text" htmlFor="ann-link-label">
          <Input id="ann-link-label" value={d.linkLabel} maxLength={40} onChange={(e) => setD({ ...d, linkLabel: e.target.value })} placeholder="Learn more" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Show from" htmlFor="ann-start">
          <Input id="ann-start" type="date" value={d.startsAt} onChange={(e) => setD({ ...d, startsAt: e.target.value })} />
        </Field>
        <Field label="Until" htmlFor="ann-end" hint="Empty = until turned off">
          <Input id="ann-end" type="date" value={d.endsAt} onChange={(e) => setD({ ...d, endsAt: e.target.value })} />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} />
        Turned on
      </label>
    </Drawer>
  );
}
