"use client";

import { useState } from "react";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMoney, moneyInput, parseMoney } from "@/lib/fees";
import { FEATURE_LABEL, type Feature, type PlatformPlan } from "@/lib/platform";
import { Drawer, PageHeader, errorMessage, useResource } from "./shared";

interface Draft {
  id: string | null;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  studentLimit: string;
  features: Record<Feature, boolean>;
  isDefault: boolean;
  archived: boolean;
  order: number;
}

const ALL_ON = Object.fromEntries((Object.keys(FEATURE_LABEL) as Feature[]).map((f) => [f, true])) as Record<Feature, boolean>;

const toDraft = (p: PlatformPlan | null, order = 0): Draft =>
  p
    ? { id: p.id, name: p.name, description: p.description, priceMonthly: moneyInput(p.priceMonthly), priceYearly: moneyInput(p.priceYearly), studentLimit: p.studentLimit ? String(p.studentLimit) : "", features: { ...ALL_ON, ...p.features }, isDefault: p.isDefault, archived: p.archived, order: p.order }
    : { id: null, name: "", description: "", priceMonthly: "", priceYearly: "", studentLimit: "", features: { ...ALL_ON }, isDefault: false, archived: false, order };

/** What schools can buy: price, student limit and features. */
export function Plans() {
  const res = useResource(() => api<{ plans: PlatformPlan[] }>("/api/admin/plans"), "console-plans");
  const [editing, setEditing] = useState<Draft | null>(null);
  const plans = res.data?.plans ?? [];

  return (
    <>
      <PageHeader
        title="Plans"
        description="Prices and what each plan includes. New schools start a 7-day trial on the default plan."
        icon="M3 7h18v10H3zM3 11h18M7 15h3"
        actions={
          <Button onClick={() => setEditing(toDraft(null, plans.length + 1))}>
            <Icon d={ICONS.plus} />
            New plan
          </Button>
        }
      />
      {res.error && <Alert>{res.error}</Alert>}
      {!res.data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <section key={p.id} className={cx("flex flex-col rounded-2xl border bg-surface p-5", p.isDefault ? "border-accent" : "border-border", p.archived && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.isDefault && <Badge tone="accent">Default for new schools</Badge>}
                    {p.archived && <Badge>Archived</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} onClick={() => setEditing(toDraft(p))}>
                  <Icon d={ICONS.edit} />
                </Button>
              </div>
              <p className="mt-3">
                <span className="text-3xl font-semibold tracking-tight">{formatMoney(p.priceMonthly)}</span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <p className="text-xs text-muted">{p.priceYearly ? `${formatMoney(p.priceYearly)} / year` : "No yearly price"}</p>
              {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
              <ul className="mt-3 flex-1 space-y-1 text-sm">
                <li>{p.studentLimit ? `Up to ${p.studentLimit.toLocaleString("en-IN")} students` : "Unlimited students"}</li>
                {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
                  <li key={f} className={cx("flex items-center gap-2", !p.features[f] && "text-muted line-through")}>
                    <Icon d={p.features[f] ? "M5 12l5 5L20 7" : ICONS.x} className={cx("size-4", p.features[f] ? "text-success" : "text-muted")} />
                    {FEATURE_LABEL[f]}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                {p.schools} school{p.schools === 1 ? "" : "s"} on this plan
              </p>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <PlanEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(list) => {
            res.setData({ plans: list });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function PlanEditor({ draft: initial, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (plans: PlatformPlan[]) => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthly = parseMoney(d.priceMonthly);
  const yearly = d.priceYearly.trim() ? parseMoney(d.priceYearly) : 0;
  const valid = d.name.trim() && monthly !== null && yearly !== null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Always the whole plan, so nothing falls back to a default
      const body = { name: d.name.trim(), description: d.description.trim(), priceMonthly: monthly ?? 0, priceYearly: yearly ?? 0, studentLimit: Number(d.studentLimit) || 0, features: d.features, isDefault: d.isDefault, archived: d.archived, order: d.order };
      const res = await api<{ plans: PlatformPlan[] }>(d.id ? `/api/admin/plans/${d.id}` : "/api/admin/plans", { method: d.id ? "PATCH" : "POST", body });
      onSaved(res.plans);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={d.id ? `Edit ${initial.name}` : "New plan"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!valid}>
            Save plan
          </Button>
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {d.id && <Alert tone="warning">Changes apply to every school on this plan right away (limits and features). Recorded payments are not changed.</Alert>}
      <Field label="Name" htmlFor="plan-name">
        <Input id="plan-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={60} placeholder="e.g. Pro" />
      </Field>
      <Field label="Short description" htmlFor="plan-desc">
        <Input id="plan-desc" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} maxLength={300} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price per month (₹)" htmlFor="plan-pm">
          <Input id="plan-pm" inputMode="decimal" value={d.priceMonthly} onChange={(e) => setD({ ...d, priceMonthly: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
        <Field label="Price per year (₹)" htmlFor="plan-py" hint="Empty = 12 × monthly">
          <Input id="plan-py" inputMode="decimal" value={d.priceYearly} onChange={(e) => setD({ ...d, priceYearly: e.target.value.replace(/[^\d.]/g, "") })} />
        </Field>
      </div>
      <Field label="Student limit" htmlFor="plan-limit" hint="Empty = unlimited">
        <Input id="plan-limit" inputMode="numeric" value={d.studentLimit} onChange={(e) => setD({ ...d, studentLimit: e.target.value.replace(/\D/g, "") })} placeholder="Unlimited" />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium">Features</p>
        <div className="space-y-2">
          {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
            <label key={f} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
              {FEATURE_LABEL[f]}
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.features[f]} onChange={(e) => setD({ ...d, features: { ...d.features, [f]: e.target.checked } })} />
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.isDefault} onChange={(e) => setD({ ...d, isDefault: e.target.checked, archived: e.target.checked ? false : d.archived })} />
          Default plan for new schools&apos; trial
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={d.archived} disabled={d.isDefault} onChange={(e) => setD({ ...d, archived: e.target.checked })} />
          Archived (hidden from schools; existing schools keep it)
        </label>
      </div>
    </Drawer>
  );
}
