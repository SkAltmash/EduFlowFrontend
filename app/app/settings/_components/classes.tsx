"use client";

import { useState } from "react";
import { Drawer, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { CLASS_TEMPLATES, loadClassList, parseSections, type ClassList, type SchoolClass } from "@/lib/academics";
import { api } from "@/lib/api";
import { SettingsCard } from "./card";

type Message = { tone: "success" | "danger"; text: string } | null;

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w.endsWith("s") ? `${w}es` : `${w}s`}`;

export function ClassesSettings() {
  const list = useResource(loadClassList, "academics-classes");
  // undefined = closed, null = new class
  const [editing, setEditing] = useState<SchoolClass | null | undefined>(undefined);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<ClassList & Record<string, unknown>>, success: (r: ClassList & Record<string, unknown>) => string) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await action();
      list.setData(res);
      setMessage({ tone: "success", text: success(res) });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function move(index: number, by: -1 | 1) {
    const classes = list.data!.classes;
    const ids = classes.map((c) => c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    // Show the new order at once; the server answer confirms it
    list.setData({ ...list.data!, classes: ids.map((id) => classes.find((c) => c.id === id)!) });
    try {
      list.setData(await api<ClassList>("/api/academics/classes/order", { method: "PUT", body: { ids } }));
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
      list.reload();
    }
  }

  if (list.error) return <Alert>{list.error}</Alert>;
  if (!list.data) return <Skeleton className="h-96 rounded-2xl" />;
  const { classes, unknown, strays, unassigned } = list.data;
  const totalStudents = classes.reduce((n, c) => n + c.students, 0);

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Classes & subjects"
        description="Your classes in order, lowest first. Promotion moves students to the next class down this list."
        action={
          classes.length > 0 && (
            <Button size="sm" onClick={() => setEditing(null)}>
              <Icon d={ICONS.plus} />
              Add class
            </Button>
          )
        }
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        {classes.length === 0 ? (
          <GetStarted
            unknown={unknown}
            busy={busy}
            onSetup={() =>
              run("setup", () => api("/api/academics/classes/setup-from-students", { method: "POST" }), (r) => {
                const created = (r.created as string[]).length;
                const renamed = (r.renamed as unknown[]).length;
                return `Created ${plural(created, "class")} from your students${renamed ? ` and combined ${plural(renamed, "other spelling")} into them` : ""}.`;
              })
            }
            onTemplate={(names, sections) =>
              run("template", () => api("/api/academics/classes/bulk", { method: "POST", body: { names, sections } }), (r) => `Added ${plural(r.created as number, "class")}.`)
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded-full bg-surface-muted px-2.5 py-1">
                <span className="font-semibold text-foreground">{classes.length}</span> classes
              </span>
              <span className="rounded-full bg-surface-muted px-2.5 py-1">
                <span className="font-semibold text-foreground">{totalStudents}</span> active students
              </span>
              {unassigned > 0 && (
                <span className="rounded-full bg-warning-soft px-2.5 py-1 text-warning">
                  <span className="font-semibold">{unassigned}</span> without a class
                </span>
              )}
            </div>

            <ol className="-mx-5 divide-y divide-border border-y border-border">
              {classes.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex flex-col">
                    <button aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="grid h-4 w-6 place-items-center text-muted hover:text-foreground disabled:opacity-25">
                      <Icon d="M7 14l5-5 5 5" className="size-3.5" />
                    </button>
                    <button aria-label={`Move ${c.name} down`} disabled={i === classes.length - 1} onClick={() => move(i, 1)} className="grid h-4 w-6 place-items-center text-muted hover:text-foreground disabled:opacity-25">
                      <Icon d="M7 10l5 5 5-5" className="size-3.5" />
                    </button>
                  </div>
                  <button onClick={() => setEditing(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-accent-soft px-2 text-sm font-semibold text-accent">{c.name}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {c.sections.length ? (
                          c.sections.map((s) => (
                            <span key={s} className="rounded-md border border-border px-1.5 py-0.5 text-xs">
                              {s} <span className="text-muted">{c.sectionCounts[s] ?? 0}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted">No sections</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {plural(c.students, "student")} · {c.subjects.length ? c.subjects.map((s) => s.name).join(", ") : "no subjects yet"}
                      </span>
                    </span>
                    <Icon d={ICONS.chevronRight} className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </SettingsCard>

      {(unknown.length > 0 || strays.length > 0) && classes.length > 0 && (
        <FixCard
          list={list.data}
          busy={busy}
          onMerge={(from, to) =>
            run(`merge:${from.grade}|${from.section ?? ""}`, () => api("/api/academics/classes/merge", { method: "POST", body: { from, to } }), (r) => `Moved ${plural(r.moved as number, "student")}. Attendance, tests and fees moved with them.`)
          }
          onAddSection={(cls, section) =>
            run(`add:${cls.id}|${section}`, () => api(`/api/academics/classes/${cls.id}`, { method: "PATCH", body: { sections: [...cls.sections, section] } }), () => `Added section ${section} to class ${cls.name}.`)
          }
        />
      )}

      {editing !== undefined && (
        <ClassEditor
          cls={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(res, text) => {
            list.setData(res);
            setMessage({ tone: "success", text });
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

function GetStarted({ unknown, busy, onSetup, onTemplate }: { unknown: ClassList["unknown"]; busy: string | null; onSetup: () => void; onTemplate: (names: string[], sections: string[]) => void }) {
  const [template, setTemplate] = useState(CLASS_TEMPLATES[0].id);
  const [sections, setSections] = useState("A");
  const found = unknown.reduce((n, u) => n + u.students, 0);
  const chosen = CLASS_TEMPLATES.find((t) => t.id === template)!;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {unknown.length > 0 && (
        <div className="flex flex-col rounded-xl border border-accent/40 bg-accent-soft/40 p-4">
          <span className="self-start">
            <Badge tone="accent">Recommended</Badge>
          </span>
          <p className="mt-2 font-medium">Set up from your students</p>
          <p className="mt-1 text-sm text-muted">
            Your {plural(found, "student")} use {plural(unknown.length, "class name")}:{" "}
            <span className="text-foreground">{unknown.slice(0, 6).map((u) => u.grade).join(", ")}{unknown.length > 6 ? "…" : ""}</span>. Different spellings of the same class (like “Class 5”, “V” and “5”) are combined into one.
          </p>
          <div className="mt-auto pt-4">
            <Button className="w-full sm:w-auto" onClick={onSetup} loading={busy === "setup"}>
              Create classes from students
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col rounded-xl border border-border p-4">
        <p className="font-medium">Start from a template</p>
        <p className="mt-1 text-sm text-muted">You can rename, reorder and add subjects afterwards.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {CLASS_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              aria-pressed={template === t.id}
              className={cx("rounded-full border px-3 py-1 text-sm transition-colors", template === t.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-border hover:bg-surface-muted")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 truncate text-xs text-muted">{chosen.names.join(", ")}</p>
        <div className="mt-3 max-w-56">
          <Field label="Sections in every class" htmlFor="tpl-sections" hint="Comma separated. Leave empty for none.">
            <Input id="tpl-sections" value={sections} onChange={(e) => setSections(e.target.value)} placeholder="A, B" />
          </Field>
        </div>
        <Button variant={unknown.length ? "secondary" : "primary"} className="mt-4 w-full sm:w-auto" onClick={() => onTemplate(chosen.names, parseSections(sections))} loading={busy === "template"}>
          Add {chosen.names.length} classes
        </Button>
      </div>
    </div>
  );
}

/** Students whose class or section isn't in the list, with one-click fixes. */
function FixCard({
  list,
  busy,
  onMerge,
  onAddSection,
}: {
  list: ClassList;
  busy: string | null;
  onMerge: (from: { grade: string; section?: string }, to: { classId: string; section: string }) => void;
  onAddSection: (cls: SchoolClass, section: string) => void;
}) {
  return (
    <SettingsCard title="Needs attention" description="These students have a class or section that isn't in your list. Move them to the right one; their attendance, tests and fees move too.">
      <ul className="-mx-5 divide-y divide-border border-y border-border">
        {list.unknown.map((u) => (
          <MergeRow key={`u:${u.grade}`} label={u.grade} students={u.students} suggestion={list.classes.find((c) => c.name === u.suggestion)} classes={list.classes} busy={busy === `merge:${u.grade}|`} onMerge={(to) => onMerge({ grade: u.grade }, to)} />
        ))}
        {list.strays.map((s) => {
          const cls = list.classes.find((c) => c.name === s.grade)!;
          return (
            <li key={`s:${s.grade}|${s.section}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">
                  {s.grade} - {s.section} <span className="font-normal text-muted">· {plural(s.students, "student")}</span>
                </p>
                <p className="text-xs text-muted">Section {s.section} isn&apos;t listed for class {s.grade}.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onAddSection(cls, s.section)} loading={busy === `add:${cls.id}|${s.section}`}>
                Add section {s.section}
              </Button>
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}

