"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { Drawer, Notice, Section, errorMessage, formatDate, useResource } from "@/components/data";
import { Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, Spinner, cx } from "@/components/ui";
import { OUTCOME_LABEL, loadClassList } from "@/lib/academics";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LOW_ATTENDANCE,
  STATUS_META,
  addDays,
  formatDay as formatAttendanceDay,
  formatRate,
  localToday,
  type StudentAttendance,
} from "@/lib/attendance";
import { GENDERS, STUDENT_STATUSES, type Student } from "@/lib/students";
import { Avatar, STATUS_LABEL, StatusBadge, classLabel } from "./bits";

type FormState = Record<
  | "admissionNo" | "firstName" | "lastName" | "gender" | "dateOfBirth" | "grade" | "section" | "rollNo"
  | "email" | "phone" | "guardianName" | "guardianPhone" | "guardianEmail" | "address" | "admissionDate"
  | "status" | "notes",
  string
>;

const EMPTY: FormState = {
  admissionNo: "", firstName: "", lastName: "", gender: "", dateOfBirth: "", grade: "", section: "", rollNo: "",
  email: "", phone: "", guardianName: "", guardianPhone: "", guardianEmail: "", address: "", admissionDate: "",
  status: "active", notes: "",
};

const DATE_FIELDS = new Set(["dateOfBirth", "admissionDate"]);

function toForm(s: Student): FormState {
  return {
    ...EMPTY,
    ...Object.fromEntries(
      (Object.keys(EMPTY) as (keyof FormState)[]).map((k) => {
        const v = s[k];
        return [k, v == null ? "" : DATE_FIELDS.has(k) ? String(v).slice(0, 10) : String(v)];
      })
    ),
  };
}

/** New student: send non-empty fields. Edit: send changed fields, with null to clear. */
function toPayload(form: FormState, original?: FormState) {
  const body: Record<string, string | null> = {};
  for (const key of Object.keys(form) as (keyof FormState)[]) {
    const value = form[key].trim();
    if (original) {
      if (value !== original[key].trim()) body[key] = value === "" ? null : value;
    } else if (value !== "") {
      body[key] = value;
    }
  }
  return body;
}

