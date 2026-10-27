"use client";

import { Alert, Badge, Button, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { PageHeader, formatDate, useResource } from "./shared";

interface System {
  api: { ok: boolean; uptimeSeconds: number; node: string; version: string; commit: string | null; memoryMb: number };
  database: { ok: boolean; pingMs: number; name: string; host: string };
  errors: { count: number; since: string; last: { at: string; path: string; message: string } | null };
  whatsapp: { sentLast24h: number; failedLast24h: number };
  sessions: number;
  plans: number;
  encryption: boolean;
}

function uptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

/** Is everything up: API, database, WhatsApp delivery, server errors. */
export function SystemHealth() {
  const res = useResource(() => api<System>("/api/admin/system"), "console-system");
  const s = res.data;
  const failRate = s && s.whatsapp.sentLast24h ? Math.round((s.whatsapp.failedLast24h / s.whatsapp.sentLast24h) * 100) : 0;
  const allOk = s && s.api.ok && s.database.ok && failRate < 20 && s.encryption;

  return (
    <>
      <PageHeader
        title="System health"
        description="Live status of the API, database and messaging."
        icon="M3 12h4l3-8 4 16 3-8h4"
        actions={
          <Button variant="secondary" onClick={res.reload} loading={res.loading && Boolean(res.data)}>
            Refresh
          </Button>
        }
      />
      {res.error && <Alert>{res.error}</Alert>}
      {!s ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className={cx("mb-5 flex items-center gap-3 rounded-xl border px-4 py-3", allOk ? "border-success/30 bg-success-soft" : "border-warning/40 bg-warning-soft")}>
            <span className={cx("size-2.5 rounded-full", allOk ? "bg-success" : "bg-warning")} />
            <p className="text-sm font-medium">{allOk ? "All systems normal" : "Something needs a look"}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile title="API" ok={s.api.ok} lines={[`Up ${uptime(s.api.uptimeSeconds)}`, `Node ${s.api.node} · ${s.api.memoryMb} MB`, s.api.commit ? `Build ${s.api.commit}` : `Version ${s.api.version}`]} />
            <Tile title="Database" ok={s.database.ok} lines={[`Ping ${s.database.pingMs} ms`, s.database.name, s.database.host]} />
            <Tile title="WhatsApp (24h)" ok={failRate < 20} lines={[`${s.whatsapp.sentLast24h} sent`, `${s.whatsapp.failedLast24h} failed${s.whatsapp.sentLast24h ? ` (${failRate}%)` : ""}`]} />
            <Tile
              title="Server errors"
              ok={s.errors.count === 0}
              warnOnly
              lines={[`${s.errors.count} since ${formatDate(s.errors.since, true)}`, ...(s.errors.last ? [`Last: ${s.errors.last.path}`, s.errors.last.message, formatDate(s.errors.last.at, true)] : ["None since the last restart"])]}
            />
            <Tile title="Sessions" ok lines={[`${s.sessions} signed-in devices`, `${s.plans} plans`]} />
            <Tile title="Data encryption" ok={s.encryption} lines={[s.encryption ? "Enabled (WhatsApp tokens, two-step login)" : "DATA_ENCRYPTION_KEY is not set: two-step login and saved WhatsApp tokens won't work"]} />
          </div>
        </>
      )}
    </>
  );
}

function Tile({ title, ok, warnOnly, lines }: { title: string; ok: boolean; warnOnly?: boolean; lines: string[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {ok ? <Badge tone="success">OK</Badge> : <Badge tone={warnOnly ? "accent" : "danger"}>{warnOnly ? "Check" : "Problem"}</Badge>}
      </div>
      {lines.map((l, i) => (
        <p key={i} className={cx("break-words text-sm", i ? "text-muted" : "font-medium")}>
          {l}
        </p>
      ))}
    </section>
  );
}
