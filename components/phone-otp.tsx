"use client";

import { useEffect, useState } from "react";
import { useResource } from "./data";
import { Alert, Button, cx } from "./ui";
import { ApiError, api } from "@/lib/api";

export interface OtpChallenge {
  challengeId: string;
  /** Masked number the code went to, e.g. "+91 ••••• 43210" */
  phone: string;
  resendIn: number;
  expiresIn: number;
  /** Development only (OTP_FAKE on the server) */
  devCode?: string;
}

/** What sign-in / sign-up offer: mobile OTP sign-in, and whether sign-up needs a verified number. */
export function useAuthOptions() {
  return useResource(() => api<{ phoneLogin: boolean; phoneRequiredOnRegister: boolean }>("/api/auth/options", { noRetry: true }), "auth-options").data;
}

/** "+919876543210" → "98765 43210" */
export function formatPhone(p?: string) {
  const d = (p ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : (p ?? "");
}

const messageOf = (err: unknown) => (err instanceof ApiError ? (err.details?.[0]?.message ?? err.message) : "Something went wrong. Please try again.");

/**
 * Mobile number, then the code texted to it. `send` asks the server for a code;
 * `verify` checks it (and does whatever comes next: sign in, save the number…).
 */
export function PhoneOtp({
  send,
  verify,
  submitLabel = "Verify",
  sendLabel = "Send OTP",
  initialPhone = "",
  autoFocus,
  variant = "app",
}: {
  send: (phone: string) => Promise<OtpChallenge>;
  verify: (challengeId: string, code: string) => Promise<void>;
  submitLabel?: string;
  sendLabel?: string;
  initialPhone?: string;
  autoFocus?: boolean;
  /** "auth": the larger sign-in page inputs */
  variant?: "app" | "auth";
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const digits = phone.replace(/\D/g, "").slice(-10);
  const validPhone = /^[6-9]\d{9}$/.test(digits);
  const big = variant === "auth";
  const inputClass = cx(
    "w-full rounded-xl border border-border bg-surface outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/15",
    big ? "h-11 text-[15px]" : "h-10 text-sm"
  );

  async function doSend() {
    if (!validPhone) return setError("Enter a valid 10-digit mobile number");
    setBusy("send");
    setError(null);
    try {
      const c = await send(digits);
      setChallenge(c);
      setCode("");
      setWait(c.resendIn);
    } catch (err) {
      setError(messageOf(err));
      // The server says how long to wait when asked too soon
      const m = err instanceof ApiError && err.message.match(/Wait (\d+) seconds/);
      if (m) setWait(Number(m[1]));
    } finally {
      setBusy(null);
    }
  }

  async function doVerify() {
    if (!challenge || code.length < 4) return;
    setBusy("verify");
    setError(null);
    try {
      await verify(challenge.challengeId, code);
    } catch (err) {
      setError(messageOf(err));
      if (err instanceof ApiError && (err.code === "OTP_EXPIRED" || err.code === "OTP_LOCKED")) setCode("");
    } finally {
      setBusy(null);
    }
  }

  if (!challenge) {
    return (
      <div className="space-y-3">
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className={cx("pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-muted", big ? "text-[15px]" : "text-sm")}>+91</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              aria-label="Mobile number"
              autoFocus={autoFocus}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 14));
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSend())}
              placeholder="98765 43210"
              className={cx(inputClass, "pl-12 tracking-wide")}
            />
          </div>
          <Button type="button" onClick={doSend} loading={busy === "send"} disabled={!validPhone || wait > 0} className={big ? "h-11 rounded-xl" : undefined}>
            {wait > 0 ? `Wait ${wait}s` : sendLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    // Not a <form>: this sits inside other forms (sign-up)
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <p className="text-sm text-muted">
        Enter the code sent to <span className="font-medium text-foreground">{challenge.phone}</span>.{" "}
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => {
            setChallenge(null);
            setError(null);
          }}
        >
          Change number
        </button>
      </p>
      {challenge.devCode && <p className="rounded-lg bg-warning-soft px-3 py-1.5 text-xs">Test mode: no SMS is sent. The code is {challenge.devCode}.</p>}
      <input
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="OTP code"
        maxLength={8}
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 8);
          setCode(v);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doVerify())}
        placeholder="••••••"
        className={cx(inputClass, "h-14 text-center font-mono text-2xl tracking-[0.5em]")}
      />
      <Button type="button" onClick={doVerify} className={cx("w-full", big && "h-11 rounded-xl text-[15px]")} loading={busy === "verify"} disabled={code.length < 4}>
        {submitLabel}
      </Button>
      <p className="text-center text-sm text-muted">
        {wait > 0 ? (
          <>Didn&apos;t get it? You can ask again in {wait}s.</>
        ) : (
          <button type="button" onClick={doSend} disabled={busy !== null} className="font-medium text-accent hover:underline">
            Send the code again
          </button>
        )}
      </p>
    </div>
  );
}

/** A small "verified" row with a way to change the number. */
export function VerifiedPhone({ phone, onChange }: { phone: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-success/40 bg-success-soft px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <svg viewBox="0 0 16 16" className="size-4 text-success" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <span className="font-medium">+91 {formatPhone(phone)}</span> verified
        </span>
      </span>
      <button type="button" onClick={onChange} className="font-medium text-accent hover:underline">
        Change
      </button>
    </div>
  );
}
