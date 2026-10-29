"use client";

import { useState, type RefObject } from "react";
import { errorMessage } from "./data";
import { PRINT_ICON, canShareFiles, nodeToPdf, shareNodeAsImage, shareOrDownload } from "./share";
import { Icon, Spinner } from "./ui";

const OPTIONS = [
  { key: "pdf", label: "Download PDF", icon: "M12 4v12M7 11l5 5 5-5M5 20h14" },
  { key: "share-pdf", label: "Share PDF", icon: "M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" },
  { key: "image", label: "Share image", icon: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01" },
  { key: "print", label: "Print", icon: PRINT_ICON },
] as const;
type Key = (typeof OPTIONS)[number]["key"];

/** PDF, image and print for any on-screen document (report cards, progress reports). */
export function DocShareBar({ docRef, fileName, title, paper = "a4" }: { docRef: RefObject<HTMLElement | null>; fileName: string; title: string; paper?: "a5" | "a4" }) {
  const [busy, setBusy] = useState<Key | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shareable] = useState(canShareFiles);

  async function handle(key: Key) {
    const node = docRef.current;
    if (!node) return;
    setBusy(key);
    setNote(null);
    try {
      if (key === "print") window.print();
      else if (key === "image") {
        if ((await shareNodeAsImage(node, fileName, title)) === "downloaded") setNote("Image downloaded. Attach it in WhatsApp Web or any chat.");
      } else if ((await shareOrDownload(await nodeToPdf(node, fileName, paper), title, key === "share-pdf")) === "downloaded") {
        setNote(key === "share-pdf" ? "PDF downloaded. Attach it in WhatsApp Web or email." : "PDF downloaded.");
      }
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">
        {OPTIONS.filter((o) => o.key !== "share-pdf" || shareable).map((o) => (
          <button
            key={o.key}
            onClick={() => handle(o.key)}
            disabled={busy !== null}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-2 py-2.5 text-xs font-medium transition-colors hover:bg-surface-muted disabled:opacity-60"
          >
            {busy === o.key ? <Spinner className="size-5" /> : <Icon d={o.icon} className="size-5 text-accent" />}
            {o.key === "image" && !shareable ? "Save image" : o.label}
          </button>
        ))}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
