"use client";

import { useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { errorMessage, useResource } from "@/components/data";
import { Letterhead } from "@/components/letterhead";
import { Alert, Button, Field, Input, Select, Skeleton } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SCHOOL_TYPES, loadSchool, setCachedSchool, type School } from "@/lib/school";
import { SettingsCard } from "./card";

type Editable = Omit<School, "id" | "slug" | "createdAt">;

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 1)).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" }));

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const BOARDS = ["CBSE", "ICSE", "State Board", "IB", "Cambridge (IGCSE)", "NIOS"];

export function ProfileSettings() {
  const { updateSession } = useAuth();
  const loaded = useResource(loadSchool, "school-profile");
  const [draft, setDraft] = useState<Partial<Editable>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  const s = loaded.data;
  if (!s) return <Skeleton className="h-[36rem] rounded-2xl" />;

  const v = { ...s, ...draft };
  const changed = Object.fromEntries(Object.entries(draft).filter(([k, val]) => val !== s[k as keyof Editable])) as Partial<Editable>;
  const dirty = Object.keys(changed).length > 0;
  const set = <K extends keyof Editable>(k: K) => (value: Editable[K]) => {
    setDraft((d) => ({ ...d, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const text = (k: keyof Editable) => ({
    id: `school-${k}`,
    value: String(v[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k)(e.target.value as never),
    "aria-invalid": Boolean(errors[k]),
  });

  async function save() {
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const { school } = await api<{ school: School }>("/api/school", { method: "PATCH", body: changed });
      setCachedSchool(school);
      loaded.setData(school);
      setDraft({});
      // The sidebar and report cards show the school's name
      if (changed.name) updateSession({ tenant: { id: school.id, name: school.name, slug: school.slug } });
      setMessage({ tone: "success", text: "School profile saved. Receipts and report cards now use it." });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(fieldErrors(err.details));
      setMessage({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard
      title="School profile"
      description="Your school's details. They head every receipt and report card."
      footer={
        <>
          {dirty && (
            <Button variant="ghost" onClick={() => { setDraft({}); setErrors({}); }}>
              Discard
            </Button>
          )}
          <Button onClick={save} loading={busy} disabled={!dirty || !v.name.trim()}>
            Save changes
          </Button>
        </>
      }
    >
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="School name" htmlFor="school-name" error={errors.name || (!v.name.trim() ? "School name is required" : undefined)}>
            <Input {...text("name")} maxLength={150} />
          </Field>
        </div>
        <Field label="Type" htmlFor="school-type">
          <Select {...text("type")}>
            {SCHOOL_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Board" htmlFor="school-board" hint="Optional" error={errors.board}>
          <Input {...text("board")} list="school-boards" maxLength={60} placeholder="e.g. CBSE" />
          <datalist id="school-boards">
            {BOARDS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="school-phone" error={errors.phone}>
            <Input {...text("phone")} type="tel" inputMode="tel" maxLength={30} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Email" htmlFor="school-email" error={errors.email}>
            <Input {...text("email")} type="email" maxLength={254} placeholder="office@school.edu" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Website" htmlFor="school-website" hint="Optional" error={errors.website}>
              <Input {...text("website")} maxLength={200} placeholder="www.school.edu" />
            </Field>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold">Address</h3>
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <Field label="Street address" htmlFor="school-address" error={errors.address}>
              <Input {...text("address")} maxLength={300} placeholder="Building, street, area" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="City" htmlFor="school-city" error={errors.city}>
              <Input {...text("city")} maxLength={80} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="State" htmlFor="school-state" error={errors.state}>
              <Input {...text("state")} list="school-states" maxLength={80} />
              <datalist id="school-states">
                {STATES.map((st) => (
                  <option key={st} value={st} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="PIN code" htmlFor="school-pincode" error={errors.pincode}>
              <Input {...text("pincode")} inputMode="numeric" maxLength={12} />
            </Field>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-3 text-sm font-semibold">Academics &amp; receipts</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Academic year starts in" htmlFor="school-academicYearStart" hint="Used for year-to-date fee totals">
            <Select id="school-academicYearStart" value={String(v.academicYearStart)} onChange={(e) => set("academicYearStart")(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note printed on receipts" htmlFor="school-receiptNote" hint={`Optional, e.g. your refund policy. ${300 - v.receiptNote.length} characters left.`} error={errors.receiptNote}>
              <Input {...text("receiptNote")} maxLength={300} placeholder="Fees once paid are not refundable." />
            </Field>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-semibold">Preview</h3>
        <p className="mb-3 text-xs text-muted">How the top of receipts and report cards will look.</p>
        <div className="rounded-lg border border-zinc-300 bg-white p-5 text-[13px] text-zinc-900">
          <Letterhead
            school={{ ...v, name: v.name || "Your school" }}
            title="Fee receipt"
            right={
              <>
                <p className="font-mono text-base font-semibold">R00001</p>
                <p className="text-xs text-zinc-500">Receipt no</p>
              </>
            }
          />
          {v.receiptNote && <p className="mt-3 border-t border-dashed border-zinc-300 pt-2 text-[11px] text-zinc-600">{v.receiptNote}</p>}
        </div>
      </div>
    </SettingsCard>
  );
}
