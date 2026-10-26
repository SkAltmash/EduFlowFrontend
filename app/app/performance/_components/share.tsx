"use client";

import { useRef, useState } from "react";
import { Drawer, Section } from "@/components/data";
import { ShareImageButton } from "@/components/share";
import { Icon, cx } from "@/components/ui";
import { WA_ICON } from "@/components/whatsapp-send";
import { formatDay } from "@/lib/attendance";
import { BOARD_VALUE, pct, type Board, type PerformanceRow } from "@/lib/performance";

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"];
const MEDAL_HEX = ["#f5b301", "#9aa4b2", "#c47a3a"];
const BOARD_TITLE: Record<Board, string> = { overall: "Top performers", marks: "Top scorers", attendance: "Best attendance" };
const SIZES = [3, 5, 10] as const;

export interface ShareScope {
  school: string;
  board: Board;
  from: string;
  to: string;
  /** "Class 5 - A", or "" for the whole school */
  classLabel: string;
}

const cls = (r: PerformanceRow) => (r.grade ? (r.section ? `${r.grade}-${r.section}` : r.grade) : "");
const periodText = (s: ShareScope) => `${formatDay(s.from, "short").replace(/^\w+,?\s*/, "")} – ${formatDay(s.to, "short").replace(/^\w+,?\s*/, "")} ${s.to.slice(0, 4)}`;

/** Leaderboard for a parents' or staff group: an image card or WhatsApp text, top N only. */
export function ShareLeaderboard({ scope, ranked, onClose, onSendParents }: { scope: ShareScope; ranked: PerformanceRow[]; onClose: () => void; onSendParents: () => void }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>(5);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const top = ranked.slice(0, size);
  const value = BOARD_VALUE[scope.board];
  const rankOf = (r: PerformanceRow) => r.rank[scope.board]!;

  const text = [
    `🏆 *${scope.school} · ${BOARD_TITLE[scope.board]}*`,
    `_${[scope.classLabel || "Whole school", periodText(scope)].join(" · ")}_`,
    "",
    ...top.map((r) => {
      const rank = rankOf(r);
      const mark = rank <= 3 ? MEDAL_EMOJI[rank - 1] : `${rank}.`;
      return `${mark} *${r.fullName}*${!scope.classLabel && cls(r) ? ` (${cls(r)})` : ""} · ${pct(value(r))}`;
    }),
    "",
    scope.board === "overall" ? "Score = 70% test marks + 30% attendance" : scope.board === "marks" ? "Average of all tests in the period" : "Present days out of days marked",
    "Congratulations to all! 👏",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the WhatsApp button still works
    }
  }

  return (
    <Drawer title="Share performance" onClose={onClose}>
      <Section title="Send to each parent">
        <button onClick={onSendParents} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-[#128c4a] hover:bg-[#128c4a]/5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#128c4a] text-white">
            <Icon d={WA_ICON} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Performance report to parents</span>
            <span className="block text-sm text-muted">Each parent gets only their child&apos;s rank, marks and attendance.</span>
          </span>
          <Icon d="M9 6l6 6-6 6" className="text-muted" />
        </button>
      </Section>

      <Section title="Post to a group">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">Share the top students with a class or staff group.</p>
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface p-0.5 text-sm">
            {SIZES.map((n) => (
              <button key={n} onClick={() => setSize(n)} aria-pressed={size === n} className={cx("rounded-md px-2.5 py-1 transition-colors", size === n ? "bg-surface-muted font-medium" : "text-muted")}>
                Top {n}
              </button>
            ))}
          </div>
        </div>

        {/* The image: fixed light colours so it looks the same everywhere it's shared */}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-muted p-3">
          <div ref={cardRef} className="mx-auto w-[400px] overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-sm">
            <div className="relative bg-[#1b2563] px-6 pb-5 pt-6 text-white">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(61,220,151,0.25),transparent_60%)]" />
              <p className="relative text-xs font-medium uppercase tracking-[0.18em] text-white/70">{scope.school}</p>
              <p className="relative mt-1 text-2xl font-bold">🏆 {BOARD_TITLE[scope.board]}</p>
              <p className="relative mt-1 text-sm text-white/80">
                {scope.classLabel || "Whole school"} · {periodText(scope)}
              </p>
            </div>
            <ol className="divide-y divide-zinc-100 px-4 py-2">
              {top.map((r) => {
                const rank = rankOf(r);
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold"
                      style={rank <= 3 ? { backgroundColor: MEDAL_HEX[rank - 1], color: "#fff" } : { backgroundColor: "#f4f4f5", color: "#71717a" }}
                    >
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.fullName}</span>
                      {!scope.classLabel && cls(r) && <span className="block text-xs text-zinc-500">Class {cls(r)}</span>}
                    </span>
                    <span className="text-lg font-bold tabular-nums">{pct(value(r))}</span>
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3 text-[11px] text-zinc-500">
              <span>{scope.board === "overall" ? "70% marks + 30% attendance" : scope.board === "marks" ? "Average test marks" : "Attendance rate"}</span>
              <span>EduFlow</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <ShareImageButton nodeRef={cardRef} fileName={`leaderboard-${scope.to}`} title={`${scope.school} · ${BOARD_TITLE[scope.board]}`} />
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#128c4a] px-4 text-sm font-medium text-white hover:bg-[#0f7a40]"
          >
            <Icon d={WA_ICON} />
            Share as text
          </a>
        </div>
        <button onClick={copy} className="mt-2 text-xs font-medium text-accent hover:underline">
          {copied ? "Copied ✓" : "Copy text"}
        </button>
        <p className="mt-3 text-xs text-muted">Only the top {size} are shared. Full rankings, marks and attendance stay private to staff.</p>
      </Section>
    </Drawer>
  );
}