interface Props {
  /** null = create a new student */
  studentId: string | null;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function StudentDrawer(props: Props) {
  // Loading is split out so the form mounts once with its initial values
  if (props.studentId === null) return <StudentForm {...props} initial={null} />;
  return <ExistingStudent {...props} studentId={props.studentId} />;
}

function ExistingStudent(props: Props & { studentId: string }) {
  const { data, error } = useResource(
    () => api<{ student: Student }>(`/api/students/${props.studentId}`),
    props.studentId
  );

  if (!data) {
    return (
      <Drawer title="Student" onClose={props.onClose}>
        {error ? <p className="text-sm text-danger">{error}</p> : <Spinner className="mx-auto my-16" />}
      </Drawer>
    );
  }
  return <StudentForm {...props} initial={data.student} />;
}

const GENDER_LABEL = { male: "Male", female: "Female", other: "Other" } as const;

function age(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - d.getUTCFullYear();
  if (now.getMonth() < d.getUTCMonth() || (now.getMonth() === d.getUTCMonth() && now.getDate() < d.getUTCDate())) years--;
  return years;
}

/** Dates are stored as UTC midnight, so format them in UTC to avoid showing the previous day. */
function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function StudentForm({ initial, canManage, onClose, onSaved }: Props & { initial: Student | null }) {
  const [student, setStudent] = useState(initial);
  const [mode, setMode] = useState<"view" | "edit">(initial ? "view" : "edit");
  const [form, setForm] = useState<FormState>(initial ? toForm(initial) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  // The school's class list; until one exists, class and section are typed freely
  const classList = useResource(loadClassList, "academics-classes");
  const chosenClass = classList.data?.classes.find((c) => c.name === form.grade);

  const original = student ? toForm(student) : undefined;
  const dirty = Object.keys(toPayload(form, original)).length > 0;

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function startEdit() {
    if (student) setForm(toForm(student));
    setErrors({});
    setMessage(null);
    setMode("edit");
  }

  function cancelEdit() {
    if (!student) return onClose();
    if (dirty && !confirm("Discard your changes?")) return;
    setErrors({});
    setMode("view");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.admissionNo.trim()) local.admissionNo = "Admission number is required";
    if (!form.firstName.trim()) local.firstName = "First name is required";
    setErrors(local);
    if (Object.keys(local).length) return;

    setBusy("save");
    setMessage(null);
    try {
      const body = toPayload(form, original);
      const res = student
        ? await api<{ student: Student }>(`/api/students/${student.id}`, { method: "PATCH", body })
        : await api<{ student: Student }>("/api/students", { method: "POST", body });
      onSaved();
      setStudent(res.student);
      setForm(toForm(res.student));
      setMode("view");
      setMessage({ tone: "success", text: student ? "Changes saved" : "Student added" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "ADMISSION_NO_TAKEN") setErrors({ admissionNo: err.message });
      else if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      else setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!student || !confirm(`Delete ${student.fullName}? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await api(`/api/students/${student.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------- view mode
  if (mode === "view" && student) {
    return (
      <Drawer
        title="Student profile"
        onClose={onClose}
        footer={
          canManage && (
            <div className="flex items-center justify-between gap-2">
              <Button variant="danger" onClick={remove} loading={busy === "delete"}>
                Delete
              </Button>
              <Button onClick={startEdit}>
                <Icon d={ICONS.edit} />
                Edit
              </Button>
            </div>
          )
        }
      >
        <Notice message={message} />
        <ProfileView student={student} />
      </Drawer>
    );
  }

  // ---------------------------------------------------------------- edit mode
  const input = (key: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={`s-${key}`} error={errors[key]}>
      <Input id={`s-${key}`} value={form[key]} onChange={set(key)} aria-invalid={Boolean(errors[key])} {...props} />
    </Field>
  );

  return (
    <Drawer
      title={student ? `Edit ${student.fullName}` : "Add student"}
      onClose={student ? cancelEdit : onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancelEdit}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" className="min-w-32" loading={busy === "save"} disabled={!dirty || busy !== null}>
            {student ? "Save changes" : "Add student"}
          </Button>
        </div>
      }
    >
      <form id="student-form" onSubmit={save} className="space-y-6" noValidate>
        <Notice message={message} />

        <Section title="Student">
          <div className="grid gap-3 sm:grid-cols-2">
            {input("firstName", "First name *", { autoFocus: !student, autoComplete: "off" })}
            {input("lastName", "Last name", { autoComplete: "off" })}
            {input("admissionNo", "Admission no *", { autoComplete: "off", autoCapitalize: "characters" })}
            <Field label="Status" htmlFor="s-status">
              <Select id="s-status" value={form.status} onChange={set("status")}>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gender" htmlFor="s-gender" error={errors.gender}>
              <Select id="s-gender" value={form.gender} onChange={set("gender")}>
                <option value="">Not set</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABEL[g]}
                  </option>
                ))}
              </Select>
            </Field>
            {input("dateOfBirth", "Date of birth", { type: "date" })}
          </div>
        </Section>

        <Section title="Class">
          <div className="grid grid-cols-2 gap-3">
            {classList.data?.classes.length ? (
              <>
                <Field label="Class" htmlFor="s-grade" error={errors.grade}>
                  <Select id="s-grade" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value, section: "" }))} aria-invalid={Boolean(errors.grade)}>
                    <option value="">No class</option>
                    {classList.data.classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {form.grade && !chosenClass && <option value={form.grade}>{form.grade} (not in class list)</option>}
                  </Select>
                </Field>
                <Field label="Section" htmlFor="s-section" error={errors.section}>
                  <Select id="s-section" value={form.section} onChange={set("section")} disabled={!chosenClass?.sections.length && !form.section} aria-invalid={Boolean(errors.section)}>
                    <option value="">{chosenClass && !chosenClass.sections.length ? "No sections" : "No section"}</option>
                    {chosenClass?.sections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                    {form.section && !chosenClass?.sections.includes(form.section) && <option value={form.section}>{form.section} (not listed)</option>}
                  </Select>
                </Field>
              </>
            ) : (
              <>
                {input("grade", "Class", { placeholder: "e.g. 5" })}
                {input("section", "Section", { placeholder: "e.g. A", autoCapitalize: "characters" })}
              </>
            )}
            {input("rollNo", "Roll no", { inputMode: "numeric" })}
            {input("admissionDate", "Admission date", { type: "date" })}
          </div>
        </Section>

        <Section title="Guardian">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{input("guardianName", "Name")}</div>
            {input("guardianPhone", "Phone", { type: "tel", inputMode: "tel" })}
            {input("guardianEmail", "Email", { type: "email", inputMode: "email" })}
          </div>
        </Section>

        <Section title="Contact">
          <div className="grid gap-3 sm:grid-cols-2">
            {input("phone", "Student phone", { type: "tel", inputMode: "tel" })}
            {input("email", "Student email", { type: "email", inputMode: "email" })}
            <div className="sm:col-span-2">{input("address", "Address", { autoComplete: "street-address" })}</div>
          </div>
        </Section>

        <Section title="Notes">
          <textarea
            id="s-notes"
            rows={3}
            value={form.notes}
            onChange={set("notes")}
            placeholder="Anything staff should know"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />
        </Section>
      </form>
    </Drawer>
  );
}

