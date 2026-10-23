// Read and write CSV / Excel files in the browser.
// SheetJS is loaded on demand so it never weighs on the normal page bundle.
import { downloadFile, parseCsv, toCsv } from "./students";

export type SpreadsheetFormat = "xlsx" | "csv";

export interface Sheet {
  name: string;
  /** Every cell as trimmed text; empty rows removed */
  rows: string[][];
}

export const SPREADSHEET_ACCEPT =
  ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function isSpreadsheetFile(file: File) {
  return /\.(csv|xlsx|xls)$/i.test(file.name);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel dates arrive as JS Dates in local time; keep the calendar day the user sees. */
function cellToText(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Returns every non-empty sheet. CSV files become a single sheet. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (/\.csv$/i.test(file.name)) {
    // Own parser for CSV: keeps values like "007" and "21/03/2014" exactly as typed
    return [{ name: file.name, rows: parseCsv(await file.text()) }];
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });

  return workbook.SheetNames.map((name) => {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    });
    const rows = raw.map((r) => r.map(cellToText)).filter((r) => r.some((c) => c !== ""));
    return { name, rows };
  }).filter((s) => s.rows.length > 0);
}

/** Matches YYYY-MM-DD so Excel exports can store real dates. */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Downloads rows as .xlsx or .csv. `dateColumns` are written as real Excel dates
 * (shown as YYYY-MM-DD); everything else stays text so IDs and phone numbers keep leading zeros.
 */
export async function downloadSpreadsheet(
  baseName: string,
  rows: string[][],
  format: SpreadsheetFormat,
  { dateColumns = [], sheetName = "Sheet1" }: { dateColumns?: number[]; sheetName?: string } = {}
) {
  if (format === "csv") {
    // BOM so Excel opens UTF-8 names (e.g. Hindi, Urdu) correctly
    downloadFile(`${baseName}.csv`, "﻿" + toCsv(rows));
    return;
  }

  const XLSX = await import("xlsx");
  const dates = new Set(dateColumns);
  const data = rows.map((row, r) =>
    row.map((cell, c) => {
      const m = r > 0 && dates.has(c) ? cell.match(ISO_DAY) : null;
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : cell;
    })
  );

  const sheet = XLSX.utils.aoa_to_sheet(data, { cellDates: true, dateNF: "yyyy-mm-dd" });
  // Column widths from the longest value, header row gets an autofilter
  sheet["!cols"] = rows[0].map((_, c) => ({
    wch: Math.min(40, Math.max(10, ...rows.slice(0, 500).map((r) => (r[c] ?? "").length + 2))),
  }));
  if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${baseName}.xlsx`, { compression: true });
}
