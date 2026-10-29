"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetTenantStatus } from "@/components/plan-banner";
import { forgetSchool } from "@/lib/school";
import { WA_ICON } from "@/components/whatsapp-send";
import { Alert, Badge, Button, Field, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { ROLES, api, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMoney, moneyInput, parseMoney } from "@/lib/fees";
import { FEATURE_LABEL, HEALTH_META, STATUS_META, endsText, type Feature, type PlatformPlan, type SchoolDetail } from "@/lib/platform";
import { Drawer, errorMessage, formatDate, generatePassword, loginShareLink, useResource, type Member } from "./shared";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "billing", label: "Billing" },
  { id: "access", label: "Limits" },
  { id: "team", label: "Team" },
  { id: "notes", label: "Notes" },
  { id: "data", label: "Data" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const METHODS = [
  { id: "upi", label: "UPI" },
  { id: "bank", label: "Bank transfer" },
  { id: "cash", label: "Cash" },
  { id: "cheque", label: "Cheque" },
  { id: "card", label: "Card" },
  { id: "other", label: "Other" },
];

const dayInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

type Message = { tone: "success" | "danger"; text: string } | null;

/** Everything about one school: usage, plan and payments, limits, team, notes and data tools. */
export function SchoolDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const router = useRouter();
  const { enterSchool } = useAuth();
  const detail = useResource(() => api<SchoolDetail>(`/api/admin/schools/${id}`), `school:${id}`);
  const plans = useResource(() => api<{ plans: PlatformPlan[] }>("/api/admin/plans"), "console-plans");
  const [section, setSection] = useState<SectionId>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const d = detail.data;
  const s = d?.school;

  /** Runs a change that returns the updated school, then shows `success`. */
  async function run(key: string, action: () => Promise<SchoolDetail | void>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      const next = await action();
      if (next) detail.setData(next);
      setMessage({ tone: "success", text: success });
      onChanged();
      return true;
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function enter() {
    setBusy("enter");
    try {
      await enterSchool(id);
      resetTenantStatus();
      forgetSchool();
      router.push("/app/dashboard");
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
      setBusy(null);
    }
  }

  const ctx = { id, d: d!, plans: plans.data?.plans ?? [], busy, run, setMessage, onClose };

  return (
    <Drawer
      size="lg"
      onClose={onClose}
      title={
        s ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{s.name}</span>
            <Badge tone={STATUS_META[s.subscription.status].tone}>{STATUS_META[s.subscription.status].label}</Badge>
          </span>
        ) : (
          "School"
        )
      }
    >
      {detail.error && <Alert>{detail.error}</Alert>}
      {!d || !s ? (
        !detail.error && <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              <span className="font-mono text-xs">{s.slug}</span> · joined {formatDate(s.createdAt)} · last active {ago(s.lastActiveAt).toLowerCase()}
            </div>
            <Button size="sm" onClick={enter} loading={busy === "enter"} disabled={!s.isActive}>
              <Icon d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H4" />
              Enter school
            </Button>
          </div>

          <div className="-mx-5 flex gap-1 overflow-x-auto border-b border-border px-5">
            {SECTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSection(t.id);
                  setMessage(null);
                }}
                className={cx("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors", section === t.id ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-foreground")}
              >
                {t.label}
              </button>
            ))}
          </div>

          {message && <Alert tone={message.tone}>{message.text}</Alert>}

          {section === "overview" && <OverviewSection d={d} />}
          {/* Remounts when the subscription changes, so its form shows the new dates */}
          {section === "billing" && <BillingSection key={JSON.stringify(s.subscription)} {...ctx} />}
          {section === "access" && <AccessSection {...ctx} />}
          {section === "team" && <TeamSection {...ctx} />}
          {section === "notes" && <NotesSection {...ctx} />}
          {section === "data" && <DataSection {...ctx} />}
        </>
      )}
    </Drawer>
  );
}

interface Ctx {
  id: string;
  d: SchoolDetail;
  plans: PlatformPlan[];
  busy: string | null;
  run: (key: string, action: () => Promise<SchoolDetail | void>, success: string) => Promise<boolean>;
  setMessage: (m: Message) => void;
  onClose: () => void;
}

