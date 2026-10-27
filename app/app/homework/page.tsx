"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer, PageHeader, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { WA_ICON, WhatsAppDrawer } from "@/components/whatsapp-send";
import { loadClassList, type SchoolClass } from "@/lib/academics";
import { api } from "@/lib/api";
import { addDays, formatDay, localToday } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { NAV_ICONS, type Homework } from "@/lib/classroom";
import { classText, loadMyClasses, subjectsIn, teaches, type MyClasses } from "@/lib/teaching";
import { ClassSelect, SubjectChip } from "@/components/academic-bits";
import { Syllabus } from "./_components/syllabus";

/** Monday of the week containing `day`. */
const weekStart = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

export default function HomeworkPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const [tab, setTab] = useState<"diary" | "syllabus">("diary");
  if (role === "accountant") return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">Homework is for teachers and admins.</p>;

  return (
    <div>
      <PageHeader icon={NAV_ICONS.homework} title="Homework" description="The class diary: what was given, what's due, and how far each class has got in the syllabus." />
      <div role="tablist" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {(
          [
            ["diary", "Diary"],
            ["syllabus", "Syllabus progress"],
          ] as const
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors", tab === t ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "diary" ? (
        <Suspense fallback={null}>
          <Diary />
        </Suspense>
      ) : (
        <Syllabus />
      )}
    </div>
  );
}

