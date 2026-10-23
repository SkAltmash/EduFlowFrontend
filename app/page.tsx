import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { buttonClass } from "@/components/ui";

const features = [
  {
    title: "One account, many institutes",
    body: "Teach at a school in the morning and a coaching centre in the evening. Switch between them without a second login.",
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    title: "Roles that fit how you work",
    body: "Owners, admins, teachers and accountants each see what they need, and nothing they shouldn't.",
    icon: "M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7l8-4z",
  },
  {
    title: "Secure by default",
    body: "Short-lived sessions, automatic sign-out on suspicious activity and a full audit trail of admin actions.",
    icon: "M6 10V8a6 6 0 1112 0v2M5 10h14v10H5z",
  },
];

const audiences = ["Schools", "Tuition centres", "Coaching institutes", "Academies"];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full bg-accent/15 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-success" />
              Built for {audiences.join(", ").toLowerCase()}
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Run your institute, not your spreadsheets.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted">
              EduFlow brings your staff, classes and fees together in one place, so you can spend more time on teaching.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonClass("primary") + " h-11 w-full px-6 sm:w-auto"}>
                Create your institute
              </Link>
              <Link href="/login" className={buttonClass("secondary") + " h-11 w-full px-6 sm:w-auto"}>
                I already have an account
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">Free to start. No credit card needed.</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </span>
                <h2 className="mt-4 font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl bg-foreground px-6 py-12 text-center text-background sm:px-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your institute in under a minute</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm opacity-70">
              Create an account, name your organisation, and you&apos;re the owner. Invite your team whenever you&apos;re ready.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex h-11 items-center rounded-lg bg-background px-6 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6">
          <span>EduFlow · School management made simple</span>
          <span>Made for educators</span>
        </div>
      </footer>
    </>
  );
}
