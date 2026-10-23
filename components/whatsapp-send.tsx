"use client";

import { useState, type ReactNode } from "react";
import { Drawer, errorMessage, useResource } from "@/components/data";
import { Alert, Badge, Button, Icon, Spinner, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { localToday } from "@/lib/attendance";
import {
  STATUS_LABEL,
  recentlySent,
  timeAgo,
  type LastSent,
  type MessageRef,
  type MessageType,
  type PrepareResult,
  type Recipient,
  type SendResult,
} from "@/lib/whatsapp";

/** Chat-bubble icon used for every WhatsApp action. */
export const WA_ICON = "M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1L4 20zM9 10h.01M12 10h.01M15 10h.01";

export function WhatsAppButton({
  children,
  className,
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50",
        // WhatsApp green, darkened enough for white text (WCAG AA)
        "bg-[#128c4a] hover:bg-[#0e7a40]",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        className
      )}
    >
      <Icon d={WA_ICON} />
      {children}
    </button>
  );
}

function StatusChip({ last }: { last: LastSent | null }) {
  if (!last) return null;
  const tone = last.status === "failed" ? "danger" : last.status === "read" || last.status === "delivered" ? "success" : "neutral";
  return (
    <Badge tone={tone}>
      {last.status === "read" ? "✓✓ " : last.status === "delivered" ? "✓✓ " : last.status === "sent" ? "✓ " : ""}
      {STATUS_LABEL[last.status]} · {timeAgo(last.at)}
    </Badge>
  );
}

function logOpened(type: MessageType, recipients: Recipient[]) {
  // Fire-and-forget: the history is a convenience, never block opening WhatsApp
  api("/api/whatsapp/log", {
    method: "POST",
    body: { type, entries: recipients.map((r) => ({ refKey: r.refKey, studentId: r.studentId, to: r.to })) },
  }).catch(() => {});
}

