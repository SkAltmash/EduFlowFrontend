"use client";

import { useState } from "react";
import { Drawer, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Input, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDay } from "@/lib/attendance";
import {
  concessionDiscount,
  concessionShort,
  formatMoney,
  moneyInput,
  parseMoney,
  type Concession,
  type ConcessionPreset,
  type ConcessionType,
  type Due,
} from "@/lib/fees";
import { MoneyInput } from "./collect-drawer";

export const REASONS = ["Sibling", "Staff child", "RTE", "Scholarship", "Financial help", "Merit", "Other"];

const TYPES: { id: ConcessionType; label: string; hint: string }[] = [
  { id: "percent", label: "% off", hint: "e.g. 10% off every installment" },
  { id: "amount", label: "₹ off", hint: "A fixed amount less on every installment" },
  { id: "fixed", label: "Fixed fee", hint: "Pays this much per installment" },
  { id: "free", label: "Free", hint: "Nothing to pay (RTE, full scholarship)" },
];

export function usePresets() {
  return useResource(() => api<{ presets: ConcessionPreset[]; isDefault: boolean }>("/api/fees/concession-presets"), "concession-presets");
}

/** Text form of a concession being edited (money as rupees text). */
export interface ConcessionDraft {
  type: ConcessionType;
  value: string;
  reason: string;
  presetId: string | null;
}

export const emptyDraft = (): ConcessionDraft => ({ type: "percent", value: "", reason: "", presetId: null });

export function toDraft(c: Concession | null | undefined): ConcessionDraft {
  if (!c) return emptyDraft();
  return { type: c.type, value: c.type === "percent" ? String(c.value) : c.type === "free" ? "" : moneyInput(c.value), reason: c.reason, presetId: c.presetId ?? null };
}

/** The draft as an API concession, or null when it isn't valid yet. */
export function fromDraft(d: ConcessionDraft): Concession | null {
  if (d.type === "free") return { type: "free", value: 0, reason: d.reason.trim(), ...(d.presetId ? { presetId: d.presetId } : {}) };
  const value = d.type === "percent" ? Number(d.value) : parseMoney(d.value);
  if (value === null || Number.isNaN(value) || value < 0 || (d.type === "percent" && (value > 100 || value === 0)) || (d.type === "amount" && value === 0)) return null;
  return { type: d.type, value, reason: d.reason.trim(), ...(d.presetId ? { presetId: d.presetId } : {}) };
}

export function presetToConcession(p: ConcessionPreset): Concession {
  return { type: p.type, value: p.value, reason: p.name, ...(p.id ? { presetId: p.id } : {}) };
}

