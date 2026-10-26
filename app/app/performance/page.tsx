"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useResource } from "@/components/data";
import { Alert, Badge, ICONS, Icon, Input, Select, Skeleton, cx } from "@/components/ui";
import { WA_ICON, WhatsAppDrawer } from "@/components/whatsapp-send";
import { loadClassList, loadYears } from "@/lib/academics";
import { api } from "@/lib/api";
import { addDays, className, formatDay, localToday } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { BOARD_VALUE, ordinal, pct, type Board, type Performance, type PerformanceRow } from "@/lib/performance";
import { Avatar } from "../students/_components/bits";
import { StudentDrawer } from "../students/_components/student-drawer";
import { ShareLeaderboard } from "./_components/share";

type Period = "month" | "3m" | "year";

/** How often the board refreshes itself while the page is open. */
const LIVE_MS = 60_000;

const MEDAL = [
  { ring: "ring-[#f5b301]", bg: "bg-[#f5b301]", soft: "from-[#f5b301]/25", label: "1st" },
  { ring: "ring-[#9aa4b2]", bg: "bg-[#9aa4b2]", soft: "from-[#9aa4b2]/25", label: "2nd" },
  { ring: "ring-[#c47a3a]", bg: "bg-[#c47a3a]", soft: "from-[#c47a3a]/25", label: "3rd" },
];

const BOARDS: { id: Board; label: string; hint: string }[] = [
  { id: "overall", label: "Overall", hint: "70% test marks + 30% attendance" },
  { id: "marks", label: "Marks", hint: "Average of every test in the period" },
  { id: "attendance", label: "Attendance", hint: "Present + late out of marked days" },
];

const TROPHY = "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3";

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export default function PerformancePage() {
  const { session } = useAuth();
  if (session.status === "authenticated" && session.role === "accountant") {
    return <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">Performance is for teachers and admins.</p>;
  }
  return <Leaderboards />;
}

