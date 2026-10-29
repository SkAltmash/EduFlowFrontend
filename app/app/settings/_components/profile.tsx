"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { fieldErrors } from "@/components/auth-shell";
import { errorMessage, useResource } from "@/components/data";
import { ImageCropper } from "@/components/image-cropper";
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

      <LogoUploader
        school={s}
        onChange={(school, text) => {
          setCachedSchool(school);
          loaded.setData(school);
          setMessage(text ? { tone: "success", text } : null);
        }}
        onError={(text) => setMessage({ tone: "danger", text })}
      />

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
            <p className="text-sm text-muted">
              Receipt look, numbering and the note at the bottom are in{" "}
              <Link href="/app/settings/receipts" className="font-medium text-accent hover:underline">
                Settings → Receipts
              </Link>
              .
            </p>
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

/** Picked files can be large photos; the cropped logo is a small 512×512 PNG. */
const MAX_PICK_BYTES = 10 * 1024 * 1024;
const LOGO_SIZE = 512;

/** The school's logo: uploaded straight to Cloudinary with a signature from the server. */
function LogoUploader({ school, onChange, onError }: { school: School; onChange: (s: School, message: string) => void; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  // Picked image waiting in the crop window
  const [cropping, setCropping] = useState<File | null>(null);

  function pick(file: File) {
    if (input.current) input.current.value = "";
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return onError("Choose a PNG, JPG or WebP image.");
    if (file.size > MAX_PICK_BYTES) return onError("That image is over 10 MB. Choose a smaller one.");
    setCropping(file);
  }

  async function upload(file: File) {
    setCropping(null);
    setBusy("upload");
    try {
      const { uploadUrl, fields } = await api<{ uploadUrl: string; fields: Record<string, string | number> }>("/api/school/logo/signature", { method: "POST" });
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
      form.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const out = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message: string } } | null;
      if (!res.ok || !out?.secure_url) {
        const reason = out?.error?.message ?? "";
        // The platform's Cloudinary key can't upload: only EduFlow can fix that
        throw new Error(/permission|forbidden/i.test(reason) ? "Logo upload is set up but not allowed yet on EduFlow's side. Ask EduFlow support (Console → Settings → Test connection)." : reason || "Upload failed. Try again.");
      }
      const { school: saved } = await api<{ school: School }>("/api/school/logo", { method: "PUT", body: { url: out.secure_url } });
      onChange(saved, "Logo saved. It now appears on receipts and report cards.");
    } catch (err) {
      onError(err instanceof ApiError ? errorMessage(err) : (err as Error).message);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Remove the logo from receipts and report cards?")) return;
    setBusy("remove");
    try {
      const { school: saved } = await api<{ school: School }>("/api/school/logo", { method: "DELETE" });
      onChange(saved, "Logo removed.");
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-muted/50 p-4">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
        {school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logoUrl} alt={`${school.name} logo`} className="size-full object-contain p-1" />
        ) : (
          <span className="text-2xl font-semibold text-zinc-400">{school.name.trim()[0]?.toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Logo</p>
        <p className="text-xs text-muted">
          {school.logoUploads === false && !school.logoUrl
            ? "Logo upload isn't switched on yet. Ask EduFlow support."
            : `Shown on receipts and report cards. Pick a PNG, JPG or WebP; you crop it to a square and it's saved at ${LOGO_SIZE} × ${LOGO_SIZE} px.`}
        </p>
      </div>
      {school.logoUploads !== false && (
        <div className="flex gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
          <Button variant="secondary" size="sm" loading={busy === "upload"} disabled={busy !== null} onClick={() => input.current?.click()}>
            {school.logoUrl ? "Change logo" : "Upload logo"}
          </Button>
          {cropping && <ImageCropper file={cropping} output={LOGO_SIZE} title="Crop your logo" onCancel={() => setCropping(null)} onDone={upload} />}
          {school.logoUrl && (
            <Button variant="ghost" size="sm" className="text-danger" loading={busy === "remove"} disabled={busy !== null} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
