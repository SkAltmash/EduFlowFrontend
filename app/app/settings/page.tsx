"use client";

import { useState } from "react";
import { Drawer, Pager, Section, errorMessage, formatDate, useResource, type Pagination } from "@/components/data";
import { Alert, Badge, Button, Field, Icon, Input, Skeleton, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS_LABEL, TYPE_LABEL, timeAgo, type LastSent, type MessageType, type WhatsAppSettings } from "@/lib/whatsapp";

const TYPES: MessageType[] = ["fee_receipt", "fee_reminder", "absence", "attendance_summary"];

export default function SettingsPage() {
  const { session } = useAuth();
  const role = session.status === "authenticated" ? session.role : undefined;

  if (role !== "owner" && role !== "admin") {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">Only owners and admins can change settings.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">How EduFlow talks to parents.</p>
      </div>
      <WhatsAppSettingsCard />
      <MessageHistory />
    </div>
  );
}

function WhatsAppSettingsCard() {
  const loaded = useResource(() => api<{ settings: WhatsAppSettings }>("/api/whatsapp/settings"), "wa-settings");
  const s = loaded.data?.settings;
  // Edits on top of the saved settings
  const [draft, setDraft] = useState<Partial<{ mode: "link" | "api"; defaultCountryCode: string; phoneNumberId: string; displayPhone: string; accessToken: string }>>({});
  const [templates, setTemplates] = useState<Partial<Record<MessageType, { name?: string; language?: string }>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);

  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  if (!s) return <Skeleton className="h-64 rounded-xl" />;

  const mode = draft.mode ?? s.mode;
  const value = <K extends "defaultCountryCode" | "phoneNumberId" | "displayPhone">(k: K) => draft[k] ?? s[k];
  const tpl = (t: MessageType) => ({ name: templates[t]?.name ?? s.templates[t].name, language: templates[t]?.language ?? s.templates[t].language });
  const dirty = Object.keys(draft).length > 0 || Object.keys(templates).length > 0;
  const templatesSet = TYPES.filter((t) => tpl(t).name).length;

  async function save(extra: Record<string, unknown> = {}) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ settings: WhatsAppSettings }>("/api/whatsapp/settings", {
        method: "PUT",
        body: { ...draft, ...(Object.keys(templates).length ? { templates } : {}), ...extra },
      });
      loaded.setData(res);
      setDraft({});
      setTemplates({});
      setMessage({ tone: "success", text: "WhatsApp settings saved." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await api<{ to: string }>("/api/whatsapp/settings/test", { method: "POST", body: { to: testTo } });
      setMessage({ tone: "success", text: `Test message sent to +${res.to}. It should arrive within a minute.` });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setTesting(false);
    }
  }

  async function copy(t: MessageType) {
    try {
      await navigator.clipboard.writeText(s!.templates[t].body);
      setCopied(t);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked: the text is visible and selectable anyway
    }
  }

  const checklist = [
    { done: Boolean(value("phoneNumberId")), label: "Phone number ID" },
    { done: s.tokenSet && s.tokenReadable, label: "Access token (stored encrypted)" },
    { done: templatesSet === TYPES.length, label: `Approved templates (${templatesSet} of ${TYPES.length})` },
    { done: s.webhookConfigured, label: "Delivery & read ticks (set up by your platform admin)" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-10 place-items-center rounded-xl bg-[#128c4a] text-white">
          <Icon d={WA_ICON} className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">WhatsApp</h2>
          <p className="text-sm text-muted">Receipts, fee reminders, absence alerts and monthly attendance reports.</p>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        <Section title="How messages are sent">
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["link", "Click-to-send", "Free · no setup", "Opens WhatsApp on the phone or WhatsApp Web with the message ready. Staff tap Send. Bulk messages go one parent at a time."],
                ["api", "Automatic", "WhatsApp Business API", "Messages go out instantly from the school's own WhatsApp number, with delivered and read ticks. Needs a Meta Business account; Meta charges per message."],
              ] as const
            ).map(([v, title, tag, text]) => (
              <button
                key={v}
                onClick={() => setDraft((d) => ({ ...d, mode: v }))}
                aria-pressed={mode === v}
                className={cx("rounded-xl border p-4 text-left transition-colors", mode === v ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-muted")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{title}</span>
                  <Badge tone={v === "link" ? "success" : "accent"}>{tag}</Badge>
                </span>
                <span className="mt-1.5 block text-sm text-muted">{text}</span>
              </button>
            ))}
          </div>
        </Section>

        <div className="max-w-xs">
          <Field label="Country code for local numbers" htmlFor="wa-cc" hint={`10-digit numbers get +${value("defaultCountryCode")} added.`}>
            <Input id="wa-cc" inputMode="numeric" value={value("defaultCountryCode")} onChange={(e) => setDraft((d) => ({ ...d, defaultCountryCode: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
          </Field>
        </div>

        {mode === "api" && (
          <>
            {!s.encryptionAvailable && (
              <Alert tone="warning">The server isn&apos;t set up to store access tokens securely (DATA_ENCRYPTION_KEY is missing). Ask your platform admin to add it first.</Alert>
            )}

            <Section title="Setup">
              <ul className="mb-4 grid gap-2 sm:grid-cols-2">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    <span className={cx("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", c.done ? "bg-success text-background" : "border border-border text-muted")}>
                      {c.done ? "✓" : ""}
                    </span>
                    <span className={c.done ? "" : "text-muted"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => setGuide(true)} className="mb-4 text-sm font-medium text-accent hover:underline">
                Where do I find these? →
              </button>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Phone number ID" htmlFor="wa-pnid" hint="From Meta: WhatsApp → API Setup">
                  <Input id="wa-pnid" inputMode="numeric" value={value("phoneNumberId")} onChange={(e) => setDraft((d) => ({ ...d, phoneNumberId: e.target.value.replace(/\D/g, "") }))} placeholder="e.g. 106540352242922" />
                </Field>
                <Field label="School WhatsApp number" htmlFor="wa-display" hint="Shown to staff only">
                  <Input id="wa-display" value={value("displayPhone")} onChange={(e) => setDraft((d) => ({ ...d, displayPhone: e.target.value }))} placeholder="+91 98765 43210" />
                </Field>
                <div className="md:col-span-2">
                  <Field
                    label="Permanent access token"
                    htmlFor="wa-token"
                    hint={
                      s.tokenSet ? (
                        <>
                          A token is saved (encrypted; it&apos;s never shown again).{" "}
                          <button className="font-medium text-danger hover:underline" onClick={() => save({ accessToken: "", mode: "link" })}>
                            Remove it
                          </button>
                        </>
                      ) : (
                        "From a System User in Meta Business Settings, with whatsapp_business_messaging permission."
                      )
                    }
                  >
                    <Input
                      id="wa-token"
                      type="password"
                      autoComplete="off"
                      value={draft.accessToken ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, accessToken: e.target.value }))}
                      placeholder={s.tokenSet ? "•••••••••••• (saved, type to replace)" : "EAAG…"}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Message templates">
              <p className="mb-3 text-sm text-muted">
                WhatsApp only allows pre-approved messages to parents. Create each template in Meta (category <strong className="text-foreground">Utility</strong>),
                paste the text exactly, wait for approval (usually minutes to a day), then enter its name here.
              </p>
              <div className="space-y-3">
                {TYPES.map((t) => {
                  const info = s.templates[t];
                  return (
                    <div key={t} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{info.title}</p>
                        {tpl(t).name ? <Badge tone="success">Set</Badge> : <Badge>Not set</Badge>}
                      </div>
                      <div className="mt-2 rounded-lg bg-surface-muted p-3 font-mono text-xs leading-relaxed">{info.body}</div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span>
                          {info.params} variables · e.g. {info.example.slice(0, 3).join(", ")}…
                        </span>
                        <button onClick={() => copy(t)} className="font-medium text-accent hover:underline">
                          {copied === t ? "Copied ✓" : "Copy text"}
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2">
                        <Input
                          aria-label={`${info.title} template name`}
                          value={tpl(t).name}
                          placeholder={info.suggestedName}
                          onChange={(e) => setTemplates((m) => ({ ...m, [t]: { ...m[t], name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } }))}
                        />
                        <Input
                          aria-label={`${info.title} language`}
                          value={tpl(t).language}
                          placeholder="en"
                          onChange={(e) => setTemplates((m) => ({ ...m, [t]: { ...m[t], language: e.target.value.trim() } }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            {s.tokenSet && s.phoneNumberId && (
              <Section title="Test">
                <div className="flex max-w-md gap-2">
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your mobile number" inputMode="tel" />
                  <Button variant="secondary" onClick={sendTest} loading={testing} disabled={testTo.replace(/\D/g, "").length < 8}>
                    Send test
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted">Sends Meta&apos;s “hello_world” message to check the number and token.</p>
              </Section>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          {dirty && (
            <Button variant="ghost" onClick={() => { setDraft({}); setTemplates({}); }}>
              Discard
            </Button>
          )}
          <Button onClick={() => save()} loading={busy} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      {guide && (
        <Drawer title="Connect WhatsApp Business" onClose={() => setGuide(false)}>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Go to <a className="text-accent hover:underline" href="https://business.facebook.com" target="_blank" rel="noopener noreferrer">Meta Business Suite</a> and create (or open) your school&apos;s business account.
            </li>
            <li>
              At <a className="text-accent hover:underline" href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">developers.facebook.com</a>, create an app of type <em>Business</em> and add the <strong>WhatsApp</strong> product.
            </li>
            <li>Under WhatsApp → API Setup, add and verify the school&apos;s phone number. Copy its <strong>Phone number ID</strong>.</li>
            <li>
              In Business Settings → System users, create a system user, give it access to the app and WhatsApp account, and generate a <strong>permanent token</strong> with
              the <code className="font-mono text-xs">whatsapp_business_messaging</code> permission.
            </li>
            <li>In WhatsApp Manager → Message templates, create the four templates from this page (category Utility) and wait for approval.</li>
            <li>Paste the details here, save, and send a test message.</li>
          </ol>
          <Alert tone="warning">
            Use a number that isn&apos;t already active on the WhatsApp phone app, or migrate it first: a number can&apos;t be on the app and the API at the same time.
          </Alert>
        </Drawer>
      )}
    </section>
  );
}

interface HistoryRow {
  id: string;
  type: MessageType;
  mode: "link" | "api";
  status: LastSent["status"];
  to: string;
  student: { id: string; fullName: string; admissionNo: string } | null;
  error: string | null;
  sentByName: string;
  createdAt: string;
}

function MessageHistory() {
  const [page, setPage] = useState(1);
  const path = `/api/whatsapp/messages?page=${page}&limit=20`;
  const list = useResource(() => api<{ messages: HistoryRow[]; pagination: Pagination }>(path), path);

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <h2 className="border-b border-border px-5 py-4 font-semibold">Recent WhatsApp messages</h2>
      {list.error ? (
        <p className="p-5 text-sm text-danger">{list.error}</p>
      ) : !list.data ? (
        <Skeleton className="m-5 h-24" />
      ) : list.data.messages.length === 0 ? (
        <p className="p-5 text-sm text-muted">No messages yet. Send one from a receipt, a fee account or the attendance register.</p>
      ) : (
        <ul className="divide-y divide-border">
          {list.data.messages.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">
                  <span className="font-medium">{TYPE_LABEL[m.type]}</span>
                  {m.student && <span className="text-muted"> · {m.student.fullName}</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {m.to ? `+${m.to}` : "—"} · {m.mode === "api" ? "Automatic" : "Click-to-send"}
                  {m.sentByName && ` · ${m.sentByName}`}
                </p>
                {m.error && <p className="mt-0.5 text-xs text-danger">{m.error}</p>}
              </div>
              <div className="shrink-0 text-right">
                <Badge tone={m.status === "failed" ? "danger" : m.status === "read" || m.status === "delivered" ? "success" : "neutral"}>{STATUS_LABEL[m.status]}</Badge>
                <p className="mt-1 text-xs text-muted" title={formatDate(m.createdAt, true)}>
                  {timeAgo(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager pagination={list.data?.pagination} onPage={setPage} />
    </section>
  );
}
