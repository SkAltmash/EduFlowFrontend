"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "./data";
import { Button, Icon } from "./ui";

/**
 * Renders `children` as the only thing printed (see #print-area in globals.css).
 * Mount it next to an on-screen document and call window.print().
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(
    <div id="print-area" className="hidden">
      {children}
    </div>,
    document.body
  );
}

/** PNG of an element: shared through the phone's share sheet (WhatsApp etc.) or downloaded. */
export async function shareNodeAsImage(node: HTMLElement, fileName: string, title: string) {
  const { toBlob } = await import("html-to-image");
  // 2x for a crisp image; white background so it never comes out transparent
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  if (!blob) throw new Error("Couldn't create the image");
  const file = new File([blob], `${fileName}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return "shared" as const;
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled" as const;
      throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded" as const;
}

/** A one-page PDF (A5, or A4 with `size`) of an element, as a File. */
export async function nodeToPdf(node: HTMLElement, fileName: string, size: "a5" | "a4" = "a5") {
  const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const png = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = png;
  });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: size });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  // Fit the width, then shrink further if it would run off the page
  let w = pageW - margin * 2;
  let h = (img.height / img.width) * w;
  if (h > pageH - margin * 2) {
    h = pageH - margin * 2;
    w = (img.width / img.height) * h;
  }
  pdf.addImage(png, "PNG", (pageW - w) / 2, margin, w, h, undefined, "FAST");
  pdf.setProperties({ title: fileName });
  return new File([pdf.output("blob")], `${fileName}.pdf`, { type: "application/pdf" });
}

/** Shares a file through the phone's share sheet when possible, else downloads it. */
export async function shareOrDownload(file: File, title: string, preferShare = true) {
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return "shared" as const;
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled" as const;
      throw err;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded" as const;
}

/** Whether this device can share files (phones, some desktops). */
export function canShareFiles() {
  try {
    return typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [new File([""], "x.pdf", { type: "application/pdf" })] }));
  } catch {
    return false;
  }
}

/** "Share image" button for any on-screen document. */
export function ShareImageButton({ nodeRef, fileName, title }: { nodeRef: RefObject<HTMLElement | null>; fileName: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    if (!nodeRef.current) return;
    setBusy(true);
    setNote(null);
    try {
      if ((await shareNodeAsImage(nodeRef.current, fileName, title)) === "downloaded") {
        setNote("Image downloaded. Attach it in WhatsApp Web or any chat.");
      }
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contents">
      <Button variant="secondary" onClick={share} loading={busy}>
        <Icon d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" />
        Share image
      </Button>
      {note && <p className="col-span-full text-xs text-muted">{note}</p>}
    </div>
  );
}

export const PRINT_ICON = "M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z";
