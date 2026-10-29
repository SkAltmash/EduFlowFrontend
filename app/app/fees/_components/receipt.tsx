"use client";

import { useRef, useState, type Ref } from "react";
import { SchoolLetterhead, useSchoolProfile } from "@/components/letterhead";
import { PRINT_ICON, PrintPortal, canShareFiles, nodeToPdf, shareNodeAsImage, shareOrDownload } from "@/components/share";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Button, Field, Icon, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay } from "@/lib/attendance";
import { MODE_LABEL, MODE_REFERENCE, amountInWords, formatMoney, type Receipt } from "@/lib/fees";
import { RECEIPT_ACCENTS, receiptSettings, type ReceiptSettings } from "@/lib/school";

function Cell({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      {/* Names wrap rather than get cut off */}
      <dd className={mono ? "break-all font-mono" : "break-words font-semibold leading-snug"}>{children}</dd>
    </div>
  );
}

/** The receipt as a paper document. Fixed light colours: it looks the same on screen, in dark mode, on paper and in PDFs. */
export function ReceiptDocument({
  receipt,
  ref,
  settings,
  note: noteOverride,
  copyLabel,
}: {
  receipt: Receipt;
  ref?: Ref<HTMLDivElement>;
  /** Settings being edited (preview); otherwise the school's saved ones */
  settings?: ReceiptSettings;
  note?: string;
  /** "Office copy" / "Parent copy" when printing two */
  copyLabel?: string;
}) {
  const { payment: p, school, currentBalance } = receipt;
  const cls = p.student.grade ? className(p.student.grade, p.student.section) : "—";
  const profile = useSchoolProfile();
  const cfg = settings ?? receiptSettings(profile?.receipt);
  const show = cfg.show;
  const accent = RECEIPT_ACCENTS[cfg.accent];
  const note = noteOverride ?? profile?.receiptNote;
  const opening = p.kind === "opening";
  const account = receipt.account;
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-zinc-300 bg-white p-6 text-[13px] leading-relaxed text-zinc-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* Coloured strip so a shared image reads as a receipt at a glance */}
      <div aria-hidden className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent.strip} print:hidden`} />
      {copyLabel && <p className={`mb-2 text-right text-[10px] font-bold uppercase tracking-widest ${accent.text}`}>{copyLabel}</p>}
      {p.voided && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="-rotate-12 rounded-md border-4 border-red-600/70 px-6 py-2 text-5xl font-black tracking-widest text-red-600/70">VOID</span>
        </div>
      )}
      <SchoolLetterhead
        name={school.name}
        // Fees paid before EduFlow always say so; otherwise the title can be hidden
        title={opening ? "Fees paid before EduFlow" : show.title ? cfg.title : ""}
        showLogo={show.logo}
        showName={show.schoolName}
        showContact={show.contact}
        ruleClass={accent.rule}
        titleClass={accent.text}
        right={
          <>
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Receipt no</p>
            <p className="font-mono text-base font-bold">{p.receiptNo}</p>
            <p className="text-xs text-zinc-500">{formatDay(p.date, "long")}</p>
          </>
        }
      />

      <dl className={`grid grid-cols-2 gap-x-6 gap-y-2 py-3 ${show.guardian ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Cell label="Student">{p.student.fullName}</Cell>
        <Cell label="Admission no" mono>
          {p.student.admissionNo}
        </Cell>
        <Cell label="Class">{cls}</Cell>
        {show.guardian && <Cell label="Guardian">{p.student.guardianName || "—"}</Cell>}
      </dl>

      {/* The amount, big */}
      <div className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${p.voided ? "border-zinc-300 bg-zinc-50" : accent.box}`}>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Amount received</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{formatMoney(p.amount)}</p>
          {show.amountInWords && <p className="text-[11px] italic text-zinc-600">{amountInWords(p.amount)}</p>}
        </div>
        <div className="shrink-0 text-right text-xs">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Paid by</p>
          <p className="font-semibold">{MODE_LABEL[p.mode]}</p>
          {p.reference && <p className="max-w-40 truncate font-mono text-zinc-600">{p.reference}</p>}
          {!p.voided && <p className={`mt-1 inline-block rounded-full ${accent.badge} px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white`}>✓ Received</p>}
        </div>
      </div>

      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-zinc-300 text-left text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="py-1.5 font-medium">Towards</th>
            <th className="py-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {p.allocations.map((a) => (
            <tr key={a.invoiceId} className="border-b border-zinc-100">
              <td className="py-1.5">
                {a.label} <span className="text-zinc-500">· {a.planName}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(a.amount)}</td>
            </tr>
          ))}
          {!p.voided && (p.advance ?? 0) > 0 && (
            <tr className="border-b border-zinc-100">
              <td className="py-1.5">
                Advance <span className="text-zinc-500">· for upcoming fees</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(p.advance!)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td className="pt-2">Total</td>
            <td className="pt-2 text-right tabular-nums">{formatMoney(p.amount)}</td>
          </tr>
        </tbody>
      </table>

      {show.concessions && receipt.concessions && receipt.concessions.length > 0 && (
        <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
          {receipt.concessions.map((c) => (
            <p key={`${c.planName}|${c.label}`} className="flex justify-between gap-3">
              <span>
                {c.label} fee {formatMoney(c.fee)} − {c.reason}
              </span>
              <span className="tabular-nums">= {formatMoney(c.fee - c.discount)}</span>
            </p>
          ))}
        </div>
      )}

      {/* Where the student stands now */}
      {show.summary && !p.voided && (
        // 1px gaps over a grey background draw the dividers, in 2 or 4 columns alike
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 text-center sm:grid-cols-4">
          {[
            ["Total fees", account?.fee],
            ["Paid till date", account?.paid],
            ["Balance due", account?.balance ?? currentBalance],
            ["Advance", account?.advance ?? receipt.currentAdvance ?? 0],
          ]
            .filter(([, v]) => v !== undefined)
            .map(([label, v]) => (
              <div key={String(label)} className="bg-white px-2 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
                <p className={`font-semibold tabular-nums ${label === "Balance due" && Number(v) > 0 ? "text-red-700" : ""}`}>{formatMoney(Number(v))}</p>
              </div>
            ))}
        </div>
      )}

      {(opening || p.note) && (
        <dl className="mt-3 space-y-1 text-xs">
          {opening && (
            <div>
              <dt className="inline text-zinc-500">Recorded in EduFlow: </dt>
              <dd className="inline">paid before the school started using EduFlow{p.reference ? ` (original receipt ${p.reference})` : ""}.</dd>
            </div>
          )}
          {p.note && (
            <div>
              <dt className="inline text-zinc-500">Note: </dt>
              <dd className="inline">{p.note}</dd>
            </div>
          )}
        </dl>
      )}

      {p.voided && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          Voided {formatDate(p.voided.at, true)} by {p.voided.byName}: {p.voided.reason}
        </p>
      )}

      {(show.receivedBy || show.signature) && (
        <div className="mt-8 flex items-end justify-between gap-4 text-xs text-zinc-500">
          {show.receivedBy ? (
            <span>
              Received by {p.receivedByName || "—"}
              <br />
              {formatDate(p.createdAt, true)}
            </span>
          ) : (
            <span />
          )}
          {show.signature && <span className="min-w-36 border-t border-zinc-400 pt-1 text-center">{cfg.signatureLabel || "Authorised signature"}</span>}
        </div>
      )}
      {note && <p className="mt-5 border-t border-dashed border-zinc-300 pt-2 text-[11px] text-zinc-600">{note}</p>}
      {show.footer && <p className="mt-4 text-center text-[10px] text-zinc-400">Computer-generated receipt · EduFlow</p>}
    </div>
  );
}

/** Opens the print dialog for a receipt; only the receipt is printed. */
export function PrintableReceipt({ receipt }: { receipt: Receipt }) {
  const cfg = receiptSettings(useSchoolProfile()?.receipt);
  return (
    <PrintPortal>
      {cfg.twoCopies ? (
        // Office copy and parent copy on one sheet, with a line to cut along
        <div className="space-y-4">
          <ReceiptDocument receipt={receipt} copyLabel="Office copy" />
          <p className="border-t border-dashed border-zinc-400 pt-1 text-center text-[9px] uppercase tracking-widest text-zinc-400">✂ cut here</p>
          <ReceiptDocument receipt={receipt} copyLabel="Parent copy" />
        </div>
      ) : (
        <ReceiptDocument receipt={receipt} />
      )}
    </PrintPortal>
  );
}

export function ReceiptDrawer({
  paymentId,
  canVoid,
  onClose,
  onChanged,
  initial,
}: {
  paymentId: string;
  canVoid: boolean;
  onClose: () => void;
  onChanged?: () => void;
  /** Already-loaded receipt (e.g. right after collecting) to skip a fetch */
  initial?: Receipt;
}) {
  const fetched = useResource(() => (initial ? Promise.resolve(initial) : api<Receipt>(`/api/fees/payments/${paymentId}`)), paymentId);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const data = receipt ?? fetched.data;
  const docRef = useReceiptRef();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doVoid() {
    setBusy(true);
    setError(null);
    try {
      setReceipt(await api<Receipt>(`/api/fees/payments/${paymentId}/void`, { method: "POST", body: { reason } }));
      setVoiding(false);
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={data ? `Receipt ${data.payment.receiptNo}` : "Receipt"}
      onClose={onClose}
      footer={
        data && (
          <div className="flex items-center justify-between gap-2">
            {canVoid && !data.payment.voided && !voiding ? (
              <Button variant="danger" onClick={() => setVoiding(true)}>
                Void
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => window.print()}>
              <Icon d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" />
              Print
            </Button>
          </div>
        )
      }
    >
      {fetched.error && !data ? (
        <Alert>{fetched.error}</Alert>
      ) : !data ? (
        <Spinner className="mx-auto my-16" />
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          {voiding && (
            <div className="space-y-3 rounded-xl border border-danger/40 bg-danger-soft p-4">
              <p className="text-sm">
                Voiding keeps this receipt on record but cancels it. {formatMoney(data.payment.amount)} goes back onto the student&apos;s dues.
              </p>
              <Field label="Reason" htmlFor="void-reason">
                <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque bounced, entered twice" autoFocus />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setVoiding(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={doVoid} loading={busy} disabled={reason.trim().length < 3}>
                  Void receipt
                </Button>
              </div>
            </div>
          )}
          <ReceiptShare receipt={data} docRef={docRef} />
          <ReceiptDocument receipt={data} ref={docRef} />
          {data.payment.mode !== "cash" && !data.payment.reference && MODE_REFERENCE[data.payment.mode] && (
            <p className="text-xs text-muted">No reference ({MODE_REFERENCE[data.payment.mode]}) was recorded for this payment.</p>
          )}
          <PrintableReceipt receipt={data} />
        </>
      )}
    </Drawer>
  );
}

const SHARE_OPTIONS = [
  { key: "pdf", label: "Download PDF", icon: "M12 4v12M7 11l5 5 5-5M5 20h14" },
  { key: "share-pdf", label: "Share PDF", icon: "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" },
  { key: "image", label: "Share image", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" },
  { key: "print", label: "Print", icon: PRINT_ICON },
  { key: "copy", label: "Copy text", icon: "M9 9h10v11H9zM5 15V4h10" },
] as const;
type OptionKey = (typeof SHARE_OPTIONS)[number]["key"];

/** Every way to send a receipt: WhatsApp message, PDF, image, print and copy. */
export function ReceiptShare({ receipt, docRef }: { receipt: Receipt; docRef: React.RefObject<HTMLDivElement | null> }) {
  const paper = receiptSettings(useSchoolProfile()?.receipt).paper;
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shareable] = useState(canShareFiles);
  if (receipt.payment.voided) return null;
  const p = receipt.payment;
  const fileName = `receipt-${p.receiptNo}-${p.student.fullName.replace(/\s+/g, "-")}`;
  const title = `Fee receipt ${p.receiptNo} — ${p.student.fullName}`;

  async function handle(key: OptionKey) {
    const node = docRef.current;
    if (!node) return;
    setBusy(key);
    setNote(null);
    try {
      if (key === "pdf" || key === "share-pdf") {
        const done = await shareOrDownload(await nodeToPdf(node, fileName, paper), title, key === "share-pdf");
        if (done === "downloaded") setNote(key === "share-pdf" ? "PDF downloaded. Attach it in WhatsApp Web or email." : "PDF downloaded.");
      } else if (key === "image") {
        if ((await shareNodeAsImage(node, fileName, title)) === "downloaded") setNote("Image downloaded. Attach it in WhatsApp Web or any chat.");
      } else if (key === "print") {
        window.print();
      } else {
        const lines = [
          receipt.school.name,
          `Fee receipt ${p.receiptNo} · ${formatDay(p.date, "long")}`,
          `${p.student.fullName} (${p.student.admissionNo})`,
          `Received ${formatMoney(p.amount)} by ${MODE_LABEL[p.mode]}${p.reference ? ` (${p.reference})` : ""}`,
          ...p.allocations.map((a) => `• ${a.label}: ${formatMoney(a.amount)}`),
          ...((p.advance ?? 0) > 0 ? [`• Advance: ${formatMoney(p.advance!)}`] : []),
          `Balance due now: ${formatMoney(receipt.account?.balance ?? receipt.currentBalance)}`,
        ];
        await navigator.clipboard.writeText(lines.join("\n"));
        setNote("Receipt details copied. Paste them in any chat or SMS.");
      }
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const options = SHARE_OPTIONS.filter((o) => o.key !== "share-pdf" || shareable);

  return (
    <div className="space-y-2">
      <WhatsAppButton onClick={() => setWhatsapp(true)}>Send on WhatsApp</WhatsAppButton>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => handle(o.key)}
            disabled={busy !== null}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-2 py-2.5 text-xs font-medium transition-colors hover:bg-surface-muted disabled:opacity-60"
          >
            {busy === o.key ? <Spinner className="size-5" /> : <Icon d={o.icon} className="size-5 text-accent" />}
            {o.key === "image" && !shareable ? "Save image" : o.label}
          </button>
        ))}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
      {whatsapp && (
        <WhatsAppDrawer type="fee_receipt" refs={[{ paymentId: p.id }]} title={`Receipt ${p.receiptNo} on WhatsApp`} onClose={() => setWhatsapp(false)} />
      )}
    </div>
  );
}

export function useReceiptRef() {
  return useRef<HTMLDivElement>(null);
}