export function WhatsAppDrawer({
  type,
  refs,
  title,
  description,
  onClose,
  extra,
}: {
  type: MessageType;
  refs: MessageRef[];
  title: string;
  description?: string;
  onClose: () => void;
  /** Extra actions shown above the list, e.g. "Share receipt image" */
  extra?: ReactNode;
}) {
  const key = `${type}:${JSON.stringify(refs)}`;
  const prepared = useResource(
    () => api<PrepareResult>("/api/whatsapp/prepare", { method: "POST", body: { type, refs, today: localToday() } }),
    key
  );
  const [skipRecent, setSkipRecent] = useState(true);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const data = prepared.data;
  const ready = data?.recipients.filter((r) => !r.skip) ?? [];
  const skipped = data?.recipients.filter((r) => r.skip) ?? [];
  const recent = ready.filter((r) => recentlySent(r.last));
  const queue = skipRecent && refs.length > 1 ? ready.filter((r) => !recentlySent(r.last)) : ready;
  const pending = queue.filter((r) => !opened.has(r.refKey));
  const single = refs.length === 1;
  const auto = Boolean(data?.canSendAutomatically);

  function open(r: Recipient) {
    if (!r.link) return;
    window.open(r.link, "_blank", "noopener,noreferrer");
    setOpened((s) => new Set(s).add(r.refKey));
    logOpened(type, [r]);
  }

  async function copy(r: Recipient) {
    try {
      await navigator.clipboard.writeText(r.text ?? "");
      setCopied(r.refKey);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy. Select the message text and copy it manually.");
    }
  }

  async function sendAll() {
    if (!single && !confirm(`Send ${queue.length} WhatsApp message${queue.length === 1 ? "" : "s"} now?`)) return;
    setSending(true);
    setError(null);
    try {
      const refsToSend = refs.filter((ref) => queue.some((q) => q.refKey === refKeyOf(ref)));
      setResult(await api<SendResult>("/api/whatsapp/send", { method: "POST", body: { type, refs: refsToSend, today: localToday() } }));
      prepared.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const footer = data && queue.length > 0 && (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 text-sm text-muted">
        {auto
          ? `${queue.length} message${queue.length === 1 ? "" : "s"} will be sent from ${single ? "your school's number" : "the school's number"}`
          : pending.length
            ? `${queue.length - pending.length} of ${queue.length} opened`
            : "All opened ✓"}
      </p>
      {auto ? (
        <WhatsAppButton onClick={sendAll} disabled={sending || Boolean(result)} className="min-w-36">
          {sending ? <Spinner /> : null}
          {result ? "Sent" : single ? "Send now" : `Send ${queue.length}`}
        </WhatsAppButton>
      ) : pending.length ? (
        <WhatsAppButton onClick={() => open(pending[0])} className="min-w-36">
          {single ? "Open WhatsApp" : `Open next (${queue.length - pending.length + 1}/${queue.length})`}
        </WhatsAppButton>
      ) : (
        <Button onClick={onClose}>Done</Button>
      )}
    </div>
  );

  return (
    <Drawer title={title} onClose={onClose} footer={footer}>
      {description && <p className="text-sm text-muted">{description}</p>}
      {error && <Alert>{error}</Alert>}

      {prepared.error ? (
        <Alert>{prepared.error}</Alert>
      ) : !data ? (
        <Spinner className="mx-auto my-12" />
      ) : (
        <>
          {extra}

          {data.mode === "api" && !auto && (
            <Alert tone="warning">Automatic sending has no approved template for this message yet, so it opens in WhatsApp instead. An admin can add it in Settings → WhatsApp.</Alert>
          )}

          {result && (
            <Alert tone={result.failed ? "warning" : "success"}>
              {result.sent} sent{result.failed ? `, ${result.failed} failed` : ""}
              {result.skipped ? `, ${result.skipped} skipped` : ""}. Delivery and read ticks update automatically.
            </Alert>
          )}

          {!single && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Ready", value: queue.length, tone: "text-success" },
                { label: "Messaged today", value: recent.length, tone: "" },
                { label: "Can't send", value: skipped.length, tone: skipped.length ? "text-danger" : "" },
              ].map((t) => (
                <div key={t.label} className="rounded-xl border border-border bg-surface p-3">
                  <p className={cx("text-xl font-semibold tabular-nums", t.tone)}>{t.value}</p>
                  <p className="text-xs text-muted">{t.label}</p>
                </div>
              ))}
            </div>
          )}

          {!single && recent.length > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={skipRecent} onChange={(e) => setSkipRecent(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
              <span>
                Skip {recent.length} parent{recent.length === 1 ? "" : "s"} already messaged in the last 24 hours
              </span>
            </label>
          )}

          {single && ready[0] ? (
            <SinglePreview r={ready[0]} onCopy={() => copy(ready[0])} copied={copied === ready[0].refKey} resultStatus={result?.results[0]} />
          ) : single && skipped[0] ? (
            <Alert tone="warning">
              Can&apos;t message {skipped[0].guardianName || "this parent"}: {skipped[0].skip}.
              {skipped[0].skip === "No guardian phone number" && " Add it on the student's profile."}
            </Alert>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {[...ready, ...skipped].map((r) => {
                const inQueue = queue.includes(r);
                const res = result?.results.find((x) => x.refKey === r.refKey);
                return (
                  <li key={r.refKey} className={cx("px-4 py-3", (!inQueue || r.skip) && "opacity-60")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.studentName ?? "—"}</p>
                        <p className="truncate text-xs text-muted">
                          {r.skip ? r.skip : `${r.guardianName || "Parent"} · +${r.to}`}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {res ? (
                            <Badge tone={res.status === "sent" ? "success" : res.status === "failed" ? "danger" : "neutral"}>
                              {res.status === "sent" ? "Sent just now" : res.status === "failed" ? `Failed: ${res.reason}` : `Skipped: ${res.reason}`}
                            </Badge>
                          ) : opened.has(r.refKey) ? (
                            <Badge tone="success">Opened just now</Badge>
                          ) : (
                            <StatusChip last={r.last} />
                          )}
                        </div>
                      </div>
                      {!r.skip && !auto && (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="sm" onClick={() => copy(r)}>
                            {copied === r.refKey ? "Copied" : "Copy"}
                          </Button>
                          <WhatsAppButton size="sm" onClick={() => open(r)}>
                            Open
                          </WhatsAppButton>
                        </div>
                      )}
                    </div>
                    {r.text && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted hover:text-foreground">Preview message</summary>
                        <MessageBubble text={r.text} className="mt-2" />
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!auto && !single && queue.length > 0 && (
            <p className="text-xs text-muted">
              Each tap opens WhatsApp with the message ready. Press send there, come back, and tap again for the next parent.
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}

function refKeyOf(ref: MessageRef) {
  if ("paymentId" in ref) return ref.paymentId;
  if ("date" in ref) return `${ref.studentId}:${ref.date}`;
  if ("month" in ref) return `${ref.studentId}:${ref.month}`;
  return ref.studentId;
}

/** WhatsApp-style bubble: *bold* rendered bold, line breaks kept. */
export function MessageBubble({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("rounded-xl bg-wa-bubble p-3 text-[13px] leading-relaxed text-foreground", className)}>
      <p className="whitespace-pre-wrap break-words">
        {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
          part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i}>{part.slice(1, -1)}</strong> : part
        )}
      </p>
    </div>
  );
}

function SinglePreview({
  r,
  onCopy,
  copied,
  resultStatus,
}: {
  r: Recipient;
  onCopy: () => void;
  copied: boolean;
  resultStatus?: SendResult["results"][number];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium">To {r.guardianName || "Parent"}</p>
          <p className="text-muted">+{r.to}</p>
        </div>
        {resultStatus ? (
          <Badge tone={resultStatus.status === "sent" ? "success" : "danger"}>
            {resultStatus.status === "sent" ? "Sent just now" : `Failed: ${resultStatus.reason}`}
          </Badge>
        ) : (
          <StatusChip last={r.last} />
        )}
      </div>
      {r.last && recentlySent(r.last) && !resultStatus && (
        <Alert tone="warning">
          This parent was already messaged {timeAgo(r.last.at)}
          {r.last.by ? ` by ${r.last.by}` : ""}.
        </Alert>
      )}
      {r.text && <MessageBubble text={r.text} />}
      <button onClick={onCopy} className="text-xs font-medium text-accent hover:underline">
        {copied ? "Copied ✓" : "Copy message"}
      </button>
    </div>
  );
}
