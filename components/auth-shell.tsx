"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { PASSWORD_RULES } from "./password-rules";
import { ThemeToggle } from "./theme-toggle";
import { Logo, cx } from "./ui";

export const AUTH_ICONS = {
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  lock: "M6 11h12v10H6zM8 11V8a4 4 0 118 0v3",
  school: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M12 10.5v.01",
};

const FEATURES = [
  { title: "Fees & receipts", text: "Collect by cash or UPI, print receipts, chase dues on WhatsApp.", icon: "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8" },
  { title: "Attendance in seconds", text: "Mark a class from your phone. Parents of absent students get a message.", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" },
  { title: "Tests & report cards", text: "Enter marks, get grades and ranks, share report cards instantly.", icon: "M9 4h6M8 4H6v16h12V4h-2M9 10h6M9 14h6M9 18h3" },
];

/**
 * Sign-in / sign-up frame. Desktop: brand panel on the left, form on the right.
 * Phones: the form alone under the logo.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel: fixed brand colours so it looks the same in light and dark mode */}
      <aside className="relative hidden overflow-hidden bg-[#1b2563] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(61,220,151,0.22),transparent_60%),radial-gradient(ellipse_70%_60%_at_0%_100%,rgba(143,155,232,0.35),transparent_60%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

        <Link href="/" aria-label="EduFlow home" className="relative inline-flex w-fit">
          <Image src="/images/brand/wordmark-dark.png" alt="EduFlow" width={534} height={96} priority className="h-8 w-auto" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Run your school from one place. <span className="text-[#3ddc97]">Simply.</span>
          </h2>
          <ul className="mt-8 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={f.icon} />
                  </svg>
                </span>
                <span>
                  <span className="block font-medium">{f.title}</span>
                  <span className="block text-sm text-white/70">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/70">
          {["7-day free trial", "No credit card", "Made for Indian schools"].map((t) => (
            <span key={t} className="inline-flex items-center gap-2">
              <svg viewBox="0 0 16 16" className="size-4 text-[#3ddc97]" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </span>
          ))}
        </div>
      </aside>

      {/* Form */}
      <section className="relative flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Logo href="/" />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] motion-safe:animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-8 text-center text-sm text-muted">{footer}</p>
          </div>
        </div>
        <p className="text-center text-xs text-muted">
          by{" "}
          <a href="https://zaref.in" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-foreground">
            Zaref
          </a>
        </p>
      </section>
    </main>
  );
}

const fieldBase =
  "h-11 w-full rounded-xl border border-border bg-surface pl-10 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 aria-invalid:border-danger aria-invalid:focus:ring-danger/15 sm:text-sm";

function FieldIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Text input with a leading icon, for the auth forms. */
export function AuthInput({ icon, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: string }) {
  return (
    <div className="group relative">
      <FieldIcon d={icon} />
      <input className={cx(fieldBase, "pr-3", className)} {...props} />
    </div>
  );
}

/** Password input with a show/hide button and a Caps Lock warning. */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div>
      <div className="group relative">
        <FieldIcon d={AUTH_ICONS.lock} />
        <input
          {...props}
          type={visible ? "text" : "password"}
          onKeyDown={(e) => {
            checkCaps(e);
            props.onKeyDown?.(e);
          }}
          onKeyUp={checkCaps}
          onBlur={(e) => {
            setCaps(false);
            props.onBlur?.(e);
          }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cx(fieldBase, "pr-12", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {visible ? (
              <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2.1-2.6 3.3M6.5 7.6C4.6 8.9 3.2 10.7 2.5 12c1 1.8 4.5 6 9.5 6 1.7 0 3.2-.5 4.5-1.2M9.9 10a3 3 0 004.1 4.1" />
            ) : (
              <path d="M2.5 12c1-1.8 4.5-6 9.5-6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6zM12 15a3 3 0 100-6 3 3 0 000 6z" />
            )}
          </svg>
        </button>
      </div>
      {caps && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-warning" role="status">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4l7 8h-4v4H9v-4H5l7-8zM9 20h6" />
          </svg>
          Caps Lock is on
        </p>
      )}
    </div>
  );
}

const STRENGTH = [
  { label: "Too weak", bar: "bg-danger", text: "text-danger" },
  { label: "Weak", bar: "bg-danger", text: "text-danger" },
  { label: "Fair", bar: "bg-warning", text: "text-warning" },
  { label: "Good", bar: "bg-warning", text: "text-warning" },
  { label: "Strong", bar: "bg-success", text: "text-success" },
];

/** A 4-step meter plus the checklist of rules still missing. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const rules = PASSWORD_RULES.slice(0, 5);
  const passed = rules.filter((r) => r.test(value)).length;
  // 0–4 steps: every rule counts, and long passwords earn the last step
  const level = Math.min(4, Math.max(0, passed - 1 + (value.length >= 12 && passed === rules.length ? 1 : 0)));
  const s = STRENGTH[level];
  const missing = rules.filter((r) => !r.test(value));
  return (
    <div className="mt-2.5 space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cx("h-1.5 rounded-full transition-colors duration-300", i <= level ? s.bar : "bg-surface-muted")} />
          ))}
        </div>
        <span className={cx("w-16 text-right text-xs font-medium", s.text)}>{s.label}</span>
      </div>
      {missing.length > 0 && <p className="text-xs text-muted">Add: {missing.map((r) => r.label.toLowerCase()).join(", ")}</p>}
    </div>
  );
}

/** Label row for auth fields (with optional right-hand extra, e.g. "Optional"). */
export function AuthField({ label, htmlFor, error, hint, extra, children }: { label: string; htmlFor: string; error?: string; hint?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {extra}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

/** Maps the API's VALIDATION_ERROR details to { field: message } (first message wins). */
export function fieldErrors(details?: { field: string; message: string }[]) {
  const out: Record<string, string> = {};
  for (const d of details ?? []) out[d.field] ??= d.message;
  return out;
}
