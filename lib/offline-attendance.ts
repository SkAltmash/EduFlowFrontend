// Attendance saved while offline: kept on this device and sent when the connection is back.
import { ApiError, api } from "@/lib/api";

export interface PendingRegister {
  date: string;
  grade: string;
  section: string;
  entries: { studentId: string; status: string; note: string }[];
  savedAt: string;
}

const KEY = "eduflow.attendance.pending";
export const PENDING_EVENT = "eduflow:attendance-pending";

export function readPending(): PendingRegister[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PendingRegister[];
  } catch {
    return [];
  }
}

function write(list: PendingRegister[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked: nothing more we can do offline
  }
  window.dispatchEvent(new Event(PENDING_EVENT));
}

/** Keeps a register to send later; a newer save of the same class and day merges into it. */
export function queueRegister(p: Omit<PendingRegister, "savedAt">) {
  const list = readPending();
  const i = list.findIndex((x) => x.date === p.date && x.grade === p.grade && x.section === p.section);
  if (i >= 0) {
    const merged = new Map(list[i].entries.map((e) => [e.studentId, e]));
    for (const e of p.entries) merged.set(e.studentId, e);
    list[i] = { ...p, entries: [...merged.values()], savedAt: new Date().toISOString() };
  } else list.push({ ...p, savedAt: new Date().toISOString() });
  write(list);
}

/** A failure that means "no connection", not "the server said no". */
export const isOffline = (err: unknown) => err instanceof ApiError && err.status === 0;

let flushing = false;

/** Sends everything waiting. Registers the server rejects are dropped (they'd never succeed). */
export async function flushPending(): Promise<{ sent: number; failed: number }> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    for (const p of readPending()) {
      try {
        await api("/api/attendance/register", { method: "PUT", body: { date: p.date, grade: p.grade, section: p.section, entries: p.entries } });
        sent += 1;
        write(readPending().filter((x) => !(x.date === p.date && x.grade === p.grade && x.section === p.section)));
      } catch (err) {
        if (isOffline(err)) break;
        failed += 1;
        write(readPending().filter((x) => !(x.date === p.date && x.grade === p.grade && x.section === p.section)));
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
