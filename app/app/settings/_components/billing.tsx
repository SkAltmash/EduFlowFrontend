"use client";

import { supportLink, useTenantStatus } from "@/components/plan-banner";
import { Badge, Icon, Skeleton, buttonClass, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { formatMoney } from "@/lib/fees";
import { FEATURE_LABEL, STATUS_META, endsText, type Feature } from "@/lib/platform";
import { SettingsCard } from "./card";

const CHECK = "M5 12l5 5L20 7";

/** The school's EduFlow plan: what it includes, when it ends and how to renew or upgrade. */
export function BillingSettings() {
  const status = useTenantStatus();
  if (!status) return <Skeleton className="h-72 rounded-2xl" />;
  const sub = status.subscription;
  const meta = STATUS_META[sub.status];
  const endsOn = sub.status === "trial" ? sub.trialEndsAt : sub.currentPeriodEnd;
  const ask = (text: string) => supportLink(status, text);

  return (
    <div className="space-y-6">
      <SettingsCard title="Your plan" description="What your school's EduFlow subscription includes.">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-semibold tracking-tight">{sub.planName ?? (sub.status === "none" ? "Full access" : "No plan")}</p>
              <Badge tone={meta.tone}>{sub.status === "none" ? "Free" : meta.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {sub.status === "none"
                ? "Your school has full access with no end date."
                : `${endsText(sub)}${endsOn ? ` · ${sub.status === "trial" ? "trial ends" : "renews"} ${new Date(endsOn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
              {sub.status === "active" && ` · billed ${sub.cycle}`}
            </p>
          </div>
          <a href={ask(sub.status === "trial" ? "Hi, we'd like to start a paid EduFlow plan." : "Hi, I'd like to renew our EduFlow plan.")} target="_blank" rel="noopener noreferrer" className={buttonClass("primary")}>
            <Icon d={WA_ICON} />
            {sub.status === "active" || sub.status === "none" ? "Contact support" : sub.status === "trial" ? "Choose a plan" : "Renew now"}
          </a>
        </div>
        {sub.readOnly && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm">Your school is read-only: everything can be viewed, but nothing can be added or changed until the plan is renewed.</p>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <dt className="text-xs text-muted">Students</dt>
            <dd className="mt-0.5 font-medium">{sub.studentLimit ? `Up to ${sub.studentLimit.toLocaleString("en-IN")} active students` : "Unlimited"}</dd>
          </div>
          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <dt className="text-xs text-muted">Features</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
                <span key={f} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", sub.features[f] ? "bg-success-soft text-success" : "bg-surface text-muted line-through")}>
                  {sub.features[f] && <Icon d={CHECK} className="size-3" />}
                  {FEATURE_LABEL[f]}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </SettingsCard>

      {status.plans.length > 0 && (
        <SettingsCard title="Plans" description="Prices per school. Payments go through EduFlow support for now.">
          <div className="grid gap-4 md:grid-cols-2">
            {status.plans.map((p) => {
              const current = p.id === sub.planId;
              return (
                <div key={p.id} className={cx("flex flex-col rounded-2xl border p-5", current ? "border-accent bg-accent-soft/40" : "border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {current && <Badge tone="accent">Current</Badge>}
                  </div>
                  <p className="mt-2">
                    <span className="text-3xl font-semibold tracking-tight">{formatMoney(p.priceMonthly)}</span>
                    <span className="text-sm text-muted"> / month</span>
                  </p>
                  {p.priceYearly > 0 && <p className="text-xs text-muted">or {formatMoney(p.priceYearly)} / year</p>}
                  {p.description && <p className="mt-2 text-sm text-muted">{p.description}</p>}
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Icon d={CHECK} className="size-4 text-success" />
                      {p.studentLimit ? `Up to ${p.studentLimit.toLocaleString("en-IN")} students` : "Unlimited students"}
                    </li>
                    {(Object.keys(FEATURE_LABEL) as Feature[]).map((f) => (
                      <li key={f} className={cx("flex items-center gap-2", !p.features[f] && "text-muted line-through")}>
                        <Icon d={p.features[f] ? CHECK : "M6 6l12 12M18 6L6 18"} className={cx("size-4", p.features[f] ? "text-success" : "text-muted")} />
                        {FEATURE_LABEL[f]}
                      </li>
                    ))}
                  </ul>
                  {!current && (
                    <a href={ask(`Hi, we'd like the EduFlow ${p.name} plan.`)} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("secondary"), "mt-4")}>
                      Get {p.name}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {status.support.email && (
            <p className="text-sm text-muted">
              Questions? Email{" "}
              <a href={`mailto:${status.support.email}`} className="text-accent hover:underline">
                {status.support.email}
              </a>
            </p>
          )}
        </SettingsCard>
      )}
    </div>
  );
}