/** Ready-made types first (one tap), then a custom form. */
export function ConcessionPicker({ draft, onChange, presets }: { draft: ConcessionDraft; onChange: (d: ConcessionDraft) => void; presets: ConcessionPreset[] }) {
  const custom = !draft.presetId;
  return (
    <div className="space-y-4">
      {presets.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Quick pick</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {presets.map((p) => {
              const on = draft.presetId === p.id && p.id !== null;
              return (
                <button
                  key={p.id ?? p.name}
                  type="button"
                  onClick={() => onChange(toDraft({ ...presetToConcession(p), presetId: p.id }))}
                  aria-pressed={on}
                  className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-muted")}
                >
                  <span className={cx("block text-sm font-medium", on && "text-accent")}>{p.name}</span>
                  <span className="block text-xs text-muted">{concessionShort(p)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={cx("rounded-xl border p-3", custom ? "border-accent/40" : "border-border")}>
        <p className="mb-2 text-sm font-medium">{presets.length ? "Or set your own" : "Concession"}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => onChange({ ...draft, type: t.id, presetId: null, value: draft.type === t.id ? draft.value : "" })}
              aria-pressed={custom && draft.type === t.id}
              className={cx("h-9 rounded-lg border text-xs font-medium sm:text-sm", custom && draft.type === t.id ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface hover:bg-surface-muted")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{TYPES.find((t) => t.id === draft.type)?.hint}</p>
        {draft.type !== "free" && (
          <div className="mt-2 max-w-48">
            {draft.type === "percent" ? (
              <div className="relative">
                <Input aria-label="Percent off" inputMode="decimal" value={draft.value} onChange={(e) => onChange({ ...draft, presetId: null, value: e.target.value.replace(/[^\d.]/g, "") })} placeholder="10" className="pr-8" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
              </div>
            ) : (
              <MoneyInput id="concession-amount" value={draft.value} onChange={(v) => onChange({ ...draft, presetId: null, value: v })} />
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onChange({ ...draft, presetId: null, reason: draft.reason === r ? "" : r })}
              aria-pressed={draft.reason === r}
              className={cx("rounded-full border px-2.5 py-1 text-xs transition-colors", draft.reason === r ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:bg-surface-muted")}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A student's standing concession, with a before/after preview of their unpaid dues. */
export function ConcessionDrawer({
  studentId,
  studentName,
  current,
  dues,
  onClose,
  onSaved,
}: {
  studentId: string;
  studentName: string;
  current: Concession | null | undefined;
  dues: Due[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const presets = usePresets();
  const [draft, setDraft] = useState<ConcessionDraft>(() => toDraft(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const concession = fromDraft(draft);

  // Dues the concession can still change: unpaid, and not hand-edited on the due itself
  const open = dues.filter((d) => d.balance > 0);
  const preview = open.map((d) => {
    const handEdited = d.discountSource === "manual";
    const after = handEdited ? d.discount : Math.min(concessionDiscount(d.amount, concession), d.amount - d.paid);
    return { d, before: d.amount - d.discount, after: d.amount - after };
  });
  const saving = preview.reduce((t, p) => t + Math.max(0, p.before - p.after), 0);

  async function save(c: Concession | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ duesUpdated: number }>(`/api/fees/students/${studentId}/concession`, { method: "PUT", body: { concession: c } });
      onSaved(c ? `Concession saved for ${studentName}. ${res.duesUpdated} unpaid due${res.duesUpdated === 1 ? "" : "s"} updated; new fee plans will include it too.` : `Concession removed for ${studentName}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`Concession · ${studentName}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          {current ? (
            <Button variant="danger" onClick={() => confirm(`Remove ${studentName}'s concession? Unpaid dues go back to the full fee.`) && save(null)} disabled={busy}>
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => concession && save(concession)} loading={busy} disabled={!concession}>
              Save concession
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {current && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
          <span>
            Now: <strong>{current.label}</strong>
          </span>
          {current.updatedByName && <span className="text-xs text-muted">by {current.updatedByName}</span>}
        </div>
      )}

      {presets.data ? <ConcessionPicker draft={draft} onChange={setDraft} presets={presets.data.presets} /> : null}

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-medium">What changes</p>
          {saving > 0 && <span className="text-sm font-semibold text-success">Saves {formatMoney(saving)}</span>}
        </div>
        {open.length === 0 ? (
          <p className="rounded-lg bg-surface-muted px-3 py-3 text-sm text-muted">No unpaid dues right now. The concession will apply to fee plans assigned later.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {preview.map(({ d, before, after }) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{d.label}</span>
                  <span className="text-xs text-muted">
                    {d.planName} · due {formatDay(d.dueDate, "short")}
                    {d.paid > 0 && ` · ${formatMoney(d.paid)} paid`}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {after !== before && <span className="mr-2 text-xs text-muted line-through">{formatMoney(before)}</span>}
                  <span className={cx("font-semibold", after < before && "text-success")}>{formatMoney(after)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Paid dues aren&apos;t changed. A concession set on a single due by hand is kept.</p>
      </div>
    </Drawer>
  );
}

/** Small tag for a concession in lists. */
export function ConcessionTag({ c }: { c: Concession }) {
  return <Badge tone="success">{c.reason ? `${c.reason} · ${concessionShort(c)}` : concessionShort(c)}</Badge>;
}
