"use client";

import { useEffect, useState } from "react";
import { SubjectChip } from "@/components/academic-bits";
import { Drawer, PageHeader, errorMessage, useResource } from "@/components/data";
import { Alert, Button, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { loadClassList } from "@/lib/academics";
import { api } from "@/lib/api";
import { localToday } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { DAYS, DAY_NAMES, NAV_ICONS, weekdayOf, type Slot } from "@/lib/classroom";
import type { Member } from "@/lib/school";
import { classText, loadMyClasses, type AllAssignments } from "@/lib/teaching";

const nowHHMM = () => new Date().toTimeString().slice(0, 5);

export default function TimetablePage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const isAdmin = role === "owner" || role === "admin";
  const my = useResource(loadMyClasses, "my-classes");
  const classList = useResource(loadClassList, "academics-classes");
  const [view, setView] = useState<"mine" | "class">(isAdmin ? "class" : "mine");
  const [cls, setCls] = useState("");
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(nowHHMM);

  useEffect(() => {
    const id = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Default class: the teacher's first class, or the first class of the school
  const options = (classList.data?.classes ?? []).flatMap((c) => (c.sections.length ? c.sections.map((s) => ({ v: `${c.name}|${s}`, label: `${c.name} - ${s}` })) : [{ v: `${c.name}|`, label: `Class ${c.name}` }]));
  const firstMine = my.data?.limited ? my.data.classes[0] : undefined;
  const fallback = firstMine ? `${firstMine.grade}|${firstMine.section || (classList.data?.classes.find((c) => c.name === firstMine.grade)?.sections[0] ?? "")}` : (options[0]?.v ?? "");
  const current = cls || fallback;
  const [grade, section] = current.split("|");

  const path = view === "mine" ? "/api/timetable?mine=1" : grade ? `/api/timetable?grade=${encodeURIComponent(grade)}&section=${encodeURIComponent(section ?? "")}` : null;
  const data = useResource(() => (path ? api<{ slots: Slot[] }>(path) : Promise.resolve({ slots: [] as Slot[] })), path ?? "none");
  const slots = data.data?.slots ?? [];

  if (role === "accountant") return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">The timetable is for teachers and admins.</p>;

  return (
    <div>
      <PageHeader
        icon={NAV_ICONS.timetable}
        title="Timetable"
        description={view === "mine" ? "Your periods this week. Today is highlighted." : "The weekly timetable of a class."}
        actions={
          isAdmin &&
          view === "class" &&
          grade && (
            <Button onClick={() => setEditing(true)}>
              <Icon d={ICONS.edit} />
              Edit timetable
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {(
            [
              ["mine", "My week"],
              ["class", "Class timetable"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cx("rounded-md px-3 py-1.5", view === v ? "bg-surface-muted font-medium" : "text-muted")}>
              {label}
            </button>
          ))}
        </div>
        {view === "class" && (
          <Select aria-label="Class" value={current} onChange={(e) => setCls(e.target.value)} className="h-9 w-40 text-sm">
            {options.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {data.error ? (
        <Alert>{data.error}</Alert>
      ) : !data.data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon d={NAV_ICONS.timetable} className="size-6" />
          </span>
          <p className="mt-3 font-medium">{view === "mine" ? "No periods assigned to you yet" : `No timetable for Class ${classText(grade, section)} yet`}</p>
          <p className="mt-1 text-sm text-muted">{isAdmin ? "Build it once and teachers see their day on the dashboard." : "An admin sets up the timetable in this page."}</p>
          {isAdmin && view === "class" && grade && (
            <Button className="mt-4" onClick={() => setEditing(true)}>
              <Icon d={ICONS.plus} />
              Build timetable
            </Button>
          )}
        </div>
      ) : (
        <WeekGrid slots={slots} showClass={view === "mine"} now={now} />
      )}

      {editing && grade && (
        <TimetableEditor
          grade={grade}
          section={section ?? ""}
          slots={slots.filter((s) => s.section === (section ?? ""))}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            data.reload();
          }}
        />
      )}
    </div>
  );
}

/** Days across, periods down. Today's column and the period in progress stand out. */
function WeekGrid({ slots, showClass, now }: { slots: Slot[]; showClass: boolean; now: string }) {
  const today = weekdayOf(localToday());
  const days = Array.from(new Set([1, 2, 3, 4, 5, 6, ...slots.map((s) => s.day)])).sort();
  const times = Array.from(new Map(slots.map((s) => [`${s.start}-${s.end}`, { start: s.start, end: s.end }])).values()).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-24 border-b border-border px-3 py-3 text-left text-xs font-medium text-muted">Time</th>
            {days.map((d) => (
              <th key={d} className={cx("border-b border-l border-border px-3 py-3 text-left text-xs font-semibold", d === today ? "bg-accent-soft text-accent" : "text-muted")}>
                {DAYS[d - 1]}
                {d === today && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">Today</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => {
            const live = now >= t.start && now < t.end;
            return (
              <tr key={`${t.start}-${t.end}`}>
                <td className="border-b border-border px-3 py-2 align-top text-xs tabular-nums text-muted">
                  <span className={cx(live && "font-semibold text-accent")}>{t.start}</span>
                  <span className="block">{t.end}</span>
                </td>
                {days.map((d) => {
                  const here = slots.filter((s) => s.day === d && s.start === t.start && s.end === t.end);
                  const isNow = live && d === today;
                  return (
                    <td key={d} className={cx("border-b border-l border-border p-1.5 align-top", d === today && "bg-accent-soft/40")}>
                      {here.map((s) => (
                        <div key={s.id} className={cx("rounded-lg border p-2", isNow ? "border-accent bg-surface shadow-md ring-2 ring-accent/20" : "border-transparent bg-surface-muted/60")}>
                          <div className="flex items-center justify-between gap-1">
                            <SubjectChip name={s.subject} />
                            {isNow && <span className="text-[10px] font-semibold uppercase text-accent">Now</span>}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">{showClass ? `Class ${classText(s.grade, s.section)}` : s.teacherName || "No teacher set"}</p>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Cell = { subject: string; teacherId: string };

function defaultPeriods() {
  // 8 periods of 40 minutes from 8:00 with a 20-minute break after the 4th
  const out: { start: string; end: string }[] = [];
  let m = 8 * 60;
  for (let i = 0; i < 8; i++) {
    if (i === 4) m += 20;
    const fmt = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
    out.push({ start: fmt(m), end: fmt(m + 40) });
    m += 40;
  }
  return out;
}

/** A grid of periods × days; each cell picks a subject and its teacher. */
function TimetableEditor({ grade, section, slots, onClose, onSaved }: { grade: string; section: string; slots: Slot[]; onClose: () => void; onSaved: () => void }) {
  const classList = useResource(loadClassList, "academics-classes");
  const team = useResource(() => api<{ members: Member[] }>("/api/school/members"), "school-members");
  const assignments = useResource(() => api<AllAssignments>("/api/teaching/assignments"), "teaching-assignments");
  const existing = Array.from(new Map(slots.map((s) => [`${s.start}-${s.end}`, { start: s.start, end: s.end }])).values()).sort((a, b) => a.start.localeCompare(b.start));
  const [periods, setPeriods] = useState(existing.length ? existing : defaultPeriods());
  const [days, setDays] = useState(() => (slots.some((s) => s.day === 6) || !slots.length ? 6 : 5));
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const out: Record<string, Cell> = {};
    for (const s of slots) {
      const pi = (existing.length ? existing : defaultPeriods()).findIndex((p) => p.start === s.start && p.end === s.end);
      if (pi >= 0) out[`${s.day}|${pi}`] = { subject: s.subject, teacherId: s.teacherId ?? "" };
    }
    return out;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjects = classList.data?.classes.find((c) => c.name === grade)?.subjects.map((s) => s.name) ?? [];
  const teachers = (team.data?.members ?? []).filter((m) => m.role !== "accountant");
  /** The teacher assigned to a subject in this class, if any. */
  const teacherFor = (subject: string) =>
    assignments.data?.teachers.find((t) => t.classes.some((c) => c.grade === grade && (!c.section || c.section === section) && c.subjects.some((x) => x.toLowerCase() === subject.toLowerCase())))?.userId ?? "";

  const setCell = (key: string, patch: Partial<Cell>) =>
    setCells((m) => {
      const next = { ...(m[key] ?? { subject: "", teacherId: "" }), ...patch };
      if (patch.subject !== undefined && !m[key]?.teacherId) next.teacherId = teacherFor(patch.subject);
      return { ...m, [key]: next };
    });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const out = Object.entries(cells)
        .filter(([key, c]) => c.subject && Number(key.split("|")[0]) <= days && Number(key.split("|")[1]) < periods.length)
        .map(([key, c]) => {
          const [d, pi] = key.split("|").map(Number);
          return { day: d, start: periods[pi].start, end: periods[pi].end, subject: c.subject, teacherId: c.teacherId || null };
        });
      await api("/api/timetable", { method: "PUT", body: { grade, section, slots: out } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`Timetable · Class ${classText(grade, section)}`}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={days === 6} onChange={(e) => setDays(e.target.checked ? 6 : 5)} className="size-4 accent-[var(--accent)]" />
            Saturday is a school day
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save timetable
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {subjects.length === 0 && <Alert tone="warning">Add subjects to Class {grade} in Settings → Classes &amp; subjects first.</Alert>}
      <p className="text-sm text-muted">Pick a subject for each period. The teacher fills in from Settings → Team when a subject teacher is assigned.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-56 px-2 pb-2 text-left text-xs font-medium text-muted">Period</th>
              {Array.from({ length: days }, (_, i) => (
                <th key={i} className="px-1 pb-2 text-left text-xs font-medium text-muted">
                  {DAY_NAMES[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, pi) => (
              <tr key={pi} className="border-t border-border">
                <td className="px-2 py-2 align-top">
                  <div className="flex items-center gap-1">
                    <Input aria-label={`Period ${pi + 1} start`} type="time" value={p.start} onChange={(e) => setPeriods((l) => l.map((x, k) => (k === pi ? { ...x, start: e.target.value } : x)))} className="h-8 w-[6.75rem] px-1.5 text-xs" />
                    <Input aria-label={`Period ${pi + 1} end`} type="time" value={p.end} onChange={(e) => setPeriods((l) => l.map((x, k) => (k === pi ? { ...x, end: e.target.value } : x)))} className="h-8 w-[6.75rem] px-1.5 text-xs" />
                  </div>
                  <button onClick={() => setPeriods((l) => l.filter((_, k) => k !== pi))} className="mt-1 text-[11px] text-muted hover:text-danger">
                    Remove period
                  </button>
                </td>
                {Array.from({ length: days }, (_, i) => {
                  const key = `${i + 1}|${pi}`;
                  const c = cells[key];
                  return (
                    <td key={i} className="px-1 py-2 align-top">
                      <Select aria-label={`${DAY_NAMES[i]} period ${pi + 1} subject`} value={c?.subject ?? ""} onChange={(e) => setCell(key, { subject: e.target.value })} className={cx("h-8 w-full px-2 text-xs", c?.subject && "border-accent/40 bg-accent-soft/40")}>
                        <option value="">Free</option>
                        {subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                      {c?.subject && (
                        <Select aria-label={`${DAY_NAMES[i]} period ${pi + 1} teacher`} value={c.teacherId} onChange={(e) => setCell(key, { teacherId: e.target.value })} className="mt-1 h-7 w-full px-2 text-[11px]">
                          <option value="">Teacher…</option>
                          {teachers.map((t) => (
                            <option key={t.userId} value={t.userId}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          setPeriods((l) => {
            const last = l[l.length - 1];
            const [h, m] = (last?.end ?? "08:00").split(":").map(Number);
            const start = h * 60 + m;
            const fmt = (x: number) => `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
            return [...l, { start: fmt(start), end: fmt(start + 40) }];
          })
        }
      >
        <Icon d={ICONS.plus} />
        Add period
      </Button>
    </Drawer>
  );
}
