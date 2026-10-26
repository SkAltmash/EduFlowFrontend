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
