"use client";

import { useState } from "react";
import { Alert, Badge, Button, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { PageHeader, errorMessage, useResource } from "./shared";

const codeInput = (v: string) => v.replace(/\D/g, "").slice(0, 6);

/** Two-step login for the super admin account (authenticator app codes). */
export function Security() {
  const status = useResource(() => api<{ enabled: boolean; encryptionAvailable: boolean }>("/api/admin/2fa"), "console-2fa");
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const s = status.data;

  async function call(path: string, body?: object) {
    setBusy(true);
    setMessage(null);
    try {
      return await api<Record<string, unknown>>(`/api/admin/2fa/${path}`, { method: "POST", body });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Security" description="Protect the console: it can see and change every school." icon="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4" />
      {status.error && <Alert>{status.error}</Alert>}
      {!s ? (
        <Skeleton className="h-48" />
      ) : (
        <section className="max-w-2xl rounded-2xl border border-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Two-step login</h2>
              <p className="text-sm text-muted">After your password, enter a 6-digit code from Google Authenticator, Microsoft Authenticator or similar.</p>
            </div>
            {s.enabled ? <Badge tone="success">On</Badge> : <Badge tone="danger">Off</Badge>}
          </div>
          <div className="space-y-4 p-5">
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
            {!s.encryptionAvailable && !s.enabled && <Alert tone="warning">Set DATA_ENCRYPTION_KEY on the server first; the secret is stored encrypted.</Alert>}

            {s.enabled ? (
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!confirm("Turn off two-step login? Anyone with your password could then sign in.")) return;
                  if (await call("disable", { code })) {
                    setCode("");
                    status.setData({ ...s, enabled: false });
                    setMessage({ tone: "success", text: "Two-step login is off." });
                  }
                }}
              >
                <p className="text-sm">To turn it off, enter a current code from your app.</p>
                <div className="flex gap-2">
                  <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" className="w-36 text-center font-mono text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(codeInput(e.target.value))} placeholder="000000" />
                  <Button type="submit" variant="danger" loading={busy} disabled={code.length !== 6}>
                    Turn off
                  </Button>
                </div>
              </form>
            ) : !setup ? (
              <Button
                disabled={!s.encryptionAvailable}
                loading={busy}
                onClick={async () => {
                  const r = await call("setup");
                  if (r) setSetup(r as { secret: string; otpauthUrl: string });
                }}
              >
                Set up two-step login
              </Button>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await call("enable", { code })) {
                    setSetup(null);
                    setCode("");
                    status.setData({ ...s, enabled: true });
                    setMessage({ tone: "success", text: "Two-step login is on. You'll be asked for a code every time you sign in." });
                  }
                }}
              >
                <ol className="list-decimal space-y-3 pl-5 text-sm">
                  <li>
                    Open your authenticator app and add an account with this key (time-based):
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-base tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                      <Button type="button" variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(setup.secret)}>
                        Copy
                      </Button>
                    </div>
                    <a href={setup.otpauthUrl} className="mt-2 inline-block text-accent hover:underline md:hidden">
                      On this phone? Tap to add to your app
                    </a>
                  </li>
                  <li>
                    Enter the 6-digit code it shows:
                    <div className="mt-2 flex gap-2">
                      <Input aria-label="6-digit code" inputMode="numeric" autoComplete="one-time-code" className="w-36 text-center font-mono text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(codeInput(e.target.value))} placeholder="000000" autoFocus />
                      <Button type="submit" loading={busy} disabled={code.length !== 6}>
                        Turn on
                      </Button>
                    </div>
                  </li>
                </ol>
                <p className="text-xs text-muted">Keep the key somewhere safe (a password manager). If you lose the phone, it&apos;s the only way back in without server access.</p>
              </form>
            )}
          </div>
        </section>
      )}
    </>
  );
}
