"use client";

import { useState } from "react";
import { ReceiptDocument } from "@/app/app/fees/_components/receipt";
import { errorMessage, useResource } from "@/components/data";
import { Alert, Button, Field, Input, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Receipt } from "@/lib/fees";
import { RECEIPT_ACCENTS, RECEIPT_SHOW, loadSchool, receiptSettings, setCachedSchool, type ReceiptAccent, type ReceiptSettings, type School } from "@/lib/school";
import { SettingsCard } from "./card";

/** A made-up payment to preview the receipt with. */
function sampleReceipt(school: School, prefix: string): Receipt {
  const today = new Date().toISOString().slice(0, 10);
  return {
    payment: {
      id: "preview",
      receiptNo: `${prefix}00042`,
      studentId: "preview",
      student: { fullName: "Aarav Sharma", admissionNo: "ADM-0142", grade: "5", section: "A", guardianName: "Rohit Sharma" },
      date: today,
      amount: 1500000,
      kind: "receipt",
      advance: 0,
      mode: "upi",
      reference: "UTR412398765",
      note: "",
      allocations: [
        { invoiceId: "a", label: "Term 1", planName: "Class 5 2026-27", amount: 1200000 },
        { invoiceId: "b", label: "Term 2", planName: "Class 5 2026-27", amount: 300000 },
      ],
      receivedByName: "Office",
      createdAt: new Date().toISOString(),
      voided: null,
    },
    school: { name: school.name },
    currentBalance: 900000,
    currentAdvance: 0,
    concessions: [{ label: "Term 1", planName: "Class 5 2026-27", fee: 1350000, discount: 150000, reason: "Sibling (10% off)" }],
    account: { fee: 2400000, paid: 1500000, balance: 900000, advance: 0 },
  };
}

/** How fee receipts look: colours, what's shown, numbering, note, paper and copies. */
export function ReceiptSettingsCard() {
  const loaded = useResource(loadSchool, "school-profile");
  const [draft, setDraft] = useState<ReceiptSettings | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  const school = loaded.data;
  if (!school) return <Skeleton className="h-[36rem] rounded-2xl" />;

  const saved = receiptSettings(school.receipt);
  const v = draft ?? saved;
  const note = noteDraft ?? school.receiptNote;
  const dirty = JSON.stringify(v) !== JSON.stringify(saved) || note !== school.receiptNote;
  const set = (patch: Partial<ReceiptSettings>) => setDraft({ ...v, ...patch });
  const prefixOk = /^[A-Za-z0-9/-]{1,10}$/.test(v.prefix);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const { school: next } = await api<{ school: School }>("/api/school/receipt", { method: "PUT", body: { ...v, receiptNote: note } });
      setCachedSchool(next);
      loaded.setData(next);
      setDraft(null);
      setNoteDraft(null);
      setMessage({ tone: "success", text: "Saved. Every receipt (screen, PDF, image and print) now looks like this." });
    } catch (err) {
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <SettingsCard
        title="Receipts"
        description="Choose how fee receipts look. The preview updates as you change things."
        footer={
          <>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setNoteDraft(null);
                }}
              >
                Discard
              </Button>
            )}
            <Button onClick={save} loading={busy} disabled={!dirty || !prefixOk || v.title.trim().length < 2}>
              Save changes
            </Button>
          </>
        }
      >
        {message && <Alert tone={message.tone}>{message.text}</Alert>}

        <div>
          <p className="mb-2 text-sm font-medium">Colour</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RECEIPT_ACCENTS) as ReceiptAccent[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set({ accent: a })}
                aria-pressed={v.accent === a}
                className={cx("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors", v.accent === a ? "border-accent bg-accent-soft font-medium" : "border-border hover:bg-surface-muted")}
              >
                <span className={cx("size-4 rounded-full", RECEIPT_ACCENTS[a].swatch)} />
                {RECEIPT_ACCENTS[a].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="rc-title" hint="e.g. Fee receipt, Fee challan, Tuition fee receipt">
            <Input id="rc-title" value={v.title} maxLength={60} disabled={!v.show.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Receipt number starts with" htmlFor="rc-prefix" error={prefixOk ? undefined : "1–10 letters, digits, - or /"} hint={`New receipts look like ${v.prefix || "R"}00042. The number carries on from your last receipt; old receipts keep theirs.`}>
            <Input id="rc-prefix" value={v.prefix} maxLength={10} onChange={(e) => set({ prefix: e.target.value.toUpperCase().replace(/\s/g, "") })} className="font-mono" />
          </Field>
          <Field label="Signature label" htmlFor="rc-sign" hint="Under the signature line, e.g. Principal or Accountant">
            <Input id="rc-sign" value={v.signatureLabel} maxLength={60} onChange={(e) => set({ signatureLabel: e.target.value })} />
          </Field>
          <Field label="PDF paper size" htmlFor="rc-paper">
            <div className="flex rounded-lg border border-border p-0.5 text-sm" id="rc-paper" role="group">
              {(["a5", "a4"] as const).map((pp) => (
                <button
                  key={pp}
                  type="button"
                  onClick={() => set({ paper: pp })}
                  aria-pressed={v.paper === pp}
                  className={cx("flex-1 rounded-md px-3 py-1.5", v.paper === pp ? "bg-surface-muted font-medium" : "text-muted")}
                >
                  {pp === "a5" ? "A5 (half page)" : "A4 (full page)"}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Note at the bottom" htmlFor="rc-note" hint={`Optional, e.g. your refund policy. ${300 - note.length} characters left.`}>
          <Input id="rc-note" value={note} maxLength={300} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Fees once paid are not refundable." />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Show on the receipt</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RECEIPT_SHOW.map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted">
                <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={v.show[key]} onChange={(e) => set({ show: { ...v.show, [key]: e.target.checked } })} />
                {label}
                {key === "logo" && !school.logoUrl && <span className="text-xs text-muted">(no logo yet)</span>}
                {key === "schoolName" && !v.show.schoolName && (!school.logoUrl || !v.show.logo) && <span className="text-xs text-warning">(still shown: no logo)</span>}
              </label>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-4 py-3">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={v.twoCopies} onChange={(e) => set({ twoCopies: e.target.checked })} />
          <span>
            <span className="block text-sm font-medium">Print two copies on one page</span>
            <span className="block text-xs text-muted">An office copy and a parent copy, with a line to cut along.</span>
          </span>
        </label>
      </SettingsCard>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
        <div className="rounded-2xl border border-border bg-surface-muted/60 p-3 sm:p-5">
          <ReceiptDocument receipt={sampleReceipt(school, v.prefix || "R")} settings={v} note={note} />
        </div>
      </div>
    </div>
  );
}
