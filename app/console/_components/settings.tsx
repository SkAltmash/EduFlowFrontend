"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { PageHeader, errorMessage, formatDate, useResource } from "./shared";

interface Settings {
  supportWhatsapp: string;
  supportEmail: string;
  updatedAt: string | null;
}

/** Platform settings: the support contact schools see on renew and upgrade buttons. */
export function PlatformSettings() {
  const res = useResource(() => api<Settings>("/api/admin/settings"), "console-settings");
  const [form, setForm] = useState<{ supportWhatsapp: string; supportEmail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const s = res.data;
  const values = form ?? { supportWhatsapp: s?.supportWhatsapp ?? "", supportEmail: s?.supportEmail ?? "" };
  const digits = values.supportWhatsapp.replace(/\D/g, "");

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      res.setData(await api<Settings>("/api/admin/settings", { method: "PUT", body: values }));
      setForm(null);
      setMessage({ tone: "success", text: "Saved. Schools see the new contact the next time they open EduFlow." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Platform-wide settings." icon="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4" />
      {res.error && <Alert>{res.error}</Alert>}
      {!s ? (
        <Skeleton className="h-56 max-w-2xl" />
      ) : (
        <section className="max-w-2xl rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Support contact</h2>
            <p className="text-sm text-muted">Where schools reach you from &quot;Renew now&quot;, &quot;Choose a plan&quot; and &quot;Get Pro&quot;.</p>
          </div>
          <div className="space-y-4 p-5">
            {message && <Alert tone={message.tone}>{message.text}</Alert>}
            <Field label="WhatsApp number" htmlFor="support-wa" hint="With country code, e.g. 919876543210. Schools open a chat with a ready message.">
              <Input id="support-wa" inputMode="tel" value={values.supportWhatsapp} onChange={(e) => setForm({ ...values, supportWhatsapp: e.target.value })} placeholder="919876543210" />
            </Field>
            <Field label="Email" htmlFor="support-email">
              <Input id="support-email" type="email" value={values.supportEmail} onChange={(e) => setForm({ ...values, supportEmail: e.target.value })} placeholder="support@yourdomain.com" />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {digits.length >= 10 ? (
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Test the WhatsApp link →
                  </a>
                ) : s.updatedAt ? (
                  `Last changed ${formatDate(s.updatedAt, true)}`
                ) : (
                  "Not set yet"
                )}
              </span>
              <Button onClick={save} loading={busy} disabled={form === null}>
                Save
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
