"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/app/app/students/_components/bits";
import { errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import {
  ATTENDANCE_STATUSES,
  STATUS_META,
  className,
  formatDay,
  formatRate,
  type AttendanceStatus,
  type Register as RegisterData,
} from "@/lib/attendance";
import { StatusBar } from "./class-grid";

type Mark = { status: AttendanceStatus; note: string };

interface Props {
  date: string;
  grade: string;
  section: string;
  onBack: () => void;
  /** Lets the page ask before switching away with unsaved marks */
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}

export function Register({ date, grade, section, onBack, onDirtyChange, onSaved }: Props) {
  const path = `/api/attendance/register?date=${date}&grade=${encodeURIComponent(grade)}&section=${encodeURIComponent(section)}`;
  const { data: loaded, setData, error, reload } = useResource(() => api<RegisterData>(path), path);
  // While another class/day loads, the previous register must not be shown or edited
  const data = loaded && loaded.date === date && loaded.grade === grade && loaded.section === section ? loaded : null;

  // Local edits on top of the saved register, keyed by student id
  const [edits, setEdits] = useState<Record<string, Mark>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [loadedPath, setLoadedPath] = useState(path);
  const [notifying, setNotifying] = useState(false);
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const canMessage = role === "owner" || role === "admin" || role === "teacher";

  // A different class or day starts with a clean slate (reset during render, not in an effect)
  if (loadedPath !== path) {
    setLoadedPath(path);
    setEdits({});
    setOpenNote(null);
    setMessage(null);
  }

  const saved = useMemo(() => {
    const out: Record<string, Mark> = {};
    for (const s of data?.students ?? []) if (s.attendance) out[s.id] = s.attendance;
    return out;
  }, [data]);

  const current = (id: string): Mark | undefined => edits[id] ?? saved[id];
  const changed = Object.entries(edits).filter(([id, m]) => saved[id]?.status !== m.status || (saved[id]?.note ?? "") !== m.note);
  const dirty = changed.length > 0;
  const canEdit = Boolean(data?.canEdit);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // Warn before closing the tab with unsaved marks
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
    for (const s of data?.students ?? []) {
      const m = edits[s.id] ?? saved[s.id];
      if (m) c[m.status] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [data, edits, saved]);

  function setStatus(id: string, status: AttendanceStatus) {
    if (!canEdit) return;
    setMessage(null);
    setEdits((e) => ({ ...e, [id]: { status, note: (e[id] ?? saved[id])?.note ?? "" } }));
    if (status === "present") setOpenNote((n) => (n === id ? null : n));
  }

  function setNote(id: string, note: string) {
    setEdits((e) => {
      const base = e[id] ?? saved[id];
      return base ? { ...e, [id]: { ...base, note } } : e;
    });
  }

  /** Everyone without a mark becomes present; existing marks are kept. */
  function markRemainingPresent() {
    setMessage(null);
    setEdits((e) => {
      const next = { ...e };
      for (const s of data?.students ?? []) if (!(next[s.id] ?? saved[s.id])) next[s.id] = { status: "present", note: "" };
      return next;
    });
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api<RegisterData>("/api/attendance/register", {
        method: "PUT",
        body: {
          date,
          grade,
          section,
          entries: changed.map(([studentId, m]) => ({ studentId, status: m.status, note: m.note.trim() })),
        },
      });
      setData(res);
      setEdits({});
      setOpenNote(null);
      setMessage({ tone: "success", text: `Attendance saved for ${res.summary.marked} of ${res.summary.total} students.` });
      onSaved();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  // Desktop shortcuts: P / A / L / V on a focused row, then move to the next row
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  function onRowKey(e: React.KeyboardEvent, index: number, id: string) {
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
    const status = ATTENDANCE_STATUSES.find((s) => STATUS_META[s].key === e.key.toLowerCase());
    if (status) {
      e.preventDefault();
      setStatus(id, status);
      rowRefs.current[index + 1]?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      rowRefs.current[index + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
  }

  const back = () => {
    if (dirty && !confirm("You have unsaved attendance. Leave without saving?")) return;
    onBack();
  };

  // Parents to alert: students whose *saved* mark is absent or late
  const alertable = (data?.students ?? []).filter((st) => st.attendance && (st.attendance.status === "absent" || st.attendance.status === "late"));

  const total = data?.students.length ?? 0;
  const marked = total - counts.unmarked;

  return (
    <div className={cx(canEdit && "pb-28")}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="secondary" size="icon" aria-label="Back to classes" onClick={back}>
          <Icon d={ICONS.chevronLeft} />
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Class {className(grade, section)}</h2>
          <p className="truncate text-sm text-muted">{formatDay(date)}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {ATTENDANCE_STATUSES.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className={cx("size-2.5 rounded-full", STATUS_META[s].dot)} />
                    <span className="tabular-nums font-medium">{counts[s]}</span>
                    <span className="text-muted">{STATUS_META[s].label}</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full border border-border" />
                  <span className="tabular-nums font-medium">{counts.unmarked}</span>
                  <span className="text-muted">Unmarked</span>
                </span>
              </div>
              {canEdit && counts.unmarked > 0 && (
                <Button variant="secondary" size="sm" onClick={markRemainingPresent}>
                  <Icon d="M5 12l5 5L20 7" />
                  {marked === 0 ? "Mark everyone present" : `Mark remaining ${counts.unmarked} present`}
                </Button>
              )}
            </div>
            <StatusBar counts={counts} total={total} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-muted">
              {marked} of {total} marked
              {data.lastMarked && (
                <>
                  {" "}
                  · Last saved {formatDate(data.lastMarked.at, true)}
                  {data.lastMarked.by && ` by ${data.lastMarked.by}`}
                </>
              )}
            </p>
          </div>

          {!canEdit && data.reason && (
            <div className="mb-4">
              <Alert tone="warning">{data.reason}</Alert>
            </div>
          )}
          {message && (
            <div className="mb-4">
              <Alert tone={message.tone}>{message.text}</Alert>
            </div>
          )}

          {canMessage && alertable.length > 0 && !dirty && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-sm">
                <span className="font-medium">
                  {alertable.filter((a) => a.attendance?.status === "absent").length} absent
                  {alertable.some((a) => a.attendance?.status === "late") && `, ${alertable.filter((a) => a.attendance?.status === "late").length} late`}
                </span>
                <span className="text-muted"> · let their parents know</span>
              </p>
              <WhatsAppButton size="sm" onClick={() => setNotifying(true)}>
                Notify parents
              </WhatsAppButton>
            </div>
          )}
          {notifying && (
            <WhatsAppDrawer
              type="absence"
              refs={alertable.map((st) => ({ studentId: st.id, date }))}
              title={`Absence alerts · Class ${className(grade, section)}`}
              description={formatDay(date)}
              onClose={() => setNotifying(false)}
            />
          )}

          {total === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
              No active students in this class.
            </div>
          ) : (
            <>
              {canEdit && (
                <p className="mb-2 hidden text-xs text-muted lg:block">
                  Tip: click a row, then press <Kbd>P</Kbd> <Kbd>A</Kbd> <Kbd>L</Kbd> or <Kbd>V</Kbd> (leave). It moves to the next student.
                </p>
              )}
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {data.students.map((s, index) => {
                  const mark = current(s.id);
                  const isChanged = changed.some(([id]) => id === s.id);
                  const noteOpen = openNote === s.id || Boolean(mark?.note && mark.status !== "present");
                  return (
                    <li key={s.id}>
                      <div
                        ref={(el) => {
                          rowRefs.current[index] = el;
                        }}
                        tabIndex={canEdit ? 0 : -1}
                        onKeyDown={(e) => onRowKey(e, index, s.id)}
                        className={cx(
                          "flex flex-col gap-3 px-4 py-3 outline-none focus-visible:bg-accent-soft/50 sm:flex-row sm:items-center",
                          isChanged && "bg-warning-soft/40"
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="w-7 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{s.rollNo || "–"}</span>
                          <Avatar name={s.fullName} seed={s.id} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium">
                              {s.fullName}
                              {!s.current && <Badge>moved / left</Badge>}
                            </p>
                            <p className="truncate font-mono text-xs text-muted">{s.admissionNo}</p>
                          </div>
                          {canEdit && mark && mark.status !== "present" && !noteOpen && (
                            <button
                              onClick={() => setOpenNote(s.id)}
                              className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline sm:hidden"
                            >
                              Add note
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {canEdit && mark && mark.status !== "present" && !noteOpen && (
                            <button
                              onClick={() => setOpenNote(s.id)}
                              className="hidden shrink-0 px-1 text-xs font-medium text-accent hover:underline sm:block"
                            >
                              Add note
                            </button>
                          )}
                          <div role="radiogroup" aria-label={`Attendance for ${s.fullName}`} className="grid flex-1 grid-cols-4 gap-1.5 sm:flex sm:flex-none">
                            {ATTENDANCE_STATUSES.map((st) => {
                              const selected = mark?.status === st;
                              return (
                                <button
                                  key={st}
                                  role="radio"
                                  aria-checked={selected}
                                  disabled={!canEdit}
                                  tabIndex={-1}
                                  title={`${STATUS_META[st].label} (${STATUS_META[st].key.toUpperCase()})`}
                                  onClick={() => setStatus(s.id, st)}
                                  className={cx(
                                    "h-10 rounded-lg border text-sm font-medium transition-colors sm:w-20",
                                    selected
                                      ? STATUS_META[st].selected
                                      : "border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground disabled:hover:bg-surface",
                                    !canEdit && !selected && "opacity-40"
                                  )}
                                >
                                  {STATUS_META[st].label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {mark && mark.status !== "present" && noteOpen && (
                        <div className="px-4 pb-3 sm:pl-24">
                          <input
                            value={mark.note}
                            onChange={(e) => setNote(s.id, e.target.value)}
                            disabled={!canEdit}
                            maxLength={200}
                            placeholder={mark.status === "leave" ? "Reason for leave" : mark.status === "late" ? "Arrived at / reason" : "Reason (optional)"}
                            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Save bar */}
          {canEdit && total > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:left-60">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
                <div className="min-w-0 text-sm">
                  {dirty ? (
                    <span className="font-medium">
                      {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-muted">{counts.unmarked ? `${counts.unmarked} still unmarked` : "All students marked"}</span>
                  )}
                  <span className="hidden text-muted sm:inline"> · {formatRate(rateOf(counts))} attendance</span>
                </div>
                <div className="flex shrink-0 gap-2">
                  {dirty && (
                    <Button variant="ghost" onClick={() => setEdits({})} disabled={saving}>
                      Discard
                    </Button>
                  )}
                  <Button onClick={save} loading={saving} disabled={!dirty} className="min-w-36">
                    Save attendance
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function rateOf(c: { present: number; late: number; absent: number }) {
  const counted = c.present + c.late + c.absent;
  return counted ? Math.round(((c.present + c.late) / counted) * 1000) / 10 : null;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{children}</kbd>;
}
