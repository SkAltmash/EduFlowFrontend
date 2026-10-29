"use client";

import { useState } from "react";
import { Alert, Button, Field, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { PageHeader, errorMessage, formatDate, useResource } from "./shared";

interface Settings {
  supportWhatsapp: string;
  supportEmail: string;
  updatedAt: string | null;
  cloudinary: { cloudName: string; apiKey: string; folder: string; secretSet: boolean; secretReadable: boolean };
  encryptionAvailable: boolean;
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
      res.setData(await api<Settings>("/api/admin/settings", { method: "PUT", body: { supportWhatsapp: values.supportWhatsapp, supportEmail: values.supportEmail } }));
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
      <PageHeader title="Settings" description="Support contact and image uploads for every school." icon="M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4" />
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
      {s && <CloudinaryCard settings={s} onSaved={res.setData} />}
    </>
  );
}

/** Keys for image uploads (school logos). The secret is write-only: it's stored encrypted and never shown again. */
function CloudinaryCard({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const c = settings.cloudinary;
  const [form, setForm] = useState({ cloudName: c.cloudName, apiKey: c.apiKey, apiSecret: "", folder: c.folder });
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const configured = Boolean(c.cloudName && c.apiKey && c.secretSet);
  const dirty = form.cloudName !== c.cloudName || form.apiKey !== c.apiKey || form.folder !== c.folder || form.apiSecret !== "";

  async function run(kind: "save" | "test" | "clear") {
    if (kind === "clear" && !confirm("Turn off logo uploads? Logos already uploaded keep working.")) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "test") {
        await api("/api/admin/settings/cloudinary/test", { method: "POST" });
        setMessage({ tone: "success", text: "Connected. A test image was uploaded and deleted, so schools can upload logos." });
      } else {
        const body = kind === "clear" ? { cloudName: "", apiKey: "", apiSecret: "", folder: form.folder } : { ...form, cloudName: form.cloudName.trim(), apiKey: form.apiKey.trim(), apiSecret: form.apiSecret.trim() };
        const next = await api<Settings>("/api/admin/settings", { method: "PUT", body: { cloudinary: body } });
        onSaved(next);
        setForm({ cloudName: next.cloudinary.cloudName, apiKey: next.cloudinary.apiKey, apiSecret: "", folder: next.cloudinary.folder });
        setMessage({ tone: "success", text: kind === "clear" ? "Logo uploads turned off." : "Saved and checked with Cloudinary. Schools can now upload their logo in Settings → School profile." });
      }
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-semibold">Image uploads (Cloudinary)</h2>
          <p className="text-sm text-muted">Schools and tuition centres upload their logo here; it appears on receipts and report cards.</p>
        </div>
        <span className={configured ? "rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success" : "rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted"}>
          {configured ? "On" : "Off"}
        </span>
      </div>
      <div className="space-y-4 p-5">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {!settings.encryptionAvailable && <Alert tone="warning">Set DATA_ENCRYPTION_KEY on the server first; the API secret is stored encrypted.</Alert>}
        {c.secretSet && !c.secretReadable && <Alert tone="warning">The saved API secret can&apos;t be read (the encryption key changed). Enter it again.</Alert>}
        <p className="text-xs text-muted">
          Find these in Cloudinary → Settings → API Keys. The key needs a role that can upload and delete images; Save and check tests both.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cloud name" htmlFor="cl-cloud">
            <Input id="cl-cloud" value={form.cloudName} onChange={(e) => setForm({ ...form, cloudName: e.target.value })} placeholder="e.g. dxyz123ab" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="API key" htmlFor="cl-key">
            <Input id="cl-key" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} inputMode="numeric" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="API secret" htmlFor="cl-secret" hint={c.secretSet ? "Saved. Leave empty to keep it." : "Stored encrypted; never shown again."}>
            <Input id="cl-secret" type="password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} placeholder={c.secretSet ? "••••••••••••" : ""} autoComplete="new-password" spellCheck={false} />
          </Field>
          <Field label="Folder" htmlFor="cl-folder" hint="Logos go in <folder>/schools/<school id>/">
            <Input id="cl-folder" value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} autoComplete="off" spellCheck={false} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {configured && (
              <Button variant="secondary" onClick={() => run("test")} loading={busy === "test"} disabled={busy !== null}>
                Test connection
              </Button>
            )}
            {configured && (
              <Button variant="ghost" className="text-danger" onClick={() => run("clear")} loading={busy === "clear"} disabled={busy !== null}>
                Turn off
              </Button>
            )}
          </div>
          <Button onClick={() => run("save")} loading={busy === "save"} disabled={!dirty || busy !== null || !form.cloudName.trim() || !form.apiKey.trim() || (!c.secretSet && !form.apiSecret.trim())}>
            Save and check
          </Button>
        </div>
      </div>
    </section>
  );
}
