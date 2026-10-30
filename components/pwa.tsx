"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, Icon, cx } from "./ui";

// ---------------------------------------------------------------------------
// Install prompt (Chrome / Edge / Android), shared by every "Install app" button
// ---------------------------------------------------------------------------

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep it for our own button instead of the browser's mini bar
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

/** "prompt": the browser can install it; "ios": show the Share → Add to Home Screen steps; null: installed or not possible. */
export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (isStandalone() ? null : deferred ? "prompt" : isIos() ? "ios" : null),
    () => null
  );
  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    notify();
    return outcome === "accepted";
  }
  return { state, install } as const;
}

const PHONE_ICON = "M7 3h10v18H7zM11 18h2M12 7v6M9.5 10.5L12 13l2.5-2.5";

/** "Install app" for menus; shows iPhone steps where the browser can't install directly. */
export function InstallAppButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const { state, install } = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  if (!state) return null;
  return (
    <div className={className}>
      <button
        onClick={async () => {
          if (state === "ios") setIosHelp((v) => !v);
          else if (await install()) onDone?.();
        }}
        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-muted"
      >
        <Icon d={PHONE_ICON} className="text-accent" />
        <span className="flex-1">Install EduFlow app</span>
      </button>
      {iosHelp && (
        <p className="mx-2.5 mb-1 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
          In Safari, tap <strong className="text-foreground">Share</strong> <span aria-hidden>⎋</span>, then <strong className="text-foreground">Add to Home Screen</strong>.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service worker: register, and offer a refresh when a new version is ready
// ---------------------------------------------------------------------------

/** Registers the service worker (production builds only) and shows "New version" when one is waiting. */
export function PwaRuntime() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Only an update (not the first install) needs a refresh
        const watch = (sw: ServiceWorker | null) =>
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));
        // Check for a new version when the app comes back to the front
        const onVisible = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onController);
  }, []);

  if (!waiting) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-h,0px)+0.75rem)] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-2xl sm:bottom-6">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">A new version of EduFlow is ready.</span>
      </p>
      <Button size="sm" onClick={() => waiting.postMessage("SKIP_WAITING")}>
        Refresh
      </Button>
    </div>
  );
}

/** A dismissible card suggesting to install the app (phones, not yet installed). */
export function InstallCard({ className }: { className?: string }) {
  const { state, install } = useInstall();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("eduflow.install-card") === "hidden";
    } catch {
      return false;
    }
  });
  const [iosHelp, setIosHelp] = useState(false);
  if (!state || hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem("eduflow.install-card", "hidden");
    } catch {
      // Storage blocked: shows again next time
    }
  };
  return (
    <div className={cx("flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft/50 p-4 md:hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install the EduFlow app</p>
        <p className="text-sm text-muted">
          {state === "ios" && iosHelp ? (
            <>
              Tap <strong className="text-foreground">Share</strong>, then <strong className="text-foreground">Add to Home Screen</strong>.
            </>
          ) : (
            "Opens from your home screen like an app, full screen and faster."
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={async () => (state === "ios" ? setIosHelp(true) : (await install()) && hide())}>
            {state === "ios" ? "How?" : "Install"}
          </Button>
          <Button size="sm" variant="ghost" onClick={hide}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
