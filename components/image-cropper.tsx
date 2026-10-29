"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button, Icon, Spinner, cx } from "./ui";

/** Size of the on-screen crop frame (CSS px). */
const FRAME = 280;

/**
 * Square crop window for a logo: drag to move, slider / wheel / pinch to zoom, rotate,
 * white or transparent background. Produces an `output`×`output` PNG.
 */
export function ImageCropper({
  file,
  output = 512,
  title = "Crop logo",
  onCancel,
  onDone,
}: {
  file: File;
  output?: number;
  title?: string;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Zoom is relative to "whole image fits in the frame"
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [background, setBackground] = useState<"white" | "transparent">("white");
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    // Ignore a load that was cancelled (another file, or React re-running this in development)
    let active = true;
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => active && setImg(i);
    i.onerror = () => active && setError("This image can't be opened. Try a PNG or JPG.");
    i.src = url;
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const close = useEffectEvent(onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Rotated by 90° the image's width and height swap
  const sideways = rotation % 180 !== 0;
  const w = img ? (sideways ? img.naturalHeight : img.naturalWidth) : 1;
  const h = img ? (sideways ? img.naturalWidth : img.naturalHeight) : 1;
  const fit = Math.min(FRAME / w, FRAME / h);
  const scale = fit * zoom;
  const clampZoom = (z: number) => Math.min(5, Math.max(0.3, z));

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      setZoom(clampZoom((pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.dist));
    } else if (drag.current) {
      setOffset({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 5;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      setOffset((o) => ({ x: o.x + moves[e.key][0], y: o.y + moves[e.key][1] }));
    } else if (e.key === "+" || e.key === "=") setZoom((z) => clampZoom(z * 1.1));
    else if (e.key === "-") setZoom((z) => clampZoom(z / 1.1));
  }

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }

  async function done() {
    if (!img) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext("2d")!;
      if (background === "white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, output, output);
      }
      ctx.imageSmoothingQuality = "high";
      const k = output / FRAME;
      // Same transform as the preview: centre + offset, rotate, scale
      ctx.translate((FRAME / 2 + offset.x) * k, (FRAME / 2 + offset.y) * k);
      ctx.rotate((rotation * Math.PI) / 180);
      const s = scale * k;
      ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Couldn't create the image");
      onDone(new File([blob], "logo.png", { type: "image/png" }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const imageStyle: React.CSSProperties = img
    ? {
        width: img.naturalWidth * scale,
        height: img.naturalHeight * scale,
        left: FRAME / 2 + offset.x - (img.naturalWidth * scale) / 2,
        top: FRAME / 2 + offset.y - (img.naturalHeight * scale) / 2,
        transform: `rotate(${rotation}deg)`,
      }
    : {};
  const checker = "bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px]";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Cancel" className="absolute inset-0 bg-black/50 motion-safe:animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={onCancel}>
            <Icon d="M6 6l12 12M18 6L6 18" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex items-start justify-center gap-4">
            {/* The crop frame: what's inside the square is the logo */}
            <div
              tabIndex={0}
              aria-label="Crop area. Drag or use arrow keys to move, plus and minus to zoom."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)))}
              onKeyDown={onKeyDown}
              className={cx("relative shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-xl outline-none ring-accent focus-visible:ring-2 active:cursor-grabbing", background === "white" ? "bg-white" : checker)}
              style={{ width: FRAME, height: FRAME }}
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none origin-center" style={imageStyle} />
              ) : (
                !error && <Spinner className="absolute inset-0 m-auto size-6 text-muted" />
              )}
              {/* Thirds grid helps centring */}
              <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/40 [box-shadow:inset_0_0_0_0.5px_rgba(0,0,0,0.08)]" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Icon d="M5 12h14" className="text-muted" />
            <input
              type="range"
              aria-label="Zoom"
              min={0.3}
              max={5}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <Icon d="M12 5v14M5 12h14" className="text-muted" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <Icon d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
                Rotate
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>
            <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Background">
              {(["white", "transparent"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBackground(b)}
                  aria-pressed={background === b}
                  className={cx("rounded-md px-2.5 py-1 capitalize", background === b ? "bg-surface-muted font-medium" : "text-muted")}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* How it will look heading a receipt */}
          {img && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-zinc-900">
              <div className={cx("relative size-12 shrink-0 overflow-hidden rounded", background === "transparent" && checker)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt=""
                  className="absolute max-w-none origin-center"
                  style={{ ...imageStyle, width: (img.naturalWidth * scale * 48) / FRAME, height: (img.naturalHeight * scale * 48) / FRAME, left: ((FRAME / 2 + offset.x) * 48) / FRAME - (img.naturalWidth * scale * 48) / FRAME / 2, top: ((FRAME / 2 + offset.y) * 48) / FRAME - (img.naturalHeight * scale * 48) / FRAME / 2 }}
                />
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-semibold">Preview on a receipt</p>
                <p className="text-zinc-500">Saved as a {output} × {output} px square</p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted">Drag to move · scroll or pinch to zoom · leave a little space around the logo.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={done} loading={busy} disabled={!img}>
            Use this logo
          </Button>
        </div>
      </div>
    </div>
  );
}
