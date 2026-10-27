"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer, PageHeader, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Skeleton, cx } from "@/components/ui";
import { WA_ICON, WhatsAppDrawer } from "@/components/whatsapp-send";
import { loadClassList } from "@/lib/academics";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { NAV_ICONS, NOTICES_CHANGED_EVENT, type Notice } from "@/lib/classroom";
import { classText, loadMyClasses, teaches } from "@/lib/teaching";
import { timeAgo } from "@/lib/whatsapp";

type Filter = "all" | "staff" | "parents" | "unread";

export default function NoticesPage() {
  return (
    <Suspense fallback={null}>
      <NoticesView />
    </Suspense>
  );
}

function NoticesView() {
  const { session } = useAuth();
  const me = session.status === "authenticated" ? session : null;
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const canPost = me?.role !== "accountant";
  const list = useResource(() => api<{ notices: Notice[]; unread: number }>("/api/notices"), "notices");
  const [filter, setFilter] = useState<Filter>("all");
  // Opened from search ("Post a notice")
  const params = useSearchParams();
  const router = useRouter();
  const [writing, setWriting] = useState(() => params.get("new") === "1");
  const [seenNew, setSeenNew] = useState(params.get("new"));
  if (seenNew !== params.get("new")) {
    setSeenNew(params.get("new"));
    if (params.get("new") === "1") setWriting(true);
  }
  const [sending, setSending] = useState<{ notice: Notice; studentIds: string[] } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Drop ?new=1 so a reload doesn't open the form again
  useEffect(() => {
    if (params.get("new") === "1") router.replace("/app/notices", { scroll: false });
  }, [params, router]);

  const notices = list.data?.notices ?? [];
  const shown = notices.filter((n) => (filter === "all" ? true : filter === "unread" ? !n.read && n.audience === "staff" : n.audience === filter));

  async function markAllRead() {
    await api("/api/notices/read-all", { method: "POST" }).catch(() => {});
    list.reload();
    window.dispatchEvent(new Event(NOTICES_CHANGED_EVENT));
  }

  async function openNotice(n: Notice) {
    if (!n.read) {
      await api(`/api/notices/${n.id}/read`, { method: "POST" }).catch(() => {});
      list.setData((d) => d && { ...d, unread: Math.max(0, d.unread - (n.audience === "staff" ? 1 : 0)), notices: d.notices.map((x) => (x.id === n.id ? { ...x, read: true } : x)) });
      window.dispatchEvent(new Event(NOTICES_CHANGED_EVENT));
    }
  }

  async function send(n: Notice) {
    try {
      const r = await api<{ students: { id: string }[] }>(`/api/notices/${n.id}`);
      if (!r.students.length) return setMessage({ tone: "danger", text: "No active students in this notice's classes." });
      setSending({ notice: n, studentIds: r.students.map((s) => s.id) });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function remove(n: Notice) {
    if (!confirm(`Delete “${n.title}”?`)) return;
    try {
      await api(`/api/notices/${n.id}`, { method: "DELETE" });
      list.reload();
      window.dispatchEvent(new Event(NOTICES_CHANGED_EVENT));
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  return (
    <div>
      <PageHeader
        icon={NAV_ICONS.notices}
        title="Notices"
        badge={list.data?.unread ? <Badge tone="danger">{list.data.unread} unread</Badge> : undefined}
        description="Announcements for the staff room, and notices for parents sent on WhatsApp."
        actions={
          <>
            {Boolean(list.data?.unread) && (
              <Button variant="secondary" size="sm" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
            {canPost && (
              <Button onClick={() => setWriting(true)}>
                <Icon d={ICONS.plus} />
                New notice
              </Button>
            )}
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
        {(
          [
            ["all", "All"],
            ["unread", "Unread"],
            ["staff", "Staff"],
            ["parents", "Parents"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v} className={cx("rounded-md px-3 py-1.5", filter === v ? "bg-surface-muted font-medium" : "text-muted")}>
            {label}
          </button>
        ))}
      </div>

      {list.error ? (
        <Alert>{list.error}</Alert>
      ) : !list.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon d={NAV_ICONS.notices} className="size-6" />
          </span>
          <p className="mt-3 font-medium">{filter === "unread" ? "You're all caught up" : "No notices yet"}</p>
          <p className="mt-1 text-sm text-muted">Post meeting reminders for staff, or PTM and holiday notices for parents.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((n) => {
            const mine = n.createdBy === me?.user.id;
            const unread = !n.read && n.audience === "staff";
            return (
              <li
                key={n.id}
                onMouseEnter={() => openNotice(n)}
                onClick={() => openNotice(n)}
                className={cx("relative overflow-hidden rounded-2xl border bg-surface p-5", unread ? "border-accent/40" : "border-border")}
              >
                {n.pinned && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent to-brand-green" />}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread && <span className="size-2 rounded-full bg-accent" aria-label="Unread" />}
                      <h2 className="font-semibold">{n.title}</h2>
                      {n.pinned && <Badge tone="accent">Pinned</Badge>}
                      <Badge tone={n.audience === "parents" ? "success" : "neutral"}>{n.audience === "parents" ? "For parents" : "Staff"}</Badge>
                      {n.audience === "parents" && <span className="text-xs text-muted">{n.classes.length ? n.classes.map((c) => `Class ${classText(c.grade, c.section)}`).join(", ") : "Whole school"}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted" title={formatDate(n.createdAt, true)}>
                      {n.createdByName || "Someone"} · {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {n.audience === "parents" && canPost && (
                      <>
                        <a href={`https://wa.me/?text=${encodeURIComponent(`📢 *${n.title}*\n\n${n.body}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-surface-muted">
                          Group
                        </a>
                        <button onClick={() => send(n)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#128c4a] px-2.5 text-xs font-medium text-white hover:bg-[#0f7a40]">
                          <Icon d={WA_ICON} className="size-3.5" />
                          Send to parents
                        </button>
                      </>
                    )}
                    {(mine || isAdmin) && (
                      <Button variant="ghost" size="icon-sm" aria-label="Delete notice" onClick={() => remove(n)}>
                        <Icon d={ICONS.x} />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      {writing && (
        <NoticeEditor
          isAdmin={isAdmin}
          onClose={() => setWriting(false)}
          onSaved={(n) => {
            setWriting(false);
            list.reload();
            setMessage({ tone: "success", text: n.audience === "parents" ? "Notice posted. Send it to parents on WhatsApp from the notice." : "Notice posted to the staff." });
            if (n.audience === "parents" && confirm("Send this notice to the parents on WhatsApp now?")) send(n);
          }}
        />
      )}

      {sending && (
        <WhatsAppDrawer
          type="notice"
          refs={sending.studentIds.map((studentId) => ({ noticeId: sending.notice.id, studentId }))}
          title="Send notice to parents"
          description={sending.notice.title}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  );
}

function NoticeEditor({ isAdmin, onClose, onSaved }: { isAdmin: boolean; onClose: () => void; onSaved: (n: Notice) => void }) {
  const classList = useResource(loadClassList, "academics-classes");
  const my = useResource(loadMyClasses, "my-classes");
  const [audience, setAudience] = useState<"staff" | "parents">(isAdmin ? "staff" : "parents");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Class options: whole classes and sections the member may notify
  const options = (classList.data?.classes ?? []).flatMap((c) => [
    ...(teaches(my.data, c.name) && (!my.data?.limited || my.data.classes.some((m) => m.grade === c.name && !m.section)) ? [{ v: `${c.name}|`, label: `Class ${c.name}` }] : []),
    ...c.sections.filter((s) => teaches(my.data, c.name, s)).map((s) => ({ v: `${c.name}|${s}`, label: `${c.name} - ${s}` })),
  ]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ notice: Notice }>("/api/notices", {
        method: "POST",
        body: { audience, title: title.trim(), body: body.trim(), pinned, classes: audience === "parents" ? picked.map((v) => ({ grade: v.split("|")[0], section: v.split("|")[1] })) : [] },
      });
      onSaved(res.notice);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title="New notice"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={title.trim().length < 2 || body.trim().length < 2 || (audience === "parents" && !isAdmin && picked.length === 0)}>
            Post notice
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["staff", "Staff", "Shown in EduFlow to the whole team"],
            ["parents", "Parents", "Sent to families on WhatsApp"],
          ] as const
        ).map(([v, label, hint]) => (
          <button key={v} onClick={() => setAudience(v)} aria-pressed={audience === v} className={cx("rounded-xl border p-3 text-left transition-colors", audience === v ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-muted")}>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted">{hint}</span>
          </button>
        ))}
      </div>
      <Field label="Title" htmlFor="n-title">
        <Input id="n-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder={audience === "parents" ? "e.g. Parent-teacher meeting on Saturday" : "e.g. Staff meeting at 3 pm"} />
      </Field>
      <Field label="Message" htmlFor="n-body">
        <textarea id="n-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={6} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm" />
      </Field>
      {audience === "parents" ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Classes</p>
          <p className="mb-2 text-xs text-muted">{isAdmin ? "Leave all unticked for the whole school." : "Choose your classes."}</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = picked.includes(o.v);
              return (
                <button key={o.v} onClick={() => setPicked((l) => (on ? l.filter((x) => x !== o.v) : [...l, o.v]))} aria-pressed={on} className={cx("rounded-full border px-3 py-1 text-sm transition-colors", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:bg-surface-muted")}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        isAdmin && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Pin to the top
          </label>
        )
      )}
    </Drawer>
  );
}
