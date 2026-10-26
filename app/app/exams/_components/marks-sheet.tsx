"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, ICONS, Icon, Skeleton, cx } from "@/components/ui";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDay } from "@/lib/attendance";
import { SCALE_BANDS, STATUS_TEXT, classLabel, formatMark, formatPct, gradeTone, type ExamRow, type ExamView } from "@/lib/exams";
import { downloadSpreadsheet } from "@/lib/spreadsheet";
import { ExamEditor } from "./exam-editor";
import { ExamReportDrawer } from "./report-card";

type Draft = { marks: Record<string, string>; remarks: string };

const isAbsent = (v: string) => /^a(b)?$/i.test(v.trim());

/** Row values as editable text: "" = not entered, "AB" = absent. */
function toDraft(row: ExamRow, subjectIds: string[]): Draft {
  return {
    marks: Object.fromEntries(
      subjectIds.map((id, i) => {
        const s = row.result.subjects[i];
        return [id, s?.absent ? "AB" : s?.marks === null || s?.marks === undefined ? "" : String(s.marks)];
      })
    ),
    remarks: row.remarks,
  };
}

const sameDraft = (a: Draft, b: Draft) => a.remarks.trim() === b.remarks.trim() && Object.keys(a.marks).every((k) => a.marks[k].trim().toUpperCase() === (b.marks[k] ?? "").trim().toUpperCase());