function Leaderboards() {
  const { session } = useAuth();
  const school = session.status === "authenticated" ? (session.tenant?.name ?? "") : "";
  const [period, setPeriod] = useState<Period>("month");
  const [cls, setCls] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  // Parents to message: undefined = closed, otherwise the students
  const [sendTo, setSendTo] = useState<PerformanceRow[] | undefined>(undefined);

  const years = useResource(loadYears, "academics-years");
  const classList = useResource(loadClassList, "academics-classes");
  const today = localToday();
  const from =
    period === "month" ? `${today.slice(0, 7)}-01` : period === "3m" ? addDays(today, -89) : years.data?.current.startDate && years.data.current.startDate <= today ? years.data.current.startDate : addDays(today, -364);
  const [grade, section] = cls ? cls.split("|") : ["", ""];
  const path = `/api/performance?from=${from}&to=${today}${grade ? `&grade=${encodeURIComponent(grade)}` : ""}${section ? `&section=${encodeURIComponent(section)}` : ""}`;
  const { data, error, loading, reload } = useResource(() => api<Performance>(path), path);

  // Live: refresh every minute while visible, and as soon as the tab comes back
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const id = setInterval(refresh, LIVE_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  // Without any tests in the period the overall board is empty: show attendance instead
  const active: Board = board ?? (data && data.summary.tests === 0 ? "attendance" : "overall");
  const value = BOARD_VALUE[active];
  const ranked = (data?.students ?? []).filter((r) => r.rank[active] !== null).sort((a, b) => a.rank[active]! - b.rank[active]! || a.fullName.localeCompare(b.fullName));
  const q = search.trim().toLowerCase();
  const list = q ? ranked.filter((r) => r.fullName.toLowerCase().includes(q) || r.admissionNo.toLowerCase().includes(q)) : ranked;
  const shown = showAll || q ? list : list.slice(0, 15);
  const byId = new Map((data?.students ?? []).map((r) => [r.id, r]));

  const classOptions = classList.data?.classes.length
    ? classList.data.classes.flatMap((c) => [{ v: `${c.name}|`, label: `Class ${c.name}` }, ...c.sections.map((s) => ({ v: `${c.name}|${s}`, label: `${c.name} - ${s}` }))])
    : (data?.classes ?? []).map((c) => ({ v: `${c.grade}|${c.section}`, label: className(c.grade, c.section) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
            <LiveBadge at={data?.generatedAt} refreshing={loading && Boolean(data)} />
          </div>
          <p className="mt-1 text-sm text-muted">Live rankings from test marks and attendance. Updates on its own.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSharing(true)}
            disabled={!data || data.summary.students === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#128c4a] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#0f7a40] disabled:opacity-50"
          >
            <Icon d={WA_ICON} />
            Share
          </button>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
            {(
              [
                ["month", "This month"],
                ["3m", "3 months"],
                ["year", "This year"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} onClick={() => setPeriod(v)} aria-pressed={period === v} className={cx("rounded-md px-3 py-1.5 transition-colors", period === v ? "bg-surface-muted font-medium" : "text-muted hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <Select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="h-9 w-40 text-sm">
            <option value="">All classes</option>
            {classOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {!data ? (
        !error && <PageSkeleton />
      ) : data.summary.students === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-14 text-center text-sm text-muted">No active students here yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Average marks" value={pct(data.summary.marks)} hint={`${data.summary.tests} test${data.summary.tests === 1 ? "" : "s"} · ${formatDay(data.range.from, "short")} – today`} />
            <Stat label="Average attendance" value={pct(data.summary.attendance)} tone={data.summary.attendance !== null && data.summary.attendance < data.lowAttendance ? "text-warning" : undefined} hint={`${data.summary.students} students`} />
            <Stat label="Ranked overall" value={`${data.summary.ranked}`} hint="students with test marks" />
            <Stat label="Perfect attendance" value={`${data.summary.perfectAttendance}`} tone={data.summary.perfectAttendance ? "text-success" : undefined} hint="100% with 5+ days marked" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-4">
              {/* Board switch */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="tablist" className="inline-flex rounded-xl border border-border bg-surface p-1">
                  {BOARDS.map((b) => (
                    <button
                      key={b.id}
                      role="tab"
                      aria-selected={active === b.id}
                      onClick={() => setBoard(b.id)}
                      className={cx("rounded-lg px-4 py-1.5 text-sm transition-colors", active === b.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted hover:text-foreground")}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">{BOARDS.find((b) => b.id === active)!.hint}</p>
              </div>

              {ranked.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
                  <p className="font-medium">Nothing to rank yet</p>
                  <p className="mt-1 text-sm text-muted">{active === "attendance" ? "No attendance marked in this period." : "No test marks in this period. Enter marks in Tests, or switch to Attendance."}</p>
                </div>
              ) : (
                <>
                  <Podium rows={ranked.slice(0, 3)} board={active} onOpen={setOpenId} />

                  <section className="rounded-xl border border-border bg-surface">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                      <h2 className="font-semibold">Leaderboard</h2>
                      <div className="relative w-full sm:w-56">
                        <Icon d={ICONS.search} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a student" className="h-9 pl-9 text-sm" aria-label="Find a student" />
                      </div>
                    </div>
                    <ol className="divide-y divide-border">
                      {shown.map((r) => (
                        <BoardRow key={r.id} row={r} board={active} value={value(r)} lowAttendance={data.lowAttendance} onOpen={() => setOpenId(r.id)} onSend={() => setSendTo([r])} />
                      ))}
                    </ol>
                    {!q && list.length > 15 && (
                      <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-border py-3 text-sm font-medium text-accent hover:bg-surface-muted">
                        {showAll ? "Show top 15" : `Show all ${list.length}`}
                      </button>
                    )}
                    {q && list.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No ranked student matches “{search}”.</p>}
                  </section>
                </>
              )}
            </div>

            <aside className="space-y-4">
              <ClassToppers data={data} byId={byId} onOpen={setOpenId} />
              <MostImproved rows={data.students} onOpen={setOpenId} />
              <PerfectAttendance rows={data.students} onOpen={setOpenId} />
              <NeedsAttention rows={data.students} passPercent={data.passPercent} lowAttendance={data.lowAttendance} onOpen={setOpenId} />
            </aside>
          </div>
        </>
      )}

      {openId && <StudentDrawer studentId={openId} canManage={false} onClose={() => setOpenId(null)} onSaved={() => {}} />}

      {sharing && data && (
        <ShareLeaderboard
          scope={{ school, board: active, from: data.range.from, to: data.range.to, classLabel: grade ? `Class ${section ? `${grade} - ${section}` : grade}` : "" }}
          ranked={ranked}
          onClose={() => setSharing(false)}
          onSendParents={() => {
            setSharing(false);
            // Everyone in view with something to report
            setSendTo(data.students.filter((r) => r.marks.average !== null || r.attendance.rate !== null));
          }}
        />
      )}

      {sendTo && data && (
        <WhatsAppDrawer
          type="performance_report"
          refs={sendTo.map((r) => ({ studentId: r.id, from: data.range.from, to: data.range.to, ...(grade ? { grade } : {}), ...(section ? { section } : {}) }))}
          title={sendTo.length === 1 ? `Send ${sendTo[0].fullName}'s performance` : "Send performance to parents"}
          description={`${formatDay(data.range.from, "short")} – ${formatDay(data.range.to, "short")}. Each parent sees only their own child's rank, marks and attendance.`}
          onClose={() => setSendTo(undefined)}
        />
      )}
    </div>
  );
}

function LiveBadge({ at, refreshing }: { at?: string; refreshing: boolean }) {
  const now = useNow(10_000);
  const secs = at ? Math.max(0, Math.round((now - Date.parse(at)) / 1000)) : null;
  const ago = secs === null ? "" : secs < 15 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)} min ago`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success" title="Refreshes every minute">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      Live{ago && <span className="font-normal opacity-80">· {refreshing ? "updating…" : ago}</span>}
    </span>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums tracking-tight", tone)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Podium({ rows, board, onOpen }: { rows: PerformanceRow[]; board: Board; onOpen: (id: string) => void }) {
  // 2nd · 1st · 3rd, with the winner raised
  const order = [rows[1], rows[0], rows[2]];
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {order.map((r, i) => {
        if (!r) return <div key={i} />;
        const place = r.rank[board]! - 1;
        const m = MEDAL[Math.min(place, 2)];
        const first = i === 1;
        return (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className={cx(
              "group relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-surface px-2 pb-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg sm:px-4",
              first ? "pt-6 sm:pt-8" : "pt-4 sm:pt-5"
            )}
          >
            <span aria-hidden className={cx("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", m.soft)} />
            {first && (
              <span className="relative mb-1 text-[#f5b301]">
                <Icon d={TROPHY} className="size-6" />
              </span>
            )}
            <span className={cx("relative rounded-full ring-4 ring-offset-2 ring-offset-surface", m.ring)}>
              <Avatar name={r.fullName} seed={r.id} size={first ? "lg" : "md"} />
              <span className={cx("absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-bold text-white shadow", m.bg)}>{ordinal(r.rank[board]!)}</span>
            </span>
            <span className="relative mt-4 line-clamp-2 text-sm font-semibold leading-tight">{r.fullName}</span>
            <span className="relative text-xs text-muted">{r.grade ? className(r.grade, r.section) : "No class"}</span>
            <span className={cx("relative mt-2 font-semibold tabular-nums tracking-tight", first ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl")}>{pct(BOARD_VALUE[board](r))}</span>
            <span className="relative hidden text-[11px] text-muted sm:block">
              {board === "overall" ? `Marks ${pct(r.marks.average)} · Att ${pct(r.attendance.rate)}` : board === "marks" ? `${r.marks.tests} test${r.marks.tests === 1 ? "" : "s"}${r.marks.grade ? ` · Grade ${r.marks.grade}` : ""}` : `${r.attendance.present + r.attendance.late} of ${r.attendance.present + r.attendance.late + r.attendance.absent} days`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Trend({ change }: { change: number | null }) {
  if (change === null || Math.abs(change) < 0.5) return <span className="w-12 text-right text-xs text-muted">—</span>;
  const up = change > 0;
  return (
    <span className={cx("inline-flex w-12 items-center justify-end gap-0.5 text-xs font-medium tabular-nums", up ? "text-success" : "text-danger")} title="Change since the previous period">
      <Icon d={up ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} className="size-3.5" />
      {Math.abs(change).toFixed(0)}
    </span>
  );
}

function Bar({ value, tone }: { value: number | null; tone: string }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-surface-muted">
      <span className={cx("block h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${value ?? 0}%` }} />
    </span>
  );
}

function BoardRow({ row: r, board, value, lowAttendance, onOpen, onSend }: { row: PerformanceRow; board: Board; value: number | null; lowAttendance: number; onOpen: () => void; onSend: () => void }) {
  const rank = r.rank[board]!;
  return (
    <li className="group/row flex items-center transition-colors hover:bg-surface-muted">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left">
        <span className={cx("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums", rank <= 3 ? cx(MEDAL[rank - 1].bg, "text-white") : "bg-surface-muted text-muted")}>{rank}</span>
        <Avatar name={r.fullName} seed={r.id} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.fullName}</span>
          <span className="block truncate text-xs text-muted">
            {r.grade ? className(r.grade, r.section) : "No class"}
            {r.rank.inClass !== null && board === "overall" && ` · ${ordinal(r.rank.inClass)} in class`}
          </span>
        </span>
        <span className="hidden w-28 shrink-0 space-y-1 md:block">
          <span className="flex justify-between text-[11px] text-muted">
            <span>Marks</span>
            <span className="tabular-nums text-foreground">{pct(r.marks.average)}</span>
          </span>
          <Bar value={r.marks.average} tone="bg-accent" />
        </span>
        <span className="hidden w-28 shrink-0 space-y-1 md:block">
          <span className="flex justify-between text-[11px] text-muted">
            <span>Attendance</span>
            <span className={cx("tabular-nums", r.attendance.rate !== null && r.attendance.rate < lowAttendance ? "text-warning" : "text-foreground")}>{pct(r.attendance.rate)}</span>
          </span>
          <Bar value={r.attendance.rate} tone={r.attendance.rate !== null && r.attendance.rate < lowAttendance ? "bg-warning" : "bg-success"} />
        </span>
        <span className="w-16 shrink-0 text-right">
          <span className="block text-base font-semibold tabular-nums">{pct(value)}</span>
          {board === "marks" && r.marks.grade && <span className="text-[11px] text-muted">Grade {r.marks.grade}</span>}
        </span>
        <Trend change={board === "overall" ? r.change : board === "marks" ? diff(r.marks.average, r.previous.marks) : diff(r.attendance.rate, r.previous.attendance)} />
      </button>
      <button
        onClick={onSend}
        aria-label={`Send ${r.fullName}'s performance to their parent on WhatsApp`}
        title="Send to parent on WhatsApp"
        className="mx-2 grid size-8 shrink-0 place-items-center rounded-lg text-[#128c4a] transition-colors hover:bg-[#128c4a]/10"
      >
        <Icon d={WA_ICON} />
      </button>
    </li>
  );
}

const diff = (now: number | null, before: number | null) => (now !== null && before !== null ? Math.round((now - before) * 10) / 10 : null);

function SideCard({ title, icon, count, children }: { title: string; icon: string; count?: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon d={icon} className="text-accent" />
          {title}
        </h3>
        {count !== undefined && count > 0 && <Badge>{count}</Badge>}
      </div>
      {children}
    </section>
  );
}

function MiniRow({ row, right, sub, onOpen }: { row: PerformanceRow; right: ReactNode; sub?: string; onOpen: (id: string) => void }) {
  return (
    <li>
      <button onClick={() => onOpen(row.id)} className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-surface-muted">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{row.fullName}</span>
          <span className="block truncate text-xs text-muted">{sub ?? (row.grade ? className(row.grade, row.section) : "No class")}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{right}</span>
      </button>
    </li>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="px-4 py-5 text-center text-xs text-muted">{children}</p>;

function ClassToppers({ data, byId, onOpen }: { data: Performance; byId: Map<string, PerformanceRow>; onOpen: (id: string) => void }) {
  const rows = data.classes.filter((c) => c.toppers.length);
  return (
    <SideCard title="Class toppers" icon={TROPHY}>
      {rows.length === 0 ? (
        <Empty>Appears once tests have marks.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => {
            const t = byId.get(c.toppers[0])!;
            return <MiniRow key={`${c.grade}|${c.section}`} row={t} sub={`${className(c.grade, c.section)}${c.toppers.length > 1 ? ` · tied with ${c.toppers.length - 1}` : ""}`} right={pct(t.score)} onOpen={onOpen} />;
          })}
        </ul>
      )}
    </SideCard>
  );
}

function MostImproved({ rows, onOpen }: { rows: PerformanceRow[]; onOpen: (id: string) => void }) {
  const list = rows.filter((r) => r.change !== null && r.change >= 1).sort((a, b) => b.change! - a.change!).slice(0, 5);
  return (
    <SideCard title="Most improved" icon="M4 17l6-6 4 4 6-6M20 9V5h-4">
      {list.length === 0 ? (
        <Empty>Compares with the previous period once both have test marks.</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((r) => (
            <MiniRow key={r.id} row={r} onOpen={onOpen} right={<span className="text-success">+{r.change!.toFixed(0)}</span>} />
          ))}
        </ul>
      )}
    </SideCard>
  );
}

function PerfectAttendance({ rows, onOpen }: { rows: PerformanceRow[]; onOpen: (id: string) => void }) {
  const list = rows.filter((r) => r.attendance.rate === 100 && r.attendance.days >= 5).sort((a, b) => b.attendance.days - a.attendance.days || a.fullName.localeCompare(b.fullName));
  const [all, setAll] = useState(false);
  return (
    <SideCard title="Perfect attendance" icon={ICONS.calendarCheck} count={list.length}>
      {list.length === 0 ? (
        <Empty>Students present every marked day (5+ days) show here.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {(all ? list : list.slice(0, 5)).map((r) => (
              <MiniRow key={r.id} row={r} onOpen={onOpen} right={<span className="text-xs font-normal text-muted">{r.attendance.days} days</span>} />
            ))}
          </ul>
          {list.length > 5 && (
            <button onClick={() => setAll((v) => !v)} className="w-full border-t border-border py-2 text-xs font-medium text-accent hover:bg-surface-muted">
              {all ? "Show less" : `Show all ${list.length}`}
            </button>
          )}
        </>
      )}
    </SideCard>
  );
}

function NeedsAttention({ rows, passPercent, lowAttendance, onOpen }: { rows: PerformanceRow[]; passPercent: number; lowAttendance: number; onOpen: (id: string) => void }) {
  const list = rows
    .map((r) => {
      const reasons = [
        r.marks.average !== null && r.marks.average < passPercent && `marks ${pct(r.marks.average)}`,
        r.attendance.rate !== null && r.attendance.rate < lowAttendance && `attendance ${pct(r.attendance.rate)}`,
        r.change !== null && r.change <= -10 && `down ${Math.abs(r.change).toFixed(0)} points`,
      ].filter(Boolean) as string[];
      return { r, reasons };
    })
    .filter((x) => x.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length || (a.r.score ?? a.r.attendance.rate ?? 0) - (b.r.score ?? b.r.attendance.rate ?? 0));
  return (
    <SideCard title="Needs attention" icon="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" count={list.length}>
      {list.length === 0 ? (
        <Empty>
          Nobody below {passPercent}% marks or {lowAttendance}% attendance. 🎉
        </Empty>
      ) : (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {list.map(({ r, reasons }) => (
            <MiniRow key={r.id} row={r} onOpen={onOpen} sub={`${r.grade ? className(r.grade, r.section) : "No class"} · ${reasons.join(", ")}`} right={<span className="text-warning">!</span>} />
          ))}
        </ul>
      )}
    </SideCard>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cx("rounded-2xl", i === 1 ? "h-56" : "h-48")} />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
