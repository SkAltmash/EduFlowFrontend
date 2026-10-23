import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { ICONS, Icon, buttonClass, cx } from "@/components/ui";

const TRIAL_DAYS = 7;

// ---------------------------------------------------------------------------
// Content (every feature listed here exists in the product)
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: "Students in one place",
    body: "Profiles, guardians, classes and sections. Bring your whole list over from Excel or CSV in one go, and export it back any time.",
    icon: ICONS.users,
  },
  {
    title: "Attendance in a minute",
    body: "Mark everyone present, change the few who aren't, save. Monthly reports flag anyone below 75%.",
    icon: ICONS.calendarCheck,
  },
  {
    title: "Fees without the chasing",
    body: "Fee plans with installments and concessions, part payments, numbered receipts and an always-up-to-date list of who owes what.",
    icon: "M7 4h10M7 8h10M7 4c4 0 6 2 6 4s-2 4-6 4l7 8",
  },
  {
    title: "Parents on WhatsApp",
    body: "Receipts, fee reminders, absence alerts and monthly reports, sent from your phone or automatically from the school's number.",
    icon: "M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1L4 20z",
  },
  {
    title: "Reports you can hand over",
    body: "Collections by day and payment mode, class-wise dues, attendance registers. Download any of it as Excel.",
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    title: "The right access for everyone",
    body: "Owners, admins, teachers and accountants each see what their job needs. Teachers never see fees.",
    icon: "M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4z",
  },
];

const AUDIENCES = ["Schools", "Tuition centres", "Coaching institutes", "Academies"];

const STEPS = [
  { title: "Create your institute", body: "Sign up with your name and your school's name. You're the owner, ready in under a minute." },
  { title: "Bring in your students", body: "Upload your existing Excel sheet. Columns like “Adm No”, “Class” and “Father Name” are recognised automatically." },
  { title: "Run your day", body: "Take attendance, collect fees, send receipts on WhatsApp. Invite your staff whenever you're ready." },
];

const INCLUDED = [
  "Unlimited students and staff",
  "Daily attendance and monthly reports",
  "Fee plans, receipts and reminders",
  "WhatsApp messages to parents",
  "Excel and CSV import & export",
  "Works on phone, tablet and computer",
];