function Block({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewSection({ d }: { d: SchoolDetail }) {
  const s = d.school;
  const u = d.usage;
  const owner = d.members.find((m) => m.role === "owner");
  const phone = String(s.profile.phone ?? "");
  const digits = phone.replace(/\D/g, "");
  const stats = [
    { label: "Active students", value: `${u.studentsActive}${s.subscription.studentLimit ? ` / ${s.subscription.studentLimit}` : ""}`, sub: `${u.studentsTotal} in total` },
    { label: "Staff", value: u.staff, sub: "with a login" },
    { label: "Days used", value: `${u.activeDaysLast30}/30`, sub: "last 30 days" },
    { label: "Attendance", value: u.attendanceLast7Days, sub: "registers, last 7 days" },
    { label: "Fees collected", value: formatMoney(u.feesThisMonth), sub: `${u.receiptsThisMonth} receipts this month` },
    { label: "WhatsApp", value: u.whatsappLast30Days, sub: "messages, last 30 days" },
  ];
  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <span className={cx("size-2.5 rounded-full", HEALTH_META[s.health].dot)} />
        <span className="font-medium">{HEALTH_META[s.health].label}</span>
        <span className="text-muted">· {s.subscription.planName ?? "No plan"} · {endsText(s.subscription)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((x) => (
          <div key={x.label} className="rounded-xl bg-surface-muted px-3 py-2.5">
            <p className="text-xs text-muted">{x.label}</p>
            <p className="text-lg font-semibold tabular-nums">{x.value}</p>
            <p className="truncate text-[11px] text-muted">{x.sub}</p>
          </div>
        ))}
      </div>

      <Block title="Contact">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Owner</dt>
            <dd className="font-medium">{owner ? owner.name : "—"}</dd>
            {owner && (
              <dd>
                <a href={`mailto:${owner.email}`} className="text-accent hover:underline">
                  {owner.email}
                </a>
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted">School phone</dt>
            <dd className="flex items-center gap-2">
              {phone ? (
                <>
                  <a href={`tel:${phone}`} className="font-medium hover:underline">
                    {phone}
                  </a>
                  <a href={`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`} target="_blank" rel="noopener noreferrer" className="text-success" aria-label="WhatsApp">
                    <Icon d={WA_ICON} />
                  </a>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {Boolean(s.profile.email) && (
            <div>
              <dt className="text-xs text-muted">School email</dt>
              <dd>{String(s.profile.email)}</dd>
            </div>
          )}
          {Boolean(s.profile.city || s.profile.address) && (
            <div>
              <dt className="text-xs text-muted">Address</dt>
              <dd>{[s.profile.address, s.profile.city, s.profile.state].filter(Boolean).join(", ")}</dd>
            </div>
          )}
        </dl>
      </Block>

      <Block title="Recent activity" hint="From the audit log">
        {d.audit.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {d.audit.slice(0, 8).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{a.action}</span>
                  {a.actor && <span className="text-muted"> · {a.actor.name}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted">{formatDate(a.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

// ---------------------------------------------------------------------------
// Billing: plan, status, trial, payments
// ---------------------------------------------------------------------------

function BillingSection({ id, d, plans, busy, run }: Ctx) {
  const sub = d.school.subscription;
  const [form, setForm] = useState(() => ({
    planId: sub.planId ?? "",
    status: (["trial", "active", "suspended"].includes(sub.status) ? sub.status : sub.status === "none" ? "" : "active") as string,
    cycle: sub.cycle,
    trialEndsAt: dayInput(sub.trialEndsAt),
    currentPeriodEnd: dayInput(sub.currentPeriodEnd),
  }));
  const active = plans.filter((p) => !p.archived || p.id === sub.planId);
  const pay = usePaymentForm(sub.planId, sub.cycle, plans);

  const saveSub = () => {
    const body: Record<string, string> = {};
    if (form.planId && form.planId !== sub.planId) body.planId = form.planId;
    if (form.status && form.status !== sub.status) body.status = form.status;
    if (form.cycle !== sub.cycle) body.cycle = form.cycle;
    if (form.trialEndsAt && form.trialEndsAt !== dayInput(sub.trialEndsAt)) body.trialEndsAt = `${form.trialEndsAt}T23:59:59.000Z`;
    if (form.currentPeriodEnd && form.currentPeriodEnd !== dayInput(sub.currentPeriodEnd)) body.currentPeriodEnd = `${form.currentPeriodEnd}T23:59:59.000Z`;
    if (!Object.keys(body).length) return;
    return run("sub", () => api<SchoolDetail>(`/api/admin/schools/${id}/subscription`, { method: "PATCH", body }), "Subscription updated.");
  };

  const extend = (days: number) => run(`extend-${days}`, () => api<SchoolDetail>(`/api/admin/schools/${id}/extend-trial`, { method: "POST", body: { days } }), `Trial extended by ${days} days.`);

  return (
    <>
      <div className={cx("rounded-xl px-4 py-3", sub.readOnly ? "bg-danger-soft" : "bg-surface-muted")}>
        <p className="text-sm">
          <strong>{sub.planName ?? "No plan"}</strong> · {STATUS_META[sub.status].label} · {endsText(sub)}
          {d.school.mrr > 0 && <span className="text-muted"> · {formatMoney(d.school.mrr)}/mo</span>}
        </p>
        {sub.readOnly && <p className="text-xs text-danger">Read-only: the school can view everything but can&apos;t make changes.</p>}
      </div>

      <PlanStates id={id} d={d} plans={plans} busy={busy} run={run} />

      <Block title="Record a payment" hint="Extends the paid period from its current end (or today) and makes the plan active.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan" htmlFor="pay-plan">
            <Select id="pay-plan" value={pay.planId} onChange={(e) => pay.set({ planId: e.target.value })}>
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Billing" htmlFor="pay-cycle">
              <Select id="pay-cycle" value={pay.cycle} onChange={(e) => pay.set({ cycle: e.target.value as "monthly" | "yearly" })}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Select>
            </Field>
            <Field label={pay.cycle === "yearly" ? "Years" : "Months"} htmlFor="pay-periods">
              <Input id="pay-periods" type="number" min={1} max={36} value={pay.periods} onChange={(e) => pay.set({ periods: Math.max(1, Math.min(36, Number(e.target.value) || 1)) })} />
            </Field>
          </div>
          <Field label="Amount received (₹)" htmlFor="pay-amount">
            <Input id="pay-amount" inputMode="decimal" value={pay.amount} onChange={(e) => pay.set({ amount: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <Select id="pay-method" value={pay.method} onChange={(e) => pay.set({ method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="pay-ref">
            <Input id="pay-ref" value={pay.reference} onChange={(e) => pay.set({ reference: e.target.value })} placeholder="UTR / cheque no." maxLength={100} />
          </Field>
          <Field label="Note" htmlFor="pay-note">
            <Input id="pay-note" value={pay.note} onChange={(e) => pay.set({ note: e.target.value })} placeholder="Optional" maxLength={300} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            loading={busy === "pay"}
            disabled={!pay.valid}
            onClick={async () => {
              const ok = await run("pay", () => api<SchoolDetail>(`/api/admin/schools/${id}/payments`, { method: "POST", body: pay.body }), `Payment of ${formatMoney(pay.body.amount)} recorded.`);
              if (ok) pay.reset();
            }}
          >
            Mark paid
          </Button>
        </div>
      </Block>

      {sub.status === "trial" || sub.status === "expired" || sub.status === "none" ? (
        <Block title="Trial" hint={sub.trialEndsAt ? `Ends ${formatDate(sub.trialEndsAt)}` : "No trial running"}>
          <div className="flex flex-wrap gap-2">
            {[3, 7, 14, 30].map((n) => (
              <Button key={n} variant="secondary" size="sm" loading={busy === `extend-${n}`} disabled={busy !== null} onClick={() => extend(n)}>
                +{n} days
              </Button>
            ))}
          </div>
        </Block>
      ) : null}

      <Block title="Subscription" hint="Change the plan, status or end dates by hand.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan" htmlFor="sub-plan">
            <Select id="sub-plan" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              {!form.planId && <option value="">— No plan —</option>}
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatMoney(p.priceMonthly)}/mo)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="sub-status">
            <Select id="sub-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {!form.status && <option value="">— Not set (full access) —</option>}
              <option value="trial">Trial</option>
              <option value="active">Active (paid)</option>
              <option value="suspended">Suspended (read-only)</option>
            </Select>
          </Field>
          <Field label="Billing cycle" htmlFor="sub-cycle">
            <Select id="sub-cycle" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value as "monthly" | "yearly" })}>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </Field>
          <Field label="Trial ends" htmlFor="sub-trial">
            <Input id="sub-trial" type="date" value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
          </Field>
          <Field label="Paid until" htmlFor="sub-period">
            <Input id="sub-period" type="date" value={form.currentPeriodEnd} onChange={(e) => setForm({ ...form, currentPeriodEnd: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" loading={busy === "sub"} onClick={saveSub}>
            Save subscription
          </Button>
        </div>
      </Block>

      <Block title="Payment history">
        {d.payments.length === 0 ? (
          <p className="text-sm text-muted">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {d.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium">
                    {formatMoney(p.amount)} · {p.planName} · {p.periods} {p.cycle === "yearly" ? "yr" : "mo"}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {formatDate(p.createdAt)} · {METHODS.find((m) => m.id === p.method)?.label ?? p.method}
                    {p.reference && ` · ${p.reference}`} · covers to {formatDate(p.periodEnd)}
                    {p.recordedByName && ` · by ${p.recordedByName}`}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete payment"
                  loading={busy === `delpay-${p.id}`}
                  onClick={() => confirm(`Delete this ${formatMoney(p.amount)} payment? The paid period is not shortened automatically.`) && run(`delpay-${p.id}`, () => api<SchoolDetail>(`/api/admin/schools/${id}/payments/${p.id}`, { method: "DELETE" }), "Payment deleted.")}
                >
                  <Icon d={ICONS.x} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

/** One-tap plan states, to see exactly what the school sees in each (then "Enter school"). */
const STATES = [
  { id: "trial", label: "Trial, 2 days left", hint: "Yellow \"trial ending\" banner", tone: "accent", body: () => ({ status: "trial", trialEndsAt: at(2) }) },
  { id: "overdue", label: "Payment due", hint: "Red banner, still works for 3 days", tone: "danger", body: () => ({ status: "active", currentPeriodEnd: at(-1) }) },
  { id: "expired", label: "Expired", hint: "Read-only: can view, can't change", tone: "danger", lock: true, body: () => ({ status: "active", currentPeriodEnd: at(-4) }) },
  { id: "trial-ended", label: "Trial ended", hint: "Read-only after the free trial", tone: "danger", lock: true, body: () => ({ status: "trial", trialEndsAt: at(-1) }) },
  { id: "suspended", label: "Suspended", hint: "On hold by you: read-only", tone: "danger", lock: true, body: () => ({ status: "suspended" }) },
  { id: "active", label: "Active, 30 days", hint: "Back to normal", tone: "success", body: () => ({ status: "active", currentPeriodEnd: at(30) }) },
] as const;

function PlanStates({ id, d, plans, busy, run }: Pick<Ctx, "id" | "d" | "plans" | "busy" | "run">) {
  const sub = d.school.subscription;
  const planId = sub.planId ?? plans.find((p) => p.isDefault)?.id;

  async function apply(state: (typeof STATES)[number]) {
    if ("lock" in state && !confirm(`Put ${d.school.name} in "${state.label}"? Its real staff will see this too, and they can't make changes until you set it back.`)) return;
    await run(
      `state-${state.id}`,
      () => api<SchoolDetail>(`/api/admin/schools/${id}/subscription`, { method: "PATCH", body: { ...(planId && !sub.planId ? { planId } : {}), ...state.body() } }),
      `Now "${state.label}". Tap "Enter school" to see what they see.`
    );
  }

  return (
    <Block
      title="Test plan states"
      hint="Switch this school to a state, then tap Enter school (top) to see the banners and what's locked. This changes the real school."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {STATES.map((st) => {
          const on =
            (st.id === "active" && sub.status === "active") ||
            (st.id === "trial" && sub.status === "trial") ||
            (st.id === "overdue" && sub.status === "overdue") ||
            (st.id === "suspended" && sub.status === "suspended") ||
            (st.id === "expired" && sub.status === "expired" && sub.endsAt !== sub.trialEndsAt) ||
            (st.id === "trial-ended" && sub.status === "expired" && sub.endsAt === sub.trialEndsAt);
          return (
            <button
              key={st.id}
              onClick={() => apply(st)}
              disabled={busy !== null}
              aria-pressed={on}
              className={cx(
                "rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                on ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-muted"
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={cx("size-2 rounded-full", st.tone === "success" ? "bg-success" : st.tone === "accent" ? "bg-accent" : "bg-danger")} />
                {st.label}
                {busy === `state-${st.id}` && <span className="text-xs text-muted">…</span>}
              </span>
              <span className="block text-xs text-muted">{st.hint}</span>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

function usePaymentForm(currentPlan: string | null, currentCycle: "monthly" | "yearly", plans: PlatformPlan[]) {
  const fallback = currentPlan ?? plans.find((p) => p.isDefault)?.id ?? plans[0]?.id ?? "";
  const [state, setState] = useState<{ planId: string | null; cycle: "monthly" | "yearly"; periods: number; amount: string | null; method: string; reference: string; note: string }>({
    planId: null,
    cycle: currentCycle,
    periods: 1,
    amount: null,
    method: "upi",
    reference: "",
    note: "",
  });
  const planId = state.planId ?? fallback;
  const plan = plans.find((p) => p.id === planId);
  const suggested = plan ? (state.cycle === "yearly" ? plan.priceYearly || plan.priceMonthly * 12 : plan.priceMonthly) * state.periods : 0;
  // The amount follows the plan price until it's typed over
  const amount = state.amount ?? (suggested ? moneyInput(suggested) : "");
  const paise = parseMoney(amount);
  return {
    ...state,
    planId,
    amount,
    valid: Boolean(planId) && paise !== null && paise >= 0,
    body: { planId, amount: paise ?? 0, method: state.method, reference: state.reference.trim(), cycle: state.cycle, periods: state.periods, note: state.note.trim() },
    set: (patch: Partial<typeof state>) => setState((s) => ({ ...s, ...patch, ...("amount" in patch ? {} : patch.planId || patch.cycle || patch.periods ? { amount: null } : {}) })),
    reset: () => setState((s) => ({ ...s, periods: 1, amount: null, reference: "", note: "" })),
  };
}

// ---------------------------------------------------------------------------
// Limits & features, block, log out everyone
// ---------------------------------------------------------------------------

type Tri = "plan" | "on" | "off";

function AccessSection({ id, d, plans, busy, run, setMessage }: Ctx) {
  const s = d.school;
  const plan = plans.find((p) => p.id === s.subscription.planId);
  const [limit, setLimit] = useState(s.studentLimitOverride === null ? "" : String(s.studentLimitOverride));
  const [features, setFeatures] = useState<Record<Feature, Tri>>(() => {
    const o = s.featureOverrides;
    return Object.fromEntries((Object.keys(FEATURE_LABEL) as Feature[]).map((f) => [f, o[f] === undefined || o[f] === null ? "plan" : o[f] ? "on" : "off"])) as Record<Feature, Tri>;
  });

  const save = () =>
    run(
      "limits",
      () =>
        api<SchoolDetail>(`/api/admin/schools/${id}/limits`, {
          method: "PATCH",
          body: {
            studentLimit: limit.trim() === "" ? null : Math.max(0, Math.round(Number(limit) || 0)),
            features: Object.fromEntries(Object.entries(features).map(([f, v]) => [f, v === "plan" ? null : v === "on"])),
          },
        }),
      "Limits saved."
    );

  const toggleBlock = async () => {
    if (s.isActive && !confirm(`Block ${s.name}? Everyone is signed out and nobody can sign in until you unblock it.`)) return;
    await run(
      "block",
      async () => {
        await api(`/api/admin/tenants/${id}`, { method: "PATCH", body: { isActive: !s.isActive } });
        return api<SchoolDetail>(`/api/admin/schools/${id}`);
      },
      s.isActive ? "School blocked." : "School unblocked."
    );
  };

  return (
    <>
      <Block title="Student limit" hint={`Plan allows ${plan ? (plan.studentLimit ? plan.studentLimit : "unlimited") : "unlimited"}. Leave empty to follow the plan; 0 = unlimited.`}>
        <div className="flex items-center gap-2">
          <Input aria-label="Student limit" inputMode="numeric" className="w-40" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} placeholder="Plan default" />
          <span className="text-sm text-muted">
            {d.usage.studentsActive} active now · effective limit {s.subscription.studentLimit || "unlimited"}
          </span>
        </div>
      </Block>

      <Block title="Features" hint="Turn a feature on or off for this school only.">
        <ul className="space-y-2">
          {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
            <li key={f} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {FEATURE_LABEL[f]}
                <span className="ml-1.5 text-xs text-muted">(plan: {plan ? (plan.features[f] ? "on" : "off") : "on"})</span>
              </span>
              <div className="flex rounded-lg border border-border p-0.5 text-xs">
                {(["plan", "on", "off"] as Tri[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFeatures({ ...features, [f]: v })}
                    aria-pressed={features[f] === v}
                    className={cx("rounded-md px-2.5 py-1 capitalize", features[f] === v ? (v === "off" ? "bg-danger-soft font-medium text-danger" : v === "on" ? "bg-success-soft font-medium text-success" : "bg-surface-muted font-medium") : "text-muted")}
                  >
                    {v === "plan" ? "Plan" : v}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button loading={busy === "limits"} onClick={save}>
            Save limits
          </Button>
        </div>
      </Block>

      <Block title="Sessions" hint="Sign every member of this school out of every device.">
        <Button
          variant="secondary"
          loading={busy === "logout"}
          onClick={async () => {
            if (!confirm(`Log everyone in ${s.name} out?`)) return;
            let ended = 0;
            const ok = await run(
              "logout",
              async () => {
                ended = (await api<{ sessionsEnded: number }>(`/api/admin/schools/${id}/logout-all`, { method: "POST" })).sessionsEnded;
              },
              "Everyone was logged out."
            );
            if (ok) setMessage({ tone: "success", text: `Everyone was logged out (${ended} session${ended === 1 ? "" : "s"} ended).` });
          }}
        >
          Log out everyone
        </Button>
      </Block>

      <Block title={s.isActive ? "Block school" : "School is blocked"} hint={s.isActive ? "Stops all sign-ins. Data stays." : "Nobody can sign in."}>
        <Button variant={s.isActive ? "danger" : "secondary"} loading={busy === "block"} onClick={toggleBlock}>
          {s.isActive ? "Block" : "Unblock"}
        </Button>
      </Block>
    </>
  );
}

// ---------------------------------------------------------------------------
// Team: roles, add, share login
// ---------------------------------------------------------------------------

function TeamSection({ id, d, busy, run }: Ctx) {
  const [newMember, setNewMember] = useState<{ email: string; role: Role }>({ email: "", role: "teacher" });
  const [shared, setShared] = useState<{ userId: string; link: string; password: string } | null>(null);
  const phone = String(d.school.profile.phone ?? "");

  const refresh = async () => api<SchoolDetail>(`/api/admin/schools/${id}`);
  const withMembers = async (p: Promise<{ members: Member[] }>) => {
    await p;
    return refresh();
  };

  async function resetAndShare(m: SchoolDetail["members"][number]) {
    if (!confirm(`Set a new password for ${m.name}? Their current password stops working and they're signed out everywhere.`)) return;
    const password = generatePassword();
    const ok = await run(
      `reset-${m.userId}`,
      async () => {
        await api(`/api/admin/users/${m.userId}/reset-password`, { method: "POST", body: { password } });
      },
      `New password set for ${m.name}. Send it now; it won't be shown again.`
    );
    if (ok) setShared({ userId: m.userId, password, link: loginShareLink({ name: m.name, email: m.email, password, phone: m.role === "owner" ? phone : "" }) });
  }

  return (
    <>
      <Block title={`Members (${d.members.length})`}>
        <ul className="divide-y divide-border">
          {d.members.map((m) => (
            <li key={m.userId} className="py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.name} {!m.isActive && <Badge tone="danger">disabled</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email}</p>
                </div>
                <Select
                  aria-label={`Role for ${m.name}`}
                  className="h-8 w-32 text-xs"
                  value={m.role}
                  disabled={busy !== null}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    run(`role-${m.userId}`, () => withMembers(api(`/api/admin/tenants/${id}/members/${m.userId}`, { method: "PATCH", body: { role } })), `${m.name} is now ${role}.`);
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" size="sm" loading={busy === `reset-${m.userId}`} disabled={busy !== null} onClick={() => resetAndShare(m)}>
                  <Icon d={WA_ICON} />
                  Send login
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.name}`}
                  disabled={busy !== null}
                  onClick={() => confirm(`Remove ${m.name} from ${d.school.name}?`) && run(`remove-${m.userId}`, () => withMembers(api(`/api/admin/tenants/${id}/members/${m.userId}`, { method: "DELETE" })), `${m.name} removed.`)}
                >
                  <Icon d={ICONS.x} />
                </Button>
              </div>
              {shared?.userId === m.userId && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm">
                  <span>
                    New password: <code className="font-mono font-semibold">{shared.password}</code>
                  </span>
                  <a href={shared.link} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
                    <Icon d={WA_ICON} className="size-4" />
                    Send on WhatsApp
                  </a>
                </div>
              )}
            </li>
          ))}
          {d.members.length === 0 && <li className="py-6 text-center text-sm text-muted">No members</li>}
        </ul>
      </Block>

      <Block title="Add member" hint="Someone who already has an EduFlow account.">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run("add", () => withMembers(api(`/api/admin/tenants/${id}/members`, { method: "POST", body: newMember })), `${newMember.email} added.`);
            if (ok) setNewMember({ email: "", role: "teacher" });
          }}
        >
          <Input type="email" required className="min-w-0 flex-1" placeholder="Email" value={newMember.email} onChange={(e) => setNewMember((n) => ({ ...n, email: e.target.value }))} />
          <Select aria-label="Role" className="w-32" value={newMember.role} onChange={(e) => setNewMember((n) => ({ ...n, role: e.target.value as Role }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Button type="submit" loading={busy === "add"} disabled={!newMember.email}>
            Add
          </Button>
        </form>
      </Block>
    </>
  );
}

// ---------------------------------------------------------------------------
// Notes & history
// ---------------------------------------------------------------------------

function NotesSection({ id, d, busy, run }: Ctx) {
  const [text, setText] = useState("");
  return (
    <>
      <Block title="Notes" hint="Private to super admins: calls, promises, follow-ups.">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const ok = await run("note", () => api<SchoolDetail>(`/api/admin/schools/${id}/notes`, { method: "POST", body: { text: text.trim() } }), "Note added.");
            if (ok) setText("");
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Called the principal, wants yearly billing from April."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={busy === "note"} disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </form>
        {d.notes.length > 0 && (
          <ul className="space-y-2">
            {d.notes.map((n) => (
              <li key={n.id} className="group rounded-lg bg-surface-muted px-3 py-2">
                <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>
                    {n.byName} · {formatDate(n.at, true)}
                  </span>
                  <button onClick={() => confirm("Delete this note?") && run(`note-${n.id}`, () => api<SchoolDetail>(`/api/admin/schools/${id}/notes/${n.id}`, { method: "DELETE" }), "Note deleted.")} className="text-danger hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="History" hint="Last 20 audit entries for this school">
        {d.audit.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {d.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3 py-2">
                <span>
                  <span className="font-mono text-xs">{a.action}</span>
                  {a.actor && <span className="text-muted"> · {a.actor.name}</span>}
                </span>
                <span className="text-xs text-muted">{formatDate(a.createdAt, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

// ---------------------------------------------------------------------------
// Data: export (DPDP access request) and permanent delete (erasure request)
// ---------------------------------------------------------------------------

function DataSection({ id, d, busy, run, onClose }: Ctx) {
  const [confirmText, setConfirmText] = useState("");
  const s = d.school;

  const exportData = () =>
    run(
      "export",
      async () => {
        const data = await api<unknown>(`/api/admin/schools/${id}/export`);
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `eduflow-${s.slug}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      "Export downloaded. It contains personal data: store it safely and delete it when done."
    );

  return (
    <>
      <Block title="Export all data" hint="Everything this school has in EduFlow as one JSON file (for a data request or before deleting).">
        <Button variant="secondary" loading={busy === "export"} onClick={exportData}>
          <Icon d={ICONS.download} />
          Download export
        </Button>
      </Block>

      <section className="rounded-xl border border-danger/40 bg-danger-soft/40 p-4">
        <h3 className="text-sm font-semibold text-danger">Delete school permanently</h3>
        <p className="mt-1 text-sm text-muted">
          Removes the school, its students, attendance, fees, tests, messages and every account that belongs only to this school. This can&apos;t be undone. Download an export first.
        </p>
        <Field label={`Type ${s.slug} to confirm`} htmlFor="delete-confirm">
          <Input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="mt-1 max-w-xs font-mono" />
        </Field>
        <Button
          variant="danger"
          className="mt-3"
          disabled={confirmText.trim() !== s.slug}
          loading={busy === "delete"}
          onClick={async () => {
            const ok = await run("delete", async () => void (await api(`/api/admin/schools/${id}`, { method: "DELETE", body: { confirm: confirmText.trim() } })), `${s.name} deleted.`);
            if (ok) onClose();
          }}
        >
          Delete {s.name}
        </Button>
      </section>
    </>
  );
}