function Diary() {
  const { session } = useAuth();
  const me = session.status === "authenticated" ? session : null;
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const my = useResource(loadMyClasses, "my-classes");
  const [week, setWeek] = useState(() => weekStart(localToday()));
  const [onlyMine, setOnlyMine] = useState(true);
  const [cls, setCls] = useState("");
  // undefined = closed, null = new
  // Opened from search ("Give homework") with ?new=1
  const params = useSearchParams();
  const router = useRouter();
  const [editing, setEditing] = useState<Homework | null | undefined>(() => (params.get("new") === "1" ? null : undefined));
  // "Give homework" from search while already on this page
  const [seenNew, setSeenNew] = useState(params.get("new"));
  if (seenNew !== params.get("new")) {
    setSeenNew(params.get("new"));
    if (params.get("new") === "1") setEditing(null);
  }
  const [sending, setSending] = useState<{ hw: Homework; studentIds: string[] } | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Drop ?new=1 so a reload doesn't open the form again
  useEffect(() => {
    if (params.get("new") === "1") router.replace("/app/homework", { scroll: false });
  }, [params, router]);

  const to = addDays(week, 6);
  const [grade, section] = cls ? cls.split("|") : ["", ""];
  const limited = Boolean(my.data?.limited);
  const path = `/api/homework?from=${week}&to=${to}${grade ? `&grade=${encodeURIComponent(grade)}${section ? `&section=${encodeURIComponent(section)}` : ""}` : ""}${limited && onlyMine ? "&mine=1" : ""}`;
  const list = useResource(() => api<{ homework: Homework[] }>(path), path);
  const items = list.data?.homework ?? [];
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => items.some((h) => h.date === d) || d === localToday());

  async function openSend(hw: Homework) {
    try {
      const r = await api<{ students: { id: string }[] }>(`/api/homework/${hw.id}`);
      setSending({ hw, studentIds: r.students.map((s) => s.id) });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function remove(hw: Homework) {
    if (!confirm(`Delete “${hw.title}”?`)) return;
    try {
      await api(`/api/homework/${hw.id}`, { method: "DELETE" });
      list.reload();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  const classOptions = limited && onlyMine ? (my.data?.classes ?? []).map((c) => ({ v: `${c.grade}|${c.section}`, label: classText(c.grade, c.section) })) : null;

  return (
    <div className="space-y-5">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" aria-label="Previous week" onClick={() => setWeek((w) => addDays(w, -7))}>
            <Icon d={ICONS.chevronLeft} />
          </Button>
          <div className="min-w-44 rounded-lg border border-border bg-surface px-3 py-2 text-center text-sm">
            <span className="font-medium">{formatDay(week, "short")}</span> – {formatDay(to, "short")}
          </div>
          <Button variant="secondary" size="icon" aria-label="Next week" onClick={() => setWeek((w) => addDays(w, 7))}>
            <Icon d={ICONS.chevronRight} />
          </Button>
          {week !== weekStart(localToday()) && (
            <Button variant="ghost" size="sm" onClick={() => setWeek(weekStart(localToday()))}>
              This week
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {limited && (
            <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
              {([true, false] as const).map((v) => (
                <button key={String(v)} onClick={() => { setOnlyMine(v); setCls(""); }} aria-pressed={onlyMine === v} className={cx("rounded-md px-3 py-1.5", onlyMine === v ? "bg-surface-muted font-medium" : "text-muted")}>
                  {v ? "My classes" : "All classes"}
                </button>
              ))}
            </div>
          )}
          <ClassSelect value={cls} onChange={setCls} only={classOptions} />
          <Button onClick={() => setEditing(null)}>
            <Icon d={ICONS.plus} />
            Give homework
          </Button>
        </div>
      </div>

      {list.error ? (
        <Alert>{list.error}</Alert>
      ) : !list.data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Icon d={NAV_ICONS.homework} className="size-6" />
          </span>
          <p className="mt-3 font-medium">No homework this week</p>
          <p className="mt-1 text-sm text-muted">Give homework and send it to parents on WhatsApp in one go.</p>
          <Button className="mt-4" onClick={() => setEditing(null)}>
            <Icon d={ICONS.plus} />
            Give homework
          </Button>
        </div>
      ) : (
        <ol className="space-y-6">
          {days.map((d) => {
            const dayItems = items.filter((h) => h.date === d);
            return (
              <li key={d}>
                <div className="mb-2 flex items-center gap-3">
                  <span className={cx("grid size-10 place-items-center rounded-xl text-center leading-none", d === localToday() ? "bg-accent text-accent-foreground" : "bg-surface-muted")}>
                    <span>
                      <span className="block text-sm font-bold">{d.slice(8)}</span>
                      <span className="block text-[9px] uppercase">{formatDay(d, "short").slice(0, 3)}</span>
                    </span>
                  </span>
                  <p className="text-sm font-medium">{d === localToday() ? "Today" : formatDay(d)}</p>
                  <span className="h-px flex-1 bg-border" />
                </div>
                {dayItems.length === 0 ? (
                  <p className="pl-[52px] text-sm text-muted">Nothing given yet today.</p>
                ) : (
                  <ul className="grid gap-3 pl-0 sm:pl-[52px] lg:grid-cols-2">
                    {dayItems.map((h) => {
                      const mine = h.createdBy === me?.user.id;
                      return (
                        <li key={h.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <SubjectChip name={h.subject} />
                              <Badge>Class {classText(h.grade, h.section)}</Badge>
                            </div>
                            {(mine || isAdmin) && (
                              <div className="flex shrink-0 gap-1">
                                <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(h)}>
                                  <Icon d={ICONS.edit} />
                                </Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(h)}>
                                  <Icon d={ICONS.x} />
                                </Button>
                              </div>
                            )}
                          </div>
                          <p className="mt-2 font-semibold">{h.title}</p>
                          {h.details && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{h.details}</p>}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
                            <span>
                              {h.dueDate ? (
                                <>
                                  Due <span className={cx("font-medium", h.dueDate <= localToday() ? "text-warning" : "text-foreground")}>{formatDay(h.dueDate, "short")}</span>
                                </>
                              ) : (
                                "Due next class"
                              )}
                              {h.createdByName && ` · ${h.createdByName}`}
                            </span>
                            <span className="flex gap-1.5">
                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(groupText(h))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 font-medium text-foreground hover:bg-surface-muted"
                                title="Share with the class's parents group"
                              >
                                Group
                              </a>
                              <button onClick={() => openSend(h)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#128c4a] px-2.5 font-medium text-white hover:bg-[#0f7a40]">
                                <Icon d={WA_ICON} className="size-3.5" />
                                Parents
                              </button>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {editing !== undefined && (
        <HomeworkEditor
          hw={editing}
          my={my.data ?? null}
          onClose={() => setEditing(undefined)}
          onSaved={(hw, isNew) => {
            setEditing(undefined);
            list.reload();
            setMessage({ tone: "success", text: isNew ? `Homework posted for Class ${classText(hw.grade, hw.section)}.` : "Homework updated." });
            if (isNew && confirm("Send this homework to the parents on WhatsApp now?")) openSend(hw);
          }}
        />
      )}

      {sending && (
        <WhatsAppDrawer
          type="homework"
          refs={sending.studentIds.map((studentId) => ({ homeworkId: sending.hw.id, studentId }))}
          title={`Send homework to parents`}
          description={`${sending.hw.subject}: ${sending.hw.title} · Class ${classText(sending.hw.grade, sending.hw.section)}`}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  );
}

function groupText(h: Homework) {
  return [`📚 *Homework · Class ${classText(h.grade, h.section)}*`, `_${formatDay(h.date)}_`, "", `*${h.subject}:* ${h.title}`, ...(h.details ? ["", h.details] : []), "", `🗓️ Due: ${h.dueDate ? formatDay(h.dueDate) : "next class"}`].join("\n");
}

function HomeworkEditor({ hw, my, onClose, onSaved }: { hw: Homework | null; my: MyClasses | null; onClose: () => void; onSaved: (hw: Homework, isNew: boolean) => void }) {
  const classList = useResource(loadClassList, "academics-classes");
  const first = my?.limited ? my.classes[0] : undefined;
  const [grade, setGrade] = useState(hw?.grade ?? first?.grade ?? "");
  const [section, setSection] = useState(hw?.section ?? first?.section ?? "");
  const [subject, setSubject] = useState(hw?.subject ?? "");
  const [title, setTitle] = useState(hw?.title ?? "");
  const [details, setDetails] = useState(hw?.details ?? "");
  const [date, setDate] = useState(hw?.date ?? localToday());
  const [dueDate, setDueDate] = useState(hw?.dueDate ?? addDays(localToday(), 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes: SchoolClass[] = (classList.data?.classes ?? []).filter((c) => teaches(my, c.name));
  const cls = classes.find((c) => c.name === grade);
  const allowed = subjectsIn(my, grade, section);
  const subjects = (cls?.subjects.map((s) => s.name) ?? []).filter((s) => !allowed || allowed.some((a) => a.toLowerCase() === s.toLowerCase()));
  const sections = (cls?.sections ?? []).filter((s) => teaches(my, grade, s));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { subject, title: title.trim(), details: details.trim(), date, dueDate: dueDate || null };
      const res = hw
        ? await api<{ homework: Homework }>(`/api/homework/${hw.id}`, { method: "PATCH", body })
        : await api<{ homework: Homework }>("/api/homework", { method: "POST", body: { ...body, grade, section } });
      onSaved(res.homework, !hw);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={hw ? "Edit homework" : "Give homework"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!grade || !subject.trim() || title.trim().length < 2}>
            {hw ? "Save" : "Post homework"}
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Class" htmlFor="hw-grade">
          <Select id="hw-grade" value={grade} disabled={Boolean(hw)} onChange={(e) => { setGrade(e.target.value); setSection(""); setSubject(""); }}>
            <option value="">Choose…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section" htmlFor="hw-section">
          <Select id="hw-section" value={section} disabled={Boolean(hw) || !sections.length} onChange={(e) => setSection(e.target.value)}>
            {(!my?.limited || teaches({ ...my, classes: my.classes.filter((c) => !c.section) }, grade)) && <option value="">All sections</option>}
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Subject" htmlFor="hw-subject" hint={subjects.length ? undefined : "Add subjects to this class in Settings → Classes, or type one."}>
        {subjects.length ? (
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <button key={s} type="button" onClick={() => setSubject(s)} aria-pressed={subject === s} className={cx("rounded-full border px-3 py-1 text-sm transition-colors", subject === s ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:bg-surface-muted")}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <Input id="hw-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
        )}
      </Field>
      <Field label="Homework" htmlFor="hw-title">
        <Input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Exercise 4.2, questions 1 to 10" />
      </Field>
      <Field label="Details" htmlFor="hw-details" hint="Optional: instructions, pages, what to bring.">
        <textarea id="hw-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={4} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Given on" htmlFor="hw-date">
          <Input id="hw-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label="Due" htmlFor="hw-due">
          <Input id="hw-due" type="date" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
