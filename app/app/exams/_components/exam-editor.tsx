"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { Drawer, Section, errorMessage, useResource } from "@/components/data";
import { Alert, Button, Field, ICONS, Icon, Input, Select, cx } from "@/components/ui";
import { loadClassList, type SchoolClass } from "@/lib/academics";
import { ApiError, api } from "@/lib/api";
import { localToday, type ClassSummary } from "@/lib/attendance";
import { SUBJECT_PRESETS, type Exam, type ExamView } from "@/lib/exams";

interface SubjectRow {
  _id?: string;
  name: string;
  maxMarks: string;
  passMarks: string;
}

const emptyRow = (name = ""): SubjectRow => ({ name, maxMarks: "", passMarks: "" });

export function ExamEditor({
  exam,
  defaults,
  onClose,
  onSaved,
}: {
  /** null = new test */
  exam: Exam | null;
  defaults?: { grade?: string; section?: string };
  onClose: () => void;
  onSaved: (view: ExamView) => void;
}) {
  const classes = useResource(() => api<{ classes: ClassSummary[] }>(`/api/attendance/classes?date=${localToday()}`), "classes");
  const classList = useResource(loadClassList, "academics-classes");
  // The school's class list (in its order) when it has one; otherwise classes that have students
  const listed = classList.data?.classes ?? [];
  const options = listed.length
    ? listed.map((c) => ({ grade: c.name, sections: c.sections.map((sec) => ({ section: sec, students: c.sectionCounts[sec] ?? 0 })), subjects: c.subjects }))
    : [...new Set(classes.data?.classes.map((c) => c.grade))].map((g) => ({
        grade: g,
        sections: (classes.data?.classes ?? []).filter((c) => c.grade === g && c.section).map((c) => ({ section: c.section, students: c.students })),
        subjects: [] as SchoolClass["subjects"],
      }));

  const [name, setName] = useState(exam?.name ?? "");
  const [grade, setGrade] = useState(exam?.grade ?? defaults?.grade ?? "");
  const [section, setSection] = useState(exam?.section ?? defaults?.section ?? "");
  const [date, setDate] = useState(exam?.date ?? localToday());
  const [description, setDescription] = useState(exam?.description ?? "");
  const [subjects, setSubjects] = useState<SubjectRow[]>(
    exam?.subjects.map((s) => ({ _id: s.id, name: s.name, maxMarks: String(s.maxMarks), passMarks: s.passMarks === null ? "" : String(s.passMarks) })) ?? [emptyRow()]
  );
  const [sameMax, setSameMax] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sections = options.find((o) => o.grade === grade)?.sections ?? [];

  /** A new test starts with the class's subjects (Settings → Classes) unless subjects were already typed. */
  function chooseGrade(value: string) {
    setGrade(value);
    setSection("");
    const preset = options.find((o) => o.grade === value)?.subjects ?? [];
    if (!exam && preset.length && subjects.every((s) => !s.name.trim())) {
      setSubjects(preset.map((p) => ({ ...emptyRow(p.name), maxMarks: p.maxMarks ? String(p.maxMarks) : sameMax })));
    }
  }
  const used = new Set(subjects.map((s) => s.name.trim().toLowerCase()));
  const total = subjects.reduce((t, s) => t + (Number(s.maxMarks) || 0), 0);

  const update = (i: number, patch: Partial<SubjectRow>) => setSubjects((l) => l.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addPreset = (p: string) =>
    setSubjects((l) => {
      // Fill the first empty row instead of adding below it
      const empty = l.findIndex((s) => !s.name.trim());
      const row = { ...emptyRow(p), maxMarks: sameMax };
      return empty >= 0 ? l.map((s, k) => (k === empty ? { ...s, name: p, maxMarks: s.maxMarks || sameMax } : s)) : [...l, row];
    });

  async function save() {
    setError(null);
    const local: Record<string, string> = {};
    if (name.trim().length < 2) local.name = "Give the test a name";
    if (!grade) local.grade = "Choose a class";
    const bad = subjects.findIndex((s) => !s.name.trim() || !(Number(s.maxMarks) >= 1) || !Number.isInteger(Number(s.maxMarks)) || (s.passMarks !== "" && !(Number(s.passMarks) <= Number(s.maxMarks))));
    if (bad >= 0) local.subjects = `Subject ${bad + 1}: needs a name, whole-number maximum marks, and pass marks no higher than the maximum`;
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        grade,
        section,
        date,
        description: description.trim(),
        subjects: subjects.map((s) => ({
          ...(s._id ? { _id: s._id } : {}),
          name: s.name.trim(),
          maxMarks: Number(s.maxMarks),
          passMarks: s.passMarks === "" ? null : Number(s.passMarks),
        })),
      };
      const view = exam
        ? await api<ExamView>(`/api/exams/${exam.id}`, { method: "PATCH", body })
        : await api<ExamView>("/api/exams", { method: "POST", body });
      onSaved(view);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={exam ? `Edit ${exam.name}` : "New test"}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} · out of {total || "—"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {exam ? "Save changes" : "Create test"}
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}

      <Section title="Test">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name *" htmlFor="ex-name" error={errors.name}>
              <Input id="ex-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Unit Test 1, Half Yearly, Weekly Maths" autoFocus={!exam} />
            </Field>
          </div>
          <Field label="Class *" htmlFor="ex-grade" error={errors.grade}>
            <Select id="ex-grade" value={grade} onChange={(e) => chooseGrade(e.target.value)}>
              <option value="">Choose…</option>
              {options.map((o) => (
                <option key={o.grade} value={o.grade}>
                  Class {o.grade}
                </option>
              ))}
              {grade && !options.some((o) => o.grade === grade) && <option value={grade}>Class {grade}</option>}
            </Select>
          </Field>
          <Field label="Section" htmlFor="ex-section" hint="All sections = one test for the whole class">
            <Select id="ex-section" value={section} onChange={(e) => setSection(e.target.value)} disabled={!grade}>
              <option value="">All sections</option>
              {sections.map((c) => (
                <option key={c.section} value={c.section}>
                  Section {c.section} ({c.students})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="ex-date">
            <Input id="ex-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label="Note" htmlFor="ex-desc" hint="Optional, e.g. syllabus covered">
            <Input id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Subjects">
        {errors.subjects && <p className="mb-2 text-sm text-danger">{errors.subjects}</p>}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SUBJECT_PRESETS.filter((p) => !used.has(p.toLowerCase())).map((p) => (
            <button key={p} onClick={() => addPreset(p)} className="h-7 rounded-full border border-border bg-surface px-2.5 text-xs hover:border-accent hover:text-accent">
              + {p}
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-end gap-2">
          <Field label="Same maximum for all" htmlFor="ex-same">
            <Input id="ex-same" className="w-28" inputMode="numeric" value={sameMax} onChange={(e) => setSameMax(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 50" />
          </Field>
          <Button variant="secondary" size="sm" className="mb-1" disabled={!sameMax} onClick={() => setSubjects((l) => l.map((s) => ({ ...s, maxMarks: sameMax })))}>
            Apply
          </Button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_5rem_5rem_2rem] gap-2 px-0.5 text-xs text-muted">
            <span>Subject</span>
            <span>Max marks</span>
            <span>Pass marks</span>
            <span />
          </div>
          {subjects.map((s, i) => (
            <div key={s._id ?? i} className="grid grid-cols-[1fr_5rem_5rem_2rem] items-center gap-2">
              <Input aria-label="Subject" value={s.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Subject" />
              <Input aria-label="Maximum marks" inputMode="numeric" value={s.maxMarks} onChange={(e) => update(i, { maxMarks: e.target.value.replace(/\D/g, "") })} placeholder="50" />
              <Input aria-label="Pass marks" inputMode="decimal" value={s.passMarks} onChange={(e) => update(i, { passMarks: e.target.value.replace(/[^\d.]/g, "") })} placeholder="auto" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove subject" disabled={subjects.length === 1} onClick={() => setSubjects((l) => l.filter((_, k) => k !== i))}>
                <Icon d={ICONS.x} />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSubjects((l) => [...l, { ...emptyRow(), maxMarks: sameMax }])}>
            <Icon d={ICONS.plus} />
            Add subject
          </Button>
        </div>
        <p className={cx("mt-3 text-xs text-muted")}>Pass marks left on “auto” use the school&apos;s pass percentage (Settings → Grading).</p>
      </Section>
    </Drawer>
  );
}
