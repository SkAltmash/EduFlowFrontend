"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Announcement, TenantStatus } from "@/lib/platform";

// One shared copy of the school's plan status, refreshed every 10 minutes
let current: TenantStatus | null = null;
let loading: Promise<void> | null = null;
let loadedAt = 0;
const listeners = new Set<() => void>();

function load(force = false) {
  if (!force && (loading || Date.now() - loadedAt < 10 * 60_000)) return;
  loading = api<TenantStatus>("/api/tenant/status")
    .then((s) => {
      current = s;
      loadedAt = Date.now();
      listeners.forEach((l) => l());
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
}

/** The school's plan, limits, features and platform announcements (null until loaded). */
export function useTenantStatus() {
  const status = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      load();
      return () => listeners.delete(cb);
    },
    () => current,
    () => null
  );
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return status;
}

export const refreshTenantStatus = () => load(true);

/** Forgets the loaded status (e.g. a super admin switching schools), so the next page loads it fresh. */
export function resetTenantStatus() {
  current = null;
  loadedAt = 0;
  listeners.forEach((l) => l());
}

export function supportLink(s: TenantStatus | null, text: string) {
  const phone = s?.support.whatsapp?.replace(/\D/g, "");
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "https://zaref.in";
}

const DISMISS_KEY = "eduflow.dismissed-announcements";
function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

const TONES = {
  info: "border-accent/30 bg-accent-soft text-foreground",
  success: "border-success/30 bg-success-soft text-foreground",
  warning: "border-warning/40 bg-warning-soft text-foreground",
  danger: "border-danger/40 bg-danger-soft text-foreground",
};

function Banner({ tone, children, onClose }: { tone: keyof typeof TONES; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", TONES[tone])} role="status">
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="shrink-0 text-muted hover:text-foreground">
          <Icon d="M6 6l12 12M18 6L6 18" />
        </button>
      )}
    </div>
  );
}

/** Plan and platform messages above every page of a school's app. */
export function PlanBanners({ canManage }: { canManage: boolean }) {
  const status = useTenantStatus();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  if (!status) return null;
  const sub = status.subscription;
  const announcements = status.announcements.filter((a: Announcement) => !dismissed.includes(a.id));
  const renew = supportLink(status, "Hi, I'd like to renew our EduFlow plan.");

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-30)));
    } catch {
      // Storage blocked: it shows again next visit
    }
  };

  const items: React.ReactNode[] = [];
  if (sub.readOnly) {
    items.push(
      <Banner key="ro" tone="danger">
        <p className="font-semibold">{sub.status === "suspended" ? "This school's EduFlow account is on hold" : "Your EduFlow plan has ended"}</p>
        <p className="text-muted">
          Everything is still here and you can view it, but nothing can be added or changed.{" "}
          {canManage ? (
            <a href={renew} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
              Renew now →
            </a>
          ) : (
            "Ask the school's owner to renew."
          )}
        </p>
      </Banner>
    );
  } else if (sub.status === "overdue" && canManage) {
    items.push(
      <Banner key="due" tone="danger">
        <span className="font-semibold">Payment due.</span> Your plan ended {sub.daysLeft !== null ? `${-sub.daysLeft} day${sub.daysLeft === -1 ? "" : "s"} ago` : "recently"}; the app becomes read-only in a few days.{" "}
        <a href={renew} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
          Renew →
        </a>
      </Banner>
    );
  } else if (sub.status === "trial" && canManage) {
    const soon = (sub.daysLeft ?? 99) <= 3;
    items.push(
      <Banner key="trial" tone={soon ? "warning" : "info"}>
        <span className="font-semibold">
          Free trial: {sub.daysLeft === 0 ? "ends today" : sub.daysLeft === 1 ? "1 day left" : `${sub.daysLeft} days left`}.
        </span>{" "}
        {soon ? "Choose a plan to keep everything running." : `You're trying the ${sub.planName ?? "EduFlow"} plan.`}{" "}
        <Link href="/app/settings#billing" className="font-semibold text-accent hover:underline">
          See plans →
        </Link>
      </Banner>
    );
  }
  for (const a of announcements) {
    items.push(
      <Banner key={a.id} tone={a.tone} onClose={() => dismiss(a.id)}>
        <p className="font-semibold">📣 {a.title}</p>
        {a.body && <p className="text-muted">{a.body}</p>}
        {a.linkUrl && (
          <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
            {a.linkLabel || "Learn more"} →
          </a>
        )}
      </Banner>
    );
  }
  return items.length ? <div className="mb-5 space-y-2">{items}</div> : null;
}
