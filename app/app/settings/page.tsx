"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageIcon, useResource } from "@/components/data";
import { useTenantStatus } from "@/components/plan-banner";
import { ICONS, Icon, Input, cx } from "@/components/ui";
import { loadClassList } from "@/lib/academics";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { endsText } from "@/lib/platform";
import { RECEIPT_ACCENTS, loadSchool, receiptSettings } from "@/lib/school";
import { SETTINGS_GROUPS, matches, sectionById, sectionsFor } from "./_components/sections";

const SETTINGS_ICON =
  "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z";

/** Settings home: find any setting, see what's left to set up, and open a section. */
export default function SettingsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;
  const isAdmin = role === "owner" || role === "admin";
  const sections = sectionsFor(isAdmin);
  const [q, setQ] = useState("");

  // Old links like /app/settings#billing open the section's own page
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && sectionById(id)) router.replace(`/app/settings/${id}`);
  }, [router]);

  const status = useSectionStatus(isAdmin);
  const shown = sections.filter((s) => matches(s, q));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PageIcon d={SETTINGS_ICON} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted">{isAdmin ? "Your school, your team and how EduFlow works for you." : "Your account and preferences."}</p>
          </div>
        </div>
        {sections.length > 3 && (
          <div className="relative w-full sm:w-72">
            <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a setting, e.g. logo, password" aria-label="Find a setting" className="pl-9" autoFocus={false} />
          </div>
        )}
      </div>

      {isAdmin && !q && <SetupChecklist status={status} />}

      <div className="space-y-7">
        {SETTINGS_GROUPS.map((g) => {
          const items = shown.filter((s) => s.group === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{g}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => (
                  <Link
                    key={s.id}
                    href={`/app/settings/${s.id}`}
                    className="group flex gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Icon d={s.icon} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{s.label}</span>
                        <Icon d={ICONS.chevronRight} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{s.description}</span>
                      {status[s.id] && (
                        <span className={cx("mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", status[s.id]!.ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                          <span className={cx("size-1.5 rounded-full", status[s.id]!.ok ? "bg-success" : "bg-warning")} />
                          {status[s.id]!.text}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
        {shown.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">No setting matches “{q}”.</p>}
      </div>
    </div>
  );
}

type Status = Partial<Record<string, { ok: boolean; text: string }>>;

/** A short status for each section card, from data already cached elsewhere in the app. */
function useSectionStatus(isAdmin: boolean): Status {
  const school = useResource(loadSchool, "school-profile").data;
  const classes = useResource(() => (isAdmin ? loadClassList() : Promise.resolve(null)), `settings-classes:${isAdmin}`).data;
  const team = useResource(() => (isAdmin ? api<{ members: unknown[] }>("/api/school/members") : Promise.resolve(null)), `settings-team:${isAdmin}`).data;
  const plan = useTenantStatus()?.subscription;
  const status: Status = {};
  if (school) {
    const contact = Boolean(school.phone && school.address);
    status.school = school.logoUrl && contact ? { ok: true, text: "Logo and contact added" } : { ok: false, text: !school.logoUrl ? "No logo yet" : "Add phone and address" };
    const r = receiptSettings(school.receipt);
    status.receipts = { ok: true, text: `${RECEIPT_ACCENTS[r.accent].label} · numbers ${r.prefix}00001…` };
    if (school.reportCard) status["report-cards"] = { ok: true, text: `${RECEIPT_ACCENTS[school.reportCard.accent].label} · “${school.reportCard.title}”` };
  }
  if (classes) status.classes = classes.classes.length ? { ok: true, text: `${classes.classes.length} class${classes.classes.length === 1 ? "" : "es"}` } : { ok: false, text: "No classes yet" };
  if (team) status.team = team.members.length > 1 ? { ok: true, text: `${team.members.length} people` } : { ok: false, text: "Only you so far" };
  if (plan) status.billing = { ok: !plan.readOnly && plan.status !== "overdue", text: `${plan.planName ?? "Full access"} · ${endsText(plan)}` };
  return status;
}

/** What a new school still has to do, with a link to each. */
function SetupChecklist({ status }: { status: Status }) {
  const steps = [
    { id: "school", label: "Add your logo and contact details" },
    { id: "classes", label: "Add your classes or batches" },
    { id: "team", label: "Invite your staff" },
  ].map((s) => ({ ...s, done: status[s.id]?.ok }));
  const known = steps.filter((s) => s.done !== undefined);
  const done = known.filter((s) => s.done).length;
  if (known.length < steps.length || done === steps.length) return null;
  return (
    <section className="mb-7 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold">Finish setting up</p>
        <span className="text-sm text-muted">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.id}>
            <Link href={`/app/settings/${s.id}`} className={cx("flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 text-sm", s.done ? "border-success/30 text-muted line-through" : "border-border font-medium hover:border-accent/40")}>
              <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border", s.done ? "border-success bg-success text-white" : "border-border")}>{s.done && <Icon d="M5 12l5 5L20 7" className="size-3" />}</span>
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