function ProfileView({ student: s }: { student: Student }) {
  const cls = classLabel(s);
  const actions = [
    s.guardianPhone && { href: `tel:${s.guardianPhone}`, label: "Call", icon: ICONS.phone },
    s.guardianPhone && { href: `sms:${s.guardianPhone}`, label: "Message", icon: ICONS.message },
    (s.guardianEmail || s.email) && { href: `mailto:${s.guardianEmail || s.email}`, label: "Email", icon: ICONS.mail },
  ].filter(Boolean) as { href: string; label: string; icon: string }[];

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={s.fullName} seed={s.id} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{s.fullName}</h2>
          <p className="font-mono text-sm text-muted">{s.admissionNo}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={s.status} />
            {cls && <span className="text-muted">Class {cls}</span>}
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
          {actions.map((a) => (
            <a
              key={a.label}
              href={a.href}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface py-3 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              <Icon d={a.icon} className="size-5" />
              {a.label}
            </a>
          ))}
        </div>
      )}

      <AttendanceCard studentId={s.id} />

      <DetailCard
        title="Guardian"
        rows={[
          ["Name", s.guardianName],
          ["Phone", s.guardianPhone && <a href={`tel:${s.guardianPhone}`} className="text-accent hover:underline">{s.guardianPhone}</a>],
          ["Email", s.guardianEmail && <a href={`mailto:${s.guardianEmail}`} className="break-all text-accent hover:underline">{s.guardianEmail}</a>],
        ]}
      />
      <DetailCard
        title="Personal"
        rows={[
          ["Gender", s.gender && GENDER_LABEL[s.gender]],
          ["Date of birth", s.dateOfBirth && `${formatDay(s.dateOfBirth)} (${age(s.dateOfBirth)} yrs)`],
        ]}
      />
      <DetailCard
        title="Enrolment"
        rows={[
          ["Class", s.grade],
          ["Section", s.section],
          ["Roll no", s.rollNo],
          ["Admitted", s.admissionDate && formatDay(s.admissionDate)],
        ]}
      />
      {s.classHistory && s.classHistory.length > 0 && (
        <Section title="Class history">
          <ol className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {[...s.classHistory].reverse().map((h) => (
              <li key={h.year} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="w-20 shrink-0 text-muted">{h.year}</span>
                <span className="min-w-0 flex-1 truncate">
                  Class {h.section ? `${h.grade} - ${h.section}` : h.grade}
                  {h.rollNo && <span className="text-muted"> · Roll {h.rollNo}</span>}
                </span>
                <Badge tone={h.outcome === "promoted" || h.outcome === "graduated" ? "success" : h.outcome === "left" ? "danger" : "neutral"}>{OUTCOME_LABEL[h.outcome]}</Badge>
              </li>
            ))}
          </ol>
        </Section>
      )}
      <DetailCard
        title="Contact"
        rows={[
          ["Phone", s.phone && <a href={`tel:${s.phone}`} className="text-accent hover:underline">{s.phone}</a>],
          ["Email", s.email && <a href={`mailto:${s.email}`} className="break-all text-accent hover:underline">{s.email}</a>],
          ["Address", s.address],
        ]}
      />
      {s.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-sm">{s.notes}</p>
        </Section>
      )}

      <p className="text-xs text-muted">
        Added {formatDate(s.createdAt)} · Last updated {formatDate(s.updatedAt, true)}
      </p>
    </>
  );
}

function DetailCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <Section title={title}>
      <dl className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-2.5">
            <dt className="w-28 shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 flex-1">{value || <span className="text-muted">—</span>}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** Teaching staff only: accountants don't see attendance. */
function AttendanceCard({ studentId }: { studentId: string }) {
  const { session } = useAuth();
  if (session.status === "authenticated" && session.role === "accountant") return null;
  return <AttendanceHistory studentId={studentId} />;
}

/** Last 30 days: rate, counts and one square per day (grey = not marked). */
function AttendanceHistory({ studentId }: { studentId: string }) {
  const to = localToday();
  const from = addDays(to, -29);
  const path = `/api/attendance/students/${studentId}?from=${from}&to=${to}`;
  const { data, error } = useResource(() => api<StudentAttendance>(path), path);

  const byDay = new Map(data?.records.map((r) => [r.date, r]) ?? []);
  const days = Array.from({ length: 30 }, (_, i) => addDays(from, i));
  const low = data?.summary.rate !== null && data?.summary.rate !== undefined && data.summary.rate < LOW_ATTENDANCE;

  return (
    <Section title="Attendance · last 30 days">
      <div className="rounded-xl border border-border bg-surface p-4">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !data ? (
          <Skeleton className="h-16 w-full" />
        ) : data.summary.marked === 0 ? (
          <p className="text-sm text-muted">No attendance recorded in the last 30 days.</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={cx("text-2xl font-semibold tabular-nums", low && "text-danger")}>{formatRate(data.summary.rate)}</p>
                <p className="text-xs text-muted">{data.summary.marked} days recorded{low ? ` · below ${LOW_ATTENDANCE}%` : ""}</p>
              </div>
              <div className="flex gap-3 text-xs">
                {(["present", "absent", "late", "leave"] as const).map((st) => (
                  <span key={st} className="text-center">
                    <span className={cx("block text-base font-semibold tabular-nums", data.summary[st] ? STATUS_META[st].text : "text-muted")}>
                      {data.summary[st]}
                    </span>
                    <span className="text-muted">{STATUS_META[st].label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1">
              {days.map((d) => {
                const r = byDay.get(d);
                return (
                  <span
                    key={d}
                    title={`${formatAttendanceDay(d, "short")}: ${r ? STATUS_META[r.status].label + (r.note ? ` (${r.note})` : "") : "not marked"}`}
                    className={cx("aspect-square rounded-sm", r ? STATUS_META[r.status].dot : "bg-surface-muted")}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