export function MarksSheet({ examId, onBack, onChanged, onDeleted }: { examId: string; onBack: () => void; onChanged: () => void; onDeleted: () => void }) {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const isAdmin = role === "owner" || role === "admin";

  const path = `/api/exams/${examId}`;
  const loaded = useResource(() => api<ExamView>(path), path);
  const view = loaded.data;
  const subjectIds = useMemo(() => view?.exam.subjects.map((s) => s.id) ?? [], [view]);

  const [edits, setEdits] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [sort, setSort] = useState<"roll" | "rank">("roll");
  const [editing, setEditing] = useState(false);
  const [reportFor, setReportFor] = useState<ExamRow | null>(null);
  const [sharing, setSharing] = useState(false);
  const cells = useRef(new Map<string, HTMLInputElement>());

  const saved = useMemo(() => new Map((view?.students ?? []).map((r) => [r.student.id, toDraft(r, subjectIds)])), [view, subjectIds]);
  const draftOf = (id: string) => edits[id] ?? saved.get(id)!;
  const changedIds = Object.keys(edits).filter((id) => saved.has(id) && !sameDraft(edits[id], saved.get(id)!));
  const dirty = changedIds.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (loaded.error && !view) return <Alert>{loaded.error}</Alert>;
  if (!view) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const { exam, stats, grading } = view;
  const scale = grading.scale;

  function setCell(studentId: string, subjectId: string, value: string) {
    setMessage(null);
    const clean = isAbsent(value) ? "AB" : value.replace(/[^\d.]/g, "");
    setEdits((e) => {
      const base = e[studentId] ?? saved.get(studentId)!;
      return { ...e, [studentId]: { ...base, marks: { ...base.marks, [subjectId]: clean } } };
    });
  }

  function setRemarks(studentId: string, remarks: string) {
    setEdits((e) => {
      const base = e[studentId] ?? saved.get(studentId)!;
      return { ...e, [studentId]: { ...base, remarks } };
    });
  }

  /** Live preview for unsaved rows, using the same rules as the server. */
  function preview(row: ExamRow) {
    const d = draftOf(row.student.id);
    if (!changedIds.includes(row.student.id)) return { ...row.result, live: false };
    let total = 0;
    let entered = 0;
    let absent = 0;
    let invalid = false;
    exam.subjects.forEach((s) => {
      const v = d.marks[s.id]?.trim() ?? "";
      if (v === "AB") {
        entered++;
        absent++;
      } else if (v !== "") {
        const n = Number(v);
        if (Number.isNaN(n) || n > s.maxMarks) invalid = true;
        else {
          total += n;
          entered++;
        }
      }
    });
    const complete = entered === exam.subjects.length && !invalid;
    const percent = complete && absent < exam.subjects.length ? Math.round((total / exam.maxTotal) * 1000) / 10 : null;
    const grade = percent === null ? null : (SCALE_BANDS[scale].find((b) => percent >= b.min) ?? SCALE_BANDS[scale].at(-1)!).grade;
    return { ...row.result, total: complete ? total : null, percent, grade, rank: null, live: true };
  }

  const invalidCells = view.students.flatMap((r) =>
    exam.subjects.filter((s) => {
      const v = draftOf(r.student.id).marks[s.id]?.trim() ?? "";
      return v !== "" && v !== "AB" && (Number.isNaN(Number(v)) || Number(v) > s.maxMarks);
    }).map((s) => `${r.student.id}:${s.id}`)
  );

  async function save() {
    if (invalidCells.length) {
      setMessage({ tone: "danger", text: "Some marks are above the maximum (shown in red). Fix them before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const entries = changedIds.map((id) => {
        const d = edits[id];
        return {
          studentId: id,
          remarks: d.remarks.trim(),
          marks: exam.subjects.map((s) => {
            const v = d.marks[s.id]?.trim() ?? "";
            return { subjectId: s.id, absent: v === "AB", marks: v === "" || v === "AB" ? null : Number(v) };
          }),
        };
      });
      loaded.setData(await api<ExamView>(`/api/exams/${examId}/marks`, { method: "PUT", body: { entries } }));
      setEdits({});
      setMessage({ tone: "success", text: `Marks saved for ${entries.length} student${entries.length === 1 ? "" : "s"}.` });
      onChanged();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete “${exam.name}” and all its marks? This can't be undone.`)) return;
    try {
      await api(`/api/exams/${examId}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    }
  }

  async function exportSheet() {
    const header = ["Roll no", "Admission no", "Name", ...exam.subjects.map((s) => `${s.name} (${s.maxMarks})`), "Total", "Max", "%", "Grade", "Rank", "Result", "Remarks"];
    const rows = view!.students.map((r) => [
      r.student.rollNo,
      r.student.admissionNo,
      r.student.fullName,
      ...r.result.subjects.map((s) => (s.absent ? "AB" : formatMark(s.marks).replace("—", ""))),
      r.result.total === null ? "" : String(r.result.total),
      String(r.result.max),
      r.result.percent === null ? "" : String(r.result.percent),
      r.result.grade ?? "",
      r.result.rank ? String(r.result.rank) : "",
      STATUS_TEXT[r.result.status],
      r.remarks,
    ]);
    await downloadSpreadsheet(`marks-${exam.name.replace(/\s+/g, "-")}-${exam.grade}${exam.section}`, [header, ...rows], "xlsx", { sheetName: exam.name });
  }

  /** Enter / ↑ / ↓ move between students in the same subject, like a spreadsheet. */
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, col: number) {
    const ids = rows.map((r) => r.student.id);
    const move = (r: number, c: number) => {
      const key = c < exam.subjects.length ? `${ids[r]}:${exam.subjects[c].id}` : `${ids[r]}:remarks`;
      const el = cells.current.get(key);
      if (el) {
        e.preventDefault();
        el.focus();
        el.select();
      }
    };
    if (e.key === "Enter" || e.key === "ArrowDown") move(rowIndex + 1, col);
    else if (e.key === "ArrowUp") move(rowIndex - 1, col);
  }

  const rows = [...view.students].sort((a, b) => (sort === "rank" ? (a.result.rank ?? 9999) - (b.result.rank ?? 9999) : 0));
  const shareable = view.students.filter((r) => r.result.status !== "pending");
  const bands = SCALE_BANDS[scale];
  const maxDist = Math.max(1, ...Object.values(stats.distribution));

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Back to tests"
            onClick={() => (!dirty || confirm("You have unsaved marks. Leave without saving?")) && onBack()}
          >
            <Icon d={ICONS.chevronLeft} />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{exam.name}</h2>
            <p className="text-sm text-muted">
              Class {classLabel(exam.grade, exam.section)} · {formatDay(exam.date)} · out of {exam.maxTotal}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Icon d={ICONS.edit} />
            Edit test
          </Button>
          <Button variant="secondary" size="sm" onClick={exportSheet}>
            <Icon d={ICONS.download} />
            Excel
          </Button>
          {isAdmin && (
            <Button variant="danger" size="sm" onClick={remove}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Class average", value: formatPct(stats.average), hint: stats.highest !== null ? `Highest ${formatPct(stats.highest)} · lowest ${formatPct(stats.lowest)}` : "No results yet" },
          { label: "Pass rate", value: formatPct(stats.passRate), hint: `${stats.passed} passed · ${stats.failed} need help` },
          { label: "Marks entered", value: `${stats.completed}/${stats.students}`, hint: stats.pending ? `${stats.pending} pending` : "All done" },
          { label: "Absent", value: String(stats.absent), hint: "for the whole test" },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{t.value}</p>
            <p className="truncate text-xs text-muted">{t.hint}</p>
          </div>
        ))}
      </div>

      {stats.completed > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-surface p-4">
          <p className="mb-3 text-xs font-medium text-muted">Grade distribution</p>
          <div className="flex h-20 items-end gap-2">
            {bands.map((b) => {
              const n = stats.distribution[b.grade] ?? 0;
              return (
                <div key={b.grade} className="flex flex-1 flex-col items-center gap-1" title={`${b.grade}: ${n} student${n === 1 ? "" : "s"}`}>
                  <span className="text-[11px] tabular-nums text-muted">{n || ""}</span>
                  <span className="w-full max-w-10 rounded-t-[4px] bg-accent" style={{ height: n ? `${(n / maxDist) * 48}px` : "2px", opacity: n ? 1 : 0.25 }} />
                  <span className="text-xs font-medium">{b.grade}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {(["roll", "rank"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={cx("rounded-md px-3 py-1.5", sort === s ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}>
              By {s === "roll" ? "roll no" : "rank"}
            </button>
          ))}
        </div>
        <WhatsAppButton size="sm" disabled={dirty || shareable.length === 0} onClick={() => setSharing(true)} title={dirty ? "Save marks first" : undefined}>
          Share results ({shareable.length})
        </WhatsAppButton>
      </div>
      <p className="mb-2 text-xs text-muted">
        Type marks, or <kbd className="rounded border border-border bg-surface-muted px-1 font-mono text-[10px]">ab</kbd> for absent. Enter moves to the next student.
      </p>

      {message && (
        <div className="mb-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {/* Marks grid */}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">No active students in Class {classLabel(exam.grade, exam.section)}.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2.5 font-medium">Student</th>
                {exam.subjects.map((s, i) => (
                  <th key={s.id} className="border-b border-border px-2 py-2.5 text-center font-medium">
                    <div className="max-w-24 truncate text-foreground">{s.name}</div>
                    <div className="font-normal">
                      /{s.maxMarks}
                      {stats.subjects[i]?.average !== null && <span title="Class average"> · avg {formatMark(stats.subjects[i]?.average)}</span>}
                    </div>
                  </th>
                ))}
                <th className="border-b border-border px-3 py-2.5 text-right font-medium">Total</th>
                <th className="border-b border-border px-3 py-2.5 text-right font-medium">%</th>
                <th className="border-b border-border px-3 py-2.5 font-medium">Grade</th>
                <th className="border-b border-border px-3 py-2.5 text-right font-medium">Rank</th>
                <th className="min-w-40 border-b border-border px-3 py-2.5 font-medium">Remarks</th>
                <th className="border-b border-border px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const d = draftOf(row.student.id);
                const p = preview(row);
                const changed = changedIds.includes(row.student.id);
                return (
                  <tr key={row.student.id} className={cx("group", changed && "[&>td]:bg-warning-soft/40")}>
                    <td className="sticky left-0 z-10 border-b border-border bg-surface px-3 py-2 group-hover:bg-surface-muted">
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right font-mono text-xs text-muted">{row.student.rollNo || "–"}</span>
                        <div className="min-w-0">
                          <div className="max-w-36 truncate font-medium sm:max-w-48">{row.student.fullName}</div>
                          <div className="flex items-center gap-1 text-[11px] text-muted">
                            {exam.section ? row.student.admissionNo : `Sec ${row.student.section || "—"}`}
                            {!row.student.current && <Badge>moved</Badge>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {exam.subjects.map((s, ci) => {
                      const v = d.marks[s.id] ?? "";
                      const bad = invalidCells.includes(`${row.student.id}:${s.id}`);
                      const failed = !p.live && row.result.subjects[ci]?.passed === false && !row.result.subjects[ci]?.absent;
                      return (
                        <td key={s.id} className="border-b border-border px-1.5 py-1.5 text-center">
                          <input
                            ref={(el) => {
                              const k = `${row.student.id}:${s.id}`;
                              if (el) cells.current.set(k, el);
                              else cells.current.delete(k);
                            }}
                            aria-label={`${s.name} marks for ${row.student.fullName}`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={v}
                            onChange={(e) => setCell(row.student.id, s.id, e.target.value)}
                            onKeyDown={(e) => onKey(e, ri, ci)}
                            onFocus={(e) => e.target.select()}
                            className={cx(
                              "h-9 w-16 rounded-md border bg-background text-center text-base tabular-nums outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm",
                              bad ? "border-danger text-danger" : v === "AB" ? "border-border font-medium text-muted" : failed ? "border-danger/50 text-danger" : "border-border"
                            )}
                          />
                        </td>
                      );
                    })}
                    <td className="border-b border-border px-3 py-2 text-right tabular-nums">{formatMark(p.total)}</td>
                    <td className="border-b border-border px-3 py-2 text-right tabular-nums">{formatPct(p.percent)}</td>
                    <td className="border-b border-border px-3 py-2">
                      {p.grade ? (
                        <Badge tone={gradeTone(p.grade, scale)}>{p.grade}</Badge>
                      ) : row.result.status === "absent" && !p.live ? (
                        <Badge>AB</Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                      {!p.live && row.result.status === "fail" && <span className="ml-1.5 text-[11px] text-danger">needs help</span>}
                    </td>
                    <td className="border-b border-border px-3 py-2 text-right tabular-nums">{p.live ? <span className="text-muted">…</span> : (row.result.rank ?? "—")}</td>
                    <td className="border-b border-border px-2 py-1.5">
                      <input
                        ref={(el) => {
                          const k = `${row.student.id}:remarks`;
                          if (el) cells.current.set(k, el);
                          else cells.current.delete(k);
                        }}
                        aria-label={`Remarks for ${row.student.fullName}`}
                        value={d.remarks}
                        maxLength={300}
                        onChange={(e) => setRemarks(row.student.id, e.target.value)}
                        onKeyDown={(e) => onKey(e, ri, exam.subjects.length)}
                        placeholder="Optional"
                        className="h-9 w-full min-w-36 rounded-md border border-border bg-background px-2 text-base outline-none placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
                      />
                    </td>
                    <td className="border-b border-border px-2 py-2 text-right">
                      <Button variant="ghost" size="sm" disabled={changed} onClick={() => setReportFor(row)} title={changed ? "Save first" : "Report card"}>
                        Report
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Save bar */}
      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-h,0px)] z-30 border-t border-border bg-background/95 backdrop-blur md:left-[var(--sidebar-w,15rem)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-sm">
            {dirty ? (
              <span className="font-medium">
                {changedIds.length} student{changedIds.length === 1 ? "" : "s"} changed
                {invalidCells.length > 0 && <span className="text-danger"> · {invalidCells.length} mark{invalidCells.length === 1 ? "" : "s"} too high</span>}
              </span>
            ) : (
              <span className="text-muted">{stats.pending ? `${stats.pending} student${stats.pending === 1 ? "" : "s"} still to mark` : "All marks entered"}</span>
            )}
          </span>
          <div className="flex gap-2">
            {dirty && (
              <Button variant="ghost" onClick={() => setEdits({})} disabled={saving}>
                Discard
              </Button>
            )}
            <Button onClick={save} loading={saving} disabled={!dirty} className="min-w-32">
              Save marks
            </Button>
          </div>
        </div>
      </div>

      {editing && (
        <ExamEditor
          exam={exam}
          onClose={() => setEditing(false)}
          onSaved={(v) => {
            loaded.setData(v);
            setEdits({});
            setEditing(false);
            setMessage({ tone: "success", text: "Test updated." });
            onChanged();
          }}
        />
      )}
      {reportFor && <ExamReportDrawer exam={exam} row={view.students.find((r) => r.student.id === reportFor.student.id) ?? reportFor} ranked={stats.completed} onClose={() => setReportFor(null)} />}
      {sharing && (
        <WhatsAppDrawer
          type="exam_result"
          refs={shareable.map((r) => ({ examId: exam.id, studentId: r.student.id }))}
          title={`${exam.name} results · Class ${classLabel(exam.grade, exam.section)}`}
          description="Each parent gets their child's marks, grade and rank."
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