const FAQ = [
  {
    q: `How does the ${TRIAL_DAYS}-day free trial work?`,
    a: `Create an account and every feature is open for ${TRIAL_DAYS} days. No credit card, nothing to install.`,
  },
  {
    q: "Do I need to install anything?",
    a: "No. EduFlow runs in the browser on any phone, tablet or computer. Staff just log in.",
  },
  {
    q: "Can I bring my existing student list?",
    a: "Yes. Upload the Excel (.xlsx, .xls) or CSV file you already have. Common column names are matched automatically, and you see a preview before anything is saved.",
  },
  {
    q: "How do WhatsApp messages reach parents?",
    a: "Out of the box, EduFlow opens WhatsApp with the message ready and you tap Send. Free, no setup. Schools with a WhatsApp Business account can switch on automatic sending with delivered and read ticks.",
  },
  {
    q: "Is our data safe?",
    a: "Every school's data is kept separate, passwords are hashed, sessions expire automatically, and sensitive keys are stored encrypted. Only the roles you choose can see fees.",
  },
  {
    q: "We have more than one branch. Does that work?",
    a: "Yes. One login can belong to several institutes with a different role in each, and switching between them takes a click.",
  },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Check({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cx("size-4 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-green">{children}</p>;
}

function SectionTitle({ eyebrow, title, body, center }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cx("max-w-2xl", center && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-pretty text-muted">{body}</p>}
    </div>
  );
}

/** A framed piece of product UI, used as illustration. */
function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-24px_rgba(20,27,58,0.35)]", className)}>
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Illustrations (built from the same styles as the real app)
// ---------------------------------------------------------------------------

function HeroMockup() {
  const bars = [38, 52, 30, 64, 46, 72, 40, 58, 84, 50, 66, 92];
  return (
    <div aria-hidden>
      <Frame>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Fees · This month</p>
              <p className="text-2xl font-semibold tracking-tight text-success tabular-nums">₹4,69,250</p>
            </div>
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">36 receipts</span>
          </div>
          <div className="flex h-24 items-end gap-[3px]">
            {bars.map((h, i) => (
              <span key={i} className="flex-1 rounded-t-[4px] bg-accent" style={{ height: `${h}%`, opacity: i === bars.length - 1 ? 1 : 0.85 }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted">Overdue</p>
              <p className="font-semibold text-danger tabular-nums">₹3,83,750</p>
              <p className="text-[11px] text-muted">23 students</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Class 5 - A</p>
                <span className="rounded-full bg-success-soft px-1.5 text-[10px] font-medium text-success">Done</span>
              </div>
              <p className="font-semibold tabular-nums">28 / 30 present</p>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <span className="bg-success" style={{ width: "86%" }} />
                <span className="bg-warning" style={{ width: "4%" }} />
                <span className="bg-danger" style={{ width: "6%" }} />
              </div>
            </div>
          </div>
        </div>
      </Frame>
      {/* WhatsApp receipt bubble: tucked under the frame's bottom edge, never over its content */}
      <div className="relative z-10 -mt-3 ml-auto mr-2 w-64 rounded-2xl border border-border bg-surface p-3 shadow-xl sm:-mr-6">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="grid size-6 place-items-center rounded-full bg-[#128c4a] text-white">
            <Icon d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1L4 20z" className="size-3.5" />
          </span>
          WhatsApp · just now
        </div>
        <div className="mt-2 rounded-xl bg-wa-bubble p-2.5 text-[12px] leading-relaxed">
          We have received <strong>₹14,000</strong> towards the fees of <strong>Navya</strong>. Receipt <strong>R00041</strong>. Thank you!
          <span className="mt-1 block text-right text-[10px] text-success">✓✓ Read</span>
        </div>
      </div>
    </div>
  );
}

function FeesVisual() {
  return (
    <Frame>
      <div className="p-5" aria-hidden>
        <div className="mx-auto max-w-sm rounded-lg border border-zinc-200 bg-white p-4 text-[12px] text-zinc-900">
          <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-2">
            <div>
              <p className="font-bold">Sunrise Public School</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Fee receipt</p>
            </div>
            <p className="font-mono font-semibold">R00041</p>
          </div>
          <div className="flex justify-between py-2">
            <span>Q2 (Jul–Sep) · Tuition</span>
            <span className="tabular-nums">₹9,000</span>
          </div>
          <div className="flex justify-between border-t-2 border-zinc-900 pt-2 font-bold">
            <span>Total received</span>
            <span className="tabular-nums">₹9,000</span>
          </div>
          <p className="mt-1.5 italic text-zinc-600">Rupees Nine Thousand Only</p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {["Cash", "UPI", "Cheque"].map((m, i) => (
            <span key={m} className={cx("rounded-lg border py-2 font-medium", i === 1 ? "border-accent bg-accent-soft text-accent" : "border-border")}>
              {m}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function AttendanceVisual() {
  const rows: [string, string, number][] = [
    ["1", "Aarav Sharma", 0],
    ["2", "Zara Khan", 1],
    ["3", "Vihaan Patel", 0],
    ["4", "Ananya Iyer", 2],
  ];
  const opts = ["Present", "Absent", "Late"];
  const on = ["bg-success text-background border-success", "bg-danger text-background border-danger", "bg-warning text-background border-warning"];
  return (
    <Frame>
      <ul className="divide-y divide-border" aria-hidden>
        {rows.map(([roll, name, sel]) => (
          <li key={roll} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-4 text-right font-mono text-xs text-muted">{roll}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
            <span className="flex gap-1.5">
              {opts.map((o, i) => (
                <span key={o} className={cx("rounded-md border px-2 py-1 text-[11px] font-medium", i === sel ? on[i] : "border-border text-muted")}>
                  {o}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-3 text-xs">
        <span className="text-muted">All students marked · 90% present</span>
        <span className="rounded-md bg-accent px-2.5 py-1 font-medium text-accent-foreground">Save attendance</span>
      </div>
    </Frame>
  );
}

function WhatsAppVisual() {
  return (
    <Frame>
      <div className="space-y-3 p-5 text-[13px] leading-relaxed" aria-hidden>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-wa-bubble p-3">
          Dear Ravi Rao, <strong>Asha</strong> was marked <strong>absent</strong> today. Remark: Fever.
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-wa-bubble p-3">
          📋 Attendance report of <strong>Asha</strong> for <strong>October</strong>: ✅ Present 20 · ❌ Absent 2 · <strong>90.9%</strong>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-wa-bubble p-3">
          Gentle reminder: fees of <strong>₹9,000</strong> are pending. ⚠️ Overdue since 10 Oct.
          <span className="mt-1 block text-right text-[10px] text-success">✓✓ Delivered</span>
        </div>
      </div>
    </Frame>
  );
}

function Spotlight({ eyebrow, title, body, points, visual, flip }: { eyebrow: string; title: string; body: string; points: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cx(flip && "lg:order-2")}>
        <SectionTitle eyebrow={eyebrow} title={title} body={body} />
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Check className="size-3" />
              </span>
              <span className="text-pretty">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cx(flip && "lg:order-1")}>{visual}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1 overflow-x-clip">
        {/* Hero */}
        <section className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_60%_at_70%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_10%_20%,color-mix(in_oklab,var(--brand-green)_10%,transparent),transparent)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
                <span className="rounded-full bg-[#128c4a] px-1.5 py-px text-[10px] font-semibold text-white">NEW</span>
                WhatsApp receipts & absence alerts for parents
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem] lg:leading-[1.05]">
                Fees, attendance and parents. <span className="text-brand-green">All in one place.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-pretty text-muted">
                EduFlow helps schools, tuition centres and coaching institutes collect fees on time, take attendance in a minute and keep every parent in the
                loop, from any phone or computer.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className={cx(buttonClass("primary"), "h-12 px-6 text-base")}>
                  Start your {TRIAL_DAYS}-day free trial
                  <Icon d="M5 12h14M13 6l6 6-6 6" />
                </Link>
                <a href="#features" className={cx(buttonClass("secondary"), "h-12 px-6 text-base")}>
                  See what&apos;s inside
                </a>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {[`${TRIAL_DAYS} days free`, "No credit card", "Set up in minutes"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="text-brand-green" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-2 sm:px-6 lg:px-0">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* Built for */}
        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
            <p className="text-sm font-medium text-muted">Made for</p>
            <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2">
              {AUDIENCES.map((a) => (
                <li key={a} className="text-base font-semibold tracking-tight text-foreground/80">
                  {a}
                </li>
              ))}
            </ul>
            <p className="hidden text-sm font-semibold tracking-[0.25em] text-muted md:block">MANAGE · TRACK · GROW</p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <SectionTitle
            center
            eyebrow="Everything you need"
            title="One app for the work that fills your day"
            body="No more registers, receipt books and WhatsApp groups to keep in sync. Your staff learn it in an afternoon."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent/40">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <Icon d={f.icon} className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Spotlights */}
        <section className="border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl space-y-28 px-4 py-24 sm:px-6">
            <Spotlight
              eyebrow="Fees"
              title="Collect fees on time, without the paperwork"
              body="Set up a fee plan once and every student's dues follow. Record a payment in seconds and the receipt is ready to print or send."
              points={[
                "Monthly, quarterly or yearly installments with concessions",
                "Cash, UPI, card, bank transfer or cheque, with part payments",
                "Numbered receipts with the amount in words",
                "One tap to see every overdue student and remind their parents",
              ]}
              visual={<FeesVisual />}
            />
            <Spotlight
              flip
              eyebrow="Attendance"
              title="A whole class marked in under a minute"
              body="Built for the morning rush. Mark everyone present, fix the few exceptions, and save. On a phone or a computer."
              points={[
                "Big tap targets on phones, keyboard shortcuts on computers",
                "See which classes are done today at a glance",
                "Monthly report per class, ready to download as Excel",
                "Students under 75% attendance flagged automatically",
              ]}
              visual={<AttendanceVisual />}
            />
            <Spotlight
              eyebrow="WhatsApp"
              title="Parents hear from you the moment it matters"
              body="Every message is written for you from your records, so the amount, date and name are always right."
              points={[
                "Fee receipts the moment a payment is recorded",
                "Polite reminders for pending and overdue fees",
                "Absence and late alerts straight from the register",
                "Free click-to-send, or automatic from your school's number",
              ]}
              visual={<WhatsAppVisual />}
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <SectionTitle center eyebrow="How it works" title="Up and running today" />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-border bg-surface p-6">
                <span className="grid size-10 place-items-center rounded-full bg-accent text-base font-semibold text-accent-foreground">{i + 1}</span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Free trial */}
        <section id="pricing" className="scroll-mt-20 px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#141b3a] px-6 py-14 text-white sm:px-14">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#3ddc97]/20 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-[#6671ac]/30 blur-3xl" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3ddc97]">Free trial</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Try every feature free for {TRIAL_DAYS} days</h2>
                <p className="mt-4 max-w-md text-white/70">Set up your institute, import your students and collect your first fee before the week is out. No credit card needed.</p>
                <Link
                  href="/register"
                  className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-[#141b3a] transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Start your free trial
                  <Icon d="M5 12h14M13 6l6 6-6 6" />
                </Link>
              </div>
              <ul className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#3ddc97] text-[#141b3a]">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <SectionTitle center eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform group-open:rotate-45">
                    <Icon d={ICONS.plus} className="size-3.5" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-pretty text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border bg-surface/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">Spend less time on admin and more on teaching</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={cx(buttonClass("primary"), "h-12 px-6 text-base")}>
                Start your {TRIAL_DAYS}-day free trial
              </Link>
              <Link href="/login" className={cx(buttonClass("secondary"), "h-12 px-6 text-base")}>
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Image src="/images/brand/logo-light.png" alt="EduFlow: Manage · Track · Grow" width={983} height={200} className="logo-light h-12 w-auto" />
            <Image src="/images/brand/logo-dark.png" alt="" aria-hidden width={965} height={200} className="logo-dark h-12 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-muted">The simple way to run a school, tuition centre or coaching institute.</p>
          </div>
          <nav aria-label="Product" className="text-sm">
            <p className="font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-foreground">How it works</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Free trial</a></li>
              <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
            </ul>
          </nav>
          <nav aria-label="Account" className="text-sm">
            <p className="font-semibold">Account</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li><Link href="/register" className="hover:text-foreground">Start free trial</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Log in</Link></li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-muted sm:flex-row sm:px-6">
            <span>© EduFlow · Manage · Track · Grow</span>
            <span>
              Built by{" "}
              <a href="https://zaref.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline-offset-4 hover:text-accent hover:underline">
                Zaref
              </a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
