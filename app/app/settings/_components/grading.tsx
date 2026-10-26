"use client";

import { useState } from "react";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Button, Field, Input, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { SCALE_BANDS, type Grading } from "@/lib/exams";

export function GradingCard() {
  const loaded = useResource(() => api<{ grading: Grading }>("/api/exams/settings"), "grading");
  const [draft, setDraft] = useState<Partial<Grading>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const g = loaded.data?.grading;

  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  if (!g) return <Skeleton className="h-48 rounded-2xl" />;
  const scale = draft.scale ?? g.scale;
  const pass = draft.passPercent ?? g.passPercent;
  const dirty = scale !== g.scale || pass !== g.passPercent;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      loaded.setData(await api<{ grading: Grading }>("/api/exams/settings", { method: "PUT", body: { scale, passPercent: pass } }));
      setDraft({});
      setMessage({ tone: "success", text: "Grading saved. Every test's grades now use it." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold">Grading</h2>
        <p className="text-sm text-muted">How percentages become letter grades on tests and report cards.</p>
      </div>
      <div className="space-y-5 p-5">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ["cbse", "CBSE 8-point (A1–E)", "Used by most CBSE schools"],
              ["simple", "Simple (A+ to F)", "Common in tuition and coaching centres"],
            ] as const
          ).map(([v, title, hint]) => (
            <button
              key={v}
              onClick={() => setDraft((d) => ({ ...d, scale: v }))}
              aria-pressed={scale === v}
              className={cx("rounded-xl border p-4 text-left transition-colors", scale === v ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-muted")}
            >
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted">{hint}</span>
              <span className="mt-3 flex flex-wrap gap-1.5">
                {SCALE_BANDS[v].map((b, i, all) => (
                  <span key={b.grade} className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] tabular-nums">
                    <strong>{b.grade}</strong> {i === 0 ? `${b.min}+` : `${b.min}–${all[i - 1].min - 1}`}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
        <div className="max-w-xs">
          <Field label="Pass percentage" htmlFor="pass-pct" hint="Used for subjects without their own pass marks. CBSE uses 33%.">
            <Input
              id="pass-pct"
              inputMode="numeric"
              value={String(pass)}
              onChange={(e) => setDraft((d) => ({ ...d, passPercent: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) }))}
            />
          </Field>
        </div>
        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={save} loading={busy} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
