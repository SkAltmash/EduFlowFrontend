"use client";

import { useMemo, useRef, useState } from "react";
import { Drawer, Section, errorMessage } from "@/components/data";
import { Alert, Badge, Button, Select, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { SPREADSHEET_ACCEPT, downloadSpreadsheet, isSpreadsheetFile, readSpreadsheet, type Sheet } from "@/lib/spreadsheet";
import {
  DATE_FIELDS,
  STUDENT_FIELDS,
  downloadFile,
  mapColumns,
  rowsToStudents,
  templateRows,
  toCsv,
  type ColumnMapping,
  type ImportResult,
} from "@/lib/students";

// The API accepts 1000 rows per request; larger files are sent in batches
const BATCH_SIZE = 1000;
const MAX_ROWS = 10_000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TEMPLATE_DATE_COLUMNS = DATE_FIELDS.map((key) => STUDENT_FIELDS.findIndex((f) => f.key === key));

interface Parsed {
  mapping: ColumnMapping;
  students: Record<string, string>[];
  /** Rows missing a required value, found before uploading */
  missingRequired: number;
}

/** Checks one sheet: needs a header row, admission no and a name column. */
function analyzeSheet(sheet: Sheet): { parsed: Parsed } | { error: string } {
  if (sheet.rows.length < 2) return { error: "This sheet needs a header row and at least one student." };
  const [header, ...data] = sheet.rows;
  if (data.length > MAX_ROWS) return { error: `Import at most ${MAX_ROWS.toLocaleString()} students at a time.` };

  const mapping = mapColumns(header);
  const hasName = mapping.columns.firstName !== undefined || mapping.fullNameColumn !== null;
  if (mapping.columns.admissionNo === undefined || !hasName) {
    const missing = [mapping.columns.admissionNo === undefined && "an “Admission no”", !hasName && "a “First name” (or “Name”)"];
    return {
      error: `Couldn't find ${missing.filter(Boolean).join(" or ")} column in the first row. Download the template to see the expected headers.`,
    };
  }

  const students = rowsToStudents(data, mapping);
  return { parsed: { mapping, students, missingRequired: students.filter((s) => !s.admissionNo || !s.firstName).length } };
}

export function ImportDrawer({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; sheets: Sheet[] } | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const analysis = useMemo(() => (file ? analyzeSheet(file.sheets[sheetIndex]) : null), [file, sheetIndex]);
  const parsed = analysis && "parsed" in analysis ? analysis.parsed : null;

  async function readFile(picked: File) {
    setError(null);
    setFile(null);
    setResult(null);
    if (!isSpreadsheetFile(picked)) return setError("Please choose a CSV or Excel file (.csv, .xlsx or .xls).");
    if (picked.size > MAX_FILE_BYTES) return setError("That file is larger than 5 MB.");

    setReading(true);
    try {
      const sheets = await readSpreadsheet(picked);
      if (sheets.length === 0) return setError("That file is empty.");
      // Start on the first sheet that looks like a student list
      const first = sheets.findIndex((sh) => "parsed" in analyzeSheet(sh));
      setSheetIndex(Math.max(0, first));
      setFile({ name: picked.name, sheets });
    } catch {
      setError("Couldn't read that file. If it's password-protected or corrupted, open it in Excel and save a fresh copy.");
    } finally {
      setReading(false);
    }
  }

  async function runImport() {
    if (!parsed) return;
    setError(null);
    const total: ImportResult = { total: 0, created: 0, updated: 0, skipped: 0, failed: [] };
    setProgress({ done: 0, total: parsed.students.length });

    try {
      for (let start = 0; start < parsed.students.length; start += BATCH_SIZE) {
        const batch = parsed.students.slice(start, start + BATCH_SIZE);
        const res = await api<ImportResult>("/api/students/import", {
          method: "POST",
          body: { students: batch, onDuplicate },
        });
        total.total += res.total;
        total.created += res.created;
        total.updated += res.updated;
        total.skipped += res.skipped;
        // Make row numbers relative to the whole file
        total.failed.push(...res.failed.map((f) => ({ ...f, row: f.row + start })));
        setProgress({ done: start + batch.length, total: parsed.students.length });
      }
      setResult(total);
    } catch (err) {
      // Earlier batches may already be saved, so still show what happened
      if (total.total > 0) setResult(total);
      setError(errorMessage(err));
    } finally {
      setProgress(null);
      if (total.created || total.updated) onImported();
    }
  }

  function downloadErrors() {
    if (!result) return;
    downloadFile(
      "student-import-errors.csv",
      toCsv([
        ["Row (excluding header)", "Admission no", "Problems"],
        ...result.failed.map((f) => [String(f.row), f.admissionNo, f.errors.map((e) => `${e.field}: ${e.message}`).join("; ")]),
      ])
    );
  }

  const fieldLabel = (key: string) => STUDENT_FIELDS.find((f) => f.key === key)?.label ?? key;

  return (
    <Drawer title="Import students" onClose={onClose}>
      {error && <Alert>{error}</Alert>}

      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Added", value: result.created, tone: "text-success" },
              { label: "Updated", value: result.updated, tone: "text-accent" },
              { label: "Skipped", value: result.skipped, tone: "text-muted" },
              { label: "Failed", value: result.failed.length, tone: result.failed.length ? "text-danger" : "text-muted" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted">{s.label}</p>
                <p className={cx("mt-1 text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
              </div>
            ))}
          </div>
          {result.skipped > 0 && onDuplicate === "skip" && (
            <p className="text-sm text-muted">
              Skipped rows have an admission number that already exists. Import again with “Update existing students” to overwrite them.
            </p>
          )}
          {result.failed.length > 0 && (
            <Section title="Rows with problems">
              <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
                {result.failed.slice(0, 100).map((f) => (
                  <li key={f.row} className="px-3 py-2">
                    <span className="font-medium">Row {f.row}</span>
                    {f.admissionNo && <span className="text-muted"> · {f.admissionNo}</span>}
                    <ul className="mt-0.5 text-xs text-danger">
                      {f.errors.map((e, i) => (
                        <li key={i}>
                          {fieldLabel(e.field)}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" className="mt-3" onClick={downloadErrors}>
                Download error report
              </Button>
            </Section>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setResult(null); setFile(null); }}>
              Import another file
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      ) : (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className={cx(
              "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragging ? "border-accent bg-accent-soft" : "border-border"
            )}
          >
            <svg viewBox="0 0 24 24" className="mx-auto size-8 text-muted" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
            <p className="mt-2 text-sm">
              {file ? <span className="font-medium">{file.name}</span> : "Drop a CSV or Excel file here, or"}
            </p>
            <Button variant="secondary" size="sm" className="mt-3" loading={reading} onClick={() => fileInput.current?.click()}>
              {file ? "Choose a different file" : "Choose file"}
            </Button>
            <p className="mt-2 text-xs text-muted">.xlsx, .xls or .csv · up to 5 MB</p>
            <input
              ref={fileInput}
              type="file"
              accept={SPREADSHEET_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {file && file.sheets.length > 1 && (
            <Section title="Sheet">
              <Select aria-label="Sheet" value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))}>
                {file.sheets.map((sh, i) => (
                  <option key={sh.name} value={i}>
                    {sh.name} ({Math.max(0, sh.rows.length - 1).toLocaleString()} rows)
                  </option>
                ))}
              </Select>
            </Section>
          )}

          {analysis && "error" in analysis && <Alert tone="warning">{analysis.error}</Alert>}

          {reading && <Spinner className="mx-auto" />}

          {!file && !reading && (
            <div className="space-y-3 text-sm text-muted">
              <p>
                Required columns: <strong className="text-foreground">Admission no</strong> and{" "}
                <strong className="text-foreground">First name</strong> (or a single <strong className="text-foreground">Name</strong>{" "}
                column). Dates can be YYYY-MM-DD, DD/MM/YYYY or Excel dates.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span>Download template:</span>
                <Button variant="secondary" size="sm" onClick={() => downloadSpreadsheet("students-template", templateRows(), "xlsx", { dateColumns: TEMPLATE_DATE_COLUMNS, sheetName: "Students" })}>
                  Excel
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadSpreadsheet("students-template", templateRows(), "csv")}>
                  CSV
                </Button>
              </div>
            </div>
          )}

          {parsed && (
            <>
              <Section title={`${parsed.students.length.toLocaleString()} students found`}>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(parsed.mapping.columns).map((k) => (
                    <Badge key={k} tone="success">
                      {fieldLabel(k)}
                    </Badge>
                  ))}
                  {parsed.mapping.fullNameColumn !== null && <Badge tone="success">Name → first + last</Badge>}
                </div>
                {parsed.mapping.ignored.length > 0 && (
                  <p className="mt-2 text-xs text-muted">Ignored columns: {parsed.mapping.ignored.join(", ")}</p>
                )}
                {parsed.missingRequired > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    {parsed.missingRequired} row(s) are missing an admission number or first name and will be reported as failed.
                  </p>
                )}
              </Section>

              <Section title="Preview">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        {["Admission no", "Name", "Class", "Guardian"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsed.students.slice(0, 5).map((s, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-3 py-2">{s.admissionNo || <span className="text-danger">missing</span>}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {[s.firstName, s.lastName].filter(Boolean).join(" ") || <span className="text-danger">missing</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{[s.grade, s.section].filter(Boolean).join(" - ")}</td>
                          <td className="whitespace-nowrap px-3 py-2">{[s.guardianName, s.guardianPhone].filter(Boolean).join(" · ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="If the admission number already exists">
                <div className="space-y-2 text-sm">
                  {(
                    [
                      ["skip", "Skip the row", "Existing students are left unchanged."],
                      ["update", "Update existing students", "Filled-in cells overwrite the saved values; empty cells are left alone."],
                    ] as const
                  ).map(([value, label, hint]) => (
                    <label key={value} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-checked:border-accent has-checked:bg-accent-soft">
                      <input type="radio" name="onDuplicate" value={value} checked={onDuplicate === value} onChange={() => setOnDuplicate(value)} className="mt-0.5 accent-accent" />
                      <span>
                        <span className="block font-medium">{label}</span>
                        <span className="text-xs text-muted">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Section>

              <div className="flex items-center justify-end gap-3">
                {progress && (
                  <span className="text-sm text-muted">
                    {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                  </span>
                )}
                <Button onClick={runImport} loading={progress !== null}>
                  Import {parsed.students.length.toLocaleString()} students
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
