"use client";

import { useState } from "react";
import { Section, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Input, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, formatDay, localToday } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { NOTE_META, type Leave, type NoteKind, type StudentNote } from "@/lib/classroom";
import { timeAgo } from "@/lib/whatsapp";

const textareaClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm";

/** Staff-only sections of a student profile: notes & behaviour, leave, and correction requests. */
export function StudentClassroom({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  if (role === "accountant" || !role) return null;
  return (
    <>
      <NotesCard studentId={studentId} />
      <LeaveCard studentId={studentId} />
      {role === "teacher" && <CorrectionCard studentId={studentId} studentName={studentName} />}
    </>
  );
}

function NotesCard({ studentId }: { studentId: string }) {
  const { session } = useAuth();
  const me = session.status === "authenticated" ? session : null;
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const path = `/api/notes?studentId=${studentId}`;
  const notes = useResource(() => api<{ notes: StudentNote[]; counts: Record<NoteKind, number> }>(path), path);
  const [kind, setKind] = useState<NoteKind>("note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/notes", { method: "POST", body: { studentId, kind, text: text.trim() } });
      setText("");
      notes.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(n: StudentNote) {
    if (!confirm("Delete this note?")) return;
    try {
      await api(`/api/notes/${n.id}`, { method: "DELETE" });
      notes.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const c = notes.data?.counts;
  return (
    <Section title="Notes & behaviour">
      <div className="rounded-xl border border-border bg-surface">
        {c && (c.praise > 0 || c.concern > 0) && (
          <div className="flex gap-2 border-b border-border px-4 py-2.5 text-xs">
            <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">{c.praise} praise</span>
            <span className={cx("rounded-full px-2 py-0.5 font-medium", c.concern ? "bg-danger-soft text-danger" : "bg-surface-muted text-muted")}>{c.concern} concern{c.concern === 1 ? "" : "s"}</span>
            {c.meeting > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{c.meeting} parent meeting{c.meeting === 1 ? "" : "s"}</span>}
          </div>
        )}
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(NOTE_META) as NoteKind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors", kind === k ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:bg-surface-muted")}>
                <Icon d={NOTE_META[k].icon} className="size-3.5" />
                {NOTE_META[k].label}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} placeholder={kind === "meeting" ? "What was discussed with the parent" : kind === "praise" ? "What did they do well?" : kind === "concern" ? "What happened?" : "A note for staff (parents don't see this)"} className={textareaClass} />
          {error && <Alert>{error}</Alert>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Only staff can see these notes.</span>
            <Button size="sm" onClick={add} loading={busy} disabled={text.trim().length < 2}>
              Add {NOTE_META[kind].label.toLowerCase()}
            </Button>
          </div>
        </div>
        {notes.data && notes.data.notes.length > 0 && (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border">
            {notes.data.notes.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", n.kind === "praise" ? "bg-success-soft text-success" : n.kind === "concern" ? "bg-danger-soft text-danger" : n.kind === "meeting" ? "bg-accent-soft text-accent" : "bg-surface-muted text-muted")}>
                  <Icon d={NOTE_META[n.kind].icon} className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                  <p className="mt-0.5 text-xs text-muted" title={formatDate(n.createdAt, true)}>
                    <Badge tone={NOTE_META[n.kind].tone}>{NOTE_META[n.kind].label}</Badge> {n.createdByName} · {timeAgo(n.createdAt)}
                  </p>
                </div>
                {(n.createdBy === me?.user.id || isAdmin) && (
                  <Button variant="ghost" size="icon-sm" aria-label="Delete note" onClick={() => remove(n)}>
                    <Icon d={ICONS.x} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function LeaveCard({ studentId }: { studentId: string }) {
  const today = localToday();
  const path = `/api/leaves?from=${addDays(today, -30)}&to=${addDays(today, 90)}&studentId=${studentId}`;
  const leaves = useResource(() => api<{ leaves: Leave[] }>(path), path);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/leaves", { method: "POST", body: { studentId, from, to, reason: reason.trim() } });
      setOpen(false);
      setReason("");
      leaves.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: Leave) {
    if (!confirm("Remove this leave?")) return;
    try {
      await api(`/api/leaves/${l.id}`, { method: "DELETE" });
      leaves.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const list = leaves.data?.leaves ?? [];
  return (
    <Section title="Leave">
      <div className="rounded-xl border border-border bg-surface">
        {list.length > 0 && (
          <ul className="divide-y divide-border">
            {list.map((l) => {
              const current = l.from <= today && l.to >= today;
              return (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {l.from === l.to ? formatDay(l.from, "short") : `${formatDay(l.from, "short")} – ${formatDay(l.to, "short")}`}
                      {current && <Badge tone="accent">Now</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {l.reason || "No reason given"} · by {l.createdByName}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove leave" onClick={() => remove(l)}>
                    <Icon d={ICONS.x} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {open ? (
          <div className={cx("space-y-2 p-3", list.length > 0 && "border-t border-border")}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                From
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} className="mt-1" />
              </label>
              <label className="text-xs text-muted">
                To
                <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1" />
              </label>
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Reason (e.g. family function, fever)" />
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={add} loading={busy} disabled={!from || !to}>
                Save leave
              </Button>
            </div>
            <p className="text-[11px] text-muted">The register will suggest “Leave” on these days.</p>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className={cx("flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-accent hover:bg-surface-muted", list.length > 0 && "border-t border-border")}>
            <Icon d={ICONS.plus} />
            Record leave
          </button>
        )}
      </div>
    </Section>
  );
}

function CorrectionCard({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setNote(null);
    try {
      await api("/api/corrections", { method: "POST", body: { studentId, message: message.trim() } });
      setOpen(false);
      setMessage("");
      setNote({ tone: "success", text: "Sent to the office. They'll fix it and mark it done." });
    } catch (err) {
      setNote({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {note && <Alert tone={note.tone}>{note.text}</Alert>}
      {open ? (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-sm font-medium">What&apos;s wrong in {studentName}&apos;s details?</p>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Guardian phone should be 98765 43210; roll number is 14" className={textareaClass} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={send} loading={busy} disabled={message.trim().length < 3}>
              Send to office
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-2 text-sm font-medium text-accent hover:underline">
          Something wrong in these details? Report a correction
        </button>
      )}
    </div>
  );
}
