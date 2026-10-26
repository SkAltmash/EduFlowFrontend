"use client";

import { useRef, useState, type Ref } from "react";
import { PrintPortal, ShareImageButton } from "@/components/share";
import { WhatsAppButton, WhatsAppDrawer } from "@/components/whatsapp-send";
import { Drawer, errorMessage, formatDate, useResource } from "@/components/data";
import { Alert, Button, Field, Icon, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { className, formatDay } from "@/lib/attendance";
import { MODE_LABEL, MODE_REFERENCE, amountInWords, formatMoney, type Receipt } from "@/lib/fees";

/** The receipt as a paper document. Fixed light colours: it looks the same on screen, in dark mode and on paper. */
export function ReceiptDocument({ receipt, ref }: { receipt: Receipt; ref?: Ref<HTMLDivElement> }) {
  const { payment: p, school, currentBalance } = receipt;
  const cls = p.student.grade ? className(p.student.grade, p.student.section) : "—";
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-zinc-300 bg-white p-6 text-[13px] leading-relaxed text-zinc-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {p.voided && (
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-12 rounded-md border-4 border-red-600/70 px-6 py-2 text-5xl font-black tracking-widest text-red-600/70">VOID</span>
        </div>
      )}
      <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-3">
        <div>
          <p className="text-lg font-bold">{school.name}</p>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Fee receipt</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-base font-semibold">{p.receiptNo}</p>
          <p className="text-xs text-zinc-500">{formatDay(p.date, "long")}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 py-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Student</dt>
          <dd className="font-semibold">{p.student.fullName}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Admission no</dt>
          <dd className="font-mono">{p.student.admissionNo}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Class</dt>
          <dd>{cls}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Guardian</dt>
          <dd>{p.student.guardianName || "—"}</dd>
        </div>
      </dl>

      <table className="w-full border-y border-zinc-300">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="py-2 font-medium">Towards</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {p.allocations.map((a) => (
            <tr key={a.invoiceId} className="border-t border-zinc-200">
              <td className="py-1.5">
                {a.label} <span className="text-zinc-500">· {a.planName}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(a.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-900 font-bold">
            <td className="py-2">Total received</td>
            <td className="py-2 text-right text-base tabular-nums">{formatMoney(p.amount)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 italic">{amountInWords(p.amount)}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <dt className="text-zinc-500">Payment mode</dt>
          <dd className="font-medium">
            {MODE_LABEL[p.mode]}
            {p.reference && <span className="font-normal text-zinc-600"> · {p.reference}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Balance due now</dt>
          <dd className="font-medium tabular-nums">{formatMoney(currentBalance)}</dd>
        </div>
        {p.note && (
          <div className="col-span-2">
            <dt className="text-zinc-500">Note</dt>
            <dd>{p.note}</dd>
          </div>
        )}
      </dl>

      {p.voided && (
        <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          Voided {formatDate(p.voided.at, true)} by {p.voided.byName}: {p.voided.reason}
        </p>
      )}

      <div className="mt-8 flex items-end justify-between text-xs text-zinc-500">
        <span>
          Received by {p.receivedByName || "—"}
          <br />
          {formatDate(p.createdAt, true)}
        </span>
        <span className="border-t border-zinc-400 pt-1">Authorised signature</span>
      </div>
      <p className="mt-4 text-center text-[10px] text-zinc-400">Computer-generated receipt · EduFlow</p>
    </div>
  );
}

/** Opens the print dialog for a receipt; only the receipt is printed. */
export function PrintableReceipt({ receipt }: { receipt: Receipt }) {
  return (
    <PrintPortal>
      <ReceiptDocument receipt={receipt} />
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

/** "WhatsApp" + "Share image" for a receipt. Pass the receipt document's element for the image. */
export function ReceiptShare({ receipt, docRef }: { receipt: Receipt; docRef: React.RefObject<HTMLDivElement | null> }) {
  const [whatsapp, setWhatsapp] = useState(false);
  if (receipt.payment.voided) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <WhatsAppButton onClick={() => setWhatsapp(true)}>Send on WhatsApp</WhatsAppButton>
      <ShareImageButton
        nodeRef={docRef}
        fileName={`receipt-${receipt.payment.receiptNo}`}
        title={`Fee receipt ${receipt.payment.receiptNo} — ${receipt.payment.student.fullName}`}
      />
      {whatsapp && (
        <WhatsAppDrawer
          type="fee_receipt"
          refs={[{ paymentId: receipt.payment.id }]}
          title={`Receipt ${receipt.payment.receiptNo} on WhatsApp`}
          onClose={() => setWhatsapp(false)}
        />
      )}
    </div>
  );
}

export function useReceiptRef() {
  return useRef<HTMLDivElement>(null);
}