function MergeRow({ label, students, suggestion, classes, busy, onMerge }: { label: string; students: number; suggestion?: SchoolClass; classes: SchoolClass[]; busy: boolean; onMerge: (to: { classId: string; section: string }) => void }) {
  const [classId, setClassId] = useState(suggestion?.id ?? "");
  const [section, setSection] = useState("");
  const target = classes.find((c) => c.id === classId);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          “{label}” <span className="font-normal text-muted">· {plural(students, "student")}</span>
        </p>
        <p className="text-xs text-muted">{suggestion ? `Looks like class ${suggestion.name}.` : "Not in your class list."}</p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Select aria-label={`Move “${label}” to class`} value={classId} onChange={(e) => { setClassId(e.target.value); setSection(""); }} className="h-9 w-32 text-sm">
          <option value="">Move to…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {target && target.sections.length > 0 && (
          <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="h-9 w-32 text-sm">
            <option value="">Keep sections</option>
            {target.sections.map((s) => (
              <option key={s} value={s}>
                All into {s}
              </option>
            ))}
          </Select>
        )}
        <Button size="sm" disabled={!classId} loading={busy} onClick={() => onMerge({ classId, section })}>
          Move
        </Button>
      </div>
    </li>
  );
}

function ClassEditor({ cls, onClose, onSaved }: { cls: SchoolClass | null; onClose: () => void; onSaved: (list: ClassList, text: string) => void }) {
  const [name, setName] = useState(cls?.name ?? "");
  const [sections, setSections] = useState(cls?.sections.join(", ") ?? "A");
  const [subjects, setSubjects] = useState(cls?.subjects.map((s) => ({ name: s.name, maxMarks: s.maxMarks ? String(s.maxMarks) : "" })) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedSections = parseSections(sections);
  const removed = cls ? cls.sections.filter((s) => !parsedSections.includes(s) && (cls.sectionCounts[s] ?? 0) > 0) : [];
  const renamed = cls && name.trim() && name.trim() !== cls.name;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        sections: parsedSections,
        subjects: subjects.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), maxMarks: s.maxMarks ? Number(s.maxMarks) : null })),
      };
      const res = cls
        ? await api<ClassList>(`/api/academics/classes/${cls.id}`, { method: "PATCH", body })
        : await api<ClassList>("/api/academics/classes", { method: "POST", body });
      onSaved(res, cls ? (renamed ? `Renamed ${cls.name} to ${body.name} everywhere.` : `Class ${body.name} saved.`) : `Class ${body.name} added.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!cls || !confirm(`Delete class ${cls.name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api<ClassList>(`/api/academics/classes/${cls.id}`, { method: "DELETE" }), `Class ${cls.name} deleted.`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={cls ? `Class ${cls.name}` : "New class"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {cls ? (
            <Button variant="danger" onClick={remove} disabled={busy || cls.students > 0} title={cls.students ? "Move its students first" : undefined}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!name.trim() || removed.length > 0}>
              {cls ? "Save" : "Add class"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      <Field label="Class name" htmlFor="cls-name" hint={renamed ? `Students, attendance, tests and fees in ${cls!.name} will show “${name.trim()}”.` : "e.g. Nursery, LKG, 5, 11 Science"}>
        <Input id="cls-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoFocus={!cls} />
      </Field>
      <Field
        label="Sections"
        htmlFor="cls-sections"
        hint={removed.length ? undefined : "Comma separated, e.g. A, B, C. Leave empty if the class isn't divided."}
        error={removed.length ? `Section ${removed.join(", ")} still has students. Move them first.` : undefined}
      >
        <Input id="cls-sections" value={sections} onChange={(e) => setSections(e.target.value)} placeholder="A, B" />
      </Field>
      {parsedSections.length > 0 && (
        <div className="-mt-3 flex flex-wrap gap-1.5">
          {parsedSections.map((s) => (
            <span key={s} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium">
              {s}
              {cls?.sectionCounts[s] ? <span className="ml-1 font-normal text-muted">{cls.sectionCounts[s]}</span> : null}
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Subjects</p>
            <p className="text-xs text-muted">Filled in automatically when you create a test for this class.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setSubjects((l) => [...l, { name: "", maxMarks: "" }])}>
            <Icon d={ICONS.plus} />
            Add
          </Button>
        </div>
        {subjects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">No subjects yet.</p>
        ) : (
          <ul className="space-y-2">
            {subjects.map((s, i) => (
              <li key={i} className="flex gap-2">
                <Input aria-label={`Subject ${i + 1}`} value={s.name} onChange={(e) => setSubjects((l) => l.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Mathematics" className="min-w-0 flex-1" maxLength={60} />
                <Input
                  aria-label={`Default maximum marks for subject ${i + 1}`}
                  value={s.maxMarks}
                  inputMode="numeric"
                  onChange={(e) => setSubjects((l) => l.map((x, k) => (k === i ? { ...x, maxMarks: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)))}
                  placeholder="Max"
                  className="w-20"
                />
                <Button variant="ghost" size="icon" aria-label={`Remove subject ${i + 1}`} onClick={() => setSubjects((l) => l.filter((_, k) => k !== i))}>
                  <Icon d={ICONS.x} />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["English", "Hindi", "Mathematics", "Science", "Social Science", "Computer", "EVS"]
            .filter((p) => !subjects.some((s) => s.name.trim().toLowerCase() === p.toLowerCase()))
            .map((p) => (
              <button key={p} onClick={() => setSubjects((l) => [...l.filter((x) => x.name.trim()), { name: p, maxMarks: "" }])} className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent">
                + {p}
              </button>
            ))}
        </div>
      </div>
    </Drawer>
  );
}
